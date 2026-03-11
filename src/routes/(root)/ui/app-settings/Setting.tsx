import { DropdownItem, useDisclosure } from '@heroui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSnapshot } from 'valtio'
import React from 'react'

import Button from '@/components/Button'
import ColorPicker from '@/components/ColorPicker'
import Divider from '@/components/Divider'
import Dropdown, { DropdownMenu, DropdownTrigger } from '@/components/Dropdown'
import Icon from '@/components/Icon'
import Modal, { ModalContent } from '@/components/Modal'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import Title from '@/components/Title'
import { toast } from '@/components/Toast'
import Tooltip from '@/components/Tooltip'
import { deleteCache as invokeDeleteCache } from '@/tauri/commands/fs'
import { updateStore } from '@/stores/updateStore'
import About from './About'

type DropdownKey = 'settings' | 'about' | 'update'

function Setting() {
  const modalDisclosure = useDisclosure()
  const { available, latestVersion } = useSnapshot(updateStore)

  const [selectedKey, setSelectedKey] = React.useState<DropdownKey>('settings')
  const handleDropdownAction = (item: string | number) => {
    modalDisclosure.onOpen()
    setSelectedKey(item as DropdownKey)
  }

  return (
    <>
      <div className="absolute bottom-4 left-4 p-0 z-[1]">
        <Dropdown placement="right">
          <DropdownTrigger>
            <Button isIconOnly size="sm">
              <Tooltip
                content="Open Settings"
                aria-label="Open Settings"
                placement="right"
              >
                <Icon name="setting" size={23} />
              </Tooltip>
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            variant="faded"
            aria-label="Dropdown menu with description"
            onAction={handleDropdownAction}
          >
            {available && latestVersion ? (
              <DropdownItem
                key="update"
                className="text-primary dark:text-primary-400"
                startContent={<Icon name="download" />}
              >
                Update to {latestVersion}
              </DropdownItem>
            ) : null}
            <DropdownItem key="settings" startContent={<Icon name="setting" />}>
              Settings
            </DropdownItem>
            <DropdownItem key="about" startContent={<Icon name="info" />}>
              About
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      <Modal
        isOpen={modalDisclosure.isOpen}
        onClose={modalDisclosure.onClose}
        motionVariant="bottomToTop"
      >
        <ModalContent className="max-w-[30rem] pb-2 overflow-hidden rounded-2xl">
          {selectedKey === 'settings' ? (
            <AppSetting />
          ) : selectedKey === 'update' ? (
            <UpdateModal onClose={modalDisclosure.onClose} />
          ) : (
            <About />
          )}
        </ModalContent>
      </Modal>
    </>
  )
}

function AppSetting() {
  const [confirmClearCache, setConfirmClearCache] = React.useState(false)
  const [isCacheDeleting, setIsCacheDeleting] = React.useState(false)

  const deleteCache = async () => {
    setIsCacheDeleting(true)
    try {
      await invokeDeleteCache()
      toast.success('All cache were cleared.')
      setConfirmClearCache(false)
    } catch (_) {
      toast.error('There was a problem clearing cache.')
    }
    setIsCacheDeleting(false)
  }

  return (
    <div className="w-full py-12 pb-16 px-8">
      <section className="mb-6">
        <Title title="Settings" iconProps={{ name: 'setting' }} />
      </section>
      <div className="mx-auto bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3 overflow-hidden">
        <div className="flex justify-between items-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">Theme</p>
          <ThemeSwitcher />
        </div>
        <Divider className="my-2 dark:bg-zinc-700" />
        <div className="flex justify-between items-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">Color</p>
          <ColorPicker />
        </div>
        <Divider className="my-2 dark:bg-zinc-700" />
        <div className="flex justify-between items-center">
          <p className="dark:text-red-400 text-sm text-red-400">Clear Cache</p>
          <Tooltip
            content="Clear cache"
            aria-label="Clear cache"
            placement="right"
            isDisabled={confirmClearCache}
          >
            <div className="flex items-center">
              <Button
                isIconOnly={!confirmClearCache}
                size="sm"
                color="danger"
                variant={confirmClearCache ? 'solid' : 'flat'}
                onPress={() => {
                  if (!confirmClearCache) {
                    setConfirmClearCache(true)
                  } else {
                    deleteCache()
                  }
                }}
                isLoading={isCacheDeleting}
              >
                <div>
                  <Icon name="trash" />
                </div>
                <AnimatePresence initial={false}>
                  {confirmClearCache ? (
                    <motion.p
                      initial={{ width: 0, opacity: 0 }}
                      animate={{
                        width: 'auto',
                        opacity: 1,
                        transition: {
                          duration: 0.3,
                          bounce: 0.2,
                          type: 'spring',
                        },
                      }}
                      exit={{
                        width: 0,
                        opacity: 0,
                      }}
                    >
                      Clear Now
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </Button>
            </div>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

interface UpdateModalProps {
  onClose: () => void
}

function UpdateModal({ onClose }: UpdateModalProps) {
  const { available, latestVersion, currentVersion, body, isInstalling } =
    useSnapshot(updateStore)

  const handleInstall = async () => {
    try {
      const { installUpdateApp } = await import('@/stores/updateStore')
      await installUpdateApp()
      onClose()
    } catch {
      toast.error('Failed to install update. Please try again.')
    }
  }

  return (
    <div className="w-full py-12 pb-16 px-8">
      <section className="mb-6">
        <Title title="Update Available" iconProps={{ name: 'download' }} />
      </section>
      <div className="mx-auto bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-4 overflow-hidden">
        {available && latestVersion ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Current Version
                </p>
                <p className="font-semibold text-lg">{currentVersion}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Latest Version
                </p>
                <p className="font-semibold text-lg text-primary dark:text-primary-400">
                  {latestVersion}
                </p>
              </div>
            </div>
            <Divider className="my-2 dark:bg-zinc-700" />
            {body && (
              <div className="mt-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                  What's New
                </p>
                <div
                  className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line max-h-40 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              </div>
            )}
            <Divider className="my-2 dark:bg-zinc-700" />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="flat" size="sm" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                size="sm"
                onPress={handleInstall}
                isLoading={isInstalling}
              >
                Update Now
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              No updates available. You are on the latest version.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Setting
