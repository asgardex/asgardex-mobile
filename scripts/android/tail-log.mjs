#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const LOG_RELATIVE_PATH = 'logs/ASGARDEX.log'

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

function loadPackageId() {
  const configPath = resolveConfigPath()
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const json = JSON.parse(readFileSync(configPath, 'utf8'))
  return json.identifier || 'org.thorchain.asgardex'
}

const PACKAGE_ID = loadPackageId()

function sh(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim()
}

function ensureAdbAvailable() {
  try {
    execSync('adb version', { stdio: 'ignore' })
  } catch (err) {
    console.error('adb is required but was not found in PATH.')
    console.error('Install Android platform tools or add them to PATH before running this script.')
    process.exit(1)
  }
}

function pickDevice() {
  const out = sh('adb devices')
  const lines = out.split('\n').slice(1)
  const devices = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.endsWith('device')) {
      const [serial] = trimmed.split('\t')
      if (serial) devices.push(serial)
    }
  }

  if (devices.length === 0) {
    console.error('No Android devices or emulators detected. Start one and retry (e.g. Android Studio Pixel emulator).')
    process.exit(1)
  }

  if (devices.length > 1 && !process.env.ANDROID_SERIAL) {
    console.warn(
      'Multiple Android devices detected. Using the first one. Set ANDROID_SERIAL to choose a specific device.'
    )
  }

  const serial = process.env.ANDROID_SERIAL || devices[0]
  return serial
}

function ensureLogFile(serial) {
  try {
    execSync(`adb -s ${serial} shell run-as ${PACKAGE_ID} ls ${LOG_RELATIVE_PATH}`, { stdio: 'ignore' })
    return true
  } catch (err) {
    console.error(`Log file ${LOG_RELATIVE_PATH} not found in ${PACKAGE_ID} sandbox.`)
    console.error('Launch the Android app first so it initializes logging, then rerun this command.')
    return false
  }
}

function tailLog(serial) {
  console.log(`Tailing ${LOG_RELATIVE_PATH} from ${PACKAGE_ID} on device ${serial}...`)
  const tail = spawn('adb', ['-s', serial, 'shell', 'run-as', PACKAGE_ID, 'tail', '-F', LOG_RELATIVE_PATH], {
    stdio: 'inherit'
  })

  tail.on('error', (err) => {
    console.error(`Failed to spawn adb tail: ${err.message}`)
    process.exit(1)
  })

  tail.on('exit', (code, signal) => {
    if (signal) {
      process.exit(0)
    } else {
      process.exit(code ?? 0)
    }
  })
}

function run() {
  ensureAdbAvailable()
  const serial = pickDevice()
  if (!ensureLogFile(serial)) {
    process.exit(2)
  }
  tailLog(serial)
}

run()
