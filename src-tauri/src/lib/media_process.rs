use crate::domain::{CancelInProgressCompressionPayload, CustomEvents, TauriEvents};
use regex::Regex;
use shared_child::SharedChild;
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command},
    sync::{Arc, Mutex},
};
use strum::EnumProperty;
use tauri::{AppHandle, Listener, Manager};

pub type FfmpegProgressCallback = Arc<dyn Fn(Option<String>) + Send + Sync>;

pub type CancelCallback = Arc<dyn Fn() + Send + Sync>;

pub struct MediaProcessExecutorBuilder {
    app: AppHandle,
    commands: Vec<Command>,
    cancel_ids: Vec<String>,
    cancel_callback: Option<CancelCallback>,
    ffmpeg_progress_callback: Option<FfmpegProgressCallback>,
    piped: bool,
}

impl MediaProcessExecutorBuilder {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            commands: Vec::new(),
            cancel_ids: Vec::new(),
            cancel_callback: None,
            ffmpeg_progress_callback: None,
            piped: false,
        }
    }

    pub fn command(mut self, cmd: Command) -> Self {
        self.commands.clear();
        self.commands.push(cmd);
        self
    }

    pub fn commands(mut self, cmds: Vec<Command>) -> Self {
        self.commands = cmds;
        self
    }

    pub fn with_cancel_support(
        mut self,
        cancel_ids: Vec<String>,
        cancel_callback: Option<CancelCallback>,
    ) -> Self {
        self.cancel_ids = cancel_ids;
        self.cancel_callback = cancel_callback;
        self
    }

    pub fn with_ffmpeg_progress_callback(mut self, callback: FfmpegProgressCallback) -> Self {
        self.ffmpeg_progress_callback = Some(callback);
        self
    }

    pub fn with_piped(mut self) -> Self {
        self.piped = true;
        self
    }

    pub fn build(self) -> Result<MediaProcessExecutor, String> {
        if self.commands.is_empty() {
            return Err("No command provided".to_string());
        }

        // Validate incompatible flag combinations
        if self.piped {
            if self.commands.len() < 2 {
                return Err("Piped mode requires at least 2 commands".to_string());
            }
            if self.ffmpeg_progress_callback.is_some() {
                return Err(
                    "FFmpeg progress callback is not compatible with piped mode. Piped mode consumes stdout for piping."
                        .to_string(),
                );
            }
        }

        Ok(MediaProcessExecutor {
            app: self.app,
            commands: self.commands,
            cancel_ids: self.cancel_ids,
            cancel_callback: self.cancel_callback,
            ffmpeg_progress_callback: self.ffmpeg_progress_callback,
            piped: self.piped,
        })
    }
}

pub struct MediaProcessExecutor {
    app: AppHandle,
    commands: Vec<Command>,
    cancel_ids: Vec<String>,
    cancel_callback: Option<CancelCallback>,
    ffmpeg_progress_callback: Option<FfmpegProgressCallback>,
    piped: bool,
}

impl MediaProcessExecutor {
    pub async fn spawn_and_wait(self) -> Result<ProcessExitStatus, String> {
        let (_stdout, exit_code) = self.spawn_and_wait_internal(false).await?;
        Ok(ProcessExitStatus { exit_code })
    }

    pub async fn spawn_and_wait_with_output(self) -> Result<ProcessOutput, String> {
        if self.piped {
            return Err(
                "Cannot capture stdout in piped mode. Stdout is consumed for piping between processes."
                    .to_string(),
            );
        }
        let (stdout_opt, exit_code) = self.spawn_and_wait_internal(true).await?;
        let stdout = stdout_opt.ok_or("Failed to capture stdout")?;
        Ok(ProcessOutput { stdout, exit_code })
    }

    async fn spawn_and_wait_internal(
        self,
        capture_stdout: bool,
    ) -> Result<(Option<String>, u8), String> {
        if self.piped {
            self.spawn_and_wait_piped(capture_stdout).await
        } else {
            self.spawn_and_wait_parallel(capture_stdout).await
        }
    }

