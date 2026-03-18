import { DateValue } from '@internationalized/date'
import { TimelineAction } from '@xzdarcy/timeline-engine'

import {
  AudioChannelConfig,
  AudioStream,
  Chapter,
  compressionPresets,
  ContainerInfo,
  extensions,
  SubtitleStream,
  VideoStream,
  VideoTransforms,
  VideoTransformsHistory,
} from '@/types/compression'

export type VideoMetadataConfig = {
  title?: string | null
  artist?: string | null
  album?: string | null
  year?: string | null
  comment?: string | null
  description?: string | null
  synopsis?: string | null
  genre?: string | null
  copyright?: string | null
  creationTime?: string | null
  creationTimeRaw?: DateValue | null
  shouldEnableCreationTime?: boolean
}

export type AudioConfig = {
  volume: number
  audioChannelConfig?: AudioChannelConfig | null
  bitrate?: number | null
  audioCodec?: string | null
  selectedAudioTracks?: readonly number[] | null
}

export type SubtitleConfig = {
  subtitlePath: string | null
  language: string
  fileName: string | null
}

export type SubtitlesConfig = {
  subtitles: SubtitleConfig[]
  shouldEnableSubtitles?: boolean
  preserveExistingSubtitles?: boolean
}

export type VideoConfig = {
  convertToExtension: keyof typeof extensions.video | '-'
  presetName: keyof typeof compressionPresets
  shouldDisableCompression: boolean
  audioConfig: AudioConfig
  shouldEnableQuality?: boolean
  quality?: number | null
  shouldEnableCustomDimensions?: boolean
  customDimensions?: [number, number]
  shouldEnableCustomFPS?: boolean
  customFPS?: number
  shouldEnableCustomVideoCodec?: boolean
  customVideoCodec?: string
  shouldTransformVideo?: boolean
  transformVideoConfig?: {
    transforms: VideoTransforms
    transformsHistory: VideoTransformsHistory[]
    previewUrl?: string
  }
  isVideoTransformEditMode?: boolean
  shouldTrimVideo?: boolean
  trimConfig?: TimelineAction[]
  isVideoTrimEditMode?: boolean
  shouldPreserveMetadata?: boolean
  metadataConfig?: VideoMetadataConfig | null
  customThumbnailPath?: string | null
  shouldEnableCustomThumbnail?: boolean
  shouldEnableCustomChannel?: boolean
  shouldEnableCustomBitrate?: boolean
  shouldEnableCustomAudioCodec?: boolean
  shouldEnableAudioTrackSelection?: boolean
  selectedAudioTracks?: number[]
  subtitlesConfig?: SubtitlesConfig | null
}

export type Video = {
  id: string | null
  pathRaw?: string | null
  path?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeInBytes?: number | null
  size?: string | null
  extension?: null | string
  thumbnailPathRaw?: string | null
  thumbnailPath?: string | null
  videoDuration?: number | null
  isCompressing?: boolean
  isProcessCompleted?: boolean
  compressedFile?: {
    isSuccessful?: boolean
    pathRaw?: string | null
    path?: string | null
    fileName?: string | null
    fileNameToDisplay?: string | null
    mimeType?: string | null
    sizeInBytes?: number | null
    size?: string | null
    extension?: null | string
    isSaving?: boolean
    isSaved?: boolean
    savedPath?: string
  } | null
  compressionProgress?: number
  config: VideoConfig
  isConfigDirty?: boolean
  dimensions?: { width: number; height: number }
  fps?: number
  previewMode?: 'video' | 'image'
  previewVideoFrameUrl?: string | null
  videoInfoRaw?: {
    containerInfo?: ContainerInfo
    videoStreams?: VideoStream[]
    audioStreams?: AudioStream[]
    subtitleStreams?: SubtitleStream[]
    chapters?: Chapter[]
  }
}

export type ImageConfig = {
  convertToExtension: keyof typeof extensions.image | '-'
  isLossless: boolean
  quality?: number | null
  stripMetadata: boolean
}

export type Image = {
  id: string | null
  pathRaw?: string | null
  path?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeInBytes?: number | null
  size?: string | null
  extension?: null | string
  thumbnailPathRaw?: string | null
  thumbnailPath?: string | null
  isCompressing?: boolean
  isProcessCompleted?: boolean
  compressedFile?: {
    isSuccessful?: boolean
    pathRaw?: string | null
    path?: string | null
    fileName?: string | null
    fileNameToDisplay?: string | null
    mimeType?: string | null
    sizeInBytes?: number | null
    size?: string | null
    extension?: null | string
    isSaving?: boolean
    isSaved?: boolean
    savedPath?: string
  } | null
  compressionProgress?: number
  config: ImageConfig
  isConfigDirty?: boolean
  dimensions?: { width: number; height: number }
}

export type App = {
  activeTab: 'all' | 'videos' | 'images'
  batchId?: string
  media: ((Video & { type: 'video' }) | (Image & { type: 'image' }))[]
  isLoadingMediaFiles: boolean
  totalSelectedMediaCount: number
  currentMediaIndex: number
  isCompressing: boolean
  totalProgress: number
  isProcessCompleted: boolean
  isBatchCompressionCancelled: boolean
  isSaving: boolean
  isSaved: boolean
  savedPath?: string
  selectedMediaIndexForCustomization: number
  commonConfigForBatchCompression: {
    videoConfig: VideoConfig
    imageConfig: ImageConfig
  }
  showMediaInfo?: boolean
}
