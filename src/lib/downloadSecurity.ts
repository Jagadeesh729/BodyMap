/**
 * Download Security Utilities
 * Enforces strict sanitization on client-side generated download filenames
 * to prevent directory traversal, control character injection, shell meta-characters,
 * and filesystem clobbering across Windows and POSIX environments.
 */

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
])

export const MAX_FILENAME_BASE_LENGTH = 60

/**
 * Sanitizes an untrusted filename candidate into a safe, bounded, single-level filename.
 * 
 * Guarantees:
 * 1. Zero path traversal (strips ../, ..\, /, \)
 * 2. Zero control characters or null bytes (\x00-\x1f, \x7f-\x9f)
 * 3. Strips URL-encoded traversal attempts (%2e%2e%2f, etc.)
 * 4. Only allows [a-zA-Z0-9_-] in the basename
 * 5. Rejects / prefixes Windows reserved device names (CON, NUL, PRN, etc.)
 * 6. Enforces safe non-empty basename bounded to MAX_FILENAME_BASE_LENGTH
 * 7. Enforces exact extension with no double-extension attacks
 * 
 * @param candidate Untrusted input string (e.g. user goal, user name, or suggested filename)
 * @param defaultBase Safe fallback basename if candidate sanitizes to empty
 * @param extension Expected file extension without leading dot (e.g. 'json', 'md', 'txt')
 */
export function sanitizeDownloadFilename(
  candidate: string | undefined | null,
  defaultBase = 'bodymap-export',
  extension = 'json'
): string {
  const safeExt = extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'dat'
  const fallback = defaultBase.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'bodymap-export'

  if (!candidate || typeof candidate !== 'string') {
    return `${fallback}.${safeExt}`
  }

  let cleaned = candidate

  // 1. Iteratively decode URI components to uncover obfuscated traversals
  try {
    let prev = ''
    while (cleaned !== prev && prev.length < 500) {
      prev = cleaned
      cleaned = decodeURIComponent(cleaned)
    }
  } catch {
    // Malformed URI encoding - continue with current cleaned text
  }

  // 2. Remove null bytes and control characters (char codes 0-31, 127-159) without triggering no-control-regex
  let sanitizedChars = ''
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i)
    if ((code >= 0 && code <= 31) || (code >= 127 && code <= 159)) {
      continue
    }
    sanitizedChars += cleaned[i]
  }
  cleaned = sanitizedChars

  // 3. Remove traversal tokens, drive prefixes, and convert path separators to hyphens
  cleaned = cleaned.replace(/\.\./g, '')
  cleaned = cleaned.replace(/^[a-zA-Z]:/, '') // Windows drive prefix like C:
  cleaned = cleaned.replace(/[/\\]+/g, '-')

  // 4. Strip existing trailing extension if matching safeExt or other extensions
  cleaned = cleaned.replace(new RegExp(`\\.${safeExt}$`, 'i'), '')
  // Also strip any other extension dots
  cleaned = cleaned.replace(/\.[a-zA-Z0-9]+$/g, '')

  // 5. Replace spaces and punctuation with single hyphens
  cleaned = cleaned.replace(/[\s+;,$!@#%^&*()|<>`~]+/g, '-')

  // 6. Whitelist strictly to [a-zA-Z0-9_-]
  cleaned = cleaned.replace(/[^a-zA-Z0-9_-]/g, '')

  // 7. Collapse multiple consecutive hyphens or underscores
  cleaned = cleaned.replace(/-+/g, '-').replace(/_+/g, '_')

  // 8. Trim leading and trailing hyphens, dots, and underscores to prevent hidden files or CLI flags
  cleaned = cleaned.replace(/^[-_.]+/, '').replace(/[-_.]+$/, '')

  // 9. Length bounding
  if (cleaned.length > MAX_FILENAME_BASE_LENGTH) {
    cleaned = cleaned.slice(0, MAX_FILENAME_BASE_LENGTH).replace(/[-_.]+$/, '')
  }

  // 10. Fallback if empty
  if (!cleaned) {
    cleaned = fallback
  }

  // 11. Check Windows reserved device names
  if (WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase())) {
    cleaned = `safe-${cleaned.toLowerCase()}`
  }

  return `${cleaned}.${safeExt}`
}
