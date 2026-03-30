use crate::{
    domain::{AudioConfig, CompressionResult, VideoInfo, VideoThumbnail},
    ffmpeg::{self},
    ffprobe,
    fs::delete_stale_files,
};
use std::path::Path;

#[tauri::command]
pub async fn compress_video(
    app: tauri::AppHandle,
    video_path: &str,
    convert_to_extension: &str,
    preset_name: Option<&str>,
    video_id: &str,
    audio_config: AudioConfig,
    quality: u16,
    fps: Option<&str>,
    video_codec: Option<&str>,
) -> Result<CompressionResult, String> {
    let mut ffmpeg = ffmpeg::FFMPEG::new(&app)?;
    if let Ok(files) =
        delete_stale_files(ffmpeg.get_asset_dir().as_str(), 24 * 60 * 60 * 1000).await
    {
        log::debug!(
            "[main] Stale files deleted. Number of deleted files = {}",
            files.len()
        )
    };
    match ffmpeg
        .compress_video(
            video_path,
            convert_to_extension,
            preset_name,
            video_id,
            &audio_config,
            quality,
            fps,
            video_codec,
        )
        .await
    {
        Ok(result) => Ok(result),
        Err(err) => Err(err),
    }
}

#[tauri::command]
pub async fn generate_video_thumbnail(
    app: tauri::AppHandle,
    video_path: &str,
    timestamp: Option<&str>,
) -> Result<VideoThumbnail, String> {
    let mut ffmpeg = ffmpeg::FFMPEG::new(&app)?;
    ffmpeg.generate_video_thumbnail(video_path, timestamp).await
}

#[tauri::command]
pub async fn get_video_info(app: tauri::AppHandle, video_path: &str) -> Result<VideoInfo, String> {
    let mut ffprobe = ffprobe::FFPROBE::new(&app)?;
    ffprobe.get_video_info(video_path).await
}

#[tauri::command]
pub async fn extract_subtitle(
    app: tauri::AppHandle,
    video_path: &str,
    stream_index: u32,
    output_path: &str,
    format: Option<&str>,
) -> Result<String, String> {
    let mut ffmpeg = ffmpeg::FFMPEG::new(&app)?;

    if !Path::new(video_path).exists() {
        return Err(String::from("Video file does not exist."));
    }

    let output_format = format.unwrap_or("srt");

    if !matches!(output_format, "srt" | "vtt") {
        return Err(format!("Unsupported output format '{}'. Supported formats: srt, vtt", output_format));
    }

    ffmpeg
        .extract_subtitle(video_path, stream_index, output_path, output_format)
        .await
}
