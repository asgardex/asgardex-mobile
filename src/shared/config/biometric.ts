/**
 * Centralized biometric configuration
 *
 * This module consolidates all biometric-related environment variable handling
 * to avoid duplication across the codebase.
 */

// Default to enabled across all modes; flows gracefully downgrade when unavailable
export const BIOMETRIC_ENABLED_DEFAULT = 'true'

/**
 * Resolve the VITE_TAURI_BIOMETRIC_ENABLED environment variable
 * with proper fallbacks for different environments (Vite, Node.js, etc.)
 */
const resolveBiometricFlag = (): string =>
  (
    import.meta.env?.VITE_TAURI_BIOMETRIC_ENABLED ??
    (typeof process !== 'undefined' ? process.env?.VITE_TAURI_BIOMETRIC_ENABLED : undefined) ??
    BIOMETRIC_ENABLED_DEFAULT
  ).toString()

/**
 * Check if biometric feature is enabled by environment configuration
 *
 * This only checks the environment flag, NOT actual device biometry status.
 */
export const isBiometricEnabled = (): boolean => resolveBiometricFlag() !== 'false'

/**
 * Get the resolved biometric flag value
 * @returns 'true' or 'false' as string
 */
export const getBiometricFlag = (): string => resolveBiometricFlag()

/**
 * Default biometric prompt message
 */
export const DEFAULT_BIOMETRIC_PROMPT = 'Authenticate to access your ASGARDEX wallet'

/**
 * Biometric prompt message locale key
 */
export const BIOMETRIC_PROMPT_MESSAGE_ID = 'wallet.unlock.biometric.prompt' as const
