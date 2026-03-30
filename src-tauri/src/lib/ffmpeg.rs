use crate::domain::{
    AudioConfig, CompressionResult, TauriEvents, TrimSegment, VideoMetadataConfig, VideoThumbnail,
};
use crate::ffprobe::FFPROBE;
use crate::fs::get_file_metadata;
use crossbeam_channel::{Receiver, Sender};
use nanoid::nanoid;
use regex::Regex;
use serde_json::Value;
use shared_child::SharedChild;
use std::{
    io::BufReader,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
};
use strum::EnumProperty;
use tauri::{AppHandle, Listener, Manager};
use tauri_plugin_shell::ShellExt;

pub struct FFMPEG {
    app: AppHandle,
    ffmpeg: Command,
    assets_dir: PathBuf,
}

const EXTENSIONS: [&str; 5] = ["mp4", "mov", "webm", "avi", "mkv"];

impl FFMPEG {
    pub fn new(app: &tauri::AppHandle) -> Result<Self, String> {
        match app.shell().sidecar("compresso_ffmpeg") {
            Ok(command) => {
                let app_data_dir = match app.path().app_data_dir() {
                    Ok(path_buf) => path_buf,
                    Err(_) => {
                        return Err(String::from(
                            "Application app directory is not setup correctly.",
                        ));
                    }
                };
                let assets_dir: PathBuf = [PathBuf::from(&app_data_dir), PathBuf::from("assets")]
                    .iter()
                    .collect();

                Ok(Self {
                    app: app.to_owned(),
                    ffmpeg: Command::from(command),
                    assets_dir,
                })
            }
            Err(err) => Err(format!("[ffmpeg-sidecar]: {:?}", err.to_string())),
        }
    }

