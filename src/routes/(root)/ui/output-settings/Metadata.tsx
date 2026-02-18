import { AnimatePresence, motion } from 'framer-motion'
import cloneDeep from 'lodash/cloneDeep'
import React, { useCallback, useRef } from 'react'
import { useSnapshot } from 'valtio'

import Card from '@/components/Card'
import DatePicker from '@/components/DatePicker'
import Divider from '@/components/Divider'
import Switch from '@/components/Switch'
import TextArea from '@/components/TextArea'
import TextInput from '@/components/TextInput'
import type { VideoMetadataConfig } from '@/types/app'
import { slideDownTransition } from '@/utils/animation'
import {
  appProxy,
  normalizeBatchVideosConfig,
  videoMetadataConfigInitialState,
} from '../../-state'

type MetadataProps = {
  videoIndex: number
}

function Metadata({ videoIndex }: MetadataProps) {
  const {
    state: {
      videos,
      isCompressing,
      isProcessCompleted,
      commonConfigForBatchCompression,
      isLoadingFiles,
    },
  } = useSnapshot(appProxy)
  const video = videos.length > 0 && videoIndex >= 0 ? videos[videoIndex] : null
  const { config } = video ?? {}
  const { shouldPreserveMetadata, metadataConfig } =
    config ?? commonConfigForBatchCompression ?? {}

  const debounceRef = useRef<NodeJS.Timeout>()
  const metadataRef = useRef<VideoMetadataConfig | null | undefined>(
    metadataConfig as any,
  )

  React.useEffect(() => {
    ;(metadataRef.current as any) = metadataConfig
  }, [metadataConfig])

  const updateMetadataField = useCallback(
    (field: keyof VideoMetadataConfig, value: string | null | undefined) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        if (videoIndex >= 0 && appProxy.state.videos[videoIndex]?.config) {
          if (!appProxy.state.videos[videoIndex]?.config?.metadataConfig) {
            appProxy.state.videos[videoIndex].config.metadataConfig = cloneDeep(
              videoMetadataConfigInitialState,
            )
          }
          ;(appProxy.state.videos[videoIndex].config.metadataConfig![field] as
            | string
            | null
            | undefined) = value

          if (
            field === 'creationTimeRaw' &&
            appProxy.state.videos[videoIndex]?.config?.metadataConfig
          ) {
            appProxy.state.videos[videoIndex].config.metadataConfig![
              'creationTime'
            ] = (value as any)?.toDate('')?.toISOString()
          }

          appProxy.state.videos[videoIndex].isConfigDirty = true
        } else {
          if (appProxy.state.videos.length > 1) {
            if (
              !appProxy.state?.commonConfigForBatchCompression?.metadataConfig
            ) {
              appProxy.state.commonConfigForBatchCompression.metadataConfig =
                cloneDeep(videoMetadataConfigInitialState)
            }
            ;(appProxy.state.commonConfigForBatchCompression.metadataConfig![
              field
            ] as string | null | undefined) = value
            normalizeBatchVideosConfig()

            if (
              field === 'creationTimeRaw' &&
              appProxy.state.commonConfigForBatchCompression?.metadataConfig
            ) {
              appProxy.state.commonConfigForBatchCompression.metadataConfig![
                'creationTime'
              ] = (value as any)?.toDate('')?.toISOString()
            }
          }
        }
      }, 300)
    },
    [videoIndex],
  )

  const handlePreserveMetadataToggle = useCallback(() => {
    if (videoIndex >= 0 && appProxy.state.videos[videoIndex]?.config) {
      appProxy.state.videos[videoIndex].config.shouldPreserveMetadata =
        !appProxy.state.videos[videoIndex].config.shouldPreserveMetadata
      appProxy.state.videos[videoIndex].isConfigDirty = true

      if (appProxy.state.videos[videoIndex].config.shouldPreserveMetadata) {
        appProxy.state.videos[videoIndex].config.metadataConfig = null
      } else {
        appProxy.state.videos[videoIndex].config.metadataConfig = cloneDeep(
          videoMetadataConfigInitialState,
        )
      }
    } else {
      if (appProxy.state.videos.length > 1) {
        appProxy.state.commonConfigForBatchCompression.shouldPreserveMetadata =
          !appProxy.state.commonConfigForBatchCompression.shouldPreserveMetadata

        if (
          appProxy.state.commonConfigForBatchCompression.shouldPreserveMetadata
        ) {
          appProxy.state.commonConfigForBatchCompression.metadataConfig = null
        } else {
          appProxy.state.commonConfigForBatchCompression.metadataConfig =
            cloneDeep(videoMetadataConfigInitialState)
        }

        normalizeBatchVideosConfig()
      }
    }
  }, [videoIndex])

  const shouldDisableInput =
    videos.length === 0 || isCompressing || isProcessCompleted || isLoadingFiles

  return (
    <div className="mb-6">
      <Switch
        isSelected={shouldPreserveMetadata}
        onValueChange={handlePreserveMetadataToggle}
        isDisabled={shouldDisableInput}
      >
        <div className="flex justify-center items-center">
          <span className="text-gray-600 dark:text-gray-400 block mr-2 text-sm">
            Preserve Metadata
          </span>
        </div>
      </Switch>
      <AnimatePresence mode="wait">
        {!shouldPreserveMetadata ? (
          <Card className="px-2 my-2 pb-4 shadow-none border-1 dark:border-none">
            <motion.div {...slideDownTransition} className="space-y-4 mt-2">
              <div className="text-zinc-700 dark:text-zinc-400">
                <p className="text-xs  italic">
                  - Leave the field empty to keep the original
                </p>{' '}
                <p className="text-xs  italic">
                  - Or, add a whitespace to remove the original
                </p>
              </div>
              <div>
                <TextInput
                  type="text"
                  label="Title"
                  placeholder="Enter video title"
                  defaultValue={metadataConfig?.title ?? ''}
                  isDisabled={shouldDisableInput}
                  onValueChange={(value) => updateMetadataField('title', value)}
                  classNames={{ mainWrapper: 'my-3' }}
                />
                <Divider className="mb-6" />
              </div>
              <div>
                <TextInput
                  type="text"
                  label="Artist"
                  placeholder="Enter artist name"
                  defaultValue={metadataConfig?.artist ?? ''}
                  isDisabled={shouldDisableInput}
                  onValueChange={(value) =>
                    updateMetadataField('artist', value)
                  }
                  classNames={{ mainWrapper: 'my-3' }}
                />
                <Divider className="mb-6" />
              </div>
              <div>
                <TextInput
                  type="text"
                  label="Album"
                  placeholder="Enter album name"
                  defaultValue={metadataConfig?.album ?? ''}
                  isDisabled={shouldDisableInput}
                  onValueChange={(value) => updateMetadataField('album', value)}
                  classNames={{ mainWrapper: 'my-3' }}
                />
                <Divider className="mb-6" />
              </div>
              <div>
                <TextInput
                  type="text"
                  label="Genre"
                  placeholder="Enter genre"
                  defaultValue={metadataConfig?.genre ?? ''}
                  isDisabled={shouldDisableInput}
                  classNames={{ mainWrapper: 'my-3' }}
                  onValueChange={(value) => updateMetadataField('genre', value)}
                />
                <Divider className="mb-6" />
              </div>
              <div>
                <TextInput
                  type="text"
                  label="Year/Date"
                  placeholder="Enter year or date"
                  defaultValue={metadataConfig?.year ?? ''}
                  isDisabled={shouldDisableInput}
                  classNames={{ mainWrapper: 'my-3' }}
                  onValueChange={(value) => updateMetadataField('year', value)}
                />
                <Divider className="mb-6" />
              </div>
              <div className="!mt-[-10px]">
                <TextArea
                  type="text"
                  label="Description"
                  placeholder="Enter description"
                  defaultValue={metadataConfig?.description ?? ''}
                  isDisabled={shouldDisableInput}
                  onValueChange={(value) =>
                    updateMetadataField('description', value)
                  }
                  className="mb-3"
                />
                <Divider className="mb-6" />
              </div>
              <div className="!mt-[-10px]">
                <TextArea
                  type="text"
                  label="Synopsis"
                  placeholder="Enter synopsis"
                  defaultValue={metadataConfig?.synopsis ?? ''}
                  isDisabled={shouldDisableInput}
                  onValueChange={(value) =>
                    updateMetadataField('synopsis', value)
                  }
                  className="mb-3"
                />
                <Divider className="mb-6" />
              </div>
              <div className="!mt-[-10px]">
                <TextArea
                  type="text"
                  label="Comment"
                  placeholder="Enter comment"
                  defaultValue={metadataConfig?.comment ?? ''}
                  isDisabled={shouldDisableInput}
                  onValueChange={(value) =>
                    updateMetadataField('comment', value)
                  }
                  className="mb-3"
                />
                <Divider className="mb-6" />
              </div>
              <div className="!mt-[-10px]">
                <TextArea
                  type="text"
                  label="Copyright"
                  placeholder="Enter copyright information"
                  defaultValue={metadataConfig?.copyright ?? ''}
                  isDisabled={shouldDisableInput}
                  onValueChange={(value) =>
                    updateMetadataField('copyright', value)
                  }
                  className="mb-3"
                />
                <Divider className="mb-6" />
              </div>

              <div>
                <div className="flex items-center mt-[-10px]">
                  <Switch
                    isSelected={Boolean(
                      metadataConfig?.shouldEnableCreationTime,
                    )}
                    onValueChange={(isSelected) => {
                      updateMetadataField(
                        'shouldEnableCreationTime',
                        isSelected as any,
                      )
                    }}
                    className="flex justify-center items-center"
                    isDisabled={shouldDisableInput}
                    size="sm"
                  >
                    <div className="flex justify-center items-center">
                      <span className="text-black1 dark:text-white1 block mr-2 text-xs opacity-90">
                        Creation Time
                      </span>
                    </div>
                  </Switch>
                </div>
                {metadataConfig?.shouldEnableCreationTime &&
                metadataConfig?.creationTimeRaw ? (
                  <DatePicker
                    hideTimeZone
                    showMonthAndYearPickers
                    label=""
                    placeholder="Enter creation time"
                    isDisabled={
                      shouldDisableInput ||
                      !metadataConfig?.shouldEnableCreationTime
                    }
                    onChange={(value) => {
                      updateMetadataField('creationTimeRaw', value as any)
                    }}
                    defaultValue={metadataConfig?.creationTimeRaw as any}
                    value={metadataConfig?.creationTimeRaw as any}
                    className="mt-2"
                  />
                ) : null}
              </div>
            </motion.div>
          </Card>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default Metadata
