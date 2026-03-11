import { proxy } from 'valtio'

import { checkUpdate, installUpdate } from '@/tauri/commands/updater'
import { toast } from '@/components/Toast'

export type UpdateState = {
  available: boolean
  currentVersion: string
  latestVersion: string | null
  body: string | null
  date: string | null
  isChecking: boolean
  isInstalling: boolean
  installProgress: number
  hasChecked: boolean
}

export const updateStore = proxy<UpdateState>({
  available: false,
  currentVersion: '',
  latestVersion: null,
  body: null,
  date: null,
  isChecking: false,
  isInstalling: false,
  installProgress: 0,
  hasChecked: false,
})

export async function checkForUpdates() {
  if (updateStore.isChecking || updateStore.isInstalling) return

  updateStore.isChecking = true

  try {
    const info = await checkUpdate()
    updateStore.available = info.available
    updateStore.currentVersion = info.current_version
    updateStore.latestVersion = info.latest_version
    updateStore.body = info.body
    updateStore.date = info.date
    updateStore.hasChecked = true

    if (info.available) {
      toast.success(`New version ${info.latest_version} is available!`)
    }
  } catch (error) {
    console.error('Failed to check for updates:', error)
  } finally {
    updateStore.isChecking = false
  }
}

export async function installUpdateApp() {
  if (updateStore.isInstalling) return

  updateStore.isInstalling = true
  updateStore.installProgress = 0

  try {
    await installUpdate()
    toast.success('Update will be installed automatically. The app will restart.')
  } catch (error) {
    console.error('Failed to install update:', error)
    toast.error('Failed to install update. Please try again.')
  } finally {
    // Reset after a delay since the app will restart anyway
    setTimeout(() => {
      updateStore.isInstalling = false
    }, 2000)
  }
}

// Listen to update events
export function setupUpdateListeners() {
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('update-event', (event) => {
      console.log('Update event:', event.payload)
      // Parse progress from event if needed
    })

    listen('update-error', (event) => {
      console.error('Update error:', event.payload)
      toast.error(`Update error: ${event.payload}`)
    })
  })
}