    /// Compresses a video from a path
    pub async fn compress_video(
        &mut self,
        video_path: &str,
        convert_to_extension: &str,
        preset_name: Option<&str>,
        video_id: &str,
        audio_config: &AudioConfig,
        quality: u16,
        fps: Option<&str>,
        video_codec: Option<&str>,
    ) -> Result<CompressionResult, String> {
        if !EXTENSIONS.contains(&convert_to_extension) {
            return Err(String::from("Invalid convert to extension."));
        }

        let audio_streams = {
            let mut ffprobe = FFPROBE::new(&self.app)?;
            ffprobe.get_audio_streams(video_path).await?
        };
        let has_audio_stream = !audio_streams.is_empty();

        let file_name = format!("{}.{}", video_id, convert_to_extension);

        let output_file: PathBuf = [self.assets_dir.clone(), PathBuf::from(&file_name)]
            .iter()
            .collect();

        let mut cmd_args: Vec<&str> = Vec::new();

        cmd_args.push("-i");
        cmd_args.push(video_path);

        // Preserve existing metadata
        cmd_args.extend_from_slice(&["-map_metadata", "0"]);

        cmd_args.extend_from_slice(&["-hide_banner"]);

        cmd_args.extend_from_slice(&[
            "-pix_fmt:v:0",
            "yuv420p",
            "-b:v:0",
            "0",
            "-movflags",
            "+faststart",
            "-preset",
            "slow",
        ]);

        // Codec
        let output_codec: String = {
            fn default_codec(convert_to_extension: &str) -> String {
                match convert_to_extension {
                    "webm" => "libvpx-vp9".to_string(),
                    _ => "libx264".to_string(),
                }
            }
            if let Some(codec) = video_codec {
                codec.to_string()
            } else {
                if preset_name.is_none() {
                    let source_streams = {
                        let mut ffprobe = FFPROBE::new(&self.app)?;
                        ffprobe.get_video_streams(video_path).await?
                    };

                    match source_streams.first() {
                        Some(stream) => stream.codec.clone(),
                        None => default_codec(convert_to_extension),
                    }
                } else {
                    default_codec(convert_to_extension)
                }
            }
        };
        cmd_args.extend_from_slice(&["-c:v:0", output_codec.as_str()]);

        // Quality
        let max_crf: u16 = 36;
        let min_crf: u16 = 24;
        let default_crf: u16 = 28;
        let compression_quality = if (0..=100).contains(&quality) {
            let diff = (max_crf - min_crf) - ((max_crf - min_crf) * quality) / 100;
            format!("{}", min_crf + diff)
        } else {
            format!("{default_crf}")
        };
        if preset_name.is_some() || (0..=100).contains(&quality) {
            cmd_args.extend_from_slice(&["-crf", compression_quality.as_str()]);
        }

        // Dimensions
        let padding = "pad=ceil(iw/2)*2:ceil(ih/2)*2";
        let video_post_process = padding.to_owned();

        let mut filter_complex_parts: Vec<String> = Vec::new();

        let channel_filter_str = if let Some(channel_config) = &audio_config.audio_channel_config
            && channel_config.stereo_swap_channels == Some(true)
        {
            "pan=stereo|c0=c1|c1=c0"
        } else {
            ""
        };

        let combined_audio_filter = channel_filter_str.to_string();

        // If no trimming, just apply post-processing to input
        filter_complex_parts.push(format!("[0:v]{}[outv]", video_post_process));

        let fc = filter_complex_parts.join(";").to_string();
        if !fc.is_empty() {
            cmd_args.extend_from_slice(&["-filter_complex", &fc]);
        }

        // FPS
        if let Some(fps_val) = fps {
            cmd_args.push("-r");
            cmd_args.push(fps_val);
        }

        // Map output video
        cmd_args.extend_from_slice(&["-map", "[outv]"]);

        let mut audio_args_owned: Vec<String> = Vec::new();

        // Map output audio
        if audio_config.volume > 0 && has_audio_stream {
            if let Some(ref selected_tracks) = audio_config.selected_audio_tracks {
                for &track_index in selected_tracks {
                    audio_args_owned.push("-map".to_string());
                    audio_args_owned.push(format!("0:a:{}", track_index));
                }
            } else {
                cmd_args.extend_from_slice(&["-map", "0:a?"]);
            }
        }

        // Audio filter
        let audio_filter_args: Vec<String> = {
            if has_audio_stream
                && (!combined_audio_filter.is_empty()
                    || (audio_config.volume > 0 && audio_config.volume != 100))
            {
                let mut args = vec![];
                if let Some(ref selected_tracks) = audio_config.selected_audio_tracks {
                    for &track_index in selected_tracks {
                        args.push(format!("-filter:a:{}", track_index));
                        args.push(combined_audio_filter.clone());
                    }
                } else {
                    for track_index in 0..audio_streams.len() {
                        args.push(format!("-filter:a:{}", track_index));
                        args.push(combined_audio_filter.clone());
                    }
                }
                args
            } else {
                vec![]
            }
        };
        audio_args_owned.extend(audio_filter_args);

        // Audio bitrate
        if audio_config.volume > 0
            && has_audio_stream
            && let Some(bitrate) = audio_config.bitrate
        {
            audio_args_owned.push("-b:a".to_string());
            audio_args_owned.push(format!("{}k", bitrate));
        }

        // Audio codec
        if audio_config.volume > 0
            && has_audio_stream
            && let Some(codec) = &audio_config.audio_codec
        {
            audio_args_owned.push("-c:a".to_string());
            audio_args_owned.push(codec.clone());
        }

        cmd_args.extend(audio_args_owned.iter().map(|s| s.as_str()));

        if audio_config.volume == 0 {
            cmd_args.push("-an");
        }

        // Output path
        let output_path = output_file.display().to_string();
        cmd_args.extend_from_slice(&["-y", &output_path]);

        log::info!("[ffmpeg] final command{:?}", cmd_args);

        let command = self
            .ffmpeg
            .args(cmd_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match SharedChild::spawn(command) {
            Ok(child) => {
                let cp = Arc::new(child);
                let cp_clone2 = cp.clone();
                let cp_clone3 = cp.clone();

                let window = match self.app.get_webview_window("main") {
                    Some(window) => window,
                    None => return Err(String::from("Could not attach to main window")),
                };
                let destroy_event_id =
                    window.listen(TauriEvents::Destroyed.get_str("key").unwrap(), move |_| {
                        log::info!("[tauri] window destroyed");
                        match cp.kill() {
                            Ok(_) => {
                                log::info!("[ffmpeg-sidecar] child process killed.");
                            }
                            Err(err) => {
                                log::error!(
                                    "[ffmpeg-sidecar] child process could not be killed {}",
                                    err.to_string()
                                );
                            }
                        }
                    });

                let should_cancel = Arc::new(Mutex::new(false));

                let thread: tokio::task::JoinHandle<u8> = tokio::spawn(async move {
                    if let Some(stdout) = cp_clone2.take_stdout() {
                        let mut reader = BufReader::new(stdout);
                        loop {
                            let mut buf: Vec<u8> = Vec::new();
                            match tauri::utils::io::read_line(&mut reader, &mut buf) {
                                Ok(n) => {
                                    if n == 0 {
                                        break;
                                    }
                                }
                                Err(_) => break,
                            }
                        }
                    }

                    match cp_clone2.wait() {
                        Ok(status) if status.success() => 0,
                        _ => 1,
                    }
                });

                let message: String = match thread.await {
                    Ok(exit_status) => {
                        if exit_status == 1 {
                            String::from("Video is corrupted.")
                        } else {
                            String::from("")
                        }
                    }
                    Err(err) => err.to_string(),
                };

                // Cleanup
                window.unlisten(destroy_event_id);
                match cp_clone3.kill() {
                    Ok(_) => {
                        log::info!("[ffmpeg-sidecar] child process killed.");
                    }
                    Err(err) => {
                        log::error!(
                            "[ffmpeg-sidecar] child process could not be killed {}",
                            err.to_string()
                        );
                    }
                }

                let is_cancelled = should_cancel.lock().unwrap();
                if *is_cancelled {
                    // Delete the partial output file
                    std::fs::remove_file(&output_file).ok();
                    return Err(String::from("CANCELLED"));
                }

                if !message.is_empty() {
                    return Err(message);
                }
            }
            Err(err) => {
                return Err(err.to_string());
            }
        };

        let file_metadata = get_file_metadata(&output_file.to_string_lossy());
        Ok(CompressionResult {
            video_id: video_id.to_owned(),
            file_name,
            file_path: output_file.display().to_string(),
            file_metadata: file_metadata.ok(),
        })
    }

    /// Generates a .jpeg thumbnail image from a video path
    pub async fn generate_video_thumbnail(
        &mut self,
        video_path: &str,
        timestamp: Option<&str>,
    ) -> Result<VideoThumbnail, String> {
        if !Path::exists(Path::new(video_path)) {
            return Err(String::from("File does not exist in given path."));
        }
        let id = nanoid!();
        let file_name = format!("{}.jpg", id);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&file_name)]
            .iter()
            .collect();

