import { ScrollShadow } from '@heroui/react'
import { AnimatePresence } from 'framer-motion'
import React from 'react'
import { useSnapshot } from 'valtio'

import Layout from '@/components/Layout'
import Title from '@/components/Title'
import { cn } from '@/utils/tailwind'
import { appProxy } from '../-state'
import CompressionActions from './CompressionActions'
import CompressionProgress from './CompressionProgress'
import CustomizeMediaOnBatchActions from './CustomizeMediaOnBatchActions'
import OutputSettings from './output-settings/-index'
import PreviewBatchVideos from './PreviewBatchMedia'
import PreviewSingleVideo from './PreviewSingleMedia'
import StartCompression from './StartCompression'
import styles from './styles.module.css'

function MediaConfig() {
  const {
    state: { media, isCompressing, selectedMediaIndexForCustomization },
  } = useSnapshot(appProxy)

  return (
    <Layout
      childrenProps={{
        className: 'h-full',
      }}
      hideLogo
    >
      <div className={cn(['h-full p-6', styles.videoConfigContainer])}>
        <section
          className={cn(
            'relative w-full h-full px-4 py-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 overflow-hidden',
          )}
        >
          <AnimatePresence>
            {media.length > 1 ? (
              <>
                <PreviewBatchVideos />
                {selectedMediaIndexForCustomization > -1 ? (
                  <CustomizeMediaOnBatchActions />
                ) : null}
              </>
            ) : (
              <PreviewSingleVideo mediaIndex={0} />
            )}
          </AnimatePresence>
        </section>
        <section className="relative p-4 w-full h-full rounded-xl border-2 border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between w-full mb-2">
            <Title
              title={
                media.length === 1 || selectedMediaIndexForCustomization > -1
                  ? 'Output Settings'
                  : 'Batch Settings'
              }
              className="text-xl font-bold"
            />
            {!isCompressing ? <CompressionActions /> : null}
          </div>
          <ScrollShadow className="h-[78vh] hxl:h-[82vh] pb-10" hideScrollBar>
            <OutputSettings
              mediaIndex={
                media.length === 1 ? 0 : selectedMediaIndexForCustomization
              }
            />
          </ScrollShadow>
          <div className="absolute bottom-4 left-4 right-4">
            <StartCompression />
          </div>
        </section>
      </div>
      {isCompressing ? <CompressionProgress /> : null}
    </Layout>
  )
}

export default React.memo(MediaConfig)
