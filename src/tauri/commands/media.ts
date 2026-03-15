import { core } from '@tauri-apps/api'

import {
  BatchCompressionResult,
  ImageCompressionConfig,
  VideoCompressionConfig,
} from '@/types/compression'

export async function compressMediaBatch(
  batchId: string,
  media: {
    videoConfig?: VideoCompressionConfig
    imageConfig?: ImageCompressionConfig
  }[],
): Promise<BatchCompressionResult> {
  console.log(
    'final compression config',
    media,
    media.filter((m) => m.imageConfig != null).map((v) => v.imageConfig),
  )
  try {
    const rs = await core.invoke('compress_images_batch', {
      batchId,
      images: media
        .filter((m) => m.imageConfig != null)
        .map((m) => m.imageConfig),
    })
    console.log('result', rs)
  } catch (error) {
    console.log('>>', error)
  }
  return core.invoke('compress_media_batch', {
    batchId,
    media,
  })
}
