import { core, event } from '@tauri-apps/api'
import { useEffect, useRef } from 'react'
import { snapshot, useSnapshot } from 'valtio'

import {
  BatchCompressionIndividualCompressionResult,
  CustomEvents,
  VideoCompressionProgress,
} from '@/types/compression'
import { formatBytes } from '@/utils/fs'
import { convertDurationToMilliseconds } from '@/utils/string'
import { appProxy } from '../-state'

function CompressionProgress() {
  const {
    state: { batchId },
  } = useSnapshot(appProxy)

  const compressionProgressRef = useRef<event.UnlistenFn>()
  const individualCompressionResultRef = useRef<event.UnlistenFn>()

  useEffect(() => {
    if (batchId) {
      ;(async () => {
        if (compressionProgressRef.current) {
          compressionProgressRef.current?.()
        }
        compressionProgressRef.current =
          await event.listen<VideoCompressionProgress>(
            CustomEvents.VideoCompressionProgress,
            (evt) => {
              const payload = evt?.payload
              if (batchId === payload?.batchId) {
                const videos = snapshot(appProxy).state.videos
                const targetVideoIndex = videos.findIndex(
                  (v) => v.id === payload.videoId,
                )
                if (targetVideoIndex !== -1) {
                  appProxy.state.currentVideoIndex = targetVideoIndex
                  const videoDurationMilliseconds =
                    videos[targetVideoIndex].videoDurationMilliseconds
                  if (!(videoDurationMilliseconds == null)) {
                    const currentDurationInMilliseconds =
                      convertDurationToMilliseconds(payload?.currentDuration)
                    if (
                      currentDurationInMilliseconds > 0 &&
                      videoDurationMilliseconds >= currentDurationInMilliseconds
                    ) {
                      appProxy.state.videos[
                        targetVideoIndex
                      ].compressionProgress =
                        (currentDurationInMilliseconds * 100) /
                        videoDurationMilliseconds
                    }
                  }
                }
              }
            },
          )
      })()
      ;(async () => {
        if (individualCompressionResultRef.current) {
          individualCompressionResultRef.current?.()
        }
        individualCompressionResultRef.current =
          await event.listen<BatchCompressionIndividualCompressionResult>(
            CustomEvents.BatchCompressionIndividualCompressionCompletion,
            (evt) => {
              const payload = evt?.payload
              if (batchId === payload?.batchId && payload?.result) {
                const videos = snapshot(appProxy).state.videos
                const targetVideoIndex = videos.findIndex(
                  (v) => v.id === payload.result.videoId,
                )
                if (targetVideoIndex !== -1) {
                  const fileMetadata = payload?.result?.fileMetadata
                  appProxy.state.videos[targetVideoIndex].isProcessCompleted =
                    true
                  appProxy.state.videos[targetVideoIndex].isCompressing = false
                  appProxy.state.videos[targetVideoIndex].compressedVideo = {
                    isSuccessful: true,
                    fileName: fileMetadata?.fileName,
                    fileNameToDisplay: `${fileMetadata?.fileName?.slice(
                      0,
                      -((fileMetadata?.extension?.length ?? 0) + 1),
                    )}.${fileMetadata?.extension}`,
                    pathRaw: fileMetadata?.path,
                    path: core.convertFileSrc(fileMetadata?.path ?? ''),
                    mimeType: fileMetadata?.extension,
                    extension: fileMetadata?.extension,
                    size: formatBytes(fileMetadata?.size ?? 0),
                    sizeInBytes: fileMetadata?.size,
                  }
                }
              }
            },
          )
      })()
    }

    return () => {
      compressionProgressRef.current?.()
      individualCompressionResultRef.current?.()
    }
  }, [batchId])

  return null
}

export default CompressionProgress
