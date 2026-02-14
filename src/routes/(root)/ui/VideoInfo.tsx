import { Tab } from '@heroui/react'
import { motion } from 'framer-motion'
import { startCase, upperCase } from 'lodash'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSnapshot } from 'valtio'

import Code from '@/components/Code'
import Divider from '@/components/Divider'
import ScrollShadow from '@/components/ScrollShadow'
import Spinner from '@/components/Spinner'
import Tabs from '@/components/Tabs'
import {
  getAudioStreams,
  getChapters,
  getContainerInfo,
  getSubtitleStreams,
  getVideoStreams,
} from '@/tauri/commands/ffprobe'
import {
  AudioStream,
  Chapter,
  ContainerInfo,
  SubtitleStream,
  VideoStream,
} from '@/types/compression'
import { formatBytes } from '@/utils/fs'
import { formatDuration } from '@/utils/string'
import { appProxy } from '../-state'

type VideoInfoProps = {
  videoIndex: number
}

const TABS = {
  container: {
    id: 'container',
    title: 'Container',
  },
  video: {
    id: 'video',
    title: 'Video',
  },
  audio: {
    id: 'audio',
    title: 'Audio',
  },
  subtitles: {
    id: 'subtitles',
    title: 'Subtitles',
  },
  chapters: {
    id: 'chapters',
    title: 'Chapters',
  },
} as const

function VideoInfo({ videoIndex }: VideoInfoProps) {
  if (videoIndex < 0) return null

  const {
    state: { videos },
  } = useSnapshot(appProxy)

  const video = videos.length && videoIndex >= 0 ? videos[videoIndex] : null
  const { pathRaw: videoPathRaw, videoInfoRaw } = video ?? {}
  if (!video) return null

  const [tab, setTab] = useState<keyof typeof TABS>('container')
  const [loading, setLoading] = useState(false)

  const fetchTabData = useCallback(
    async (tabKey: keyof typeof TABS) => {
      const video = appProxy.state.videos[videoIndex]

      if (!videoPathRaw || !video) {
        return
      }

      if (!video.videoInfoRaw) {
        video.videoInfoRaw = {}
      }

      setLoading(true)
      try {
        switch (tabKey) {
          case 'container': {
            if (!video?.videoInfoRaw?.containerInfo) {
              const data = await getContainerInfo(videoPathRaw)
              if (data) {
                video.videoInfoRaw.containerInfo = data
              }
            }
            break
          }
          case 'video': {
            if (!video?.videoInfoRaw?.videoStreams) {
              const data = await getVideoStreams(videoPathRaw)
              if (data) {
                video.videoInfoRaw.videoStreams = data
              }
            }
            break
          }
          case 'audio': {
            if (!video?.videoInfoRaw?.audioStreams) {
              const data = await getAudioStreams(videoPathRaw)
              if (data) {
                video.videoInfoRaw.audioStreams = data
              }
            }
            break
          }
          case 'subtitles': {
            if (!video?.videoInfoRaw?.subtitleStreams) {
              const data = await getSubtitleStreams(videoPathRaw)
              if (data) {
                video.videoInfoRaw.subtitleStreams = data
              }
            }
            break
          }
          case 'chapters': {
            if (!video?.videoInfoRaw?.chapters) {
              const data = await getChapters(videoPathRaw)
              if (data) {
                video.videoInfoRaw.chapters = data
              }
            }
            break
          }
        }
      } catch {
        toast.error('Failed to load video information')
      } finally {
        setLoading(false)
      }
    },
    [videoPathRaw, videoIndex],
  )

  useEffect(() => {
    fetchTabData(tab)
  }, [tab, fetchTabData])

  return (
    <section className="w-full h-full bg-white1 dark:bg-black1 p-6">
      <Tabs
        aria-label="Video Information"
        size="sm"
        selectedKey={tab}
        onSelectionChange={(t) => setTab(t as keyof typeof TABS)}
        className="w-full"
        fullWidth
      >
        {Object.values(TABS).map((t) => (
          <Tab key={t.id} value={t.id} title={t.title} />
        ))}
      </Tabs>

      <ScrollShadow
        className="mt-6 overflow-y-auto max-h-[calc(100vh-200px)] pb-10"
        hideScrollBar
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="sm" />
          </div>
        ) : null}

        {!loading && tab === 'container' && videoInfoRaw?.containerInfo ? (
          <ContainerInfoDisplay info={videoInfoRaw?.containerInfo as any} />
        ) : null}

        {!loading && tab === 'video' && videoInfoRaw?.videoStreams ? (
          <VideoStreamsDisplay streams={videoInfoRaw?.videoStreams as any} />
        ) : null}

        {!loading && tab === 'audio' && videoInfoRaw?.audioStreams ? (
          <AudioStreamsDisplay streams={videoInfoRaw?.audioStreams as any} />
        ) : null}

        {!loading && tab === 'chapters' && videoInfoRaw?.chapters ? (
          <ChaptersDisplay chapters={videoInfoRaw?.chapters as any} />
        ) : null}

        {!loading && tab === 'subtitles' && videoInfoRaw?.subtitleStreams ? (
          <SubtitleStreamsDisplay
            streams={videoInfoRaw?.subtitleStreams as any}
          />
        ) : null}
      </ScrollShadow>
    </section>
  )
}

