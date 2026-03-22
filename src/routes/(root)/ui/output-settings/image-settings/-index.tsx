import { Divider } from '@heroui/react'
import { useSnapshot } from 'valtio'

import { appProxy } from '@/routes/(root)/-state'
import { ImageExtension as ImageExtensionType } from '@/types/compression'
import CompressionQuality from './CompressionQuality'
import ImageExtension from './ImageExtension'
import ImageMetadata from './ImageMetadata'
import SvgConfig from './SvgConfig'
import SvgScaleFactor from './SvgScaleFactor'

type ImageSettingsProps = {
  mediaIndex: number
}

function ImageSettings({ mediaIndex }: ImageSettingsProps) {
  const {
    state: { media, commonConfigForBatchCompression },
  } = useSnapshot(appProxy)
  const image =
    media.length > 0 && mediaIndex >= 0 && media[mediaIndex].type == 'image'
      ? media[mediaIndex]
      : null
  const { config } = image ?? {}
  const { convertToExtension } =
    config ?? commonConfigForBatchCompression.imageConfig ?? {}

  return (
    <div className="space-y-3 my-3">
      <div>
        <CompressionQuality mediaIndex={mediaIndex} />
        <Divider className="my-3" />
      </div>

      {(['svg'] as ImageExtensionType[]).includes(
        image?.extension as ImageExtensionType,
      ) &&
      (['png', 'jpg', 'jpeg', 'webp'] as ImageExtensionType[]).includes(
        convertToExtension as ImageExtensionType,
      ) ? (
        <div>
          <SvgScaleFactor mediaIndex={mediaIndex} />
          <Divider className="my-3 !mt-6" />
        </div>
      ) : null}

      <div>
        <ImageMetadata mediaIndex={mediaIndex} />
        <Divider className="my-3" />
      </div>

      {convertToExtension === 'svg' ? (
        <div>
          <SvgConfig mediaIndex={mediaIndex} />
          <Divider className="my-3" />
        </div>
      ) : null}

      <div className="!mt-8">
        <ImageExtension mediaIndex={mediaIndex} />
      </div>
    </div>
  )
}

export default ImageSettings
