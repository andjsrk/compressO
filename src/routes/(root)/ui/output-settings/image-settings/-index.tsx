import { Divider } from '@heroui/react'
import { useSnapshot } from 'valtio'

import { appProxy } from '@/routes/(root)/-state'
import { extensions } from '@/types/compression'
import CompressionQuality from './CompressionQuality'
import ImageExtension from './ImageExtension'
import ImageMetadata from './ImageMetadata'

type ImageSettingsProps = {
  mediaIndex: number
}

function ImageSettings({ mediaIndex }: ImageSettingsProps) {
  const {
    state: { media },
  } = useSnapshot(appProxy)
  const image =
    media.length > 0 && mediaIndex >= 0 && media[mediaIndex].type == 'image'
      ? media[mediaIndex]
      : null

  return (
    <div className="space-y-3 my-3">
      {!(['svg'] as (keyof typeof extensions.image)[]).includes(
        image?.extension as keyof typeof extensions.image,
      ) ? (
        <div>
          <CompressionQuality mediaIndex={mediaIndex} />
          <Divider className="my-3" />
        </div>
      ) : null}
      {mediaIndex >= 0 &&
      (
        ['png', 'jpg', 'jpeg', 'svg'] as (keyof typeof extensions.image)[]
      ).includes(image?.extension as keyof typeof extensions.image) ? (
        <div>
          <ImageMetadata mediaIndex={mediaIndex} />
          <Divider className="my-3" />
        </div>
      ) : null}
      {!(['gif'] as (keyof typeof extensions.image)[]).includes(
        image?.extension as keyof typeof extensions.image,
      ) ? (
        <div className="!mt-8">
          <ImageExtension mediaIndex={mediaIndex} />
        </div>
      ) : null}
    </div>
  )
}

export default ImageSettings
