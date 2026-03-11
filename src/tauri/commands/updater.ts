import { core } from '@tauri-apps/api'

export interface UpdateInfo {
  isUpdateAvailable: boolean
  currentVersion: string
  latestVersion: string | null
  body: string | null
  date: string | null
}

export function checkUpdate(): Promise<UpdateInfo> {
  return core.invoke('check_update')
}

export function installUpdate(): Promise<string> {
  return core.invoke('install_update')
}
