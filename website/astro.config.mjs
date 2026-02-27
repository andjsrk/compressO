// @ts-check

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  base: '/',
  site: 'https://compresso.codeforreal.com',
  integrations: [mdx(), sitemap()],
  output: 'static',
  outDir: 'dist',
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        external: ['@resvg/resvg-js'],
      },
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'catppuccin-mocha',
    },
  },
})
