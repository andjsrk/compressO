import { emitTo } from '@tauri-apps/api/event'
import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { snapshot, useSnapshot } from 'valtio'

import Button from '@/components/Button'
import { toast } from '@/components/Toast'
import { CustomEvents } from '@/types/compression'
import { appProxy } from '../-state'

function CancelCompression() {
  const {
    state: { isCompressing },
  } = useSnapshot(appProxy)

  const [confirmCancellation, setConfirmCancellation] = React.useState(false)
  const [isCancelling, setIsCancelling] = React.useState(false)

  const cancelOngoingCompression = async () => {
    try {
      const appSnapShot = snapshot(appProxy)
      setIsCancelling(true)
      await emitTo('main', CustomEvents.CancelInProgressCompression, {
        videoId: appSnapShot.state.videos[0].id,
        batchId: appSnapShot.state.batchId,
      })
      appProxy.timeTravel('beforeCompressionStarted')
    } catch {
      toast.error('Cannot cancel compression at this point.')
    }
    setConfirmCancellation(false)
  }

  return isCompressing ? (
    <Button
      color="danger"
      size="lg"
      variant={confirmCancellation ? 'solid' : 'flat'}
      onPress={() => {
        if (!confirmCancellation) {
          setConfirmCancellation(true)
        } else {
          cancelOngoingCompression()
        }
      }}
      isLoading={isCancelling}
      isDisabled={isCancelling}
      fullWidth
    >
      <AnimatePresence mode="wait">
        <motion.div layout="preserve-aspect">
          {confirmCancellation && !isCancelling
            ? 'Confirm Cancel'
            : isCancelling
              ? 'Cancelling...'
              : 'Cancel'}
        </motion.div>
      </AnimatePresence>
    </Button>
  ) : null
}

export default React.memo(CancelCompression)
