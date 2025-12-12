#!/usr/bin/env node

/**
 * Production Bundle Validation Script
 *
 * Validates the built Tauri bundle for common production issues:
 * - CJS patterns leaking into ESM bundle (exports., module.exports, require())
 * - Vite browser externalization markers
 * - Missing polyfills
 *
 * Usage:
 *   node scripts/validate-prod-bundle.mjs [build-dir]
 *   yarn validate:bundle
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Validation failed
 *   2 - Build directory not found
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(__dirname, '..')

// Default build output directory (from tauri.conf.json: frontendDist)
const DEFAULT_BUILD_DIR = join(projectRoot, 'build', 'renderer')

// ANSI colors for terminal output
const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`
}

/**
 * Patterns that indicate CJS code leaked into the ESM bundle.
 * These cause "exports is not defined" errors in Android WebView.
 */
const CJS_LEAK_PATTERNS = [
  {
    // Bare exports.foo = ... (not inside a string or comment)
    pattern: /(?<![."'`\w])exports\s*\.\s*\w+\s*=/g,
    name: 'exports.X assignment',
    severity: 'error'
  },
  {
    // module.exports = ...
    pattern: /(?<![."'`\w])module\s*\.\s*exports\s*=/g,
    name: 'module.exports assignment',
    severity: 'error'
  },
  {
    // Bare require() calls (not in strings)
    pattern: /(?<![."'`\w])require\s*\(\s*['"][^'"]+['"]\s*\)/g,
    name: 'require() call',
    severity: 'error'
  }
]

/**
 * Patterns that indicate Vite externalized a module (bad for production).
 */
const EXTERNALIZATION_PATTERNS = [
  {
    pattern: /__vite-browser-external/g,
    name: 'Vite browser external marker',
    severity: 'error'
  },
  {
    // Externalized node built-in warning
    pattern: /Module "node:?\w+" has been externalized/g,
    name: 'Node module externalization',
    severity: 'error'
  }
]

/**
 * Patterns that should be present (polyfills working).
 */
const REQUIRED_PATTERNS = [
  {
    pattern: /Buffer/,
    name: 'Buffer reference',
    description: 'Buffer polyfill should be used'
  }
]

/**
 * Recursively find all JS files in a directory.
 */
async function findJsFiles(dir, files = []) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir is from CLI arg or hardcoded default, not user input
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      await findJsFiles(fullPath, files)
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Check a file for pattern matches.
 */
async function checkFile(filePath, patterns) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath is from findJsFiles traversal, not user input
  const content = await readFile(filePath, 'utf-8')
  const issues = []

  for (const { pattern, name, severity } of patterns) {
    // Reset regex state
    pattern.lastIndex = 0
    const matches = [...content.matchAll(pattern)]

    for (const match of matches) {
      // Find line number
      const beforeMatch = content.slice(0, match.index)
      const lineNumber = beforeMatch.split('\n').length

      // Get context (the line containing the match)
      const lines = content.split('\n')
      const lineContent = lines[lineNumber - 1]?.trim().slice(0, 100)

      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: name,
        severity,
        match: match[0].slice(0, 50),
        context: lineContent
      })
    }
  }

  return issues
}

/**
 * Check that required patterns exist in at least one file.
 */
async function checkRequiredPatterns(files, patterns) {
  const missing = []

  for (const { pattern, name, description } of patterns) {
    let found = false

    for (const filePath of files) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath is from findJsFiles traversal, not user input
      const content = await readFile(filePath, 'utf-8')
      // Reset regex state (in case a pattern uses /g)
      pattern.lastIndex = 0
      if (pattern.test(content)) {
        found = true
        break
      }
    }

    if (!found) {
      missing.push({ name, description })
    }
  }

  return missing
}

/**
 * Main validation function.
 */
async function validateBundle(buildDir) {
  console.log(colors.cyan('\n🔍 Validating production bundle...\n'))
  console.log(colors.dim(`   Build directory: ${buildDir}\n`))

  // Check build directory exists
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- buildDir is from CLI arg or hardcoded default, not user input
    const stats = await stat(buildDir)
    if (!stats.isDirectory()) {
      console.error(colors.red(`Error: ${buildDir} is not a directory`))
      process.exit(2)
    }
  } catch {
    console.error(colors.red(`Error: Build directory not found: ${buildDir}`))
    console.error(colors.dim('\nHave you run the build command first?'))
    console.error(colors.dim('  yarn build:tauri'))
    process.exit(2)
  }

  // Find all JS files
  const jsFiles = await findJsFiles(buildDir)

  if (jsFiles.length === 0) {
    console.error(colors.red('Error: No JS files found in build directory'))
    process.exit(2)
  }

  console.log(colors.dim(`   Found ${jsFiles.length} JS files to check\n`))

  // Check for CJS leaks
  console.log('Checking for CJS leaks...')
  const allPatterns = [...CJS_LEAK_PATTERNS, ...EXTERNALIZATION_PATTERNS]
  const allIssues = []

  for (const filePath of jsFiles) {
    const issues = await checkFile(filePath, allPatterns)
    allIssues.push(...issues)
  }

  // Check for required patterns
  console.log('Checking for required polyfills...')
  const missingPatterns = await checkRequiredPatterns(jsFiles, REQUIRED_PATTERNS)

  // Report results
  console.log('')

  let hasErrors = false

  if (allIssues.length > 0) {
    hasErrors = true
    console.log(colors.red(`❌ Found ${allIssues.length} issue(s):\n`))

    for (const issue of allIssues) {
      const relPath = relative(projectRoot, issue.file)
      console.log(colors.red(`  ${issue.severity.toUpperCase()}: ${issue.pattern}`))
      console.log(colors.dim(`    File: ${relPath}:${issue.line}`))
      console.log(colors.dim(`    Match: ${issue.match}`))
      if (issue.context) {
        console.log(colors.dim(`    Context: ${issue.context}`))
      }
      console.log('')
    }
  }

  if (missingPatterns.length > 0) {
    hasErrors = true
    console.log(colors.red(`❌ Missing required polyfills/patterns:\n`))

    for (const { name, description } of missingPatterns) {
      console.log(colors.red(`  ERROR: ${name}`))
      console.log(colors.dim(`    ${description}`))
      console.log('')
    }
  }

  // Summary
  if (hasErrors) {
    console.log(colors.red('❌ Bundle validation FAILED\n'))
    console.log('These issues can cause runtime errors in Android WebView.')
    console.log('Common fixes:')
    console.log('  - Add problematic package to vite.shared.config.mjs aliases')
    console.log('  - Create ESM shim in src/shims/')
    console.log('  - Check for new CJS-only dependencies\n')
    process.exit(1)
  } else {
    console.log(colors.green('✅ Bundle validation PASSED\n'))
    console.log(colors.dim(`   Checked ${jsFiles.length} files`))
    console.log(colors.dim('   No CJS leaks detected'))
    console.log(colors.dim('   No externalization issues'))
    console.log('')
    process.exit(0)
  }
}

// CLI entry point
const buildDir = process.argv[2] || DEFAULT_BUILD_DIR
validateBundle(buildDir)
