import { createFileRoute } from '@tanstack/react-router'
import { core } from '@tauri-apps/api'
import { open } from '@tauri-apps/plugin-dialog'
import { motion } from 'framer-motion'
import cloneDeep from 'lodash/cloneDeep'
import React, { useCallback } from 'react'
import { useSnapshot } from 'valtio'

import Icon from '@/components/Icon'
import Layout from '@/components/Layout'
import Spinner from '@/components/Spinner'
import { toast } from '@/components/Toast'
import { generateVideoThumbnail } from '@/tauri/commands/ffmpeg'
import { getVideoInfo } from '@/tauri/commands/ffprobe'
import { getFileMetadata } from '@/tauri/commands/fs'
import { extensions } from '@/types/compression'
import { formatBytes } from '@/utils/fs'
import { appProxy, videoConfigInitialState } from './-state'
import Setting from './ui/app-settings/Setting'
import DragAndDrop from './ui/DragAndDrop'
import OpenWithApp from './ui/OpenWithApp'
import ReadFilesFromClipboard from './ui/ReadFilesFromClipboard'
import VideoConfig from './ui/VideoConfig'
import { Video } from '../../types/app'

export const Route = createFileRoute('/(root)/')({
  component: Root,
})

function Root() {
  const { state, resetProxy } = useSnapshot(appProxy)

  const { videos, isLoadingFiles, totalSelectedFilesCount } = state

  const handleVideoSelection = React.useCallback(
    async (path: string | string[]) => {
      if (appProxy.state.isCompressing) return

      const rawPaths = Array.isArray(path) ? path : [path]
      const videoPaths = rawPaths.filter((filePath) => {
        const ext = filePath.split('.').pop()?.toLowerCase()
        return ext && Object.keys(extensions.video).includes(ext)
      })

      if (videoPaths.length === 0) {
        toast.error('No valid files found.')
        return
      }

      appProxy.state.isLoadingFiles = true
      appProxy.state.totalSelectedFilesCount = videoPaths.length

      let corruptedFilesCount = 0
      for (const index in videoPaths) {
        const path = videoPaths[index]
        try {
          const [fileMetadata, videoInfo, videoThumbnail] = await Promise.all([
            getFileMetadata(path),
            getVideoInfo(path),
            generateVideoThumbnail(path),
          ])

          if (
            !fileMetadata ||
            (typeof fileMetadata?.size === 'number' &&
              fileMetadata?.size <= 1000)
          ) {
            corruptedFilesCount++
            continue
          }

          const videoState: Video = {
            id: videoThumbnail?.id ?? `${index}-${+new Date()}`,
            pathRaw: path,
            path: core.convertFileSrc(path),
            fileName: fileMetadata?.fileName,
            mimeType: fileMetadata?.mimeType,
            sizeInBytes: fileMetadata?.size,
            size: formatBytes(fileMetadata?.size ?? 0),
            extension: fileMetadata?.extension?.toLowerCase?.(),
            config: cloneDeep(videoConfigInitialState),
            previewMode: 'video',
          }

          if (fileMetadata?.extension) {
            videoState.config.convertToExtension =
              fileMetadata?.extension as keyof (typeof extensions)['video']
          }

          if (videoInfo) {
            const dimensions = videoInfo.dimensions
            if (
              !Number.isNaN(videoInfo.dimensions?.[0]) &&
              !Number.isNaN(videoInfo.dimensions?.[1])
            ) {
              videoState.dimensions = {
                width: dimensions[0],
                height: dimensions[1],
              }
            }

            if (videoInfo.duration) {
              videoState.videoDuration = videoInfo.duration
            }

            if (videoInfo.fps) {
              videoState.fps = Math.ceil(videoInfo.fps)
            }
          }

          if (videoThumbnail) {
            videoState.id = videoThumbnail?.id
            videoState.thumbnailPathRaw = videoThumbnail?.filePath
            videoState.thumbnailPath = core.convertFileSrc(
              videoThumbnail?.filePath,
            )
          }
          appProxy.state.videos.push(videoState)
        } catch {
          corruptedFilesCount++
        }
      }
      appProxy.state.isLoadingFiles = false
      if (corruptedFilesCount > 0) {
        toast.error(
          `${videoPaths.length > 1 ? 'Some files seem' : 'File seems'} to be corrupted/invalid ${videoPaths.length > 1 ? 'and are filtered out' : ''}.`,
        )
        if (corruptedFilesCount === videoPaths.length) {
          resetProxy()
        }
      }
    },
    [resetProxy],
  )

  const pickVideosToCompress = useCallback(async () => {
    try {
      const filePath = await open({
        directory: false,
        multiple: true,
        title: `Select video(s) to compress.`,
        filters: [
          { name: 'video', extensions: Object.keys(extensions?.video) },
        ],
      })
      if (filePath == null) {
        const message = 'File selection config is invalid.'
        // biome-ignore lint/suspicious/noConsole: <>
        console.warn(message)
        return
      }
      handleVideoSelection(filePath)
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not select a video.')
    }
  }, [handleVideoSelection])

  return isLoadingFiles ? (
    !videos.length || (totalSelectedFilesCount > 1 && videos.length === 1) ? (
      <div className="w-full h-full flex justify-center items-center">
        <Spinner />
      </div>
    ) : (
      <VideoConfig />
    )
  ) : videos.length ? (
    <VideoConfig />
  ) : (
    <Layout
      containerProps={{ className: 'relative' }}
      childrenProps={{ className: 'm-auto' }}
    >
      <motion.div
        role="button"
        tabIndex={0}
        className="h-full w-full flex flex-col justify-center items-center z-0"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{
          scale: 1,
          opacity: 1,
          transition: {
            duration: 0.6,
            bounce: 0.3,
            type: 'spring',
          },
        }}
        onClick={pickVideosToCompress}
        onKeyDown={(evt) => {
          if (evt?.key === 'Enter') {
            pickVideosToCompress()
          }
        }}
      >
        <div className="flex flex-col justify-center items-center py-16 px-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <Icon name="videoFile" className="text-primary" size={60} />
          <p className="italic text-sm mt-4 text-gray-600 dark:text-gray-400 text-center">
            Drag & Drop
            <span className="block text-xs">Or</span>
            Click to select video(s)
          </p>
        </div>
      </motion.div>
      <DragAndDrop
        multiple
        disable={videos.length > 0}
        onFile={handleVideoSelection}
      />
      <OpenWithApp onFiles={handleVideoSelection} />
      <ReadFilesFromClipboard onFiles={handleVideoSelection} />
      <Setting />
    </Layout>
  )
}

export default Root