    async fn spawn_and_wait_parallel(
        self,
        capture_stdout: bool,
    ) -> Result<(Option<String>, u8), String> {
        let mut processes: Vec<Arc<SharedChild>> = Vec::new();
        let mut event_ids: Vec<tauri::EventId> = Vec::new();
        let should_cancel = Arc::new(Mutex::new(false));
        let captured_stdout = Arc::new(Mutex::new(None));

        for mut cmd in self.commands {
            let child = SharedChild::spawn(&mut cmd).map_err(|e| e.to_string())?;
            let cp = Arc::new(child);
            processes.push(cp.clone());
        }

        let window = self
            .app
            .get_webview_window("main")
            .ok_or("Could not attach to main window")?;

        let destroy_id = window.listen(TauriEvents::Destroyed.get_str("key").unwrap(), {
            let processes = processes.clone();
            move |_| {
                log::info!("[tauri] window destroyed, killing processes");
                for proc in &processes {
                    proc.kill().ok();
                }
            }
        });
        event_ids.push(destroy_id);

        if !self.cancel_ids.is_empty() {
            let cancel_ids = self.cancel_ids.clone();
            let processes_clone = processes.clone();
            let should_cancel_clone = should_cancel.clone();

            let cancel_id = window.listen(
                CustomEvents::CancelInProgressCompression.as_ref(),
                move |evt| {
                    let payload_str = evt.payload();
                    let payload_opt: Option<CancelInProgressCompressionPayload> =
                        serde_json::from_str(payload_str).ok();

                    if let Some(payload) = payload_opt {
                        let matches = cancel_ids
                            .iter()
                            .any(|id| payload.ids.iter().any(|payload_id| payload_id == id));

                        if matches {
                            log::info!("Process execution requested to cancel");
                            for proc in &processes_clone {
                                proc.kill().ok();
                            }
                            let mut flag = should_cancel_clone.lock().unwrap();
                            *flag = true;
                        }
                    }
                },
            );
            event_ids.push(cancel_id);
        }

        // Log stderr from ALL processes
        #[cfg(debug_assertions)]
        for (idx, proc) in processes.iter().enumerate() {
            let proc_clone = proc.clone();
            tokio::spawn(async move {
                if let Some(stderr) = proc_clone.take_stderr() {
                    let mut reader = BufReader::new(stderr);
                    loop {
                        let mut buf: Vec<u8> = Vec::new();
                        match tauri::utils::io::read_line(&mut reader, &mut buf) {
                            Ok(n) => {
                                if n == 0 {
                                    break;
                                }
                                if let Ok(val) = std::str::from_utf8(&buf) {
                                    log::debug!("[media:process {}] stderr: {:?}", idx, val);
                                }
                            }
                            Err(_) => break,
                        }
                    }
                }
            });
        }

        let mut wait_handles: Vec<tokio::task::JoinHandle<u8>> = Vec::new();

        if capture_stdout {
            if let Some(proc) = processes.last() {
                let proc = proc.clone();
                let captured_stdout_clone = captured_stdout.clone();
                let handle = tokio::spawn(async move {
                    let mut json_str = String::new();
                    if let Some(stdout) = proc.take_stdout() {
                        let reader = std::io::BufReader::new(stdout);
                        for line_res in reader.lines() {
                            if let Ok(line) = line_res {
                                json_str.push_str(&line);
                            }
                        }
                    }
                    let mut captured = captured_stdout_clone.lock().unwrap();
                    *captured = Some(json_str);

                    match proc.wait() {
                        Ok(status) if status.success() => 0u8,
                        _ => 1u8,
                    }
                });
                wait_handles.push(handle);
            }
        }

        // Handle ffmpeg progress (only from FIRST process)
        if self.ffmpeg_progress_callback.is_some() {
            if let Some(proc) = processes.first() {
                let (tx, rx) = crossbeam_channel::unbounded::<Option<String>>();
                let proc = proc.clone();
                let callback = self.ffmpeg_progress_callback.clone().unwrap();

                tokio::spawn(async move {
                    while let Ok(current_duration) = rx.recv() {
                        callback(current_duration);
                    }
                });

                let handle = tokio::spawn(async move {
                    if let Some(stdout) = proc.take_stdout() {
                        let mut reader = BufReader::new(stdout);
                        loop {
                            let mut buf: Vec<u8> = Vec::new();
                            match tauri::utils::io::read_line(&mut reader, &mut buf) {
                                Ok(n) => {
                                    if n == 0 {
                                        break;
                                    }
                                    if let Ok(output) = std::str::from_utf8(&buf) {
                                        log::debug!("stdout: {:?}", output);
                                        let re =
                                            Regex::new("out_time=(?<out_time>.*?)\\n").unwrap();
                                        if let Some(cap) = re.captures(output) {
                                            let out_time = &cap["out_time"];
                                            if !out_time.is_empty() {
                                                tx.try_send(Some(String::from(out_time))).ok();
                                            }
                                        }
                                    }
                                }
                                Err(_) => break,
                            }
                        }
                    }

                    match proc.wait() {
                        Ok(status) if status.success() => 0u8,
                        _ => 1u8,
                    }
                });
                wait_handles.push(handle);
            }
        }

        // Spawn wait tasks for ALL processes that don't already have a wait handle
        for (idx, proc) in processes.iter().enumerate() {
            // Skip first process if it already has a wait handle (progress tracking)
            // Skip last process if it already has a wait handle (stdout capture)
            let has_handle = if capture_stdout && idx == processes.len() - 1 {
                true
            } else if self.ffmpeg_progress_callback.is_some() && idx == 0 {
                true
            } else {
                false
            };

            if !has_handle {
                let proc = proc.clone();
                let handle = tokio::spawn(async move {
                    match proc.wait() {
                        Ok(status) if status.success() => 0u8,
                        _ => 1u8,
                    }
                });
                wait_handles.push(handle);
            }
        }

        // Wait for ALL processes to complete and check for errors
        let mut final_exit_code = 0u8;
        for handle in wait_handles {
            match handle.await {
                Ok(code) => {
                    if code != 0 {
                        final_exit_code = code;
                    }
                }
                Err(e) => {
                    return Err(format!("Process execution failed: {}", e));
                }
            }
        }

        for event_id in event_ids {
            window.unlisten(event_id);
        }

        for proc in &processes {
            proc.kill().ok();
        }

        let is_cancelled = *should_cancel.lock().unwrap();
        if is_cancelled {
            if let Some(ref callback) = self.cancel_callback {
                callback();
            }
            return Err("CANCELLED".to_string());
        }

        let stdout = if capture_stdout {
            let captured = captured_stdout.lock().unwrap();
            captured.clone()
        } else {
            None
        };

        Ok((stdout, final_exit_code))
    }

