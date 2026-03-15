use serde::{Deserialize, Serialize};
use serde_json::Value;
use strum::{AsRefStr, EnumProperty};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TrimSegment {
    pub start: f64,
    pub end: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompressionResult {
    pub video_id: String,
    pub file_name: String,
    pub file_path: String,
    pub file_metadata: Option<FileMetadata>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub path: String,
    pub file_name: String,
    pub mime_type: String,
    pub extension: String,
    pub size: u64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoCompressionProgress {
    pub video_id: String,
    pub batch_id: String,
    pub file_name: String,
    pub current_duration: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoThumbnail {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
}

#[derive(Clone, AsRefStr)]
pub enum CustomEvents {
    VideoCompressionProgress,
    CancelInProgressCompression,
    BatchCompressionProgress,
    BatchCompressionIndividualCompressionCompletion,
    ImageCompressionProgress,
    ImageBatchCompressionProgress,
    ImageBatchIndividualCompressionCompletion,
}

#[derive(EnumProperty)]
pub enum TauriEvents {
    #[strum(props(key = "tauri://destroyed"))]
    Destroyed,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelInProgressCompressionPayload {
    pub media_id: String,
    pub batch_id: Option<String>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub duration: Option<f64>,
    pub dimensions: Option<(u32, u32)>,
    pub fps: Option<f32>,
}

#[derive(Serialize, Deserialize)]
pub struct ImageInfo {
    pub dimensions: Option<(u32, u32)>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoCoordinates {
    pub top: u32,
    pub left: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoFlip {
    pub horizontal: bool,
    pub vertical: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoTransforms {
    pub crop: VideoCoordinates,
    pub rotate: i32,
    pub flip: VideoFlip,
}

use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCompressionResult {
    pub results: HashMap<String, CompressionResult>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchCompressionProgress {
    pub batch_id: String,
    pub current_index: usize,
    pub total_count: usize,
    pub video_progress: VideoCompressionProgress,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchCompressionIndividualCompressionResult {
    pub batch_id: String,
    pub result: CompressionResult,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoFileMetadata {
    pub id: String,
    pub file_name: String,
    pub path: String,
    pub size: u64,
    pub thumbnail_path: Option<String>,
    pub duration: Option<String>,
    pub dimensions: Option<(u32, u32)>,
    pub fps: Option<f32>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoWithPath {
    pub video_path: String,
    pub video_id: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoCompressionConfig {
    pub video_id: String,
    pub video_path: String,
    pub convert_to_extension: String,
    pub preset_name: Option<String>,
    pub audio_config: AudioConfig,
    pub quality: u16,
    pub dimensions: Option<(u32, u32)>,
    pub fps: Option<String>,
    pub video_codec: Option<String>,
    pub transforms_history: Option<Vec<Value>>,
    pub metadata_config: Option<VideoMetadataConfig>,
    pub custom_thumbnail_path: Option<String>,
    pub should_enable_custom_thumbnail: Option<bool>,
    pub trim_segments: Option<Vec<TrimSegment>>,
    pub subtitles_config: Option<SubtitlesConfig>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadataConfig {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<String>,
    pub comment: Option<String>,
    pub description: Option<String>,
    pub synopsis: Option<String>,
    pub genre: Option<String>,
    pub copyright: Option<String>,
    pub creation_time: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleConfig {
    pub subtitle_path: Option<String>,
    pub language: String,
    pub file_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SubtitlesConfig {
    pub subtitles: Vec<SubtitleConfig>,
    pub should_enable_subtitles: Option<bool>,
    pub preserve_existing_subtitles: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MonoSource {
    pub left: bool,
    pub right: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AudioChannelConfig {
    pub channel_layout: Option<String>,
    pub mono_source: Option<MonoSource>,
    pub stereo_swap_channels: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AudioConfig {
    pub volume: u16,
    pub audio_channel_config: Option<AudioChannelConfig>,
    pub bitrate: Option<u32>,
    pub audio_codec: Option<String>,
    pub selected_audio_tracks: Option<Vec<usize>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VideoStream {
    pub codec: String,
    pub codec_long_name: String,
    pub profile: String,
    pub codec_type: String,

    pub width: u32,
    pub height: u32,
    pub coded_width: u32,
    pub coded_height: u32,

    pub r_frame_rate: String,
    pub avg_frame_rate: String,

    pub pix_fmt: String,
    pub color_space: Option<String>,
    pub color_range: Option<String>,
    pub color_primaries: Option<String>,
    pub color_transfer: Option<String>,
    pub chroma_location: Option<String>,

    pub bit_rate: Option<String>,
    pub duration: Option<String>,

    pub nb_frames: Option<String>,
    pub refs: Option<u32>,

    pub gop_size: Option<u32>,
    pub level: Option<u32>,

    pub field_order: String,
    pub time_base: String,
    pub rotation: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AudioStream {
    pub codec: String,
    pub codec_long_name: String,
    pub codec_type: String,
    pub profile: Option<String>,

    pub channels: String,
    pub channel_layout: String,

    pub sample_rate: String,
    pub sample_fmt: Option<String>,
    pub bits_per_sample: Option<u32>,

    pub bit_rate: Option<String>,
    pub duration: Option<String>,

    pub language: Option<String>,

    pub tags: Option<Vec<(String, String)>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleStream {
    pub index: u32,
    pub codec: String,
    pub codec_long_name: String,
    pub codec_type: String,
    pub language: Option<String>,
    pub title: Option<String>,
    pub disposition: Disposition,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Disposition {
    pub default: bool,
    pub forced: bool,
    pub attached_pic: bool,
    pub comment: bool,
    pub karaoke: bool,
    pub lyrics: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    pub id: u64,
    pub time_base: String,
    pub start: f64,
    pub end: f64,
    pub title: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ContainerInfo {
    pub filename: String,
    pub format_name: String,
    pub format_long_name: String,
    pub duration: Option<f64>,
    pub size: u64,
    pub bit_rate: Option<u64>,
    pub nb_streams: u32,
    pub tags: Option<Vec<(String, String)>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub is_update_available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub body: Option<String>,
    pub date: Option<String>,
}

// Image compression types
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImageCompressionProgress {
    pub image_id: String,
    pub batch_id: String,
    pub file_name: String,
    pub progress: f32, // 0.0 to 1.0
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImageCompressionResult {
    pub image_id: String,
    pub file_name: String,
    pub file_path: String,
    pub file_metadata: Option<FileMetadata>,
    pub original_size: u64,
    pub compressed_size: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImageCompressionConfig {
    pub image_id: String,
    pub image_path: String,
    pub convert_to_extension: Option<String>,
    pub is_lossless: Option<bool>,
    pub quality: u8, // 0-100
    pub webp_quality: Option<u8>,
    pub gif_quality: Option<GifQuality>,
    pub strip_metadata: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GifQuality {
    pub quality: u8, // 1-100
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fast: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageBatchCompressionResult {
    pub results: std::collections::HashMap<String, ImageCompressionResult>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageBatchCompressionProgress {
    pub batch_id: String,
    pub current_index: usize,
    pub total_count: usize,
    pub image_progress: ImageCompressionProgress,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageBatchIndividualCompressionResult {
    pub batch_id: String,
    pub result: ImageCompressionResult,
}
