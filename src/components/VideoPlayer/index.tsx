import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import ReactPlayer from 'react-player'
import { ReactPlayerProps } from 'react-player/types'

import Button from '../Button'
import Icon from '../Icon'

export interface VideoPlayerRef {
  playerRef: HTMLVideoElement | null
  togglePlayPause: () => void
  playVideo: () => void
  pauseVideo: () => void
}

interface VideoPlayerProps extends Omit<ReactPlayerProps, 'ref'> {
  playPauseOnSpaceKeydown?: boolean
}

const VideoPlayer = forwardRef(
  (
    { playPauseOnSpaceKeydown, ...props }: VideoPlayerProps,
    forwardedRef: ForwardedRef<VideoPlayerRef>,
  ) => {
    const [isPlaying, setIsPlaying] = useState(false)

    const playerRef = useRef<HTMLVideoElement | null>(null)
    const playPauseButtonRef = useRef<HTMLButtonElement | null>(null)

    const togglePlayPause = useCallback(() => {
      setIsPlaying((s) => !s)
    }, [])

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          e.preventDefault()
          togglePlayPause()
        }
      },
      [togglePlayPause],
    )

    useImperativeHandle(forwardedRef, () => ({
      playerRef: playerRef.current,
      togglePlayPause: togglePlayPause,
      playVideo: () => {
        setIsPlaying(true)
      },
      pauseVideo: () => {
        setIsPlaying(false)
      },
    }))

    useEffect(() => {
      if (playPauseOnSpaceKeydown) {
        window.addEventListener('keydown', handleKeyDown)
      } else {
        window.removeEventListener('keydown', handleKeyDown)
      }
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }, [handleKeyDown, playPauseOnSpaceKeydown])

    useEffect(() => {
      if (playPauseButtonRef.current) {
        playPauseButtonRef.current.focus()
      }
    }, [])

    return (
      <div
        className="relative w-full h-full"
        role="button"
        onClick={togglePlayPause}
      >
        <ReactPlayer
          ref={playerRef}
          controls
          width="100%"
          height="100%"
          playing={isPlaying}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          {...props}
        />
        <Button
          ref={playPauseButtonRef}
          onPress={togglePlayPause}
          isIconOnly
          radius="full"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-/12  bg-black/30 hover:bg-black/40 transition-colors cursor-pointer"
        >
          <Icon
            name={isPlaying ? 'pause' : 'play'}
            size={28}
            className="text-white drop-shadow-lg"
          />
        </Button>
      </div>
    )
  },
)

export default VideoPlayer