        let timestamp_value = timestamp.unwrap_or("00:00:01.00");

        let command = self.ffmpeg.args([
            "-ss",
            timestamp_value,
            "-i",
            video_path,
            "-vf",
            "scale=trunc(iw*sar/2)*2:ih,setsar=1",
            "-frames:v",
            "1",
            "-an",
            "-sn",
            &output_path.display().to_string(),
            "-y",
        ]);

        match SharedChild::spawn(command) {
            Ok(child) => {
                let cp = Arc::new(child);
                let cp_clone1 = cp.clone();
                let cp_clone2 = cp.clone();

                let window = match self.app.get_webview_window("main") {
                    Some(window) => window,
                    None => return Err(String::from("Could not attach to main window")),
                };
                let destroy_event_id = window.listen(
                    TauriEvents::Destroyed.get_str("key").unwrap(),
                    move |_| match cp.kill() {
                        Ok(_) => {
                            log::info!("[ffmpeg-sidecar] child process killed.");
                        }
                        Err(err) => {
                            log::error!(
                                "[ffmpeg-sidecar] child process could not be killed {}",
                                err.to_string()
                            );
                        }
                    },
                );

                let thread: tokio::task::JoinHandle<u8> = tokio::spawn(async move {
                    if cp_clone1.wait().is_ok() {
                        return 0;
                    }
                    1
                });

                let message: String = match thread.await {
                    Ok(exit_status) => {
                        if exit_status == 1 {
                            String::from("Video is corrupted.")
                        } else {
                            String::from("")
                        }
                    }
                    Err(err) => err.to_string(),
                };

                // Cleanup
                window.unlisten(destroy_event_id);
                match cp_clone2.kill() {
                    Ok(_) => {
                        log::info!("[ffmpeg-sidecar] child process killed.");
                    }
                    Err(err) => {
                        log::error!(
                            "[ffmpeg-sidecar] child process could not be killed {}",
                            err.to_string()
                        );
                    }
                }
                if !message.is_empty() {
                    return Err(message);
                }
            }
            Err(err) => return Err(err.to_string()),
        };
        Ok(VideoThumbnail {
            id,
            file_name,
            file_path: output_path.display().to_string(),
        })
    }

    /// Extracts a subtitle stream from a video file to a separate subtitle file
    pub async fn extract_subtitle(
        &mut self,
        video_path: &str,
        stream_index: u32,
        output_path: &str,
        output_format: &str,
    ) -> Result<String, String> {
        if !Path::exists(Path::new(video_path)) {
            return Err(String::from("File does not exist in given path."));
        }

        let output_path_buf = PathBuf::from(output_path);

        if let Some(parent_dir) = output_path_buf.parent()
            && !Path::exists(parent_dir)
        {
            return Err(String::from("Target directory does not exist."));
        }

        let mut ffprobe = FFPROBE::new(&self.app)?;
        let subtitle_streams = ffprobe.get_subtitle_streams(video_path).await?;

        let target_stream = match subtitle_streams.iter().find(|s| s.index == stream_index) {
            Some(stream) => stream,
            None => {
                let available_indices: Vec<u32> =
                    subtitle_streams.iter().map(|s| s.index).collect();
                return Err(format!(
                    "Subtitle stream with global index {} not found. Available subtitle stream indices: {:?}",
                    stream_index, available_indices
                ));
            }
        };

        let codec = &target_stream.codec;

        let subtitle_specific_index = subtitle_streams
            .iter()
            .position(|s| s.index == stream_index)
            .unwrap_or(0);

        let ffmpeg_codec = match output_format {
            "vtt" => "webvtt",
            _ => output_format,
        };

        if matches!(
            codec.as_str(),
            "hdmv_pgs_subtitle" | "dvd_subtitle" | "xsub"
        ) {
            return Err(format!(
                "Cannot extract subtitle: Codec '{}' cannot be converted to {}. This is an image-based subtitle format (e.g., Blu-ray PGS or DVD VobSub).",
                codec, output_format.to_uppercase()
            ));
        }

        let command = self
            .ffmpeg
            .args(["-i", video_path])
            .args(["-map", &format!("0:s:{}", subtitle_specific_index)])
            .args(["-c:s", ffmpeg_codec])
            .arg(&output_path_buf)
            .arg("-y")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match SharedChild::spawn(command) {
            Ok(child) => {
                let cp = Arc::new(child);

                match cp.wait() {
                    Ok(exit_status) => {
                        if exit_status.success() {
                            if Path::exists(&output_path_buf) {
                                Ok(output_path.to_string())
                            } else {
                                Err(String::from(
                                    "Failed to extract subtitle: Output file was not created.",
                                ))
                            }
                        } else {
                            Err(format!("Failed to extract subtitle (exit code {}). The subtitle may be in an unsupported format.", exit_status))
                        }
                    }
                    Err(err) => Err(format!("Failed to extract subtitle: {}", err)),
                }
            }
            Err(err) => Err(format!("Failed to extract subtitle: {}", err)),
        }
    }

    pub fn get_asset_dir(&self) -> String {
        self.assets_dir.display().to_string()
    }
}
