#!/usr/bin/env node
/**
 * Syncs version from package.json to Tauri config files.
 * Run before Tauri builds to ensure version consistency.
 *
 * Updates:
 * - src-tauri/Cargo.toml (version field)
 * - src-tauri/tauri.conf.json (version and bundleVersion fields)
 */

import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Read package.json version
const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const version = packageJson.version

console.log(`Syncing version ${version} to Tauri configs...`)

// Update Cargo.toml
const cargoPath = join(ROOT, 'src-tauri', 'Cargo.toml')
let cargoContent = readFileSync(cargoPath, 'utf8')
const cargoVersionRegex = /^version\s*=\s*"[^"]+"/m
if (cargoVersionRegex.test(cargoContent)) {
  cargoContent = cargoContent.replace(cargoVersionRegex, `version = "${version}"`)
  writeFileSync(cargoPath, cargoContent)
  console.log(`  Updated: src-tauri/Cargo.toml`)
} else {
  console.error(`  ERROR: Could not find version in Cargo.toml`)
  process.exit(1)
}

// Update tauri.conf.json
const tauriConfPath = join(ROOT, 'src-tauri', 'tauri.conf.json')
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'))

let updated = false
if (tauriConf.version !== version) {
  tauriConf.version = version
  updated = true
}
if (tauriConf.bundle?.iOS?.bundleVersion !== version) {
  tauriConf.bundle.iOS.bundleVersion = version
  updated = true
}

if (updated) {
  writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n')
  console.log(`  Updated: src-tauri/tauri.conf.json`)
} else {
  console.log(`  tauri.conf.json already up to date`)
}

console.log(`Version sync complete.`)