function ContainerInfoDisplay({ info }: { info: ContainerInfo }) {
  return (
    <div className="space-y-4">
      {info.filename ? (
        <>
          <InfoItem
            label="Full Path"
            value={
              <Code size="sm" className="text-xs max-w-[100%] truncate">
                {info.filename}
              </Code>
            }
          />
          <Divider className="my-1" />
        </>
      ) : null}

      {info.formatName ? (
        <>
          <InfoItem label="Format Name" value={info.formatName} />
          <Divider className="my-1" />
        </>
      ) : null}

      {info.formatLongName ? (
        <>
          <InfoItem label="Format" value={info.formatLongName} />
          <Divider className="my-1" />
        </>
      ) : null}

      {info.duration ? (
        <>
          <InfoItem
            label="Duration"
            value={`${formatDuration(info.duration)}`}
          />
          <Divider className="my-1" />
        </>
      ) : null}

      {info.size > 0 ? (
        <>
          <InfoItem label="Size" value={formatBytes(info.size)} />
          <Divider className="my-1" />
        </>
      ) : null}

      {info.bitRate ? (
        <>
          <InfoItem
            label="Bitrate"
            value={`${(info.bitRate / 1000).toFixed(0)} kbps`}
          />
          <Divider className="my-1" />
        </>
      ) : null}

      {info.nbStreams > 0 ? (
        <>
          <InfoItem label="Total Streams" value={info.nbStreams.toString()} />
          <Divider className="my-1" />
        </>
      ) : null}

      {info.tags && info.tags.length > 0 ? (
        <div>
          <InfoItem label="Tags" value=" " />
          <div className="mt-2 space-y-2 mx-10">
            {info.tags.map(([key, value]) => (
              <div key={key}>
                <p className="font-bold text-zinc-600 dark:text-zinc-400 text-[13px]">
                  {startCase(key)}:
                </p>{' '}
                <span className="text-zinc-800 dark:text-zinc-200 allow-user-selection text-[13px]">
                  {value ?? 'N/A'}
                </span>
                <Divider className="mt-2" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function VideoStreamsDisplay({ streams }: { streams: VideoStream[] }) {
  return (
    <div className="space-y-6">
      {streams.map((stream, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-primary">
            Video Stream {streams.length > 1 ? `${index + 1}` : ''}
          </h3>

          <InfoItem
            label="Codec"
            value={`${stream.codec} (${stream.codecLongName ?? 'N/A'})`}
          />
          <Divider className="my-3" />

          {stream.profile && (
            <>
              <InfoItem label="Profile" value={stream.profile} />
              <Divider className="my-3" />
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <InfoItem label="Width" value={`${stream.width ?? '-'}px`} />
              <Divider className="my-3" />
            </div>
            <div>
              <InfoItem label="Height" value={`${stream.height ?? '-'}px`} />
              <Divider className="my-3" />
            </div>
          </div>

          {stream.codedWidth &&
          stream.codedHeight &&
          (stream.codedWidth !== stream.width ||
            stream.codedHeight !== stream.height) ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <InfoItem
                    label="Coded Width"
                    value={`${stream.codedWidth ?? '-'}px`}
                  />
                  <Divider className="my-3" />
                </div>
                <div>
                  <InfoItem
                    label="Coded Height"
                    value={`${stream.codedHeight ?? '-'}px`}
                  />
                  <Divider className="my-3" />
                </div>
              </div>
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <InfoItem label="Frame Rate" value={stream.rFrameRate} />
              <Divider className="my-3" />
            </div>
            <div>
              <InfoItem label="Avg Frame Rate" value={stream.avgFrameRate} />
              <Divider className="my-3" />
            </div>
          </div>

          <InfoItem label="Pixel Format" value={stream.pixFmt} />
          <Divider className="my-3" />

          {stream.colorSpace ? (
            <>
              <InfoItem label="Color Space" value={stream.colorSpace} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.colorRange ? (
            <>
              <InfoItem label="Color Range" value={stream.colorRange} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.colorPrimaries ? (
            <>
              <InfoItem label="Color Primaries" value={stream.colorPrimaries} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.colorTransfer ? (
            <>
              <InfoItem label="Color Transfer" value={stream.colorTransfer} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.chromaLocation ? (
            <>
              <InfoItem label="Chroma Location" value={stream.chromaLocation} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.bitRate ? (
            <>
              <InfoItem label="Bitrate" value={stream.bitRate} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.duration ? (
            <>
              <InfoItem
                label="Duration"
                value={formatDuration(+stream.duration)}
              />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.nbFrames ? (
            <>
              <InfoItem label="Total Frames" value={stream.nbFrames} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.refs ? (
            <>
              <InfoItem
                label="Reference Frames"
                value={stream.refs.toString()}
              />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.gopSize ? (
            <>
              <InfoItem label="GOP Size" value={stream.gopSize.toString()} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.level ? (
            <>
              <InfoItem label="Codec Level" value={stream.level.toString()} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.fieldOrder && stream.fieldOrder !== 'progressive' ? (
            <>
              <InfoItem label="Field Order" value={stream.fieldOrder} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.timeBase && stream.timeBase !== '0/0' ? (
            <>
              <InfoItem label="Time Base" value={stream.timeBase} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.rotation && stream.rotation !== 0 ? (
            <>
              <InfoItem label="Rotation" value={`${stream.rotation}°`} />
              <Divider className="my-3" />
            </>
          ) : null}
        </motion.div>
      ))}
    </div>
  )
}

function AudioStreamsDisplay({ streams }: { streams: AudioStream[] }) {
  if (streams.length === 0) {
    return (
      <p className="text-center text-zinc-500 py-8">No audio streams found</p>
    )
  }

  return (
    <div className="space-y-6">
      {streams.map((stream, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-primary">
            Audio Stream {streams.length > 1 ? `${index + 1}` : ''}
          </h3>

          <InfoItem
            label="Codec"
            value={`${upperCase(stream.codec ?? 'N/A')} / ${stream.codecLongName ?? 'N/A'}`}
          />
          <Divider className="my-3" />

          {stream.profile ? (
            <>
              <InfoItem label="Profile" value={stream.profile} />
              <Divider className="my-3" />
            </>
          ) : null}

          <InfoItem label="Channels" value={stream.channels} />
          <Divider className="my-3" />

          {stream.channelLayout ? (
            <>
              <InfoItem label="Channel Layout" value={stream.channelLayout} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.sampleRate ? (
            <>
              <InfoItem
                label="Sample Rate"
                value={`${stream.sampleRate ?? 'N/A'} Hz`}
              />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.sampleFmt ? (
            <>
              <InfoItem label="Sample Format" value={stream.sampleFmt} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.bitsPerSample ? (
            <>
              <InfoItem
                label="Bits Per Sample"
                value={stream.bitsPerSample.toString()}
              />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.bitRate ? (
            <>
              <InfoItem
                label="Bitrate"
                value={`${formatBytes(+stream.bitRate).toLowerCase?.() ?? '-'}ps (${stream.bitRate})`}
              />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.duration ? (
            <>
              <InfoItem
                label="Duration"
                value={formatDuration(+stream.duration)}
              />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.tags && stream.tags.length > 0 ? (
            <div>
              <InfoItem label="Tags" value="" />
              <div className="mt-2 space-y-2 ml-4">
                {stream.tags.map(([key, value]) => (
                  <div key={key}>
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">
                      {key}:
                    </span>{' '}
                    <span className="text-zinc-800 dark:text-zinc-200">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>
      ))}
    </div>
  )
}

function SubtitleStreamsDisplay({ streams }: { streams: SubtitleStream[] }) {
  if (streams.length === 0) {
    return (
      <p className="text-center text-zinc-500 py-8">
        No subtitle streams found
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {streams.map((stream, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            Subtitle Stream {index + 1}
          </h3>

          <InfoItem
            label="Codec"
            value={`${stream.codec} (${stream.codecLongName})`}
          />
          <Divider className="my-3" />

          {stream.language ? (
            <>
              <InfoItem label="Language" value={stream.language} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.title ? (
            <>
              <InfoItem label="Title" value={stream.title} />
              <Divider className="my-3" />
            </>
          ) : null}

          {stream.disposition.default ||
          stream.disposition.forced ||
          stream.disposition.attached_pic ||
          stream.disposition.comment ||
          stream.disposition.karaoke ||
          stream.disposition.lyrics ? (
            <div>
              <InfoItem label="Disposition" value=" " />
              <div className="mt-2 space-y-1 ml-4">
                {stream.disposition.default ? (
                  <div className="text-zinc-600 dark:text-zinc-400 text-xs">
                    - Default
                  </div>
                ) : null}
                {stream.disposition.forced ? (
                  <div className="text-zinc-600 dark:text-zinc-400 text-xs">
                    - Forced
                  </div>
                ) : null}
                {stream.disposition.attached_pic ? (
                  <div className="text-zinc-600 dark:text-zinc-400 text-xs">
                    - Attached Picture
                  </div>
                ) : null}
                {stream.disposition.comment ? (
                  <div className="text-zinc-600 dark:text-zinc-400 text-xs">
                    - Comment
                  </div>
                ) : null}
                {stream.disposition.karaoke ? (
                  <div className="text-zinc-600 dark:text-zinc-400 text-xs">
                    - Karaoke
                  </div>
                ) : null}
                {stream.disposition.lyrics ? (
                  <div className="text-zinc-600 dark:text-zinc-400 text-xs">
                    - Lyrics
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </motion.div>
      ))}
    </div>
  )
}

function ChaptersDisplay({ chapters }: { chapters: Chapter[] }) {
  if (chapters.length === 0) {
    return <p className="text-center text-zinc-500 py-8">No chapters found</p>
  }

  return (
    <div className="space-y-4">
      {chapters.map((chapter, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold text-primary">
              Chapter {index + 1} {chapter.id ? `(#${chapter.id})` : ''}
            </h3>
            {chapter.title && (
              <span className="text-sm text-zinc-600 dark:text-zinc-400 ml-4">
                {chapter.title}
              </span>
            )}
          </div>

          <div className="mt-3 space-y-4">
            <InfoItem label="Start" value={`${chapter.start.toFixed(2)}s`} />
            <Divider className="my-3" />

            <InfoItem label="End" value={`${chapter.end.toFixed(2)}s`} />
            <Divider className="my-3" />

            <InfoItem
              label="Duration"
              value={`${formatDuration(chapter.end - chapter.start)}`}
            />
            <Divider className="my-3" />

            {chapter.timeBase && chapter.timeBase !== '0/0' ? (
              <>
                <InfoItem label="Time Base" value={chapter.timeBase} />
                <Divider className="my-3" />
              </>
            ) : null}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between !select-text !before:select-text">
      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {label}:
      </span>
      <span className="text-[13px] text-zinc-800 dark:text-zinc-200 ml-2 allow-user-selection max-w-[75%] text-end">
        {value || 'N/A'}
      </span>
    </div>
  )
}

export default VideoInfo
