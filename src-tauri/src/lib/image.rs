use crate::domain::{
    CustomEvents, ImageBatchCompressionProgress, ImageBatchCompressionResult,
    ImageBatchIndividualCompressionResult, ImageCompressionConfig, ImageCompressionProgress,
    ImageCompressionResult,
};
use crate::ffmpeg::FFMPEG;
use crate::fs::get_file_metadata;
use image::ImageReader;
use imagequant::{Attributes, Image};
use log::error;
use oxipng::{optimize, optimize_from_memory, Deflaters, InFile, Options, OutFile, StripChunks};
use png::Encoder;
use rgb::RGBA8;
use shared_child::SharedChild;
use std::path::PathBuf;
use std::{
    path::Path,
    process::{Command, Stdio},
    sync::Arc,
};
use tauri::{AppHandle, Emitter, Listener, Manager};
use tauri_plugin_shell::ShellExt;

pub const EXTENSIONS: [&str; 7] = ["png", "jpg", "jpeg", "webp", "gif", "heic", "svg"];

/// Main image compressor struct
pub struct ImageCompressor {
    app: AppHandle,
    jpegoptim: Command,
    gifsicle: Command,
    assets_dir: PathBuf,
    ffmpeg: FFMPEG,
}

impl ImageCompressor {
    pub fn new(app: &tauri::AppHandle) -> Result<Self, String> {
        // First, create the ffmpeg instance
        let ffmpeg = FFMPEG::new(app)?;

        // Initialize jpegoptim sidecar
        let jpegoptim = match app.shell().sidecar("compresso_jpegoptim") {
            Ok(command) => Command::from(command),
            Err(err) => return Err(format!("[jpegoptim-sidecar]: {:?}", err.to_string())),
        };

        // Initialize gifsicle sidecar
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
            jpegoptim,
            gifsicle,
            assets_dir,
            ffmpeg,
        })
    }

    pub fn get_asset_dir(&self) -> String {
        self.assets_dir.display().to_string()
    }

    /// Compresses a single image
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
        log::info!(
            "Compressing image: path={}, convert_to={:?}, quality={}, id={}, strip_metadata={:?}, is_lossless={:?}",
            image_path,
            convert_to_extension,
            quality,
            image_id,
            strip_metadata,
            is_lossless
        );

        let original_path = Path::new(image_path);
        if !original_path.exists() {
            return Err(String::from("Image file does not exist."));
        }

        let original_metadata = get_file_metadata(image_path)?;
        let original_size = original_metadata.size;

        // Get the file extension
        let extension = original_metadata.extension.to_lowercase();
        let output_extension = convert_to_extension.unwrap_or(&extension);

        let supported = EXTENSIONS.iter().any(|&ext| ext == output_extension);
        if !supported {
            return Err(format!(
                "Unsupported convert to extension: {}",
                output_extension
            ));
        }

        // Generate output filename
        let output_filename = format!("{}.{}", image_id, output_extension);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&output_filename)]
            .iter()
            .collect();

        // First, compress the image in its original format
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
            "webp" => {
                self.compress_webp(
                    image_path,
                    quality,
                    image_id,
                    strip_metadata.unwrap_or_default(),
                )
                .await?
            }
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
            "heic" => {
                // For these formats, we'll convert them directly to the output format
                output_path.clone()
            }
            _ => {
                return Err(format!(
                    "Unsupported source format: {}. Original file will be copied.",
                    extension
                ))
            }
        };

        // If format conversion is needed, use ffmpeg
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

        // Clean up temp file if it's different from final output
        if temp_path_clone != final_output_path && temp_path_clone.exists() {
            std::fs::remove_file(&temp_path_clone).ok();
        }

        // Get compressed file metadata
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
        let output_path_clone = output_path.clone();

        if !is_lossless {
            let img = ImageReader::open(image_path)
                .map_err(|e| e.to_string())?
                .decode()
                .map_err(|e| e.to_string())?
                .to_rgba8();

            let width = img.width() as usize;
            let height = img.height() as usize;

            let pixels: Vec<RGBA8> = img
                .as_raw()
                .chunks_exact(4)
                .map(|p| RGBA8 {
                    r: p[0],
                    g: p[1],
                    b: p[2],
                    a: p[3],
                })
                .collect();

            let mut attrs = Attributes::new();

            attrs.set_quality(0, 100).map_err(|err| err.to_string())?;
            attrs.set_speed(1).map_err(|err| err.to_string())?;

            attrs.set_max_colors(256).map_err(|err| err.to_string())?;

            let mut q_image = Image::new(&attrs, pixels.into_boxed_slice(), width, height, 0.0)
                .map_err(|e| format!("imagequant Image::new error: {:?}", e))?;

            let mut quant_result = attrs
                .quantize(&mut q_image)
                .map_err(|e| format!("imagequant quantize error: {:?}", e))?;

            let (palette, indices) = quant_result
                .remapped(&mut q_image)
                .map_err(|e| format!("imagequant remapped error: {:?}", e))?;

            let mut png_bytes: Vec<u8> = Vec::new();
            let width: u32 = width.try_into().map_err(|_| "width too large for png")?;
            let height: u32 = height.try_into().map_err(|_| "height too large for png")?;
            let palette_bytes: Vec<u8> = palette.iter().flat_map(|c| vec![c.r, c.g, c.b]).collect();

            {
                let mut encoder = Encoder::new(&mut png_bytes, width, height);
                encoder.set_color(png::ColorType::Indexed);
                encoder.set_depth(png::BitDepth::Eight);
                encoder.set_palette(&palette_bytes);

                let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
                writer
                    .write_image_data(&indices)
                    .map_err(|e| e.to_string())?;
            }

            let mut options = Options::default();
            options.deflate = Deflaters::Libdeflater { compression: 12 };
            options.strip = if strip_metadata {
                StripChunks::All
            } else {
                StripChunks::Safe
            };

            let optimized = optimize_from_memory(&png_bytes, &options)
                .map_err(|e| format!("PNG optimization failed: {:?}", e))?;

            std::fs::write(&output_path, optimized).map_err(|e| e.to_string())?;
        } else {
            let mut options = Options::default();

            options.deflate = Deflaters::Libdeflater { compression: 12 };

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
        }

        Ok(output_path_clone)
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

        let jpeg_quality = quality.clamp(1, 100).to_string();
        let file_path_str = output_path.to_str().unwrap();

        let mut args: Vec<&str> = vec!["-o", "-q", "--all-progressive"];

        if strip_metadata {
            args.push("--strip-all");
        }

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
                    Ok(status) if status.success() => Ok(output_path),
                    Ok(_) => Err(String::from("jpegoptim failed")),
                    Err(e) => Err(format!("jpegoptim error: {}", e)),
                }
            }
            Err(e) => Err(format!("Failed to run jpegoptim: {}", e)),
        }
    }

    /// Compresses a WebP image
    async fn compress_webp(
        &mut self,
        image_path: &str,
        quality: u8,
        image_id: &str,
        strip_metadata: bool,
    ) -> Result<PathBuf, String> {
        let output_filename = format!("{}.webp", image_id);
        let output_path: PathBuf = [self.assets_dir.clone(), PathBuf::from(&output_filename)]
            .iter()
            .collect();

        // Load the image
        let img = ImageReader::open(image_path)
            .map_err(|e| e.to_string())?
            .decode()
            .map_err(|e| e.to_string())?;

        let width = img.width();
        let height = img.height();
        let rgba: Vec<u8> = img.to_rgba8().into_raw();

        // Calculate WebP encoder quality (0.0-1.0 float)
        let encoder_quality = (quality as f32 / 100.0).clamp(0.0, 1.0);

        // Create WebP encoder
        let encoder = webp::Encoder::from_rgb(&rgba, width, height);
        let webp_data = encoder.encode(encoder_quality);

        std::fs::write(&output_path, webp_data.to_vec()).map_err(|e| e.to_string())?;

        Ok(output_path)
    }

    /// Compresses a GIF image
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
            // Lossy compression using gifsicle
            // Quality (1-100) - lower values = more aggressive optimization
            let quality_param = quality.max(1).min(100);

            // Lossy flags - create owned Strings to avoid borrow issues
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
            // Lossless compression - just copy the file for now
            // TODO: Implement proper lossless GIF optimization using gif-encoder crate
            std::fs::copy(image_path, &output_path).map_err(|e| e.to_string())?;
        }

        Ok(output_path)
    }

    /// Compresses an SVG image using basic SVG optimization
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

        // Basic SVG optimization
        // Remove comments
        if quality < 80 {
            svg_content = regex::Regex::new(r"<!--.*?-->")
                .map_err(|e| e.to_string())?
                .replace_all(&svg_content, "")
                .to_string();
        }

        // Remove unnecessary whitespace between tags
        svg_content = regex::Regex::new(r">\s+<")
            .map_err(|e| e.to_string())?
            .replace_all(&svg_content, "><")
            .to_string();

        // Remove XML declaration and DOCTYPE if present
        svg_content = regex::Regex::new(r"<\?xml[^>]*\?>")
            .map_err(|e| e.to_string())?
            .replace_all(&svg_content, "")
            .to_string();
        svg_content = regex::Regex::new(r"<!DOCTYPE[^>]*>")
            .map_err(|e| e.to_string())?
            .replace_all(&svg_content, "")
            .to_string();

        // Remove metadata elements for higher compression
        if quality < 70 {
            let metadata_re = regex::Regex::new(r"<(title|desc|metadata)[^>]*>.*?</\1>")
                .map_err(|e| e.to_string())?;
            svg_content = metadata_re.replace_all(&svg_content, "").to_string();
        }

        std::fs::write(&output_path, svg_content).map_err(|e| e.to_string())?;

        Ok(output_path)
    }

    /// Compresses images in batch
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

            // Compress the image
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

                    // Emit completion event
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
}
