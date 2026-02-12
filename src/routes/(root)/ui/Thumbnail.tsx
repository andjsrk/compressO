import { core } from '@tauri-apps/api'
import { useCallback, useEffect, useRef } from 'react'
import { OnProgressProps } from 'react-player/base'
import { toast } from 'sonner'
import { useSnapshot } from 'valtio'
import { subscribeKey } from 'valtio/utils'

import Image from '@/components/Image'
import useTimelineEngine from '@/components/Timeline/useTimelineEngine'
import VideoPlayer, { VideoPlayerRef } from '@/components/VideoPlayer'
import VideoTrimmerTimeline, {
  rowIds,
  scales,
  VideoTrimmerTimelineRef,
} from '@/ui/VideoTrimmerTimeline'
import { formatDuration } from '@/utils/string'
import VideoTransformer from './VideoTransformer'
import { appProxy } from '../-state'

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
    thumbnailPath,
    isProcessCompleted,
    previewMode = 'video',
    videoDurationMilliseconds,
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
    totalDuration: (videoDurationMilliseconds ?? 0) / 1000,
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
          if (
            playerRef.current &&
            appProxy.state.videos[videoIndex].config.isVideoTransformEditMode
          ) {
            const videoSnapshot = appProxy.state.videos[videoIndex]
            const originalThumbnail = core.convertFileSrc(
              videoSnapshot.thumbnailPathRaw!,
            )

            playerRef.current.pauseVideo()

            // Wait a bit for the pause to take effect and frame to stabilize
            await new Promise((resolve) => setTimeout(resolve, 100))

            let url: string | null = null
            let attempts = 0
            const maxAttempts = 3

            while (!url && attempts < maxAttempts) {
              url = await playerRef.current.captureVideoFrame()
              if (!url) {
                attempts++
                if (attempts < maxAttempts) {
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }
              }
            }

            appProxy.state.videos[videoIndex].thumbnailPath =
              url ?? originalThumbnail
          }
        },
      )
    }
    return () => {
      unsubscribeTransform?.()
    }
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
      <div className="relative w-full">
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
            style={{
              width: '100%',
              minWidth: '50vw',
              maxHeight: '65vh',
              aspectRatio:
                (video?.dimensions?.width ?? 1) /
                (video?.dimensions?.height ?? 1),
            }}
            onError={() => {
              toast.error(
                'Could not load video. Switching to image thumbnail...',
              )
              appProxy.state.videos[videoIndex].previewMode = 'image'
            }}
            onProgress={({ playedSeconds }: OnProgressProps) => {
              if (playerRef.current?.playerRef) {
                const internalPlayer = playerRef.current.getInternalPlayer()
                if (internalPlayer && !internalPlayer.paused) {
                  setTimelineTime(playedSeconds)
                  autoScrollCursorToCurrentTime(scales)
                }
              }
            }}
            // ffmpeg duration is sometimes incorrect, so force set this duration to particular video
            onDuration={(duration: number) => {
              if (
                duration &&
                !Number.isNaN(duration) &&
                !appProxy.state.isProcessCompleted
              ) {
                appProxy.state.videos[videoIndex].videoDurationMilliseconds =
                  duration * 1000
                appProxy.state.videos[videoIndex].videDurationRaw =
                  formatDuration(duration)
                refreshTimeline()
              }
            }}
          />
        ) : (
          <Image
            alt="video to compress"
            src={thumbnailPath as string}
            className="w-full h-full object-contain rounded-3xl max-h-[65vh]"
          />
        )}
        {showTrimmerLayout && videoDurationMilliseconds ? (
          <div className="mt-4">
            <VideoTrimmerTimeline
              id="video-trimmer-1"
              ref={trimmerRef}
              duration={videoDurationMilliseconds / 1000}
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
