import { AnimatePresence, motion } from 'framer-motion'
import React, { useCallback } from 'react'
import { snapshot, useSnapshot } from 'valtio'

import Slider from '@/components/Slider'
import Switch from '@/components/Switch'
import { slideDownTransition } from '@/utils/animation'
import { appProxy, normalizeBatchMediaConfig } from '../../../-state'

type CompressionQualityProps = {
  mediaIndex: number
}

function CompressionQuality({ mediaIndex }: CompressionQualityProps) {
  const {
    state: {
      isCompressing,
      isProcessCompleted,
      media,
      commonConfigForBatchCompression,
      isLoadingMediaFiles,
    },
  } = useSnapshot(appProxy)
  const image =
    media.length > 0 && mediaIndex >= 0 && media[mediaIndex].type == 'image'
      ? media[mediaIndex]
      : null
  const { config } = image ?? {}
  const { quality: compressionQuality, isLossless } =
    config ?? commonConfigForBatchCompression.imageConfig ?? {}

  const [quality, setQuality] = React.useState<number>(
    compressionQuality ?? 100,
  )
  const debounceRef = React.useRef<NodeJS.Timeout>()
  const qualityRef = React.useRef<number>(quality)

  React.useEffect(() => {
    qualityRef.current = quality
  }, [quality])

  React.useEffect(() => {
    const appSnapshot = snapshot(appProxy)
    if (
      appSnapshot.state.media.length &&
      quality !==
        (mediaIndex >= 0 && appSnapshot.state.media[mediaIndex].type === 'image'
          ? appSnapshot.state.media[mediaIndex]?.config?.quality
          : appSnapshot.state.media.length > 1
            ? appSnapshot.state.commonConfigForBatchCompression?.imageConfig
                ?.quality
            : undefined)
    ) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        if (
          mediaIndex >= 0 &&
          appProxy.state.media[mediaIndex].type === 'image' &&
          appProxy.state.media[mediaIndex]?.config
        ) {
          appProxy.state.media[mediaIndex].config.quality = quality
          appProxy.state.media[mediaIndex].isConfigDirty = true
        } else {
          if (appProxy.state.media.length > 1) {
            appProxy.state.commonConfigForBatchCompression.imageConfig.quality =
              quality
            normalizeBatchMediaConfig()
          }
        }
      }, 500)
    }
    return () => {
      clearTimeout(debounceRef.current)
    }
  }, [quality, mediaIndex])

  React.useEffect(() => {
    if (compressionQuality !== qualityRef.current) {
      if (
        typeof compressionQuality === 'number' &&
        !Number.isNaN(+compressionQuality)
      )
        setQuality(compressionQuality)
    }
  }, [compressionQuality])

  const handleQualityChange = React.useCallback((value: number | number[]) => {
    if (typeof value === 'number') {
      setQuality(value)
    }
  }, [])

  const handleSwitchToggle = useCallback(() => {
    if (
      mediaIndex >= 0 &&
      appProxy.state.media[mediaIndex].type === 'image' &&
      appProxy.state.media[mediaIndex]?.config
    ) {
      appProxy.state.media[mediaIndex].config.isLossless =
        !appProxy.state.media[mediaIndex].config.isLossless
      appProxy.state.media[mediaIndex].isConfigDirty = true
    } else {
      if (appProxy.state.media.length > 1) {
        appProxy.state.commonConfigForBatchCompression.imageConfig.isLossless =
          !appProxy.state.commonConfigForBatchCompression.imageConfig.isLossless
        normalizeBatchMediaConfig()
      }
    }
  }, [mediaIndex])

  const shouldDisableInput =
    media.length === 0 ||
    isCompressing ||
    isProcessCompleted ||
    isLoadingMediaFiles ||
    image?.extension === 'svg'

  return (
    <>
      <Switch
        isSelected={isLossless}
        onValueChange={handleSwitchToggle}
        isDisabled={shouldDisableInput}
      >
        <p className="text-gray-600 dark:text-gray-400 text-sm mr-2 w-full">
          Lossless Compression
        </p>
      </Switch>
      <AnimatePresence mode="wait">
        {!isLossless ? (
          <motion.div {...slideDownTransition}>
            <Slider
              label="Quality"
              aria-label="Quality"
              marks={[
                {
                  value: 1,
                  label: 'Low',
                },
                {
                  value: 50,
                  label: 'Medium',
                },
                {
                  value: 100,
                  label: 'High',
                },
              ]}
              minValue={1}
              maxValue={100}
              className="mb-8 mt-1 mx-auto"
              classNames={{
                mark: 'text-[11px] mt-2',
                base: 'mt-[-10px]',
                label: 'text-xs',
              }}
              getValue={(value) => {
                const val = Array.isArray(value) ? value?.[0] : +value
                return val < 50
                  ? 'Low'
                  : val >= 50 && val < 99
                    ? 'Medium'
                    : 'High'
              }}
              renderValue={() => (
                <p className="text-primary text-xs">{quality}%</p>
              )}
              value={quality}
              onChange={handleQualityChange}
              isDisabled={isLossless || shouldDisableInput}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

export default CompressionQuality
