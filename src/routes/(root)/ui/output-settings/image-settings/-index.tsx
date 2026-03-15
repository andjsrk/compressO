import { Divider } from '@heroui/react'

import CompressionQuality from './CompressionQuality'
import ImageExtension from './ImageExtension'
import ImageMetadata from './ImageMetadata'

type ImageSettingsProps = {
  mediaIndex: number
}

function ImageSettings({ mediaIndex }: ImageSettingsProps) {
  return (
    <div className="space-y-3 my-3">
      <div>
        <CompressionQuality mediaIndex={mediaIndex} />
        <Divider className="my-3" />
      </div>
      <div>
        <ImageMetadata mediaIndex={mediaIndex} />
        <Divider className="my-3" />
      </div>
      <div className="!mt-8">
        <ImageExtension mediaIndex={mediaIndex} />
      </div>
    </div>
  )
}

export default ImageSettings
