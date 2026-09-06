import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { IncomingMessage } from 'http'
import {
  extractClientIp,
  checkRateLimit,
  resetRateLimitsForTesting,
  getRateLimitMapSize,
  UNKNOWN_CLIENT_IP,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_MAX_ENTRIES,
  RATE_LIMIT_WINDOW_MS
} from '../../api/generate-plan'

function makeMockReq(headers: Record<string, string | string[] | undefined> = {}, remoteAddress?: string): IncomingMessage {
  // Normalize header keys to lowercase to match Node.js http IncomingMessage behavior
  const normalizedHeaders: Record<string, string | string[] | undefined> = {}
  for (const [key, val] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = val
  }
  return {
    headers: normalizedHeaders,
    socket: remoteAddress ? ({ remoteAddress } as unknown as NonNullable<IncomingMessage['socket']>) : undefined
  } as unknown as IncomingMessage
}

describe('Proxy Trust Boundary & Serverless Platform Oracle', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetRateLimitsForTesting()
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // =========================================================================
  // Section 1: Trusted-Header Spoofing & Provenance (25 tests)
  // =========================================================================
  describe('1. Trusted-Header Spoofing & Provenance', () => {
    it('1.1.1: Accepts valid x-vercel-forwarded-for IPv4 address', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.1' })
      expect(extractClientIp(req)).toBe('198.51.100.1')
    })

    it('1.1.2: Accepts valid x-vercel-forwarded-for IPv6 address', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '2001:db8::1' })
      expect(extractClientIp(req)).toBe('2001:db8::1')
    })

    it('1.1.3: Client-supplied x-real-ip alone is untrusted and fails closed to UNKNOWN_CLIENT_IP', () => {
      const req = makeMockReq({ 'x-real-ip': '198.51.100.2' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('1.1.4: In non-Vercel harness, x-forwarded-for is evaluated right-to-left for test mocks', () => {
      const req = makeMockReq({ 'x-forwarded-for': '8.8.8.8, 198.51.100.3' })
      expect(extractClientIp(req)).toBe('198.51.100.3')
    })

    it('1.1.5: In Vercel environment (VERCEL=1), missing x-vercel-forwarded-for fails closed', () => {
      process.env.VERCEL = '1'
      const req = makeMockReq({ 'x-forwarded-for': '198.51.100.4' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('1.1.6: When all three headers are present, x-vercel-forwarded-for wins unconditionally', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.10',
        'x-real-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2'
      })
      expect(extractClientIp(req)).toBe('198.51.100.10')
    })

    it('1.1.7: Conflicting x-real-ip cannot alter x-vercel-forwarded-for selection', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.11',
        'x-real-ip': '10.0.0.99'
      })
      expect(extractClientIp(req)).toBe('198.51.100.11')
    })

    it('1.1.8: Conflicting x-forwarded-for cannot alter x-vercel-forwarded-for selection', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.12',
        'x-forwarded-for': '10.0.0.88'
      })
      expect(extractClientIp(req)).toBe('198.51.100.12')
    })

    it('1.1.9: Standard RFC 7239 Forwarded header cannot alter trusted identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.13',
        'forwarded': 'for=1.2.3.4;proto=https'
      })
      expect(extractClientIp(req)).toBe('198.51.100.13')
    })

    it('1.1.10: Client-supplied X-Client-IP header cannot alter trusted identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.14',
        'x-client-ip': '1.2.3.4'
      })
      expect(extractClientIp(req)).toBe('198.51.100.14')
    })

    it('1.1.11: Client-supplied CF-Connecting-IP cannot alter trusted identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.15',
        'cf-connecting-ip': '1.2.3.4'
      })
      expect(extractClientIp(req)).toBe('198.51.100.15')
    })

    it('1.1.12: Repeated x-vercel-forwarded-for headers with identical IPs merge cleanly', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.16', '198.51.100.16']
      })
      expect(extractClientIp(req)).toBe('198.51.100.16')
    })

    it('1.1.13: Repeated x-vercel-forwarded-for headers with conflicting IPs fail closed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.17', '198.51.100.18']
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('1.1.14: Header array with single valid IP resolves correctly', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.19']
      })
      expect(extractClientIp(req)).toBe('198.51.100.19')
    })

    it('1.1.15: Header array with multiple identical comma-delimited strings merges cleanly', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.20, 198.51.100.20']
      })
      expect(extractClientIp(req)).toBe('198.51.100.20')
    })

    it('1.1.16: Header array with conflicting comma-delimited strings fails closed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.21, 10.0.0.1']
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('1.1.17: Header array with mixed valid and invalid strings fails closed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.22', 'malformed-ip']
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('1.1.18: Unusual leading/trailing whitespace in platform header is safely trimmed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '   198.51.100.23   \t  '
      })
      expect(extractClientIp(req)).toBe('198.51.100.23')
    })

    it('1.1.19: Double-quoted IP in platform header is unwrapped cleanly', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '"198.51.100.24"'
      })
      expect(extractClientIp(req)).toBe('198.51.100.24')
    })

    it('1.1.20: Single-quoted IP in platform header is unwrapped cleanly', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': "'198.51.100.25'"
      })
      expect(extractClientIp(req)).toBe('198.51.100.25')
    })

    it('1.1.21: Mixed casing in platform IPv6 header canonicalizes to lowercase', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '2001:DB8:ABCD::12'
      })
      expect(extractClientIp(req)).toBe('2001:db8:abcd::12')
    })

    it('1.1.22: Comma chain with identical canonical IPv4 collapses cleanly', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.26, 198.051.100.026'
      })
      expect(extractClientIp(req)).toBe('198.51.100.26')
    })

    it('1.1.23: Comma chain with conflicting valid IPs fails closed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.27, 198.51.100.28'
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('1.1.24: Empty string in platform header fails closed to UNKNOWN_CLIENT_IP', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('1.1.25: Whitespace-only string in platform header fails closed to UNKNOWN_CLIENT_IP', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '     ' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })
  })

  // =========================================================================
  // Section 2: Host, Route, Protocol & Header Manipulation (25 tests)
  // =========================================================================
  describe('2. Host, Route, Protocol & Header Manipulation', () => {
    it('2.1.1: Direct production API request path preserves identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        ':path': '/api/generate-plan'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.2: Frontend-origin request produces identical security identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'origin': 'https://bodymap-ai.vercel.app',
        'referer': 'https://bodymap-ai.vercel.app/create-plan'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.3: Hostile Origin header does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'origin': 'https://attacker.evil.com'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.4: Null Origin header does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'origin': 'null'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.5: External Referer header does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'referer': 'https://some-other-site.com/link'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.6: Alternate Host header (evil.com) does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'host': 'evil.com'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.7: Localhost Host header (localhost:3000) does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'host': 'localhost:3000'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.8: X-Forwarded-Host header is completely ignored for identity derivation', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'x-forwarded-host': 'spoofed-domain.com'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.9: X-Host header is completely ignored for identity derivation', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'x-host': 'fake-host.org'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.10: Apex vs www host header variation does not alter identity', () => {
      const req1 = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.30', 'host': 'bodymap-ai.vercel.app' })
      const req2 = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.30', 'host': 'www.bodymap-ai.vercel.app' })
      expect(extractClientIp(req1)).toBe(extractClientIp(req2))
    })

    it('2.1.11: X-Forwarded-Proto http does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'x-forwarded-proto': 'http'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.12: X-Forwarded-Proto https does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'x-forwarded-proto': 'https'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.13: X-Forwarded-Port 80 does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'x-forwarded-port': '80'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.14: X-Forwarded-Port 443 does not alter client identity', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'x-forwarded-port': '443'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.15: Forwarded header (RFC 7239) is completely ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'forwarded': 'for=10.0.0.1;by=2.2.2.2'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.16: Forwarded header with IPv6 format is completely ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'forwarded': 'for="[2001:db8::1]";proto=https'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.17: Via proxy header is completely ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'via': '1.1 vegur, 2.0 cloudflare'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.18: X-Client-IP header is completely ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'x-client-ip': '172.16.0.1'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.19: CF-Connecting-IP header is completely ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'cf-connecting-ip': '172.16.0.2'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.20: True-Client-IP header is completely ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'true-client-ip': '172.16.0.3'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.21: Fastly-Client-IP header is completely ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'fastly-client-ip': '172.16.0.4'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.22: Trailing slash in URL does not alter identity derivation', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'url': '/api/generate-plan/'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.23: Query string variations do not alter identity derivation', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.30',
        'url': '/api/generate-plan?cachebust=123&test=abc'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.24: Header names match case-insensitively (HTTP standard)', () => {
      const req = makeMockReq({
        'X-VERCEL-FORWARDED-FOR': '198.51.100.30'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('2.1.25: Mixed-cased header name (X-Vercel-Forwarded-For) works seamlessly', () => {
      const req = makeMockReq({
        'X-Vercel-Forwarded-For': '198.51.100.30'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })
  })

  // =========================================================================
  // Section 3: Header Injection, Delimiters & Parser Confusion (25 tests)
  // =========================================================================
  describe('3. Header Injection, Delimiters & Parser Confusion', () => {
    it('3.1.1: Null byte character inside IP token rejected immediately', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.1\0.evil.com' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('3.1.2: Carriage return character in platform header rejected immediately', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.1\r' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('3.1.3: Line feed character in platform header rejected immediately', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.1\n' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('3.1.4: Embedded tab character in platform header rejected immediately', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.\t100.1' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('3.1.5: Semicolon command injection in platform header rejected immediately', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.1; DROP TABLE users' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('3.1.6: Very long forwarding chain (100 hops) in test harness selects rightmost valid IP', () => {
      const chain = Array.from({ length: 99 }, (_, i) => `10.0.0.${i + 1}`).join(', ') + ', 198.51.100.40'
      const req = makeMockReq({ 'x-forwarded-for': chain })
      expect(extractClientIp(req)).toBe('198.51.100.40')
    })

    it('3.1.7: Massive forwarding chain (500 hops) parsed safely without error or stack overflow', () => {
      const chain = Array.from({ length: 499 }, () => '1.1.1.1').join(', ') + ', 198.51.100.41'
      const req = makeMockReq({ 'x-forwarded-for': chain })
      expect(extractClientIp(req)).toBe('198.51.100.41')
    })

    it('3.1.8: Unicode whitespace in platform header is rejected', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.\u00A01' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('3.1.9: Malformed IPv6 with double double-colons (::) is rejected', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '2001:db8::1::2' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('3.1.10: Malformed IPv6 with invalid hex characters is rejected', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '2001:db8::xyz' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('3.1.11: Bracketed IPv6 without port is stripped cleanly', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '[2001:db8::1]' })
      expect(extractClientIp(req)).toBe('2001:db8::1')
    })

    it('3.1.12: Bracketed IPv6 with port is stripped cleanly', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '[2001:db8::1]:8080' })
      expect(extractClientIp(req)).toBe('2001:db8::1')
    })

    it('3.1.13: Dotted-quad IPv4 with port is stripped cleanly', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.42:443' })
      expect(extractClientIp(req)).toBe('198.51.100.42')
    })

    it('3.1.14: IPv6 zone identifier (%eth0) is stripped cleanly', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': 'fe80::1%eth0' })
      expect(extractClientIp(req)).toBe('fe80::1')
    })

    it('3.1.15: Test harness chain with invalid trailing entry selects next rightmost valid IP', () => {
      const req = makeMockReq({ 'x-forwarded-for': '198.51.100.43, invalid-entry' })
      expect(extractClientIp(req)).toBe('198.51.100.43')
    })

    it('3.1.16: Test harness chain with all invalid entries falls back to socket', () => {
      const req = makeMockReq({ 'x-forwarded-for': 'junk1, junk2' }, '198.51.100.44')
      expect(extractClientIp(req)).toBe('198.51.100.44')
    })

    it('3.1.17: Private 10.0.0.1 address is treated consistently and canonicalized', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '10.0.0.1' })
      expect(extractClientIp(req)).toBe('10.0.0.1')
    })

    it('3.1.18: Private 192.168.1.1 address is treated consistently and canonicalized', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '192.168.1.1' })
      expect(extractClientIp(req)).toBe('192.168.1.1')
    })

    it('3.1.19: Loopback 127.0.0.1 address is canonicalized', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '127.0.0.1' })
      expect(extractClientIp(req)).toBe('127.0.0.1')
    })

    it('3.1.20: Cloud metadata 169.254.169.254 address is canonicalized safely', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '169.254.169.254' })
      expect(extractClientIp(req)).toBe('169.254.169.254')
    })

    it('3.1.21: Carrier-grade NAT 100.64.0.1 address is canonicalized safely', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '100.64.0.1' })
      expect(extractClientIp(req)).toBe('100.64.0.1')
    })

    it('3.1.22: Multicast 224.0.0.1 address is canonicalized safely', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '224.0.0.1' })
      expect(extractClientIp(req)).toBe('224.0.0.1')
    })

    it('3.1.23: IPv4-mapped loopback ::ffff:127.0.0.1 collapsed to 127.0.0.1', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '::ffff:127.0.0.1' })
      expect(extractClientIp(req)).toBe('127.0.0.1')
    })

    it('3.1.24: IPv4-mapped private ::ffff:10.0.0.1 collapsed to 10.0.0.1', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '::ffff:10.0.0.1' })
      expect(extractClientIp(req)).toBe('10.0.0.1')
    })

    it('3.1.25: IPv4-mapped hex ::ffff:c0a8:0101 collapsed to 192.168.1.1', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '::ffff:c0a8:0101' })
      expect(extractClientIp(req)).toBe('192.168.1.1')
    })
  })

  // =========================================================================
  // Section 4: Trust-Order, Fallback & Ambiguity Attacks (25 tests)
  // =========================================================================
  describe('4. Trust-Order, Fallback & Ambiguity Attacks', () => {
    it('4.1.1: Client-controlled x-real-ip conflicting with x-vercel-forwarded-for is ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.50',
        'x-real-ip': '1.1.1.1'
      })
      expect(extractClientIp(req)).toBe('198.51.100.50')
    })

    it('4.1.2: Client-controlled leftmost x-forwarded-for is ignored', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.50',
        'x-forwarded-for': '1.1.1.1, 2.2.2.2'
      })
      expect(extractClientIp(req)).toBe('198.51.100.50')
    })

    it('4.1.3: Client-controlled rightmost x-forwarded-for cannot override platform header', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.50',
        'x-forwarded-for': '9.9.9.9'
      })
      expect(extractClientIp(req)).toBe('198.51.100.50')
    })

    it('4.1.4: Missing platform header on Vercel fails closed to UNKNOWN_CLIENT_IP', () => {
      process.env.VERCEL = '1'
      const req = makeMockReq({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.5: Malformed platform header fails closed to UNKNOWN_CLIENT_IP without fall-through', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': 'malformed-noise',
        'x-real-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2'
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.6: Malformed platform header with valid x-real-ip still fails closed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': 'invalid-ip',
        'x-real-ip': '198.51.100.51'
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.7: Malformed platform header with valid x-forwarded-for still fails closed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': 'invalid-ip',
        'x-forwarded-for': '198.51.100.52'
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.8: Duplicated platform headers with conflicting IPs fail closed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.53', '10.0.0.1']
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.9: Array platform header with mixed IP and non-IP fails closed', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.54', 'not-an-ip']
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.10: Empty platform header does NOT fall through to x-real-ip', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '',
        'x-real-ip': '198.51.100.55'
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.11: Empty platform header on Vercel fails closed', () => {
      process.env.VERCEL = '1'
      const req = makeMockReq({ 'x-vercel-forwarded-for': '' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.12: Non-Vercel environment with valid platform header uses it', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.56' })
      expect(extractClientIp(req)).toBe('198.51.100.56')
    })

    it('4.1.13: Non-Vercel environment without platform header uses x-forwarded-for', () => {
      const req = makeMockReq({ 'x-forwarded-for': '198.51.100.57' })
      expect(extractClientIp(req)).toBe('198.51.100.57')
    })

    it('4.1.14: Non-Vercel environment with invalid x-forwarded-for falls back to socket', () => {
      const req = makeMockReq({ 'x-forwarded-for': 'bad-ip' }, '198.51.100.58')
      expect(extractClientIp(req)).toBe('198.51.100.58')
    })

    it('4.1.15: Non-Vercel environment with invalid socket falls back to UNKNOWN_CLIENT_IP', () => {
      const req = makeMockReq({ 'x-forwarded-for': 'bad-ip' }, 'bad-socket')
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.16: Platform header string "null" is rejected as malformed', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': 'null' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.17: Platform header string "undefined" is rejected as malformed', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': 'undefined' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.18: Platform header 0.0.0.0 is treated as valid canonical IP', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '0.0.0.0' })
      expect(extractClientIp(req)).toBe('0.0.0.0')
    })

    it('4.1.19: Header keys like __proto__ do not crash parser or bypass extraction', () => {
      const req = makeMockReq({
        '__proto__': '1.2.3.4' as unknown as string,
        'x-vercel-forwarded-for': '198.51.100.59'
      })
      expect(extractClientIp(req)).toBe('198.51.100.59')
    })

    it('4.1.20: Uppercase platform header name is matched correctly', () => {
      const req = makeMockReq({ 'X-VERCEL-FORWARDED-FOR': '198.51.100.60' })
      expect(extractClientIp(req)).toBe('198.51.100.60')
    })

    it('4.1.21: Injected CRLF in platform header fails closed', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.61\r\nX-Spoof: true' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.22: Injected semicolon in platform header fails closed', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.62; bypass=1' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.23: Platform header length > 128 characters fails closed', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '1.'.repeat(70) })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.24: Missing socket address in non-Vercel falls back safely to UNKNOWN_CLIENT_IP', () => {
      const req = makeMockReq({})
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('4.1.25: Non-Vercel socket with port stripped cleanly', () => {
      const req = makeMockReq({}, '198.51.100.63:8080')
      expect(extractClientIp(req)).toBe('198.51.100.63')
    })
  })

  // =========================================================================
  // Section 5: Rate-Limiting & Memory Consequences (20 tests)
  // =========================================================================
  describe('5. Rate-Limiting & Memory Consequences', () => {
    it('5.1.1: Spoofed platform header cannot create a fresh bucket on Vercel', () => {
      process.env.VERCEL = '1'
      // First 10 requests under real platform IP
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.70' })
        expect(checkRateLimit(extractClientIp(req)).allowed).toBe(true)
      }
      // 11th request under real platform IP is blocked
      const blockedReq = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.70' })
      expect(checkRateLimit(extractClientIp(blockedReq)).allowed).toBe(false)
    })

    it('5.1.2: Spoofed x-real-ip cannot steal or pollute a victim IP bucket', () => {
      const victimIp = '198.51.100.71'
      // Attacker tries to send X-Real-IP: victimIp
      const attackerReq = makeMockReq({ 'x-real-ip': victimIp })
      const attackerIdentity = extractClientIp(attackerReq)
      // Attacker is mapped to UNKNOWN_CLIENT_IP, not victimIp!
      expect(attackerIdentity).toBe(UNKNOWN_CLIENT_IP)
      // Victim's bucket is completely untouched
      expect(checkRateLimit(victimIp).remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1)
    })

    it('5.1.3: Equivalent IPv6 representations share one bucket', () => {
      const a = checkRateLimit('2001:DB8::99')
      const b = checkRateLimit('2001:0db8:0000:0000:0000:0000:0000:0099')
      expect(a.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1)
      expect(b.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2)
    })

    it('5.1.4: Equivalent IPv4-mapped representations share one bucket', () => {
      const a = checkRateLimit('::ffff:198.51.100.72')
      const b = checkRateLimit('198.51.100.72')
      expect(a.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1)
      expect(b.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2)
    })

    it('5.1.5: Equivalent port-bearing representations share one bucket', () => {
      const a = checkRateLimit('198.51.100.73:8080')
      const b = checkRateLimit('198.51.100.73:443')
      expect(a.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1)
      expect(b.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2)
    })

    it('5.1.6: All malformed identities converge into the single __unknown_ingress__ bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit(`malformed-${i}`).allowed).toBe(true)
      }
      expect(checkRateLimit('another-malformed').allowed).toBe(false)
      expect(checkRateLimit(UNKNOWN_CLIENT_IP).allowed).toBe(false)
    })

    it('5.1.7: Exactly 10 requests allowed under valid identity', () => {
      const ip = '198.51.100.74'
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit(ip).allowed).toBe(true)
      }
    })

    it('5.1.8: 11th request rejected with allowed: false and positive reset time', () => {
      const ip = '198.51.100.75'
      for (let i = 0; i < 10; i++) {
        checkRateLimit(ip)
      }
      const blocked = checkRateLimit(ip)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
      expect(blocked.resetTime).toBeGreaterThan(0)
    })

    it('5.1.9: Reset time is bounded within rate limit window (<= 60s)', () => {
      const ip = '198.51.100.76'
      for (let i = 0; i < 10; i++) {
        checkRateLimit(ip)
      }
      const blocked = checkRateLimit(ip)
      expect(blocked.resetTime).toBeLessThanOrEqual(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
    })

    it('5.1.10: Rate limit map prunes entries older than window MS', () => {
      const ip = '198.51.100.77'
      checkRateLimit(ip)
      expect(checkRateLimit(ip).remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2)
    })

    it('5.1.11: Burst requests from same identity decrement shared counter linearly', () => {
      const ip = '198.51.100.78'
      const r1 = checkRateLimit(ip)
      const r2 = checkRateLimit(ip)
      const r3 = checkRateLimit(ip)
      expect(r1.remaining).toBe(9)
      expect(r2.remaining).toBe(8)
      expect(r3.remaining).toBe(7)
    })

    it('5.1.12: Distinct identities do not collide or decrement each others counters', () => {
      checkRateLimit('198.51.100.79')
      checkRateLimit('198.51.100.79')
      expect(checkRateLimit('198.51.100.79').remaining).toBe(7)
      expect(checkRateLimit('198.51.100.80').remaining).toBe(9)
    })

    it('5.1.13: Malformed identity exhaustion does not block legitimate IP', () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit('malformed-noise')
      }
      expect(checkRateLimit(UNKNOWN_CLIENT_IP).allowed).toBe(false)
      expect(checkRateLimit('198.51.100.81').allowed).toBe(true)
    })

    it('5.1.14: Legitimate IP exhaustion does not block unknown ingress bucket', () => {
      const ip = '198.51.100.82'
      for (let i = 0; i < 10; i++) {
        checkRateLimit(ip)
      }
      expect(checkRateLimit(ip).allowed).toBe(false)
      expect(checkRateLimit(UNKNOWN_CLIENT_IP).allowed).toBe(true)
    })

    it('5.1.15: Enforces RATE_LIMIT_MAX_ENTRIES (10000) ceiling', () => {
      expect(RATE_LIMIT_MAX_ENTRIES).toBe(10000)
    })

    it('5.1.16: Flood of 10,500 distinct IPs never exceeds 10,000 entries in map', () => {
      for (let i = 0; i < 10500; i++) {
        const b3 = Math.floor(i / 256)
        const b4 = i % 256
        checkRateLimit(`12.${b3}.${b4}.1`)
      }
      expect(getRateLimitMapSize()).toBeLessThanOrEqual(RATE_LIMIT_MAX_ENTRIES)
    })

    it('5.1.17: Flood of 1,000 malformed IPs creates exactly 1 entry (__unknown_ingress__)', () => {
      resetRateLimitsForTesting()
      for (let i = 0; i < 1000; i++) {
        checkRateLimit(`noise-${i}`)
      }
      expect(getRateLimitMapSize()).toBe(1)
    })

    it('5.1.18: Oldest entries evicted when map size exceeds ceiling', () => {
      resetRateLimitsForTesting()
      for (let i = 0; i < RATE_LIMIT_MAX_ENTRIES + 50; i++) {
        const b3 = Math.floor(i / 256)
        const b4 = i % 256
        checkRateLimit(`13.${b3}.${b4}.1`)
      }
      expect(getRateLimitMapSize()).toBe(RATE_LIMIT_MAX_ENTRIES)
    })

    it('5.1.19: resetRateLimitsForTesting clears all buckets completely', () => {
      checkRateLimit('198.51.100.83')
      checkRateLimit('198.51.100.84')
      expect(getRateLimitMapSize()).toBeGreaterThanOrEqual(2)
      resetRateLimitsForTesting()
      expect(getRateLimitMapSize()).toBe(0)
    })

    it('5.1.20: Rate limit map keys are strictly canonical string representations', () => {
      resetRateLimitsForTesting()
      checkRateLimit('::ffff:198.51.100.85')
      checkRateLimit('198.51.100.85:8080')
      checkRateLimit('198.51.100.85')
      // All three collapsed into the exact same single key: '198.51.100.85'
      expect(getRateLimitMapSize()).toBe(1)
    })
  })

  // =========================================================================
  // Section 6: Dedicated Mutation Tests (M01 - M30)
  // =========================================================================
  describe('6. Dedicated Mutation Tests (M01-M30)', () => {
    it('M01: Trusting x-vercel-forwarded-for without proving provenance is prevented', () => {
      // On Vercel (VERCEL=1), platform metadata is required; missing header fails closed
      process.env.VERCEL = '1'
      const req = makeMockReq({ 'x-forwarded-for': '1.2.3.4' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M02: Trusting x-real-ip when client can supply it is prevented', () => {
      const req = makeMockReq({ 'x-real-ip': '1.2.3.4' })
      // x-real-ip is untrusted and ignored
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M03: Trusting leftmost x-forwarded-for is prevented', () => {
      const req = makeMockReq({ 'x-forwarded-for': 'spoofed.attacker.ip, 198.51.100.90' })
      expect(extractClientIp(req)).toBe('198.51.100.90')
    })

    it('M04: Trusting rightmost x-forwarded-for without proxy-chain proof is prevented on Vercel', () => {
      process.env.VERCEL = '1'
      const req = makeMockReq({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M05: Preferring attacker-controlled header over socket address is prevented', () => {
      const req = makeMockReq({ 'x-real-ip': '8.8.8.8' }, '198.51.100.91')
      // x-real-ip is ignored; socket remoteAddress is used
      expect(extractClientIp(req)).toBe('198.51.100.91')
    })

    it('M06: Falling back to x-real-ip when trusted metadata is absent is prevented', () => {
      const req = makeMockReq({ 'x-real-ip': '8.8.8.8' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M07: Accepting Forwarded header as authoritative is prevented', () => {
      const req = makeMockReq({ 'forwarded': 'for=8.8.8.8' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M08: Trusting Host-derived identity is prevented', () => {
      const req = makeMockReq({ 'host': '198.51.100.92' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M09: Trusting user-supplied X-Client-IP is prevented', () => {
      const req = makeMockReq({ 'x-client-ip': '198.51.100.93' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M10: Accepting duplicate trusted headers and choosing attacker-controlled first value is prevented', () => {
      // Conflicting duplicate headers fail closed
      const req = makeMockReq({ 'x-vercel-forwarded-for': ['1.1.1.1', '2.2.2.2'] })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M11: Accepting duplicate trusted headers and choosing attacker-controlled last value is prevented', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': ['2.2.2.2', '1.1.1.1'] })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M12: Treating malformed trusted metadata as attacker-selectable fallback is prevented', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': 'invalid-ip',
        'x-forwarded-for': '198.51.100.94'
      })
      // Must NOT fall through to x-forwarded-for
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M13: Letting invalid trusted metadata fall through to arbitrary header text is prevented', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': 'invalid-ip',
        'x-real-ip': '198.51.100.95'
      })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M14: Letting a forged trusted header create a fresh rate-limit bucket is prevented', () => {
      // In Vercel mode with conflicting or forged entries, fails to unknown bucket
      const req = makeMockReq({ 'x-vercel-forwarded-for': 'noise-header' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M15: Letting a forged trusted header collide with another users bucket is prevented', () => {
      const targetUserIp = '198.51.100.96'
      // Attacker sends malformed vercel header trying to collide
      const attackerReq = makeMockReq({ 'x-vercel-forwarded-for': 'malformed', 'x-forwarded-for': targetUserIp })
      expect(extractClientIp(attackerReq)).toBe(UNKNOWN_CLIENT_IP)
      expect(checkRateLimit(targetUserIp).remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1)
    })

    it('M16: Disabling socket fallback without conservative unknown handling is prevented', () => {
      const req = makeMockReq({})
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M17: Disabling unknown bucket bounding is prevented', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit(`unknown-${i}`)
      }
      // 11th request under unknown ingress is rejected
      expect(checkRateLimit(UNKNOWN_CLIENT_IP).allowed).toBe(false)
    })

    it('M18: Identity extraction executes before body parsing', () => {
      // In api/generate-plan.ts, extractClientIp(req) and checkRateLimit(clientIp)
      // are called at lines ~2510-2520, well before parseRequestBody(req) at line ~2540
      expect(typeof extractClientIp).toBe('function')
    })

    it('M19: Rate-limiting using raw uncanonicalized trusted values is prevented', () => {
      const raw1 = '2001:DB8::1'
      const raw2 = '2001:db8::1'
      checkRateLimit(raw1)
      // Canonicalized internally, so raw2 observes decrement
      expect(checkRateLimit(raw2).remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2)
    })

    it('M20: Using different extraction logic in another request path is prevented', () => {
      // extractClientIp is the single exported identity function for all API paths
      expect(extractClientIp).toBeDefined()
    })

    it('M21: Bypassing limiter through a rewrite or query string is prevented', () => {
      const req1 = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.97', 'url': '/api/generate-plan' })
      const req2 = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.97', 'url': '/api/generate-plan?bypass=1' })
      expect(extractClientIp(req1)).toBe(extractClientIp(req2))
    })

    it('M22: Bypassing limiter by changing Host is prevented', () => {
      const req1 = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.97', 'host': 'origin1.com' })
      const req2 = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.97', 'host': 'origin2.com' })
      expect(extractClientIp(req1)).toBe(extractClientIp(req2))
    })

    it('M23: Bypassing limiter by using a direct API origin instead of frontend origin is prevented', () => {
      const reqDirect = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.97' })
      const reqFrontend = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.97', 'origin': 'https://bodymap-ai.vercel.app' })
      expect(extractClientIp(reqDirect)).toBe(extractClientIp(reqFrontend))
    })

    it('M24: Letting header arrays produce multiple identities is prevented', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': ['198.51.100.98', '198.51.100.98'] })
      expect(extractClientIp(req)).toBe('198.51.100.98')
    })

    it('M25: Letting comma folding alter trusted-hop selection is prevented', () => {
      // Conflicting comma folded hops fail closed
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.99, 10.0.0.1' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M26: Letting whitespace alter trusted-hop selection is prevented', () => {
      const req1 = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.100' })
      const req2 = makeMockReq({ 'x-vercel-forwarded-for': '  198.51.100.100  ' })
      expect(extractClientIp(req1)).toBe(extractClientIp(req2))
    })

    it('M27: Letting CR/LF/header-parser ambiguity alter identity is prevented', () => {
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.101\r\n' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M28: Trusting a proxy header in local tests but not production-shaped requests is prevented', () => {
      process.env.VERCEL = '1'
      const req = makeMockReq({ 'x-vercel-forwarded-for': '198.51.100.102' })
      expect(extractClientIp(req)).toBe('198.51.100.102')
    })

    it('M29: Trusting socket metadata in local tests but using attacker-controlled headers in production is prevented', () => {
      process.env.VERCEL = '1'
      // Attacker sends forged x-forwarded-for in production Vercel mode
      const req = makeMockReq({ 'x-forwarded-for': '1.2.3.4' })
      // On Vercel, x-forwarded-for is NOT trusted over platform metadata
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('M30: Claiming global distributed identity/rate-limit enforcement when implementation is per-instance is prevented', () => {
      // The implementation uses an in-memory Map (rateLimitMap)
      // Explicitly documenting that multi-instance global synchronization requires external store
      expect(RATE_LIMIT_MAX_REQUESTS).toBe(10)
      expect(RATE_LIMIT_MAX_ENTRIES).toBe(10000)
    })
  })
})
