import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')

const resolveProjectPath = (...segments: string[]) => {
  const target = path.resolve(PROJECT_ROOT, ...segments)
  const relative = path.relative(PROJECT_ROOT, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Access outside project root is forbidden: ${target}`)
  }
  return target
}

const readFile = (relativePath: string) => {
  const absolutePath = resolveProjectPath(relativePath)
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path sanitized via resolveProjectPath
  return fs.readFileSync(absolutePath, 'utf-8')
}

type ContentMatcher = string | RegExp

type TextExpectation = {
  file: string
  description: string
  mustInclude?: ContentMatcher[]
  mustExclude?: ContentMatcher[]
}

const TEXT_EXPECTATIONS: TextExpectation[] = [
  {
    file: '.gitignore',
    description: '.gitignore keeps Tauri build artifacts ignored',
    mustInclude: ['src-tauri/target/']
  },
  {
    file: 'src/main/preload.ts',
    description: 'Electron preload stays replaced by the Tauri adapter',
    mustInclude: ["import '../renderer/tauri/windowApi'"],
    mustExclude: [/contextBridge\.exposeInMainWorld/, /from ['"]electron['"]/]
  },
  {
    file: 'src/main/electron.ts',
    description: 'Electron main process keeps sanitized logging + ledger gating',
    mustInclude: ['sanitizePathSegment', 'getLedgerFlag']
  },
  {
    file: 'scripts/trunk-check.sh',
    description: 'trunk wrapper targets origin/main and incremental mode',
    mustInclude: ['UPSTREAM_BRANCH="main"', '--upstream origin/$UPSTREAM_BRANCH']
  },
  {
    file: 'src/renderer/index.html',
    description: 'index.html keeps viewport-fit for safe-area handling',
    mustInclude: ['viewport-fit=cover']
  },
  {
    file: 'src/renderer/index.tsx',
    description: 'Renderer bootstrap still wires safe-area watcher',
    mustInclude: ['watchSafeArea', './tauri/safeArea']
  },
  {
    file: 'src/renderer/components/settings/WalletSettings.tsx',
    description: 'Wallet settings retain responsive hooks + ledger gating',
    mustInclude: ['settings-wallet-header', 'wallet-actions-row', 'chain-management-header']
  },
  {
    file: 'src/renderer/components/settings/AppExpertMode.tsx',
    description: 'Expert mode layout hooks stay in place',
    mustInclude: ['settings-expert-section', 'settings-expert-toggle']
  },
  {
    file: 'src/renderer/components/settings/AppGeneralSettings.tsx',
    description: 'General settings still branch on ledger/mobile helpers',
    mustInclude: ['isLedgerUiEnabled', 'walletRoutes.ledgerChainSelect']
  },
  {
    file: 'src/renderer/components/settings/EditableUrl.tsx',
    description: 'Editable URL retains semantic classes for CSS overrides',
    mustInclude: ['editable-url-row', 'editable-url-input', 'editable-url-test-button']
  },
  {
    file: 'src/renderer/components/settings/UnlockWalletSettings.tsx',
    description: 'Unlock settings keep ledger mode toggle',
    mustInclude: ['isLedgerUiEnabled', 'Enter Ledger Mode']
  },
  {
    file: 'src/renderer/components/sidebar/SidebarComponent.tsx',
    description: 'Sidebar still routes footer icons through openExternalUrl',
    mustInclude: ['openExternalUrl', 'FooterIcon']
  },
  {
    file: 'src/renderer/components/uielements/drawer/Drawer.tsx',
    description: 'Drawer respects safe-area padding classes',
    mustInclude: [/p[tb]-safe/]
  },
  {
    file: 'src/renderer/components/AssetsFilter/AssetsFilter.tsx',
    description: 'Assets filter keeps responsive hooks',
    mustInclude: ['assets-filter-row', 'assets-filter-search']
  },
  {
    file: 'src/renderer/views/pools/ActivePools.tsx',
    description: 'Active pools table keeps mobile class wrapper',
    mustInclude: ['pools-table']
  },
  {
    file: 'src/renderer/views/pools/PendingPools.tsx',
    description: 'Pending pools table keeps mobile class wrapper',
    mustInclude: ['pools-table']
  },
  {
    file: 'src/renderer/components/wallet/assets/AssetsTableCollapsable.tsx',
    description: 'Wallet asset rows still expose action wrapper hook',
    mustInclude: ['wallet-asset-actions']
  },
  {
    file: 'src/renderer/components/wallet/phrase/ImportPhrase.tsx',
    description: 'Import phrase keeps biometric opt-in toggle',
    mustInclude: ['BiometricOptInToggle']
  },
  {
    file: 'src/renderer/components/wallet/phrase/NewPhraseGenerate.tsx',
    description: 'New phrase flow keeps biometric opt-in toggle',
    mustInclude: ['BiometricOptInToggle']
  },
  {
    file: 'src/renderer/components/wallet/unlock/UnlockForm.tsx',
    description: 'Unlock form preserves ledger-only mode button',
    mustInclude: ['isLedgerUiEnabled', 'Use Only Ledger']
  },
  {
    file: 'src/renderer/views/wallet/WalletAuth.tsx',
    description: 'WalletAuth waits for persistent keystore state',
    mustInclude: ['keystoreWalletsPersistent$', 'isStandaloneLedgerMode']
  },
  {
    file: 'src/renderer/views/app/AppView.tsx',
    description: 'App shell still renders Sidebar + ledger import guards',
    mustInclude: ['<Sidebar', 'ledgerAddressesPersistentRD']
  },
  {
    file: 'src/renderer/views/app/AppGeneralSettingsView.tsx',
    description: 'General settings view routes release links through openExternalUrl',
    mustInclude: ['openExternalUrl']
  },
  {
    file: 'src/renderer/views/app/AppDexSettingsView.tsx',
    description: 'DEX settings expose CSS hooks',
    mustInclude: ['settings-dex-section']
  },
  {
    file: 'src/renderer/views/app/AppUpdateView.tsx',
    description: 'Update modal keeps openExternalUrl fallback',
    mustInclude: ['openExternalUrl']
  },
  {
    file: 'src/renderer/views/ViewRoutes.tsx',
    description: 'Routes stay wrapped with WalletAuth + ledger gating',
    mustInclude: ['isLedgerUiEnabled', '<WalletAuth>']
  },
  {
    file: 'src/renderer/components/poolActionsHistory/PoolActionsHistory.helper.tsx',
    description: 'Pool history helper keeps zero-hash guard',
    mustInclude: ['ZERO_HASH_PATTERN']
  },
  {
    file: 'src/renderer/components/poolActionsHistory/PoolActionsHistory.helper.test.ts',
    description: 'Pool history tests cover zero-hash fallback',
    mustInclude: ['placeholder hashes']
  },
  {
    file: 'src/renderer/services/wallet/keystore.ts',
    description: 'Keystore service still references secure storage bridge',
    mustInclude: ['window.apiKeystore?.secure']
  },
  {
    file: 'src/renderer/services/wallet/types.ts',
    description: 'Wallet types retain standalone ledger helpers',
    mustInclude: ['isStandaloneLedgerMode']
  },
  {
    file: 'src/renderer/services/wallet/util.ts',
    description: 'Wallet util keeps hasImportedKeystore + isLocked helpers',
    mustInclude: ['hasImportedKeystore', 'isLocked']
  },
  {
    file: 'src/shared/api/io.ts',
    description: 'Shared IO layer exposes SecureKeystoreWallet helpers',
    mustInclude: ['SecureKeystoreWallet', 'isSecureKeystoreWallet']
  },
  {
    file: 'src/shared/api/types.ts',
    description: 'Shared window API types still include secure storage',
    mustInclude: ['SecureStorageApi', 'apiSecure']
  },
  {
    file: 'src/shared/mock/api.ts',
    description: 'Test mocks keep secure storage implementation',
    mustInclude: ['mockSecureStorage', 'secure: mockSecureStorage']
  },
  {
    file: 'src/renderer/components/settings/AppGeneralSettings.tsx',
    description: 'Ledger controls remain in general settings',
    mustInclude: ['isInStandaloneLedgerMode', 'appWalletService.switchToKeystoreMode']
  },
  {
    file: 'src/renderer/views/app/AppDexSettingsView.tsx',
    description: 'DEX view includes slip tolerance dropdown hooks',
    mustInclude: ['settings-dex-section-text']
  }
]

const assertContent = (content: string, file: string, matcher: ContentMatcher, shouldInclude: boolean) => {
  if (typeof matcher === 'string') {
    if (shouldInclude) {
      expect(content, `${file} is missing required text: ${matcher}`).toContain(matcher)
    } else {
      expect(content, `${file} should not contain: ${matcher}`).not.toContain(matcher)
    }
  } else if (shouldInclude) {
    expect(content, `${file} is missing required pattern: ${matcher}`).toMatch(matcher)
  } else {
    expect(content, `${file} should not match pattern: ${matcher}`).not.toMatch(matcher)
  }
}

const walkFiles = (dir: string, acc: string[] = []): string[] => {
  const absoluteDir = path.isAbsolute(dir) ? dir : resolveProjectPath(dir)
  const dirRelative = path.relative(PROJECT_ROOT, absoluteDir)
  if (dirRelative.startsWith('..')) {
    throw new Error(`Found path outside project root: ${absoluteDir}`)
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Directory validated via resolveProjectPath/relative guards
  const entries = fs.readdirSync(absoluteDir)
  entries.forEach((entry) => {
    const entryPath = resolveProjectPath(dirRelative, entry)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Entry validated via resolveProjectPath
    const stats = fs.statSync(entryPath)
    if (stats.isDirectory()) {
      walkFiles(entryPath, acc)
    } else {
      acc.push(entryPath)
    }
  })
  return acc
}

const REQUIRED_TAURI_SCRIPTS = [
  'dev:tauri',
  'build:tauri',
  'tauri:android:debug',
  'tauri:android:release',
  'tauri:clean',
  'android:tail',
  'ios:tail'
]

type SettingsLocale = 'de' | 'es' | 'fr' | 'hi' | 'ko' | 'ru'
type WalletLocale = SettingsLocale

const loadSettingsMessages = async (locale: SettingsLocale) => {
  switch (locale) {
    case 'de':
      return (await import('../i18n/de/settings')).default
    case 'es':
      return (await import('../i18n/es/settings')).default
    case 'fr':
      return (await import('../i18n/fr/settings')).default
    case 'hi':
      return (await import('../i18n/hi/settings')).default
    case 'ko':
      return (await import('../i18n/ko/settings')).default
    case 'ru':
      return (await import('../i18n/ru/settings')).default
    default:
      throw new Error(`Unsupported locale: ${locale}`)
  }
}

const loadWalletMessages = async (locale: WalletLocale) => {
  switch (locale) {
    case 'de':
      return (await import('../i18n/de/wallet')).default
    case 'es':
      return (await import('../i18n/es/wallet')).default
    case 'fr':
      return (await import('../i18n/fr/wallet')).default
    case 'hi':
      return (await import('../i18n/hi/wallet')).default
    case 'ko':
      return (await import('../i18n/ko/wallet')).default
    case 'ru':
      return (await import('../i18n/ru/wallet')).default
    default:
      throw new Error(`Unsupported locale: ${locale}`)
  }
}

describe('Rebase Integrity Check', () => {
  describe('File invariants (high-risk conflicts)', () => {
    TEXT_EXPECTATIONS.forEach(({ file, description, mustInclude = [], mustExclude = [] }) => {
      it(description, () => {
        const content = readFile(file)
        mustInclude.forEach((matcher) => assertContent(content, file, matcher, true))
        mustExclude.forEach((matcher) => assertContent(content, file, matcher, false))
      })
    })
  })

  describe('Renderer guardrails', () => {
    it('renderer code never imports electron directly', () => {
      const rendererRoot = resolveProjectPath('src/renderer')
      const files = walkFiles(rendererRoot)
      const tsFiles = files.filter((filePath) => /\.(ts|tsx)$/.test(filePath) && !/(\.test|\.spec)\.ts$/.test(filePath))
      const violations: string[] = []

      tsFiles.forEach((absPath) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated via walkFiles
        const content = fs.readFileSync(absPath, 'utf-8')
        if (/from ['"]electron['"]/g.test(content) || /require\(['"]electron['"]\)/g.test(content)) {
          if (!content.includes('import type')) {
            violations.push(path.relative(PROJECT_ROOT, absPath))
          }
        }
      })

      expect(
        violations,
        `Found direct Electron imports in Renderer! These will crash Tauri:\n${violations.join('\n')}`
      ).toHaveLength(0)
    })
  })

  describe('Package + tooling alignment', () => {
    it('package.json retains tauri dependencies and scripts', () => {
      const pkg = JSON.parse(readFile('package.json')) as {
        scripts: Record<string, string>
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }

      const requiredDeps = [
        '@tauri-apps/api',
        '@tauri-apps/plugin-log',
        'tauri-plugin-secure-storage',
        'tauri-plugin-safe-area-insets'
      ]
      requiredDeps.forEach((dep) => {
        expect(deps[dep], `Missing dependency ${dep} after rebase`).toBeDefined()
      })

      expect(pkg.scripts?.dev, 'yarn dev must run tauri dev').toContain('tauri dev')
      expect(pkg.scripts?.build, 'yarn build must delegate to build:tauri').toContain('build:tauri')
      expect(pkg.scripts?.package, 'yarn package must delegate to package:electron').toContain('package:electron')
      expect(pkg.scripts?.['package:electron'], 'package:electron must call tauri build').toContain('tauri build')

      REQUIRED_TAURI_SCRIPTS.forEach((scriptName) => {
        expect(pkg.scripts?.[scriptName], `Missing script: ${scriptName}`).toBeDefined()
      })
    })
  })

  describe('Translations', () => {
    const settingsLocales: SettingsLocale[] = ['de', 'es', 'fr', 'hi', 'ko', 'ru']
    const walletLocales: WalletLocale[] = ['de', 'es', 'fr', 'hi', 'ko', 'ru']

    it('settings translations stay in sync with English keys', async () => {
      const base = (await import('../i18n/en/settings')).default
      const baseKeys = Object.keys(base).sort()

      await Promise.all(
        settingsLocales.map(async (locale) => {
          const target = await loadSettingsMessages(locale)
          expect(Object.keys(target).sort(), `Locale ${locale} is missing settings keys`).toEqual(baseKeys)
        })
      )
    })

    it('wallet translations stay in sync with English keys', async () => {
      const base = (await import('../i18n/en/wallet')).default
      const baseKeys = Object.keys(base).sort()

      await Promise.all(
        walletLocales.map(async (locale) => {
          const target = await loadWalletMessages(locale)
          expect(Object.keys(target).sort(), `Locale ${locale} is missing wallet keys`).toEqual(baseKeys)
        })
      )
    })
  })
})
