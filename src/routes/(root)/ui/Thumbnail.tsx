import { core } from '@tauri-apps/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { OnProgressProps } from 'react-player/base'
import { toast } from 'sonner'
import { useSnapshot } from 'valtio'
import { subscribeKey } from 'valtio/utils'

import Button from '@/components/Button'
import Icon from '@/components/Icon'
import Image from '@/components/Image'
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

type VideoThumbnailProps = {
  videoIndex: number
}

function VideoThumbnail({ videoIndex }: VideoThumbnailProps) {
  if (videoIndex < 0) return

  const {
    state: { videos },
  } = useSnapshot(appProxy)
  const video = videos.length > 0 ? videos[videoIndex] : null
  const {
    config,
    path: videoPath,
    pathRaw: videoPathRaw,
    thumbnailPath,
    isProcessCompleted,
    previewMode = 'video',
    videoDuration,
    compressedVideo,
  } = video ?? {}
  const {
    shouldTransformVideo,
    isVideoTransformEditMode,
    trimConfig,
    isVideoTrimEditMode,
    shouldTrimVideo,
  } = config ?? {}

  const playerRef = useRef<VideoPlayerRef | null>(null)
  const trimmerRef = useRef<VideoTrimmerTimelineRef | null>(null)
  const trimConfigSetDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const [isThumbnailRegenerating, setIsThumbnailRegenerating] = useState(false)
  const thumbnailCacheRef = useRef<Record<string, string>>({})
  const [isCopyingFrame, setIsCopyingFrame] = useState(false)

  const handleCopyCurrentFrame = useCallback(async () => {
    if (!videoPathRaw || !videoDuration || !playerRef.current) {
      toast.error('Unable to copy frame')
      return
    }

    setIsCopyingFrame(true)
    try {
      const currentTime = playerRef.current.playerRef?.getCurrentTime?.() ?? 0

      const targetDuration =
        currentTime >= videoDuration
          ? currentTime - 0.05
          : currentTime <= 0
            ? 0.05
            : currentTime
      const timestamp = formatDuration(targetDuration)

      const result = await generateVideoThumbnail(videoPathRaw, timestamp)

      await copyFileToClipboard(result.filePath)
      toast.success('Frame copied to clipboard')
    } catch {
      toast.error('Failed to copy frame to clipboard')
    } finally {
      setIsCopyingFrame(false)
    }
  }, [videoPathRaw, videoDuration])

  const handleRegenerateThumbnail = useCallback(
    async (timeStamp?: string, retries = 2, forced = false) => {
      if (
        !videoPathRaw ||
        !videoDuration ||
        (forced ? false : isThumbnailRegenerating)
      )
        return

      setIsThumbnailRegenerating(true)
      try {
        const result = await generateVideoThumbnail(
          videoPathRaw,
          timeStamp ?? pickRandomTimestamp(videoDuration * 1000),
        )
        appProxy.state.videos[videoIndex].thumbnailPathRaw = result.filePath
        appProxy.state.videos[videoIndex].thumbnailPath = core.convertFileSrc(
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
    [videoPathRaw, videoDuration, videoIndex, isThumbnailRegenerating],
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

    if (appProxy.state.videos[videoIndex]?.config) {
      unsubscribeTransform = subscribeKey(
        appProxy.state.videos[videoIndex].config,
        'isVideoTransformEditMode',
        async () => {
          const videoSnapshot = appProxy.state.videos[videoIndex]
          if (
            (playerRef.current || trimmerRef.current) &&
            videoSnapshot.config.isVideoTransformEditMode
          ) {
            const { pathRaw: videoPathRaw } = videoSnapshot

            const currentTime = playerRef.current
              ? playerRef.current.playerRef?.getCurrentTime?.()
              : trimmerRef.current?.getTime?.()
            if (currentTime && videoPathRaw) {
              try {
                const targetDuration =
                  currentTime >= videoSnapshot.videoDuration!
                    ? currentTime - 0.05
                    : currentTime <= 0
                      ? 0.05
                      : currentTime
                const timestamp = formatDuration(targetDuration)

                let thumbnailPath = thumbnailCacheRef.current[timestamp]

                if (!thumbnailPath) {
                  const result = await generateVideoThumbnail(
                    videoPathRaw,
                    timestamp,
                  )

                  thumbnailPath = result.filePath
                  thumbnailCacheRef.current[timestamp] = thumbnailPath
                }

                appProxy.state.videos[videoIndex].thumbnailPathRaw =
                  thumbnailPath
                appProxy.state.videos[videoIndex].thumbnailPath =
                  core.convertFileSrc(thumbnailPath)
              } catch {}
            }
          }
        },
      )
    }
    return () => {
      unsubscribeTransform?.()
    }
  }, [videoIndex])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <Clear thumbnail cache when video changes>
  useEffect(() => {
    thumbnailCacheRef.current = {}
  }, [videoIndex])

  useEffect(() => {
    let unsubscribeTrim: (() => void) | undefined

    if (appProxy.state.videos[videoIndex]?.config) {
      unsubscribeTrim = subscribeKey(
        appProxy.state.videos[videoIndex].config,
        'isVideoTrimEditMode',
        async () => {
          if (playerRef.current) {
            setTimeout(() => {
              if (playerRef?.current?.playerRef) {
                const currentTime =
                  playerRef?.current?.playerRef?.getCurrentTime?.()
                if (currentTime) {
                  setTimelineTime(currentTime)
                  autoScrollCursorToCurrentTime(scales)
                }
              }
            }, 100)
            if (appProxy.state.videos[videoIndex].config.isVideoTrimEditMode) {
              playerRef.current.pauseVideo()
            }
          }
        },
      )
    }
    return () => {
      unsubscribeTrim?.()
    }
  }, [videoIndex, autoScrollCursorToCurrentTime, setTimelineTime])

  const showTrimmerLayout =
    shouldTrimVideo && isVideoTrimEditMode && !isProcessCompleted

  const showTransformerLayout =
    shouldTransformVideo && isVideoTransformEditMode && !isProcessCompleted

  return (
    <div className="relative w-full flex items-center justify-center">
      <div className="relative w-full px-4">
        {previewMode === 'video' && videoPath ? (
          <VideoPlayer
            ref={playerRef}
            url={
              isProcessCompleted && compressedVideo
                ? compressedVideo?.path!
                : videoPath!
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
                <div className="min-w-[150px] p-1">
                  <button
                    className="flex items-center gap-2 w-full px-2 py-2 text-sm text-left hover:bg-default-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                (video?.dimensions?.width ?? 1) /
                (video?.dimensions?.height ?? 1),
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
              appProxy.state.videos[videoIndex].previewMode = 'image'
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
                appProxy.state.videos[videoIndex].videoDuration = duration
                refreshTimeline()
              }
            }}
          />
        ) : (
          <div className="relative w-fit mx-auto">
            <Image
              alt="video to compress"
              src={thumbnailPath as string}
              className="object-contain rounded-3xl max-h-[65vh] border-1 border-primary"
              onError={() => {
                if (!isProcessCompleted) {
                  handleRegenerateThumbnail('00:00:01.00', 0, true)
                }
              }}
            />
            {videoDuration && !isProcessCompleted ? (
              <div className="absolute bottom-4 right-4 z-[10]">
                <Tooltip content="Regenerate Thumbnail">
                  <Button
                    size="sm"
                    isIconOnly
                    onPress={() => {
                      handleRegenerateThumbnail()
                    }}
                    isDisabled={isThumbnailRegenerating}
                    isLoading={isThumbnailRegenerating}
                    className="!p-0 !min-h-0 text-[10px] !h-[unset] !px-2 !py-1"
                  >
                    <Icon name="image" size={20} />
                  </Button>
                </Tooltip>
              </div>
            ) : null}
          </div>
        )}
        {showTrimmerLayout && videoDuration ? (
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
                  if (trimRow && appProxy.state.videos[videoIndex]?.config) {
                    appProxy.state.videos[videoIndex].config.trimConfig =
                      trimRow.actions
                  }
                }, 250)
              }}
              onActionMoving={({ end }) => {
                seekPlayerTo(end, false)
                setTimelineTime(end)
              }}
            />
          </div>
        ) : null}
      </div>
      {showTransformerLayout ? (
        <div className="absolute top-0 right-0 bottom-0 left-0 w-full h-full flex flex-col m-auto justify-center items-center z-[10] bg-white1 dark:bg-black1">
          <VideoTransformer videoIndex={videoIndex} />
        </div>
      ) : null}
    </div>
  )
}

export default VideoThumbnail
