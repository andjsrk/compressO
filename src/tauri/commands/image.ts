import { core } from '@tauri-apps/api'

export async function convertSvgToPng(imagePath: string, imageId: string) {
  return await core.invoke<string>('convert_svg_to_png', {
    imagePath,
    imageId,
  })
}
