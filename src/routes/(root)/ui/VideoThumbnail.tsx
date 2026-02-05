import { toast } from 'sonner'
import { useSnapshot } from 'valtio'

import Image from '@/components/Image'
import VideoPlayer from '@/components/VideoPlayer'
import { appProxy } from '../-state'
import VideoTransformer from './VideoTransformer'

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
  } = video ?? {}
  const { shouldTransformVideo } = config ?? {}

  return shouldTransformVideo && !isProcessCompleted ? (
    <VideoTransformer videoIndex={videoIndex} />
  ) : previewMode === 'video' && videoPath ? (
    <div className="relative max-w-[65vw] xxl:max-w-[80vw] max-h-[60vh]">
      <VideoPreview videoIndex={videoIndex} />
    </div>
  ) : (
    <Image
      alt="video to compress"
      src={thumbnailPath as string}
      className="max-w-[65vw] xxl:max-w-[75vw] max-h-[60vh] object-contain rounded-3xl border-primary border-4"
    />
  )
}

type VideoPreviewProps = {
  videoIndex: number
}

function VideoPreview({ videoIndex }: VideoPreviewProps) {
  if (videoIndex < 0) return

  const {
    state: { videos },
  } = useSnapshot(appProxy)
  const video = videos.length > 0 ? videos[videoIndex] : null
  const { path } = video ?? {}

  return (
    <>
      <VideoPlayer
        src={path!}
        controls={false}
        playPauseOnSpaceKeydown
        onError={() => {
          toast.error('Could not load video. Switching to image thumbnail.')
          appProxy.state.videos[videoIndex].previewMode = 'image'
        }}
        autoFocus
      />
    </>
  )
}

export default VideoThumbnail
