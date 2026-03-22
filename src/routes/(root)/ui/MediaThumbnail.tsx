import { Button } from '@heroui/react'
import { core } from '@tauri-apps/api'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PhotoView } from 'react-photo-view'
import { OnProgressProps } from 'react-player/base'
import { toast } from 'sonner'
import { useSnapshot } from 'valtio'
import { subscribeKey } from 'valtio/utils'

import Icon from '@/components/Icon'
import Image from '@/components/Image'
import ImageViewer from '@/components/ImageViewer'
import useTimelineEngine from '@/components/Timeline/useTimelineEngine'
import Tooltip from '@/components/Tooltip'
import VideoPlayer, { VideoPlayerRef } from '@/components/VideoPlayer'
import { generateVideoThumbnail } from '@/tauri/commands/ffmpeg'
import { copyFileToClipboard } from '@/tauri/commands/fs'
import VideoTrimmerTimeline, {
  rowIds,
  scales,
  VideoTrimmerTimelineRef,
} from '@/ui/VideoTrimmerTimeline'
import { formatDuration } from '@/utils/string'
import VideoTransformer from './VideoTransformer'
import { appProxy } from '../-state'

function pickRandomTimestamp(durationMs: number): string {
  const durationSeconds = durationMs / 1000
  // Avoid the first 5% and last 5% of the video to get more interesting frames
  const minSeconds = durationSeconds * 0.05
  const maxSeconds = durationSeconds * 0.95

  const randomSeconds = minSeconds + Math.random() * (maxSeconds - minSeconds)

  return formatDuration(randomSeconds)
}

type MediaThumbnailProps = {
  mediaIndex: number
}

