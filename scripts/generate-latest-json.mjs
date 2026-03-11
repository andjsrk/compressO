#!/usr/bin/env node
/** biome-ignore-all lint/suspicious/noConsole: <> */

/**
 * Generate latest.json for Tauri updater
 *
 * This script generates a latest.json file that contains the latest release information
 * for the Tauri updater plugin to check for updates.
 *
 * Usage: node scripts/generate-latest-json.mjs
 *
 * Output: Creates a latest.json file in the root directory
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const CONFIG = {
  author: 'codeforreal1',
  repo: 'compressO',
  appName: 'CompressO',
}

/**
 * Get the latest version from package.json
 */
function getVersion() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
  )
  return packageJson.version
}

/**
 * Get changelog for the specified version from CHANGELOG.md
 */
function getChangelog(version) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md')

  if (!fs.existsSync(changelogPath)) {
    console.warn('Warning: CHANGELOG.md not found')
    return 'No changelog available'
  }

  const content = fs.readFileSync(changelogPath, 'utf-8')
  const lines = content.split('\n')

  const versionLineIndex = lines.findIndex((line) =>
    line.trim().startsWith(`### ${version}`),
  )

  if (versionLineIndex === -1) {
    console.warn(`Warning: Version ${version} not found in CHANGELOG.md`)
    return 'No changelog available'
  }

  const changelogLines = []

  for (let i = versionLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('###') && !line.startsWith('####')) {
      break
    }

    changelogLines.push(line)
  }

  while (changelogLines.length > 0 && changelogLines[0].trim() === '') {
    changelogLines.shift()
  }
  while (
    changelogLines.length > 0 &&
    changelogLines[changelogLines.length - 1].trim() === ''
  ) {
    changelogLines.pop()
  }

  return changelogLines.join('\n').trim()
}

/**
 * Get current UTC time in ISO 8601 format
 */
function getCurrentUTCTime() {
  return new Date().toISOString()
}

/**
 * Generate platform-specific URLs
 */
function generatePlatformUrls(version) {
  const baseUrl = `https://github.com/${CONFIG.author}/${CONFIG.repo}/releases/download/${version}`
  const platforms = {}

  platforms['darwin-aarch64'] = {
    signature: `${baseUrl}/${CONFIG.appName}_${version}_aarch64.dmg.sig`,
    url: `${baseUrl}/${CONFIG.appName}_${version}_aarch64.dmg`,
  }

  platforms['darwin-x86_64'] = {
    signature: `${baseUrl}/${CONFIG.appName}_${version}_x64.dmg.sig`,
    url: `${baseUrl}/${CONFIG.appName}_${version}_x64.dmg`,
  }

  platforms['windows-x86_64'] = {
    signature: `${baseUrl}/${CONFIG.appName}_${version}_x64.exe.sig`,
    url: `${baseUrl}/${CONFIG.appName}_${version}_x64.exe.nsis`,
  }

  platforms['linux-amd64'] = {
    signature: `${baseUrl}/${CONFIG.appName}_${version}_amd64.deb.sig`,
    url: `${baseUrl}/${CONFIG.appName}_${version}_amd64.deb`,
  }

  platforms['linux-appimage'] = {
    signature: `${baseUrl}/${CONFIG.appName}_${version}_amd64.AppImage.sig`,
    url: `${baseUrl}/${CONFIG.appName}_${version}_amd64.AppImage`,
  }

  return platforms
}

/**
 * Generate the latest.json content
 */
function generateLatestJson(version, changelog, pubDate) {
  const platforms = generatePlatformUrls(version)

  return {
    version,
    notes: changelog,
    pub_date: pubDate,
    platforms,
  }
}

/**
 * Write JSON to file with proper formatting
 */
function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

/**
 * Main function
 */
function main() {
  console.log('> Generating `latest.json` for Tauri updater\n')

  const version = getVersion()
  console.log(`> Version: ${version}`)

  const changelog = getChangelog(version)
  console.log('> Changelog extracted')

  const pubDate = getCurrentUTCTime()
  console.log(`> Published date: ${pubDate}`)

  const latestJson = generateLatestJson(version, changelog, pubDate)
  console.log('> JSON generated')

  const outputPath = path.join(__dirname, '..', 'latest.json')
  writeJsonFile(outputPath, latestJson)

  console.log(
    '\n> Done! You can now upload `latest.json` to your GitHub release.\n',
  )
}

main()
