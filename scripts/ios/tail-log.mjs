#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
}

function resolveConfigPath() {
  const candidate = path.resolve(repoRoot(), 'src-tauri', 'tauri.conf.json')
  if (!candidate.startsWith(repoRoot())) {
    throw new Error('Refusing to read config outside repo root')
  }
  return candidate
}

function loadBundleId() {
  const configPath = resolveConfigPath()
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const json = JSON.parse(readFileSync(configPath, 'utf8'))
  return json.identifier || 'org.thorchain.asgardex'
}

const BUNDLE_ID = loadBundleId()
const LOG_RELATIVE_PATH = path.join('logs', 'ASGARDEX.log')

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim()
}

function findBootedUdids() {
  const out = sh('xcrun simctl list devices')
  const udids = []
  for (const line of out.split('\n')) {
    if (line.includes('(Booted)')) {
      const m = line.match(/\(([A-F0-9-]{36})\)/)
      if (m) udids.push(m[1])
    }
  }
  return udids
}

function getAppContainer(udid) {
  try {
    const p = sh(`xcrun simctl get_app_container "${udid}" ${BUNDLE_ID} data`)
    return p
  } catch {
    return ''
  }
}

function run() {
  const booted = findBootedUdids()
  if (booted.length === 0) {
    console.error('No booted iOS simulator found. Launch with: yarn tauri ios dev "iPhone 17 Pro"')
    process.exit(1)
  }
  const udid = booted[0]
  const container = getAppContainer(udid)
  if (!container) {
    console.error(`App container not found for UDID ${udid}. Is the app installed/running?`)
    process.exit(2)
  }
  const rawLogPath = path.join(container, 'Library', 'Application Support', BUNDLE_ID, LOG_RELATIVE_PATH)
  const logPath = path.normalize(rawLogPath)
  if (!logPath.startsWith(container)) {
    throw new Error('Log path must stay within the simulator container')
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(logPath)) {
    console.error(`Log file not found yet: ${logPath}. Open the app to create it.`)
  }
  console.log(`Tailing: ${logPath}`)
  const tail = spawn('tail', ['-f', logPath], { stdio: 'inherit' })
  tail.on('exit', (code) => process.exit(code ?? 0))
}

run()