    async fn spawn_and_wait_piped(
        self,
        _capture_stdout: bool,
    ) -> Result<(Option<String>, u8), String> {
        let mut processes: Vec<Child> = Vec::new();
        let mut event_ids: Vec<tauri::EventId> = Vec::new();
        let should_cancel = Arc::new(Mutex::new(false));
        let processes_shared = Arc::new(Mutex::new(Vec::<Child>::new()));

        // Spawn processes sequentially with stdout -> stdin piping
        let mut previous_stdout: Option<std::process::ChildStdout> = None;
        let command_count = self.commands.len();

        for (idx, mut cmd) in self.commands.into_iter().enumerate() {
            // Configure stdin/stdout for piping
            if idx > 0 {
                // All processes except the first get stdin from previous process's stdout
                if let Some(stdout) = previous_stdout {
                    cmd.stdin(stdout);
                    log::debug!(
                        "[media_process] Connecting stdin of process {} to previous stdout",
                        idx
                    );
                } else {
                    return Err(format!(
                        "Process {} expects stdin but no previous stdout available",
                        idx
                    ));
                }
            }

            // All processes except the last need piped stdout
            if idx < command_count - 1 {
                cmd.stdout(std::process::Stdio::piped());
            }

            // Spawn the process
            let mut child = cmd.spawn().map_err(|e| {
                // Kill any previously spawned processes on error
                let mut processes = processes_shared.lock().unwrap();
                for process in processes.iter_mut() {
                    process.kill().ok();
                }
                format!("Failed to spawn process {}: {}", idx, e)
            })?;

            // Take stdout for next process (except for the last one)
            if idx < command_count - 1 {
                previous_stdout = child.stdout.take();
                if previous_stdout.is_none() {
                    // Kill spawned processes and return error
                    let mut processes = processes_shared.lock().unwrap();
                    for process in processes.iter_mut() {
                        process.kill().ok();
                    }
                    return Err(format!(
                        "Process {} does not have piped stdout, cannot continue pipe chain",
                        idx
                    ));
                }
            } else {
                // Last process - drop any stdout reference
                previous_stdout = None;
            }

            processes.push(child);
            log::debug!(
                "[media_process] Piped processes spawned process {} successfully",
                idx
            );
        }

        // Move processes into shared container for closures
        *processes_shared.lock().unwrap() = processes;
        let process_count = processes_shared.lock().unwrap().len();

        let window = self
            .app
            .get_webview_window("main")
            .ok_or("Could not attach to main window")?;

        let destroy_id = window.listen(TauriEvents::Destroyed.get_str("key").unwrap(), {
            let processes_shared = processes_shared.clone();
            move |_| {
                log::info!("[media_process] window destroyed, killing piped processes");
                let mut processes = processes_shared.lock().unwrap();
                for process in processes.iter_mut() {
                    process.kill().ok();
                }
            }
        });
        event_ids.push(destroy_id);

        if !self.cancel_ids.is_empty() {
            let cancel_ids = self.cancel_ids.clone();
            let should_cancel_clone = should_cancel.clone();
            let processes_shared_clone = processes_shared.clone();

            let cancel_id = window.listen(
                CustomEvents::CancelInProgressCompression.as_ref(),
                move |evt| {
                    let payload_str = evt.payload();
                    let payload_opt: Option<CancelInProgressCompressionPayload> =
                        serde_json::from_str(payload_str).ok();

                    if let Some(payload) = payload_opt {
                        let matches = cancel_ids
                            .iter()
                            .any(|id| payload.ids.iter().any(|payload_id| payload_id == id));

                        if matches {
                            log::info!("Piped process execution requested to cancel");
                            let mut processes = processes_shared_clone.lock().unwrap();
                            for process in processes.iter_mut() {
                                process.kill().ok();
                            }
                            let mut flag = should_cancel_clone.lock().unwrap();
                            *flag = true;
                        }
                    }
                },
            );
            event_ids.push(cancel_id);
        }

        // Log stderr from ALL processes
        #[cfg(debug_assertions)]
        {
            let procs = processes_shared.lock().unwrap();
            for (idx, _proc) in procs.iter().enumerate() {
                // Note: Child doesn't have take_stderr(), so we can't log stderr in piped mode
                // This is a limitation of using Child instead of SharedChild
                log::debug!(
                    "[media_process] Process {} stderr logging not available in piped mode",
                    idx
                );
            }
        }

        // Take processes out of shared container for waiting
        let processes = std::mem::take(&mut *processes_shared.lock().unwrap());

        // Wait for ALL processes to complete
        let mut final_exit_code = 0u8;
        let mut all_success = true;

        for (idx, mut proc) in processes.into_iter().enumerate() {
            log::debug!("[media_process] Waiting for process {} to complete", idx);

            match proc.wait() {
                Ok(status) if status.success() => {
                    log::debug!("[media_process] Process {} completed successfully", idx);
                }
                Ok(status) => {
                    log::error!(
                        "[media_process] Process {} failed with exit code: {:?}",
                        idx,
                        status.code()
                    );
                    all_success = false;
                    final_exit_code = status.code().unwrap_or(1) as u8;
                    // Note: Remaining processes will be killed when the function returns
                    break;
                }
                Err(e) => {
                    log::error!("[media_process] Process {} wait failed: {}", idx, e);
                    all_success = false;
                    final_exit_code = 1;
                    // Note: Remaining processes will be killed when the function returns
                    break;
                }
            }
        }

        for event_id in event_ids {
            window.unlisten(event_id);
        }

        let is_cancelled = *should_cancel.lock().unwrap();
        if is_cancelled {
            if let Some(ref callback) = self.cancel_callback {
                callback();
            }
            return Err("CANCELLED".to_string());
        }

        if !all_success {
            return Err("Piped process chain failed".to_string());
        }

        log::info!(
            "[media_process] All {} processes completed successfully",
            process_count
        );
        Ok((None, final_exit_code))
    }
}

pub struct ProcessExitStatus {
    exit_code: u8,
}

impl ProcessExitStatus {
    pub fn success(&self) -> bool {
        self.exit_code == 0
    }

    pub fn code(&self) -> u8 {
        self.exit_code
    }
}

pub struct ProcessOutput {
    pub stdout: String,
    exit_code: u8,
}

impl ProcessOutput {
    pub fn success(&self) -> bool {
        self.exit_code == 0
    }

    pub fn code(&self) -> u8 {
        self.exit_code
    }
}
