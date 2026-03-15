use crate::{
    domain::{
        AudioConfig, BatchCompressionResult, CompressionResult, SubtitlesConfig, TrimSegment,
        VideoCompressionConfig, VideoMetadataConfig, VideoThumbnail,
    },
    ffmpeg::{self},
    fs::delete_stale_files,
};
use serde_json::Value;
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
    dimensions: Option<(u32, u32)>,
    fps: Option<&str>,
    video_codec: Option<&str>,
    transforms_history: Option<Vec<Value>>,
    metadata_config: Option<VideoMetadataConfig>,
    custom_thumbnail_path: Option<&str>,
    trim_segments: Option<Vec<TrimSegment>>,
    subtitles_config: Option<SubtitlesConfig>,
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
            None,
            &audio_config,
            quality,
            dimensions,
            fps,
            video_codec,
            transforms_history.as_ref(),
            metadata_config.as_ref(),
            custom_thumbnail_path,
            trim_segments.as_ref(),
            subtitles_config.as_ref(),
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
pub async fn compress_videos_batch(
    app: tauri::AppHandle,
    batch_id: &str,
    videos: Vec<VideoCompressionConfig>,
) -> Result<BatchCompressionResult, String> {
    let mut ffmpeg = ffmpeg::FFMPEG::new(&app)?;
    if let Ok(files) =
        delete_stale_files(ffmpeg.get_asset_dir().as_str(), 24 * 60 * 60 * 1000).await
    {
        log::debug!(
            "[main] Stale files deleted. Number of deleted files = {}",
            files.len()
        )
    };
    ffmpeg
        .compress_videos_batch(batch_id, videos)
        .await
        .map(|result| Ok(result))
        .unwrap_or_else(|err| Err(err))
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
        return Err(format!(
            "Unsupported output format '{}'. Supported formats: srt, vtt",
            output_format
        ));
    }

    ffmpeg
        .extract_subtitle(video_path, stream_index, output_path, output_format)
        .await
}
