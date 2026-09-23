import { describe, it, expect } from 'vitest'
import {
  buildSafeMailtoUrl,
  isValidRecipientEmail,
  isValidSubject,
  isValidBody,
  type SafeMailtoParams,
} from '@/lib/mailtoSecurity'

describe('Mailto Security — Unit & Adversarial Test Suite', () => {
  describe('Recipient Validation (isValidRecipientEmail)', () => {
    it('accepts valid normal emails', () => {
      expect(isValidRecipientEmail('athlete@example.com')).toBe(true)
      expect(isValidRecipientEmail('support@bodymap.ai')).toBe(true)
      expect(isValidRecipientEmail('user.name@sub.domain.org')).toBe(true)
      expect(isValidRecipientEmail('coach+training@example.co.uk')).toBe(true)
    })

    it('rejects invalid emails lacking @ or domain', () => {
      expect(isValidRecipientEmail('not-an-email')).toBe(false)
      expect(isValidRecipientEmail('user@')).toBe(false)
      expect(isValidRecipientEmail('@domain.com')).toBe(false)
      expect(isValidRecipientEmail('user@domain')).toBe(false)
      expect(isValidRecipientEmail('user@@domain.com')).toBe(false)
      expect(isValidRecipientEmail('user@.com')).toBe(false)
      expect(isValidRecipientEmail('')).toBe(false)
      expect(isValidRecipientEmail(null)).toBe(false)
      expect(isValidRecipientEmail(undefined)).toBe(false)
    })

    it('rejects CRLF injection attempts in recipient', () => {
      expect(isValidRecipientEmail('athlete@example.com\r\nbcc:victim@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com\nbcc:victim@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com\rbcc:victim@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete\r\n@example.com')).toBe(false)
    })

    it('rejects spaces within recipient', () => {
      expect(isValidRecipientEmail('athlete @example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@ example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@exam ple.com')).toBe(false)
      expect(isValidRecipientEmail('athlete @ example .com')).toBe(false)
    })

    it('rejects quotes and angle brackets in recipient', () => {
      expect(isValidRecipientEmail('"athlete"@example.com')).toBe(false)
      expect(isValidRecipientEmail('<athlete@example.com>')).toBe(false)
      expect(isValidRecipientEmail('athlete<name>@example.com')).toBe(false)
      expect(isValidRecipientEmail('\'athlete\'@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete"@example.com')).toBe(false)
    })

    it('rejects URL-encoded CRLF in recipient', () => {
      expect(isValidRecipientEmail('athlete@example.com%0d%0abcc:victim@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com%0Abcc:victim@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com%0Dbcc:victim@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete%0d@example.com')).toBe(false)
    })

    it('rejects multiple addresses where only one is expected', () => {
      expect(isValidRecipientEmail('athlete@example.com,victim@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com;victim@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com victim@example.com')).toBe(false)
    })

    it('rejects URI delimiter injection in recipient (? & # %)', () => {
      expect(isValidRecipientEmail('athlete@example.com?cc=evil@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com&bcc=evil@example.com')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com#anchor')).toBe(false)
      expect(isValidRecipientEmail('athlete@example.com%20')).toBe(false)
    })
  })

  describe('Subject Validation & Sanitization (isValidSubject)', () => {
    it('accepts valid normal subject text', () => {
      expect(isValidSubject('My 7-Day Fitness Plan')).toBe(true)
      expect(isValidSubject('BodyMap Inquiry')).toBe(true)
      expect(isValidSubject(undefined)).toBe(true)
      expect(isValidSubject('')).toBe(true)
    })

    it('accepts spaces, Unicode, and special characters (& ? %)', () => {
      expect(isValidSubject('Fitness & Nutrition? 100% Custom')).toBe(true)
      expect(isValidSubject('Plan pour l\'athlète 🏃‍♂️ & santé')).toBe(true)
      expect(isValidSubject('Question regarding bench press & protein intake')).toBe(true)
    })

    it('rejects raw CRLF in subject to prevent header injection', () => {
      expect(isValidSubject('Inquiry\r\nbcc:victim@example.com')).toBe(false)
      expect(isValidSubject('Inquiry\ncc:victim@example.com')).toBe(false)
      expect(isValidSubject('Inquiry\rbcc:victim@example.com')).toBe(false)
      expect(isValidSubject('Inquiry\r\nSubject: Overridden')).toBe(false)
    })

    it('rejects URL-encoded CRLF (%0d%0a, %0a, %0d) in subject', () => {
      expect(isValidSubject('Inquiry%0d%0abcc:victim@example.com')).toBe(false)
      expect(isValidSubject('Inquiry%0D%0Abcc:victim@example.com')).toBe(false)
      expect(isValidSubject('Inquiry%0Abcc:victim@example.com')).toBe(false)
      expect(isValidSubject('Inquiry%0Dbcc:victim@example.com')).toBe(false)
    })

    it('rejects control characters in subject', () => {
      expect(isValidSubject('Inquiry\x00with null')).toBe(false)
      expect(isValidSubject('Inquiry\x1bwith esc')).toBe(false)
    })
  })

  describe('Body Validation (isValidBody)', () => {
    it('accepts valid multiline body text and preserves newlines', () => {
      const body = 'Hi there!\n\nHere is your custom workout plan:\n- Day 1: Bench Press\n- Day 2: Squats'
      expect(isValidBody(body)).toBe(true)
    })

    it('accepts Unicode, punctuation, and special characters in body', () => {
      expect(isValidBody('Target: 100% effort & progress! 🏋️‍♂️')).toBe(true)
      expect(isValidBody('Questions? & suggestions?')).toBe(true)
    })

    it('rejects null bytes in body', () => {
      expect(isValidBody('Legitimate workout\x00injected')).toBe(false)
    })
  })

  describe('Canonical Mailto Builder (buildSafeMailtoUrl)', () => {
    it('constructs a valid mailto URI with valid inputs', () => {
      const url = buildSafeMailtoUrl({
        to: 'support@bodymap.ai',
        subject: 'Plan Inquiry',
        body: 'Hello BodyMap team,\nI have a question.',
      })

      expect(url).toBe(
        'mailto:support@bodymap.ai?subject=Plan%20Inquiry&body=Hello%20BodyMap%20team%2C%0AI%20have%20a%20question.'
      )
    })

    it('returns null on invalid recipient', () => {
      expect(buildSafeMailtoUrl({ to: 'invalid-email' })).toBeNull()
      expect(buildSafeMailtoUrl({ to: '' })).toBeNull()
      expect(buildSafeMailtoUrl({ to: 'user@example.com,other@example.com' })).toBeNull()
      expect(buildSafeMailtoUrl({ to: 'user@example.com?bcc=evil@example.com' })).toBeNull()
    })

    it('returns null on CRLF injection attempt in recipient', () => {
      expect(
        buildSafeMailtoUrl({
          to: 'user@example.com\r\nbcc:attacker@example.com',
          subject: 'Safe Subject',
          body: 'Safe Body',
        })
      ).toBeNull()
    })

    it('returns null on CRLF injection attempt in subject', () => {
      expect(
        buildSafeMailtoUrl({
          to: 'support@bodymap.ai',
          subject: 'Test Subject\r\nbcc:attacker@example.com',
          body: 'Safe Body',
        })
      ).toBeNull()

      expect(
        buildSafeMailtoUrl({
          to: 'support@bodymap.ai',
          subject: 'Test Subject%0D%0ABcc:attacker@example.com',
          body: 'Safe Body',
        })
      ).toBeNull()
    })

    it('encodes subject containing characters resembling mail headers without header splitting', () => {
      const url = buildSafeMailtoUrl({
        to: 'support@bodymap.ai',
        subject: 'Question regarding bcc=attacker@example.com & cc=other@example.com',
        body: 'Please clarify.',
      })

      expect(url).not.toBeNull()
      // Verify the = and & in subject are safely percent-encoded
      expect(url).toContain('bcc%3Dattacker%40example.com')
      expect(url).toContain('%26%20cc%3Dother%40example.com')

      // Parse the generated URI query parameters
      const parsed = new URL(url!)
      expect(parsed.searchParams.has('bcc')).toBe(false)
      expect(parsed.searchParams.has('cc')).toBe(false)
      expect(parsed.searchParams.get('subject')).toBe(
        'Question regarding bcc=attacker@example.com & cc=other@example.com'
      )
    })

    it('encodes body containing text resembling mail headers without header injection', () => {
      const hostileBody = 'Here is my plan:\n\nBcc: evil@attacker.com\nCc: spy@attacker.com\n&bcc=evil2@attacker.com'
      const url = buildSafeMailtoUrl({
        to: 'athlete@example.com',
        subject: 'BodyMap 7-Day Plan',
        body: hostileBody,
      })

      expect(url).not.toBeNull()
      const parsed = new URL(url!)
      expect(parsed.searchParams.has('bcc')).toBe(false)
      expect(parsed.searchParams.has('cc')).toBe(false)
      expect(parsed.searchParams.get('body')).toBe(hostileBody)
    })

    it('handles omitted subject and body gracefully', () => {
      const urlOnlyRecipient = buildSafeMailtoUrl({ to: 'athlete@example.com' })
      expect(urlOnlyRecipient).toBe('mailto:athlete@example.com')

      const urlWithSubjectOnly = buildSafeMailtoUrl({
        to: 'athlete@example.com',
        subject: 'Hello',
      })
      expect(urlWithSubjectOnly).toBe('mailto:athlete@example.com?subject=Hello')

      const urlWithBodyOnly = buildSafeMailtoUrl({
        to: 'athlete@example.com',
        body: 'Workout details',
      })
      expect(urlWithBodyOnly).toBe('mailto:athlete@example.com?body=Workout%20details')
    })
  })

  describe('Security Oracle Invariants', () => {
    const testCases: SafeMailtoParams[] = [
      { to: 'athlete@example.com', subject: 'Subject & Plan', body: 'Body with & and ?' },
      { to: 'support@bodymap.ai', subject: 'Inquiry', body: 'Hello' },
      { to: 'user@domain.com', subject: 'Plan: 100% custom', body: 'Multiline\nText\nHere' },
      { to: 'coach@gym.org', subject: 'Questions? & answers', body: 'Notes: &cc=injected?' },
    ]

    it.each(testCases)('enforces strict query parameter allowlist on generated URI: %j', (params) => {
      const url = buildSafeMailtoUrl(params)
      expect(url).not.toBeNull()
      expect(url!.startsWith('mailto:')).toBe(true)

      const parsed = new URL(url!)
      const searchKeys = [...parsed.searchParams.keys()]
      // MUST only ever contain 'subject' and/or 'body'
      expect(searchKeys.every((k) => k === 'subject' || k === 'body')).toBe(true)

      // MUST NEVER contain injected headers
      expect(parsed.searchParams.has('bcc')).toBe(false)
      expect(parsed.searchParams.has('cc')).toBe(false)
      expect(parsed.searchParams.has('to')).toBe(false)
      expect(parsed.searchParams.has('from')).toBe(false)
      expect(parsed.searchParams.has('reply-to')).toBe(false)
    })
  })
})