function MediaThumbnail({ mediaIndex }: MediaThumbnailProps) {
  if (mediaIndex < 0) return

  const {
    state: { media },
  } = useSnapshot(appProxy)
  const mediaFile = media.length > 0 ? media[mediaIndex] : null
  const {
    type: mediaType,
    path: mediaPath,
    pathRaw: mediaPathRaw,
    compressedFile,
    isProcessCompleted,
  } = mediaFile ?? {}
  const {
    thumbnailPath: videoThumbnailPath,
    previewMode = 'video',
    videoDuration,
  } = mediaFile?.type === 'video' ? (mediaFile ?? {}) : {}
  const {
    shouldTransformVideo,
    isVideoTransformEditMode,
    trimConfig,
    isVideoTrimEditMode,
    shouldTrimVideo,
  } = mediaFile?.type === 'video' ? (mediaFile?.config ?? {}) : {}

  const playerRef = useRef<VideoPlayerRef | null>(null)
  const trimmerRef = useRef<VideoTrimmerTimelineRef | null>(null)
  const trimConfigSetDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const [isThumbnailRegenerating, setIsThumbnailRegenerating] = useState(false)
  const thumbnailCacheRef = useRef<Record<string, string>>({})
  const [isCopyingFrame, setIsCopyingFrame] = useState(false)

  const handleCopyCurrentFrame = useCallback(async () => {
    if (
      !mediaPathRaw ||
      !videoDuration ||
      !playerRef.current ||
      appProxy.state.media[mediaIndex].type !== 'video'
    ) {
      toast.error('Unable to copy frame')
      return
    }

    setIsCopyingFrame(true)
    try {
      const currentTime = playerRef.current.playerRef?.getCurrentTime?.() ?? 0

      const targetDuration =
        currentTime >= videoDuration
          ? currentTime - 0.02
          : currentTime <= 0
            ? 0.02
            : currentTime
      const timestamp = formatDuration(targetDuration)

      const result = await generateVideoThumbnail(mediaPathRaw, timestamp)

      await copyFileToClipboard(result.filePath)
      toast.success('Frame copied to clipboard')
    } catch {
      toast.error('Failed to copy frame to clipboard')
    } finally {
      setIsCopyingFrame(false)
    }
  }, [mediaPathRaw, videoDuration, mediaIndex])

  const handleRegenerateThumbnail = useCallback(
    async (timeStamp?: string, retries = 2, forced = false) => {
      if (
        appProxy.state.media[mediaIndex].type !== 'video' ||
        !mediaPathRaw ||
        !videoDuration ||
        (forced ? false : isThumbnailRegenerating)
      )
        return

      setIsThumbnailRegenerating(true)
      try {
        const result = await generateVideoThumbnail(
          mediaPathRaw,
          timeStamp ?? pickRandomTimestamp(videoDuration * 1000),
        )
        appProxy.state.media[mediaIndex].thumbnailPathRaw = result.filePath
        appProxy.state.media[mediaIndex].thumbnailPath = core.convertFileSrc(
          result.filePath,
        )
      } catch {
        if (retries > 0) {
          handleRegenerateThumbnail('00:00:01.00', retries - 1)
        }
      } finally {
        setIsThumbnailRegenerating(false)
      }
    },
    [mediaPathRaw, videoDuration, mediaIndex, isThumbnailRegenerating],
  )

  const seekPlayerTo = useCallback((time: number, onPausedOnly = true) => {
    if (playerRef.current?.playerRef) {
      const playbackState = playerRef.current.getPlaybackState()
      if (onPausedOnly) {
        playbackState === 'paused' && playerRef.current.playerRef.seekTo(time)
      } else {
        playerRef.current.playerRef.seekTo(time, 'seconds')
      }
    }
  }, [])

  const {
    setTime: setTimelineTime,
    autoScrollCursorToCurrentTime,
    refreshTimeline,
  } = useTimelineEngine({
    timelineState: trimmerRef,
    totalDuration: videoDuration ?? 0,
    onPlay: () => {
      playerRef.current?.playVideo?.()
    },
    onPause: () => {
      playerRef.current?.pauseVideo?.()
    },
    onEnd: () => {
      playerRef.current?.pauseVideo?.()
    },
    onSeek: seekPlayerTo,
  })

  useEffect(() => {
    let unsubscribeTransform: (() => void) | undefined

    if (
      appProxy.state.media[mediaIndex]?.type === 'video' &&
      appProxy.state.media[mediaIndex]?.config
    ) {
      unsubscribeTransform = subscribeKey(
        appProxy.state.media[mediaIndex].config,
        'isVideoTransformEditMode',
        async () => {
          const mediaSnapshot = appProxy.state.media[mediaIndex]
          if (
            (playerRef.current || trimmerRef.current) &&
            mediaSnapshot.type === 'video' &&
            mediaSnapshot.config.isVideoTransformEditMode
          ) {
            if (playerRef.current) {
              playerRef.current.pauseVideo()
            }
            const { pathRaw: mediaPathRaw } = mediaSnapshot
            const currentTime = playerRef.current
              ? playerRef.current.playerRef?.getCurrentTime?.()
              : trimmerRef.current?.getTime?.()
            if (currentTime && mediaPathRaw) {
              try {
                const targetDuration =
                  currentTime >= mediaSnapshot.videoDuration!
                    ? currentTime - 0.02
                    : currentTime <= 0
                      ? 0.02
                      : currentTime
                const timestamp = formatDuration(targetDuration)

                let thumbnailPath = thumbnailCacheRef.current[timestamp]

                if (!thumbnailPath) {
                  const result = await generateVideoThumbnail(
                    mediaPathRaw,
                    timestamp,
                  )

                  thumbnailPath = result.filePath
                  thumbnailCacheRef.current[timestamp] = thumbnailPath
                }

                mediaSnapshot.thumbnailPathRaw = thumbnailPath
                mediaSnapshot.thumbnailPath = core.convertFileSrc(thumbnailPath)
              } catch {}
            }
          }
        },
      )
    }
    return () => {
      unsubscribeTransform?.()
    }
  }, [mediaIndex])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <Clear thumbnail cache when video changes>
  useEffect(() => {
    thumbnailCacheRef.current = {}
  }, [mediaIndex])

  useEffect(() => {
    let unsubscribeTrim: (() => void) | undefined

    if (
      appProxy.state.media[mediaIndex]?.type === 'video' &&
      appProxy.state.media[mediaIndex]?.config
    ) {
      unsubscribeTrim = subscribeKey(
        appProxy.state.media[mediaIndex].config,
        'isVideoTrimEditMode',
        async () => {
          if (playerRef.current) {
            setTimeout(() => {
              if (playerRef?.current?.playerRef) {
                const currentTime =
                  playerRef?.current?.playerRef?.getCurrentTime?.()
                if (currentTime) {
                  setTimelineTime(currentTime)
                  autoScrollCursorToCurrentTime(scales, {
                    onlyOnOutOfView: false,
                  })
                }
              }
            }, 100)
            if (
              appProxy.state.media[mediaIndex].type === 'video' &&
              appProxy.state.media[mediaIndex].config.isVideoTrimEditMode
            ) {
              playerRef.current.pauseVideo()
            }
          }
        },
      )
    }
    return () => {
      unsubscribeTrim?.()
    }
  }, [mediaIndex, autoScrollCursorToCurrentTime, setTimelineTime])

  const showTrimmerLayout =
    shouldTrimVideo && isVideoTrimEditMode && !isProcessCompleted

  const showTransformerLayout =
    shouldTransformVideo && isVideoTransformEditMode && !isProcessCompleted

  const thumbnailPath =
    mediaFile?.type === 'video' ? videoThumbnailPath : mediaPath

  const imageToRenderSrc = isProcessCompleted
    ? mediaFile?.type === 'video' && mediaFile?.previewMode === 'image'
      ? mediaFile?.thumbnailPath!
      : mediaFile?.compressedFile?.path!
    : (thumbnailPath as string)

  return (
    <div className="relative w-full flex items-center justify-center">
      <div className="relative w-full px-4">
        {mediaType === 'video' &&
        previewMode === 'video' &&
        mediaPath &&
        (mediaFile?.isProcessCompleted
          ? mediaFile?.compressedFile?.extension !== 'gif'
          : true) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <VideoPlayer
              ref={playerRef}
              url={
                isProcessCompleted && compressedFile
                  ? compressedFile?.path!
                  : mediaPath!
              }
              enableTimelinePlayer={
                !(
                  showTrimmerLayout ||
                  showTransformerLayout ||
                  isProcessCompleted
                )
              }
              progressInterval={10}
              controls={false}
              playPauseOnSpaceKeydown={!showTransformerLayout}
              autoFocus
              containerClassName="w-full h-full mx-auto"
              contextMenu={
                !isProcessCompleted ? (
                  <div className="min-w-[120px] p-0">
                    <button
                      className="flex items-center gap-1 w-full px-2 py-2 text-xs text-left hover:bg-default-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleCopyCurrentFrame}
                      disabled={isCopyingFrame}
                    >
                      <Icon name="copy" size={20} />
                      <span>Copy current frame</span>
                    </button>
                  </div>
                ) : null
              }
              style={{
                width: '100%',
                minWidth: '50vw',
                maxHeight: '65vh',
                aspectRatio:
                  (mediaFile?.dimensions?.width ?? 1) /
                  (mediaFile?.dimensions?.height ?? 1),
              }}
              config={{
                file: {
                  attributes: {
                    crossOrigin: 'anonymous',
                  },
                  tracks: [],
                },
              }}
              disableClosedCaptions
              onError={() => {
                toast.warning('Switching to image thumbnail...')
                if (appProxy.state.media[mediaIndex].type === 'video') {
                  appProxy.state.media[mediaIndex].previewMode = 'image'
                }
              }}
              onProgress={({ playedSeconds }: OnProgressProps) => {
                if (playerRef.current?.playerRef) {
                  setTimelineTime(playedSeconds)
                  autoScrollCursorToCurrentTime(scales)
                }
              }}
              // ffmpeg duration is sometimes incorrect, so force set this duration to particular video
              onDuration={(duration: number) => {
                if (
                  duration &&
                  !Number.isNaN(duration) &&
                  !appProxy.state.isProcessCompleted
                ) {
                  if (appProxy.state.media[mediaIndex].type === 'video') {
                    appProxy.state.media[mediaIndex].videoDuration = duration
                  }
                  refreshTimeline()
                }
              }}
              onPlay={() => {
                setTimeout(() => {
                  autoScrollCursorToCurrentTime(scales)
                }, 100)
              }}
              onArrowKeySeek={() => {
                autoScrollCursorToCurrentTime(scales, {
                  onlyOnOutOfView: false,
                  smoothScrolling: true,
                })
              }}
            />
          </motion.div>
        ) : (
          <div className="relative w-fit mx-auto">
            <Image
              alt="image to compress"
              src={imageToRenderSrc}
              className="object-contain rounded-3xl max-h-[65vh] border-1 border-zinc-200 dark:border-zinc-900 min-w-[100px] min-h-[100px]"
              onError={() => {
                if (!isProcessCompleted) {
                  handleRegenerateThumbnail('00:00:01.00', 0, true)
                }
              }}
              {...(mediaFile?.dimensions?.width
                ? { width: mediaFile?.dimensions?.width }
                : {})}
            />
            <div className="absolute bottom-3 right-3 z-[20] flex items-center gap-3 bg-zinc-900/10 dark:bg-zinc-900/40 min-h-[25px] px-2 rounded-2xl">
              {videoDuration && !isProcessCompleted ? (
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  onPress={() => {
                    handleRegenerateThumbnail()
                  }}
                  isDisabled={isThumbnailRegenerating}
                  isLoading={isThumbnailRegenerating}
                  className="!p-0 !min-h-0 !py-2 !w-[unset] !min-w-[unset] !h-0 "
                >
                  <Tooltip content="Regenerate Thumbnail" className="w-0! h-0!">
                    <Icon name="image" size={20} />
                  </Tooltip>
                </Button>
              ) : null}
              <ImageViewer
                // @ts-ignore
                providerProps={
                  mediaFile?.extension === 'svg' ||
                  (isProcessCompleted &&
                    mediaFile?.config?.convertToExtension === 'svg')
                    ? { photoWrapClassName: 'bg-zinc-800' }
                    : {}
                }
              >
                <PhotoView src={imageToRenderSrc!}>
                  <div>
                    <Tooltip content="Enlarge image">
                      <Icon name="zoom" size={18} className="cursor-pointer" />
                    </Tooltip>
                  </div>
                </PhotoView>
              </ImageViewer>
            </div>
          </div>
        )}
        {mediaType === 'video' && showTrimmerLayout && videoDuration ? (
          <div className="mt-4">
            <VideoTrimmerTimeline
              id="video-trimmer-1"
              ref={trimmerRef}
              duration={videoDuration}
              {...(trimConfig
                ? {
                    initialTrimActions: trimConfig as any,
                  }
                : {})}
              onActionResizing={(data) => {
                if (playerRef.current?.playerRef) {
                  playerRef.current.playerRef.seekTo(
                    data.dir === 'left' ? data.start : data.end,
                  )
                }
              }}
              onCursorDrag={seekPlayerTo}
              onClickTimeArea={(time) => {
                seekPlayerTo(time, false)
                return true
              }}
              onClickActionOnly={(_, { time }) => {
                seekPlayerTo(time, false)
                setTimelineTime(time)
              }}
              onEditorDataChange={(data) => {
                if (trimConfigSetDebounceRef.current) {
                  clearTimeout(trimConfigSetDebounceRef.current)
                }
                trimConfigSetDebounceRef.current = setTimeout(() => {
                  const trimRow = data.find((d) => d.id === rowIds.videoTrim)
                  if (
                    trimRow &&
                    appProxy.state.media[mediaIndex].type === 'video' &&
                    appProxy.state.media[mediaIndex]?.config
                  ) {
                    appProxy.state.media[mediaIndex].config.trimConfig =
                      trimRow.actions
                  }
                }, 250)
              }}
            />
          </div>
        ) : null}
      </div>
      {showTransformerLayout ? (
        <div className="absolute top-0 right-0 bottom-0 left-0 w-full h-full flex flex-col m-auto justify-center items-center z-[10] bg-white1 dark:bg-black1">
          <VideoTransformer mediaIndex={mediaIndex} />
        </div>
      ) : null}
    </div>
  )
}

export default MediaThumbnail
