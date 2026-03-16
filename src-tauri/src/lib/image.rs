use crate::domain::{
    CustomEvents, ImageBatchCompressionProgress, ImageBatchCompressionResult,
    ImageBatchIndividualCompressionResult, ImageCompressionConfig, ImageCompressionProgress,
    ImageCompressionResult,
};
use crate::ffmpeg::FFMPEG;
use crate::fs::get_file_metadata;
use image::ImageReader;
use img_parts::{
    jpeg::Jpeg,
    png::{Png, PngChunk},
    Bytes,
};
use log::error;
use oxipng::{optimize, Deflaters, InFile, Options, OutFile, StripChunks};
use shared_child::SharedChild;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::{
    process::{Command, Stdio},
    sync::Arc,
};
use tauri::{AppHandle, Emitter, Listener, Manager};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Copy)]
pub enum ImageContainer {
    Png,
    Jpeg,
}

pub const EXTENSIONS: [&str; 7] = ["png", "jpg", "jpeg", "webp", "gif", "heic", "svg"];

pub struct ImageCompressor {
    app: AppHandle,
    pngquant: Command,
    jpegoptim: Command,
    gifsicle: Command,
    assets_dir: PathBuf,
    ffmpeg: FFMPEG,
}

impl ImageCompressor {
    pub fn new(app: &tauri::AppHandle) -> Result<Self, String> {
        let ffmpeg = FFMPEG::new(app)?;

        let pngquant = match app.shell().sidecar("compresso_pngquant") {
            Ok(command) => Command::from(command),
            Err(err) => return Err(format!("[pngquant-sidecar]: {:?}", err.to_string())),
        };

        let jpegoptim = match app.shell().sidecar("compresso_jpegoptim") {
            Ok(command) => Command::from(command),
            Err(err) => return Err(format!("[jpegoptim-sidecar]: {:?}", err.to_string())),
        };

        let gifsicle = match app.shell().sidecar("compresso_gifsicle") {
            Ok(command) => Command::from(command),
            Err(err) => return Err(format!("[gifsicle-sidecar]: {:?}", err.to_string())),
        };

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
            pngquant,
            jpegoptim,
            gifsicle,
            assets_dir,
            ffmpeg,
        })
    }

    pub fn get_asset_dir(&self) -> String {
        self.assets_dir.display().to_string()
    }

    pub async fn compress_image(
        &mut self,
        image_path: &str,
        convert_to_extension: Option<&str>,
        quality: u8,
        image_id: &str,
        _batch_id: Option<&str>,
        strip_metadata: Option<bool>,
        is_lossless: Option<bool>,
    ) -> Result<ImageCompressionResult, String> {
        let original_path = Path::new(image_path);
        if !original_path.exists() {
            return Err(String::from("Image file does not exist."));
        }

        let original_metadata = get_file_metadata(image_path)?;
        let original_size = original_metadata.size;

        let extension = original_metadata.extension.to_lowercase();
        let output_extension = convert_to_extension.unwrap_or(&extension);

        let supported = EXTENSIONS.iter().any(|&ext| ext == output_extension);
        if !supported {
            return Err(format!(
                "Unsupported convert to extension: {}",
                output_extension
            ));
        }

        let output_filename = format!("{}.{}", image_id, output_extension);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&output_filename)]
            .iter()
            .collect();

        let temp_output_path = match extension.as_str() {
            "png" => {
                self.compress_png(
                    image_path,
                    quality,
                    image_id,
                    is_lossless.unwrap_or(true),
                    strip_metadata.unwrap_or_default(),
                )
                .await?
            }
            "jpg" | "jpeg" => {
                self.compress_jpeg(
                    image_path,
                    quality,
                    image_id,
                    is_lossless.unwrap_or(true),
                    strip_metadata.unwrap_or_default(),
                )
                .await?
            }
            "webp" => self.compress_webp(image_path, quality, image_id).await?,
            "gif" => {
                self.compress_gif(
                    image_path,
                    quality,
                    image_id,
                    is_lossless.unwrap_or(true),
                    strip_metadata.unwrap_or_default(),
                )
                .await?
            }
            "svg" => {
                self.compress_svg(
                    image_path,
                    quality,
                    image_id,
                    is_lossless.unwrap_or(true),
                    strip_metadata.unwrap_or_default(),
                )
                .await?
            }
            "heic" => output_path.clone(),
            _ => {
                return Err(format!(
                    "Unsupported source format: {}. Original file will be copied.",
                    extension
                ))
            }
        };

        let temp_path_clone = temp_output_path.clone();
        let final_output_path =
            if convert_to_extension.is_some() && convert_to_extension.unwrap() != &extension {
                self.ffmpeg
                    .convert_image(
                        &temp_output_path,
                        &output_path,
                        output_extension,
                        quality,
                        strip_metadata.unwrap_or(true),
                    )
                    .await?
            } else {
                temp_output_path
            };

        if temp_path_clone != final_output_path && temp_path_clone.exists() {
            std::fs::remove_file(&temp_path_clone).ok();
        }

        let compressed_metadata =
            get_file_metadata(&final_output_path.to_string_lossy().to_string())?;
        let compressed_size = compressed_metadata.size;

        Ok(ImageCompressionResult {
            image_id: image_id.to_string(),
            file_name: output_filename,
            file_path: final_output_path.display().to_string(),
            file_metadata: Some(compressed_metadata),
            original_size,
            compressed_size,
        })
    }

    async fn compress_png(
        &mut self,
        image_path: &str,
        quality: u8,
        image_id: &str,
        is_lossless: bool,
        strip_metadata: bool,
    ) -> Result<PathBuf, String> {
        let output_filename = format!("{}.png", image_id);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&output_filename)]
            .iter()
            .collect();

        if !is_lossless {
            std::fs::copy(image_path, &output_path).map_err(|e| e.to_string())?;

            let file_path_str = output_path.to_str().unwrap();

            let quality_str = quality.clamp(1, 100).to_string();

            let result = self
                .run_pngquant(&quality_str, file_path_str, image_path, strip_metadata)
                .await;

            match result {
                Err(e) => {
                    log::warn!(
                        "[image] pngquant attempt 1 failed: {}. Retrying with quality 0-{}...",
                        e,
                        quality
                    );

                    self.run_pngquant(
                        &format!("0-{}", quality),
                        file_path_str,
                        image_path,
                        strip_metadata,
                    )
                    .await
                }
                Ok(path) => {
                    return Ok(path);
                }
            }
        } else {
            let mut options = Options::default();

            options.deflate = Deflaters::Libdeflater { compression: 12 };
            options.optimize_alpha = true;

            options.strip = if strip_metadata {
                StripChunks::All
            } else {
                StripChunks::Safe
            };

            optimize(
                &InFile::Path(PathBuf::from(image_path)),
                &OutFile::Path {
                    path: Some(output_path.clone()),
                    preserve_attrs: !strip_metadata,
                },
                &options,
            )
            .map_err(|e| format!("PNG optimization failed: {:?}", e))?;

            if !strip_metadata {
                let _ = self.copy_image_metadata(
                    ImageContainer::Png,
                    image_path,
                    output_path.to_str().unwrap(),
                );
            }

            Ok(output_path)
        }
    }

    async fn run_pngquant(
        &mut self,
        quality_str: &str,
        output_path: &str,
        input_path: &str,
        strip_metadata: bool,
    ) -> Result<PathBuf, String> {
        let mut args: Vec<&str> = vec!["--quality", quality_str, "--force", "--strip"];

        args.push("--output");
        args.push(output_path);
        args.push(input_path);

        log::info!("[image] pngquant command: {:?}", args);

        let command = self
            .pngquant
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match SharedChild::spawn(command) {
            Ok(child) => {
                #[cfg(debug_assertions)]
                let stderr_output = child.take_stderr().and_then(|mut stderr| {
                    use std::io::Read;
                    let mut buffer = String::new();
                    let _ = stderr.read_to_string(&mut buffer);
                    Some(buffer)
                });
                #[cfg(not(debug_assertions))]
                let stderr_output = None;

                let cp = Arc::new(child);
                let cp_clone = cp.clone();

                tokio::spawn(async move {
                    let _ = cp_clone.wait();
                });

                match cp.wait() {
                    Ok(status) if status.success() => {
                        if !strip_metadata {
                            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                            let _ = self.copy_image_metadata(
                                ImageContainer::Png,
                                input_path,
                                output_path,
                            );
                        }
                        Ok(PathBuf::from(output_path))
                    }
                    Ok(_) => {
                        let error_msg = stderr_output.as_ref().map(|s| s.trim()).unwrap_or("");
                        if !error_msg.is_empty() {
                            Err(format!("pngquant failed: {}", error_msg))
                        } else {
                            Err(String::from("pngquant failed"))
                        }
                    }
                    Err(e) => Err(format!("pngquant error: {}", e)),
                }
            }
            Err(e) => Err(format!("Failed to run pngquant: {}", e)),
        }
    }

    async fn compress_jpeg(
        &mut self,
        image_path: &str,
        quality: u8,
        image_id: &str,
        is_lossless: bool,
        strip_metadata: bool,
    ) -> Result<PathBuf, String> {
        use std::process::Stdio;
        use std::sync::Arc;

        let output_filename = format!("{}.jpg", image_id);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&output_filename)]
            .iter()
            .collect();

        std::fs::copy(image_path, &output_path).map_err(|e| e.to_string())?;

        let jpeg_quality = quality.max(1).min(100).to_string();
        let file_path_str = output_path.to_str().unwrap();

        let mut args: Vec<&str> = vec!["-o", "-q", "--all-progressive", "--strip-all"];

        if is_lossless {
            args.push("--max=100");
        } else {
            args.push("-m");
            args.push(&jpeg_quality);
        }

        args.push(file_path_str);

        log::info!("[image] jpegoptim final command{:?}", args);

        let command = self
            .jpegoptim
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match SharedChild::spawn(command) {
            Ok(child) => {
                let cp = Arc::new(child);
                let cp_clone = cp.clone();

                tokio::spawn(async move {
                    let _ = cp_clone.wait();
                });

                match cp.wait() {
                    Ok(status) if status.success() => {
                        if !strip_metadata {
                            let _ = self.copy_image_metadata(
                                ImageContainer::Jpeg,
                                image_path,
                                file_path_str,
                            );
                        }
                        Ok(output_path)
                    }
                    Ok(_) => Err(String::from("jpegoptim failed")),
                    Err(e) => Err(format!("jpegoptim error: {}", e)),
                }
            }
            Err(e) => Err(format!("Failed to run jpegoptim: {}", e)),
        }
    }

    async fn compress_webp(
        &mut self,
        image_path: &str,
        quality: u8,
        image_id: &str,
    ) -> Result<PathBuf, String> {
        let output_filename = format!("{}.webp", image_id);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&output_filename)]
            .iter()
            .collect();

        let img = ImageReader::open(image_path)
            .map_err(|e| e.to_string())?
            .decode()
            .map_err(|e| e.to_string())?;

        let width = img.width();
        let height = img.height();
        let rgba: Vec<u8> = img.to_rgba8().into_raw();

        let encoder_quality = (quality as f32 / 100.0).clamp(0.0, 1.0);

        let encoder = webp::Encoder::from_rgb(&rgba, width, height);
        let webp_data = encoder.encode(encoder_quality);

        std::fs::write(&output_path, webp_data.to_vec()).map_err(|e| e.to_string())?;

        Ok(output_path)
    }

    async fn compress_gif(
        &mut self,
        image_path: &str,
        quality: u8,
        image_id: &str,
        is_lossless: bool,
        strip_metadata: bool,
    ) -> Result<PathBuf, String> {
        let output_filename = format!("{}.gif", image_id);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&output_filename)]
            .iter()
            .collect();

        if !is_lossless {
            let quality_param = quality.max(1).min(100);

            let lossy_arg = format!("--lossy={}", quality_param);
            let output_path_str = output_path.to_str().unwrap().to_string();

            let command = self
                .gifsicle
                .args(["-o", &lossy_arg, "--verbose", image_path, &output_path_str])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let child = SharedChild::spawn(command)
                .map_err(|e| format!("Failed to run gifsicle: {}", e))?;
            let cp = Arc::new(child);

            match cp.wait() {
                Ok(status) if status.success() => {}
                Ok(_) => return Err(String::from("gifsicle failed")),
                Err(e) => return Err(format!("gifsicle error: {}", e)),
            };
        } else {
            std::fs::copy(image_path, &output_path).map_err(|e| e.to_string())?;
        }

        Ok(output_path)
    }

    async fn compress_svg(
        &mut self,
        image_path: &str,
        quality: u8,
        image_id: &str,
        _is_lossless: bool,
        strip_metadata: bool,
    ) -> Result<PathBuf, String> {
        let output_filename = format!("{}.svg", image_id);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&output_filename)]
            .iter()
            .collect();

        let mut svg_content = std::fs::read_to_string(image_path).map_err(|e| e.to_string())?;

        if quality < 80 {
            svg_content = regex::Regex::new(r"<!--.*?-->")
                .map_err(|e| e.to_string())?
                .replace_all(&svg_content, "")
                .to_string();
        }

        svg_content = regex::Regex::new(r">\s+<")
            .map_err(|e| e.to_string())?
            .replace_all(&svg_content, "><")
            .to_string();

        svg_content = regex::Regex::new(r"<\?xml[^>]*\?>")
            .map_err(|e| e.to_string())?
            .replace_all(&svg_content, "")
            .to_string();
        svg_content = regex::Regex::new(r"<!DOCTYPE[^>]*>")
            .map_err(|e| e.to_string())?
            .replace_all(&svg_content, "")
            .to_string();

        if quality < 70 {
            let metadata_re = regex::Regex::new(r"<(title|desc|metadata)[^>]*>.*?</\1>")
                .map_err(|e| e.to_string())?;
            svg_content = metadata_re.replace_all(&svg_content, "").to_string();
        }

        std::fs::write(&output_path, svg_content).map_err(|e| e.to_string())?;

        Ok(output_path)
    }

    pub async fn compress_images_batch(
        &mut self,
        batch_id: &str,
        images: Vec<ImageCompressionConfig>,
    ) -> Result<ImageBatchCompressionResult, String> {
        let mut results: std::collections::HashMap<String, ImageCompressionResult> =
            std::collections::HashMap::new();
        let total_count = images.len();

        for (index, image_config) in images.iter().enumerate() {
            let image_id = &image_config.image_id;

            let app_clone = self.app.clone();
            let batch_id_clone = batch_id.to_string();
            let image_id_clone = image_id.clone();

            tokio::spawn(async move {
                if let Some(window) = app_clone.get_webview_window("main") {
                    let _ = window.clone().listen(
                        CustomEvents::ImageCompressionProgress.as_ref(),
                        move |evt| {
                            if let Ok(progress) =
                                serde_json::from_str::<ImageCompressionProgress>(evt.payload())
                            {
                                if progress.image_id == image_id_clone {
                                    let batch_progress = ImageBatchCompressionProgress {
                                        batch_id: batch_id_clone.to_owned(),
                                        current_index: index,
                                        total_count,
                                        image_progress: progress,
                                    };
                                    let _ = window.emit(
                                        CustomEvents::ImageBatchCompressionProgress.as_ref(),
                                        batch_progress,
                                    );
                                }
                            }
                        },
                    );
                }
            });

            let image_path = &image_config.image_path;
            let quality = image_config.quality;
            let convert_to_extension = image_config.convert_to_extension.as_deref();
            let strip_metadata = image_config.strip_metadata.unwrap_or(true);
            let is_lossless = image_config.is_lossless;

            match self
                .compress_image(
                    image_path,
                    convert_to_extension,
                    quality,
                    image_id,
                    Some(batch_id),
                    Some(strip_metadata),
                    is_lossless,
                )
                .await
            {
                Ok(result) => {
                    let image_id = result.image_id.clone();
                    results.insert(image_id.clone(), result.clone());

                    let app_clone2 = self.app.clone();
                    let batch_id_clone2 = batch_id.to_string();

                    tokio::spawn(async move {
                        if let Some(window) = app_clone2.get_webview_window("main") {
                            let individual_result = ImageBatchIndividualCompressionResult {
                                batch_id: batch_id_clone2,
                                result,
                            };
                            let _ = window.emit(
                                CustomEvents::ImageBatchIndividualCompressionCompletion.as_ref(),
                                individual_result,
                            );
                        }
                    });
                }
                Err(e) => {
                    error!("Failed to compress image at index {}: {}", index, e);
                }
            }
        }

        Ok(ImageBatchCompressionResult { results })
    }

    pub fn copy_image_metadata(
        &self,
        container: ImageContainer,
        src: &str,
        dst: &str,
    ) -> Result<(), String> {
        match container {
            ImageContainer::Png => {
                let src_bytes = fs::read(src).map_err(|err| err.to_string())?;
                let dst_bytes = fs::read(dst).map_err(|err| err.to_string())?;

                let src_png =
                    Png::from_bytes(Bytes::from(src_bytes)).map_err(|err| err.to_string())?;
                let mut dst_png =
                    Png::from_bytes(Bytes::from(dst_bytes)).map_err(|err| err.to_string())?;

                let metadata_kinds = [b"tEXt", b"zTXt", b"iTXt", b"iCCP", b"eXIf"];
                let mut chunks_to_keep: Vec<PngChunk> = Vec::new();

                for chunk in dst_png.chunks() {
                    let kind = chunk.kind();
                    let is_metadata = metadata_kinds.iter().any(|&mk| kind == *mk);
                    if !is_metadata {
                        chunks_to_keep.push(chunk.clone());
                    }
                }

                dst_png.chunks_mut().clear();
                for chunk in chunks_to_keep {
                    dst_png.chunks_mut().push(chunk);
                }

                for chunk in src_png.chunks() {
                    let kind = chunk.kind();
                    if kind == *b"tEXt"
                        || kind == *b"zTXt"
                        || kind == *b"iTXt"
                        || kind == *b"iCCP"
                        || kind == *b"eXIf"
                    {
                        dst_png
                            .chunks_mut()
                            .insert(1, PngChunk::new(kind, chunk.contents().clone()));
                    }
                }

                let encoded_bytes = dst_png.encoder().bytes();
                fs::write(dst, encoded_bytes).map_err(|err| err.to_string())?;
            }
            ImageContainer::Jpeg => {
                let src_bytes = fs::read(src).map_err(|err| err.to_string())?;
                let dst_bytes = fs::read(dst).map_err(|err| err.to_string())?;

                let src_jpeg =
                    Jpeg::from_bytes(Bytes::from(src_bytes)).map_err(|err| err.to_string())?;
                let mut dst_jpeg =
                    Jpeg::from_bytes(Bytes::from(dst_bytes)).map_err(|err| err.to_string())?;

                for segment in src_jpeg.segments() {
                    let marker = segment.marker();
                    if (0xE0..=0xEF).contains(&marker) || marker == 0xFE {
                        dst_jpeg.segments_mut().insert(1, segment.clone());
                    }
                }

                fs::write(dst, dst_jpeg.encoder().bytes()).map_err(|err| err.to_string())?;
            }
        }

        Ok(())
    }
}
