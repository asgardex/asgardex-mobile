/**
 * ESM-compatible replacement for the `safe-buffer` package.
 *
 * This shim bypasses the CJS `safe-buffer` which causes
 * "exports is not defined" errors when bundled into ESM output.
 *
 * The safe-buffer package was created to provide a safer Buffer API
 * that doesn't expose uninitialized memory. Modern Buffer implementations
 * already do this safely, so we just re-export the buffer polyfill.
 */

import { Buffer } from 'buffer'

// Re-export Buffer and SlowBuffer from the buffer polyfill
// safe-buffer's main purpose is to ensure Buffer.alloc/allocUnsafe exist
// and that Buffer() constructor doesn't expose uninitialized memory.
// The modern buffer polyfill already handles this correctly.

export { Buffer }

// SlowBuffer is deprecated but some packages still use it
// It's essentially the same as Buffer.allocUnsafeSlow
export const SlowBuffer = function SlowBuffer(size: number): Buffer {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer.allocUnsafeSlow(size)
}

// Default export for CJS-style imports
export default { Buffer, SlowBuffer }

// Named exports that match safe-buffer's API
export const kMaxLength = 0x7fffffff
