/**
 * BodyMap AI — Mailto URI Security Utilities
 * ===========================================
 * Canonical safe builder for client-side mailto: URI schemes.
 * 
 * Prevents:
 * 1. Email recipient delimiter injection (commas, semicolons, angle brackets, quotes)
 * 2. Header injection via CRLF (\r, \n, %0d, %0a) in recipient or subject fields
 * 3. Query parameter injection (e.g. injecting ?bcc=, &cc=, or custom headers)
 * 4. Control character and null-byte injection
 * 5. URL length overflow / browser mailto URI truncation
 */

export interface SafeMailtoParams {
  to: string
  subject?: string
  body?: string
}

const EMAIL_REGEX = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const MAX_EMAIL_LENGTH = 254
const MAX_SUBJECT_LENGTH = 500
const MAX_BODY_LENGTH = 4000

function containsControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if ((code >= 0 && code <= 31) || (code >= 127 && code <= 159)) {
      return true
    }
  }
  return false
}

function containsNullByte(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) === 0) {
      return true
    }
  }
  return false
}

/**
 * Validates that an input is a single, well-formed, safe email recipient.
 * Rejects CRLF, spaces, quotes, angle brackets, delimiters, and multiple addresses.
 */
export function isValidRecipientEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()

  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) return false

  // Reject CR, LF, null byte, or any control characters
  if (containsControlChars(trimmed)) return false

  // Reject URL-encoded CRLF or delimiter bypass attempts
  if (/%0[ad]/i.test(trimmed)) return false

  // Reject URI delimiter characters (?, &, #, %, /) and address list separators (, ;)
  if (/[?&#%,;:<>"'\s\\]/.test(trimmed)) return false

  // Reject double dots in local or domain part
  if (/\.\./.test(trimmed)) return false

  return EMAIL_REGEX.test(trimmed)
}

/**
 * Validates that a subject header contains no raw or encoded CRLF or null bytes.
 */
export function isValidSubject(subject: unknown): boolean {
  if (subject === undefined || subject === null) return true
  if (typeof subject !== 'string') return false

  // Reject CR, LF, null byte, or control characters
  if (containsControlChars(subject)) return false

  // Reject URL-encoded CRLF (%0d, %0a, %0D, %0A) to prevent header injection in mail clients
  if (/%0[ad]/i.test(subject)) return false

  return subject.length <= MAX_SUBJECT_LENGTH
}

/**
 * Validates that body content contains no null bytes.
 * Note: Legitimate newlines (\r\n, \n) are allowed in the body and will be properly URI-encoded.
 */
export function isValidBody(body: unknown): boolean {
  if (body === undefined || body === null) return true
  if (typeof body !== 'string') return false

  // Reject null bytes
  if (containsNullByte(body)) return false

  return body.length <= MAX_BODY_LENGTH
}

/**
 * Canonical builder for safe mailto: URIs.
 * 
 * Guarantees:
 * - Recipient is strictly validated as a single valid email address
 * - Subject cannot contain CRLF (raw or encoded), preventing header splitting
 * - Subject and Body are properly percent-encoded via encodeURIComponent
 * - Only strictly allowlisted parameters ('subject' and 'body') can exist
 * - Returns null if validation fails, enforcing fail-closed behavior
 */
export function buildSafeMailtoUrl(params: SafeMailtoParams): string | null {
  if (!params || typeof params !== 'object') return null

  const recipient = (params.to || '').trim()
  if (!isValidRecipientEmail(recipient)) {
    return null
  }

  const subject = params.subject !== undefined ? params.subject.trim() : undefined
  if (subject !== undefined && !isValidSubject(subject)) {
    return null
  }

  const body = params.body !== undefined ? params.body : undefined
  if (body !== undefined && !isValidBody(body)) {
    return null
  }

  const queryParts: string[] = []

  if (subject) {
    queryParts.push(`subject=${encodeURIComponent(subject)}`)
  }

  if (body) {
    queryParts.push(`body=${encodeURIComponent(body)}`)
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
  return `mailto:${recipient}${queryString}`
}
