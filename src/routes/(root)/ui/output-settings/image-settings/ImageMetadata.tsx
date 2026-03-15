import { useCallback } from 'react'
import { useSnapshot } from 'valtio'

import Switch from '@/components/Switch'
import { appProxy, normalizeBatchMediaConfig } from '../../../-state'

type ImageMetadataProps = {
  mediaIndex: number
}

const ImageMetadata = ({ mediaIndex }: ImageMetadataProps) => {
  const {
    state: {
      isCompressing,
      isProcessCompleted,
      media,
      commonConfigForBatchCompression,
      isLoadingMediaFiles,
    },
  } = useSnapshot(appProxy)
  const image =
    media.length > 0 && mediaIndex >= 0 && media[mediaIndex].type == 'image'
      ? media[mediaIndex]
      : null
  const { config } = image ?? {}
  const { stripMetadata } =
    config ?? commonConfigForBatchCompression.imageConfig ?? {}

  const handleValueChange = useCallback(
    (preserveMetadata: boolean) => {
      const shouldStripMetadata = !preserveMetadata
      if (
        mediaIndex >= 0 &&
        appProxy.state.media[mediaIndex].type === 'image' &&
        appProxy.state.media[mediaIndex]?.config
      ) {
        appProxy.state.media[mediaIndex].config.stripMetadata =
          shouldStripMetadata
        appProxy.state.media[mediaIndex].isConfigDirty = true
      } else {
        if (appProxy.state.media.length > 1) {
          appProxy.state.commonConfigForBatchCompression.imageConfig.stripMetadata =
            shouldStripMetadata
          normalizeBatchMediaConfig()
        }
      }
    },
    [mediaIndex],
  )

  const shouldDisableInput =
    media.length === 0 ||
    isCompressing ||
    isProcessCompleted ||
    isLoadingMediaFiles

  return (
    <Switch
      isSelected={!stripMetadata}
      onValueChange={handleValueChange}
      isDisabled={shouldDisableInput}
    >
      <p className="text-gray-600 dark:text-gray-400 text-sm mr-2 w-full">
        Preserve Metadata
      </p>
    </Switch>
  )
}

export default ImageMetadata
