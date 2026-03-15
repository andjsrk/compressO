import { Button } from '@heroui/react'
import { core } from '@tauri-apps/api'
import { motion } from 'framer-motion'
import { cloneDeep } from 'lodash'
import { memo, useCallback } from 'react'
import { useSnapshot } from 'valtio'

import { zoomInTransition } from '@/utils/animation'
import { appProxy } from '../-state'
import PreviewSingleVideo from './PreviewSingleMedia'

function CustomizeMediaOnBatchActions() {
  const {
    state: { selectedMediaIndexForCustomization },
  } = useSnapshot(appProxy)

  const handleApplyVideoConfig = useCallback(() => {
    const selectedMediaIndexForCustomization =
      appProxy.state.selectedMediaIndexForCustomization
    if (selectedMediaIndexForCustomization >= 0) {
      appProxy.state.selectedMediaIndexForCustomization = -1

      if (
        appProxy.state.media[selectedMediaIndexForCustomization].type ===
        'video'
      ) {
        if (
          appProxy.state.media[selectedMediaIndexForCustomization]?.config
            ?.shouldTransformVideo &&
          appProxy.state.media[selectedMediaIndexForCustomization].config
            ?.transformVideoConfig?.previewUrl
        ) {
          appProxy.state.media[
            selectedMediaIndexForCustomization
          ].thumbnailPath =
            appProxy.state.media[
              selectedMediaIndexForCustomization
            ]?.config?.transformVideoConfig?.previewUrl
          appProxy.state.media[
            selectedMediaIndexForCustomization
          ].config.isVideoTransformEditMode = false
        }
      }
    }
  }, [])

  const handleResetVideoConfig = useCallback(() => {
    const selectedMediaIndexForCustomization =
      appProxy.state.selectedMediaIndexForCustomization
    if (selectedMediaIndexForCustomization >= 0) {
      const mediaSnapshot =
        appProxy.state.media[selectedMediaIndexForCustomization]
      if (mediaSnapshot?.type === 'video') {
        mediaSnapshot.thumbnailPath = core.convertFileSrc(
          mediaSnapshot.thumbnailPathRaw!,
        )
        mediaSnapshot.config = cloneDeep(
          appProxy.state.commonConfigForBatchCompression.videoConfig,
        )
        appProxy.state.media[selectedMediaIndexForCustomization].isConfigDirty =
          false
      } else if (mediaSnapshot?.type === 'image') {
        // TODO: Reset the thumbnail after adding transform image feature
        mediaSnapshot.config = cloneDeep(
          appProxy.state.commonConfigForBatchCompression.imageConfig,
        )
      }
      appProxy.state.media[selectedMediaIndexForCustomization].isConfigDirty =
        false
      appProxy.state.selectedMediaIndexForCustomization = -1
    }
  }, [])

  return (
    <>
      <div className="absolute top-0 right-0 bottom-0 left-0 w-full h-full z-[10] flex flex-col justify-center bg-white1 dark:bg-black1">
        <motion.div
          className="flex flex-col justify-center items-center"
          {...zoomInTransition}
        >
          <PreviewSingleVideo mediaIndex={selectedMediaIndexForCustomization} />
        </motion.div>
        <div className="flex items-center gap-2 absolute top-4 right-4">
          <Button
            size="sm"
            onPress={handleResetVideoConfig}
            color="danger"
            variant="flat"
            radius="md"
          >
            Reset
          </Button>
          <Button
            size="sm"
            variant="flat"
            radius="md"
            onPress={handleApplyVideoConfig}
          >
            Apply
          </Button>
        </div>
      </div>
    </>
  )
}

export default memo(CustomizeMediaOnBatchActions)
