import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

import { Toaster } from '@/components/Toast'
import Titlebar from '@/tauri/components/Titlebar'
import { getPlatform } from '@/utils/fs'
import UIProvider from '../providers/UIProvider'

export const Route = createRootRoute({
  component: RootComponent,
})

const isDev = import.meta.env.DEV

const { isMacOS } = getPlatform()

function RootComponent() {
  return (
    <>
      <UIProvider className={isMacOS ? 'pt-4' : ''}>
        {isMacOS ? <Titlebar /> : null}
        <Outlet />
      </UIProvider>
      <Toaster />
      {isDev ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  )
}
