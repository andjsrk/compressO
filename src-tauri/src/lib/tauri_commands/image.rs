use crate::{
    domain::{ImageBatchCompressionResult, ImageCompressionConfig},
    fs::delete_stale_files,
    image,
};

#[tauri::command]
pub async fn compress_images_batch(
    app: tauri::AppHandle,
    batch_id: &str,
    images: Vec<ImageCompressionConfig>,
) -> Result<ImageBatchCompressionResult, String> {
    let mut image_compressor = image::ImageCompressor::new(&app)?;

    if let Ok(files) = delete_stale_files(
        image_compressor.get_asset_dir().as_str(),
        24 * 60 * 60 * 1000,
    )
    .await
    {
        log::debug!(
            "[main] Stale files deleted. Number of deleted files = {}",
            files.len()
        )
    };

    image_compressor
        .compress_images_batch(batch_id, images)
        .await
        .map(|result| Ok(result))
        .unwrap_or_else(|err| Err(err))
}

#[tauri::command]
pub async fn convert_svg_to_png(
    app: tauri::AppHandle,
    image_path: &str,
    image_id: &str,
) -> Result<String, String> {
    let image_compressor = image::ImageCompressor::new(&app)?;
    let output_path = image_compressor.convert_svg_to_png(image_path, image_id)?;
    Ok(output_path.to_string_lossy().to_string())
}
