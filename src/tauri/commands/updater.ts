import { core } from '@tauri-apps/api'

export interface UpdateInfo {
  available: boolean
  current_version: string
  latest_version: string | null
  body: string | null
  date: string | null
}

export function checkUpdate(): Promise<UpdateInfo> {
  return core.invoke('check_update')
}

export function installUpdate(): Promise<string> {
  return core.invoke('install_update')
}
