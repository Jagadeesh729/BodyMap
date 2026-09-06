import { describe, it, expect, beforeEach } from 'vitest'
import type { IncomingMessage } from 'http'
import {
  canonicalizeIp,
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
  return {
    headers,
    socket: remoteAddress ? ({ remoteAddress } as unknown as NonNullable<IncomingMessage['socket']>) : undefined
  } as unknown as IncomingMessage
}

describe('Ingress Identity & Distributed Abuse Oracle', () => {
  beforeEach(() => {
    resetRateLimitsForTesting()
  })

  // =========================================================================
  // Section 1: RFC 5952 IPv6 Canonicalization Invariants (20 tests)
  // =========================================================================
  describe('1. RFC 5952 IPv6 Canonicalization Invariants', () => {
    it('1.1.1: Normalizes uppercase IPv6 hex characters to lowercase', () => {
      expect(canonicalizeIp('2001:DB8::1')).toBe('2001:db8::1')
      expect(canonicalizeIp('FE80::A1B2:C3D4')).toBe('fe80::a1b2:c3d4')
    })

    it('1.1.2: Suppresses leading zeroes in each 16-bit field', () => {
      expect(canonicalizeIp('2001:0db8:0001:0000:0000:0000:0000:0001')).toBe('2001:db8:1::1')
      expect(canonicalizeIp('0001:0002:0003:0004:0005:0006:0007:0008')).toBe('1:2:3:4:5:6:7:8')
    })

    it('1.1.3: Compresses longest run of consecutive 16-bit zero fields', () => {
      expect(canonicalizeIp('2001:db8:0:0:0:1:0:1')).toBe('2001:db8::1:0:1')
    })

    it('1.1.4: Compresses first run when two runs of zeros have equal length', () => {
      expect(canonicalizeIp('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1')
    })

    it('1.1.5: Does NOT compress a single isolated 16-bit zero field (RFC 5952 § 4.2.2)', () => {
      expect(canonicalizeIp('2001:db8:0:1:1:1:1:1')).toBe('2001:db8:0:1:1:1:1:1')
    })

    it('1.1.6: All-zero IPv6 address collapses strictly to ::', () => {
      expect(canonicalizeIp('0:0:0:0:0:0:0:0')).toBe('::')
      expect(canonicalizeIp('0000:0000:0000:0000:0000:0000:0000:0000')).toBe('::')
      expect(canonicalizeIp('::')).toBe('::')
    })

    it('1.1.7: IPv6 loopback collapses strictly to ::1', () => {
      expect(canonicalizeIp('0:0:0:0:0:0:0:1')).toBe('::1')
      expect(canonicalizeIp('0000:0000:0000:0000:0000:0000:0000:0001')).toBe('::1')
      expect(canonicalizeIp('::1')).toBe('::1')
    })

    it('1.1.8: Trailing consecutive zeroes compress correctly to ::', () => {
      expect(canonicalizeIp('2001:db8:1:1:1:1:0:0')).toBe('2001:db8:1:1:1:1::')
    })

    it('1.1.9: Leading consecutive zeroes compress correctly to ::', () => {
      expect(canonicalizeIp('0:0:1:1:1:1:1:1')).toBe('::1:1:1:1:1:1')
    })

    it('1.1.10: Compresses second run when it is strictly longer than first run', () => {
      expect(canonicalizeIp('2001:db8:0:0:1:0:0:0')).toBe('2001:db8:0:0:1::')
    })

    it('1.1.11: Full 8 fields without zero runs remain verbatim in lowercase', () => {
      expect(canonicalizeIp('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2:3:4:5:6')
    })

    it('1.1.12: Strips IPv6 zone/scope identifier (%eth0)', () => {
      expect(canonicalizeIp('fe80::1%eth0')).toBe('fe80::1')
      expect(canonicalizeIp('fe80::1%1')).toBe('fe80::1')
    })

    it('1.1.13: Handles mixed uppercase and zero suppression simultaneously', () => {
      expect(canonicalizeIp('2001:0DB8:0000:0000:ABCD:0000:0000:0001')).toBe('2001:db8::abcd:0:0:1')
    })

    it('1.1.14: Preserves maximum word values ffff', () => {
      expect(canonicalizeIp('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
    })

    it('1.1.15: Compresses double colon at prefix', () => {
      expect(canonicalizeIp('::ffff')).toBe('::ffff')
    })

    it('1.1.16: Compresses double colon at suffix', () => {
      expect(canonicalizeIp('ffff::')).toBe('ffff::')
    })

    it('1.1.17: Rejects double :: occurrences', () => {
      expect(canonicalizeIp('2001::db8::1')).toBeNull()
      expect(canonicalizeIp('::1::2')).toBeNull()
    })

    it('1.1.18: Rejects non-hex characters in IPv6 words', () => {
      expect(canonicalizeIp('2001:xyz::1')).toBeNull()
      expect(canonicalizeIp('2001:db8::g')).toBeNull()
    })

    it('1.1.19: Rejects IPv6 word length exceeding 4 hex digits', () => {
      expect(canonicalizeIp('20001:db8::1')).toBeNull()
    })

    it('1.1.20: Rejects IPv6 with insufficient or surplus words without ::', () => {
      expect(canonicalizeIp('2001:db8:1:2:3:4:5')).toBeNull()
      expect(canonicalizeIp('2001:db8:1:2:3:4:5:6:7')).toBeNull()
    })
  })

  // =========================================================================
  // Section 2: IPv4 Canonicalization & Parsing Invariants (15 tests)
  // =========================================================================
  describe('2. IPv4 Canonicalization & Parsing Invariants', () => {
    it('2.1.1: Standard dotted-quad IPv4 canonicalizes cleanly', () => {
      expect(canonicalizeIp('192.168.1.1')).toBe('192.168.1.1')
      expect(canonicalizeIp('8.8.8.8')).toBe('8.8.8.8')
      expect(canonicalizeIp('10.0.0.1')).toBe('10.0.0.1')
    })

    it('2.1.2: Strips leading zeros from IPv4 octets to prevent evasion', () => {
      expect(canonicalizeIp('192.168.001.001')).toBe('192.168.1.1')
      expect(canonicalizeIp('010.000.000.001')).toBe('10.0.0.1')
      expect(canonicalizeIp('172.016.000.050')).toBe('172.16.0.50')
    })

    it('2.1.3: Handles boundary addresses 0.0.0.0 and 255.255.255.255', () => {
      expect(canonicalizeIp('0.0.0.0')).toBe('0.0.0.0')
      expect(canonicalizeIp('255.255.255.255')).toBe('255.255.255.255')
    })

    it('2.1.4: Rejects IPv4 octet > 255', () => {
      expect(canonicalizeIp('256.0.0.1')).toBeNull()
      expect(canonicalizeIp('192.168.1.300')).toBeNull()
    })

    it('2.1.5: Rejects negative IPv4 octets', () => {
      expect(canonicalizeIp('192.168.-1.1')).toBeNull()
    })

    it('2.1.6: Rejects IPv4 with fewer than 4 octets', () => {
      expect(canonicalizeIp('192.168.1')).toBeNull()
      expect(canonicalizeIp('10.0')).toBeNull()
      expect(canonicalizeIp('127')).toBeNull()
    })

    it('2.1.7: Rejects IPv4 with more than 4 octets', () => {
      expect(canonicalizeIp('192.168.1.1.1')).toBeNull()
    })

    it('2.1.8: Rejects non-numeric IPv4 characters', () => {
      expect(canonicalizeIp('192.168.1.a')).toBeNull()
      expect(canonicalizeIp('192.168.x.1')).toBeNull()
    })

    it('2.1.9: Rejects trailing or leading dots', () => {
      expect(canonicalizeIp('.192.168.1.1')).toBeNull()
      expect(canonicalizeIp('192.168.1.1.')).toBeNull()
    })

    it('2.1.10: Rejects consecutive dots', () => {
      expect(canonicalizeIp('192..168.1.1')).toBeNull()
    })

    it('2.1.11: Strips valid TCP port from IPv4', () => {
      expect(canonicalizeIp('192.168.1.1:80')).toBe('192.168.1.1')
      expect(canonicalizeIp('10.0.0.1:8080')).toBe('10.0.0.1')
      expect(canonicalizeIp('172.16.0.1:65535')).toBe('172.16.0.1')
    })

    it('2.1.12: Rejects IPv4 with TCP port > 65535', () => {
      expect(canonicalizeIp('192.168.1.1:65536')).toBeNull()
      expect(canonicalizeIp('192.168.1.1:999999')).toBeNull()
    })

    it('2.1.13: Rejects IPv4 with non-numeric TCP port', () => {
      expect(canonicalizeIp('192.168.1.1:abc')).toBeNull()
    })

    it('2.1.14: Trims external whitespace around IPv4', () => {
      expect(canonicalizeIp('  192.168.1.1  ')).toBe('192.168.1.1')
      expect(canonicalizeIp('\t10.0.0.1\n')).toBe('10.0.0.1')
    })

    it('2.1.15: Rejects embedded whitespace inside IPv4', () => {
      expect(canonicalizeIp('192. 168.1.1')).toBeNull()
      expect(canonicalizeIp('10.0.0 .1')).toBeNull()
    })
  })

  // =========================================================================
  // Section 3: IPv4-Mapped IPv6 Canonicalization Invariants (10 tests)
  // =========================================================================
  describe('3. IPv4-Mapped IPv6 Canonicalization Invariants', () => {
    it('3.1.1: Collapses standard ::ffff:w.x.y.z to w.x.y.z', () => {
      expect(canonicalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1')
      expect(canonicalizeIp('::ffff:10.0.0.1')).toBe('10.0.0.1')
    })

    it('3.1.2: Normalizes uppercase ::FFFF:w.x.y.z prefix', () => {
      expect(canonicalizeIp('::FFFF:192.168.1.1')).toBe('192.168.1.1')
      expect(canonicalizeIp('::fFfF:8.8.8.8')).toBe('8.8.8.8')
    })

    it('3.1.3: Collapses full zero-expanded 0:0:0:0:0:ffff:w.x.y.z prefix', () => {
      expect(canonicalizeIp('0:0:0:0:0:ffff:192.168.1.1')).toBe('192.168.1.1')
      expect(canonicalizeIp('0000:0000:0000:0000:0000:ffff:192.168.1.1')).toBe('192.168.1.1')
    })

    it('3.1.4: Normalizes hex notation IPv4-mapped IPv6 ::ffff:c0a8:0101 to 192.168.1.1', () => {
      expect(canonicalizeIp('::ffff:c0a8:0101')).toBe('192.168.1.1')
    })

    it('3.1.5: Normalizes hex notation loopback ::ffff:7f00:0001 to 127.0.0.1', () => {
      expect(canonicalizeIp('::ffff:7f00:0001')).toBe('127.0.0.1')
    })

    it('3.1.6: Normalizes hex notation public IP ::ffff:0808:0808 to 8.8.8.8', () => {
      expect(canonicalizeIp('::ffff:0808:0808')).toBe('8.8.8.8')
    })

    it('3.1.7: Normalizes hex notation with full zero prefix 0:0:0:0:0:ffff:c0a8:0101', () => {
      expect(canonicalizeIp('0:0:0:0:0:ffff:c0a8:0101')).toBe('192.168.1.1')
    })

    it('3.1.8: Strips port from mapped IP [::ffff:192.168.1.1]:8080', () => {
      expect(canonicalizeIp('[::ffff:192.168.1.1]:8080')).toBe('192.168.1.1')
    })

    it('3.1.9: Strips quotes from mapped IP "::ffff:192.168.1.1"', () => {
      expect(canonicalizeIp('"::ffff:192.168.1.1"')).toBe('192.168.1.1')
    })

    it('3.1.10: Normalizes leading zero octets in mapped IP ::ffff:192.168.001.001', () => {
      expect(canonicalizeIp('::ffff:192.168.001.001')).toBe('192.168.1.1')
    })
  })

  // =========================================================================
  // Section 4: Delimiter, Quote, Port & Bracket Handling (15 tests)
  // =========================================================================
  describe('4. Delimiter, Quote, Port & Bracket Handling', () => {
    it('4.1.1: Strips brackets from bracketed IPv6 [2001:db8::1]', () => {
      expect(canonicalizeIp('[2001:db8::1]')).toBe('2001:db8::1')
    })

    it('4.1.2: Strips brackets and valid port [2001:db8::1]:80', () => {
      expect(canonicalizeIp('[2001:db8::1]:80')).toBe('2001:db8::1')
    })

    it('4.1.3: Strips brackets and valid port [2001:db8::1]:443', () => {
      expect(canonicalizeIp('[2001:db8::1]:443')).toBe('2001:db8::1')
    })

    it('4.1.4: Strips brackets and maximum valid port 65535', () => {
      expect(canonicalizeIp('[2001:db8::1]:65535')).toBe('2001:db8::1')
    })

    it('4.1.5: Rejects bracketed IPv6 with port > 65535', () => {
      expect(canonicalizeIp('[2001:db8::1]:65536')).toBeNull()
    })

    it('4.1.6: Rejects unclosed opening bracket', () => {
      expect(canonicalizeIp('[2001:db8::1')).toBeNull()
    })

    it('4.1.7: Rejects trailing bracket without opening bracket', () => {
      expect(canonicalizeIp('2001:db8::1]')).toBeNull()
    })

    it('4.1.8: Strips surrounding double quotes', () => {
      expect(canonicalizeIp('"192.168.1.1"')).toBe('192.168.1.1')
      expect(canonicalizeIp('"[2001:db8::1]:80"')).toBe('2001:db8::1')
    })

    it('4.1.9: Strips surrounding single quotes', () => {
      expect(canonicalizeIp("'192.168.1.1'")).toBe('192.168.1.1')
      expect(canonicalizeIp("'2001:db8::1'")).toBe('2001:db8::1')
    })

    it('4.1.10: Rejects mismatched quotes', () => {
      expect(canonicalizeIp('"192.168.1.1')).toBeNull()
      expect(canonicalizeIp("192.168.1.1'")).toBeNull()
    })

    it('4.1.11: Bracketed IPv4 with port [192.168.1.1]:80 collapses cleanly', () => {
      expect(canonicalizeIp('[192.168.1.1]:80')).toBe('192.168.1.1')
    })

    it('4.1.12: Strips leading and trailing carriage return / newline', () => {
      expect(canonicalizeIp('\r\n192.168.1.1\r\n')).toBe('192.168.1.1')
    })

    it('4.1.13: Strips leading and trailing tabs', () => {
      expect(canonicalizeIp('\t\t2001:db8::1\t')).toBe('2001:db8::1')
    })

    it('4.1.14: Rejects non-numeric port in brackets [::1]:xyz', () => {
      expect(canonicalizeIp('[::1]:xyz')).toBeNull()
    })

    it('4.1.15: Rejects characters following close bracket without colon [::1]extra', () => {
      expect(canonicalizeIp('[::1]extra')).toBeNull()
    })
  })

  // =========================================================================
  // Section 5: Security Injection, Control Characters & Length Bounding (15 tests)
  // =========================================================================
  describe('5. Security Injection, Control Characters & Length Bounding', () => {
    it('5.1.1: Rejects null byte in IPv4 string', () => {
      expect(canonicalizeIp('192.168.1.1\0.evil.com')).toBeNull()
    })

    it('5.1.2: Rejects null byte in IPv6 string', () => {
      expect(canonicalizeIp('2001:db8\0::1')).toBeNull()
    })

    it('5.1.3: Rejects embedded CRLF header injection', () => {
      expect(canonicalizeIp('192.168.1.1\r\nX-Injected: true')).toBeNull()
      expect(canonicalizeIp('10.0.0.1\nSet-Cookie: session=evil')).toBeNull()
    })

    it('5.1.4: Rejects semicolon command injection', () => {
      expect(canonicalizeIp('192.168.1.1; rm -rf /')).toBeNull()
      expect(canonicalizeIp('192.168.1.1; SELECT * FROM users')).toBeNull()
    })

    it('5.1.5: Rejects comma inside single IP candidate', () => {
      expect(canonicalizeIp('192.168.1.1,10.0.0.1')).toBeNull()
    })

    it('5.1.6: Rejects embedded tab characters', () => {
      expect(canonicalizeIp('192.168.1.1\t8.8.8.8')).toBeNull()
    })

    it('5.1.7: Rejects empty string', () => {
      expect(canonicalizeIp('')).toBeNull()
      expect(canonicalizeIp('   ')).toBeNull()
    })

    it('5.1.8: Rejects null and undefined inputs gracefully', () => {
      expect(canonicalizeIp(null)).toBeNull()
      expect(canonicalizeIp(undefined)).toBeNull()
    })

    it('5.1.9: Rejects non-string types safely', () => {
      expect(canonicalizeIp(12345 as unknown as string)).toBeNull()
      expect(canonicalizeIp({} as unknown as string)).toBeNull()
      expect(canonicalizeIp([] as unknown as string)).toBeNull()
    })

    it('5.1.10: Rejects excessively long IP string (129 chars)', () => {
      expect(canonicalizeIp('a'.repeat(129))).toBeNull()
    })

    it('5.1.11: Rejects multi-kilobyte DoS string (2000 chars)', () => {
      expect(canonicalizeIp('1.'.repeat(1000))).toBeNull()
    })

    it('5.1.12: Rejects URL formats', () => {
      expect(canonicalizeIp('http://192.168.1.1')).toBeNull()
      expect(canonicalizeIp('https://example.com')).toBeNull()
    })

    it('5.1.13: Rejects CIDR prefix notation', () => {
      expect(canonicalizeIp('192.168.1.0/24')).toBeNull()
      expect(canonicalizeIp('2001:db8::/32')).toBeNull()
    })

    it('5.1.14: Rejects HTML and script tags', () => {
      expect(canonicalizeIp('<script>alert(1)</script>')).toBeNull()
    })

    it('5.1.15: Rejects shell metacharacters', () => {
      expect(canonicalizeIp('192.168.1.1 & ls')).toBeNull()
      expect(canonicalizeIp('192.168.1.1 | cat')).toBeNull()
    })
  })

  // =========================================================================
  // Section 6: Ingress Header Selection & Proxy Trust Hierarchy (15 tests)
  // =========================================================================
  describe('6. Ingress Header Selection & Proxy Trust Hierarchy', () => {
    it('6.1.1: x-vercel-forwarded-for takes absolute supremacy over other headers', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.10',
        'x-real-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2'
      }, '127.0.0.1')
      expect(extractClientIp(req)).toBe('198.51.100.10')
    })

    it('6.1.2: x-real-ip takes supremacy over x-forwarded-for when vercel header absent', () => {
      const req = makeMockReq({
        'x-real-ip': '198.51.100.20',
        'x-forwarded-for': '2.2.2.2'
      }, '127.0.0.1')
      expect(extractClientIp(req)).toBe('198.51.100.20')
    })

    it('6.1.3: Evaluates x-forwarded-for chain right-to-left to trust reverse proxy appended hop', () => {
      const req = makeMockReq({
        'x-forwarded-for': 'spoofed.attacker.ip, 198.51.100.30'
      })
      expect(extractClientIp(req)).toBe('198.51.100.30')
    })

    it('6.1.4: Multi-hop x-forwarded-for chain selects rightmost valid IP', () => {
      const req = makeMockReq({
        'x-forwarded-for': '1.1.1.1, 2.2.2.2, 198.51.100.40'
      })
      expect(extractClientIp(req)).toBe('198.51.100.40')
    })

    it('6.1.5: Skips malformed rightmost entry in x-forwarded-for to find rightmost valid IP', () => {
      const req = makeMockReq({
        'x-forwarded-for': '198.51.100.50, malformed-proxy-entry'
      })
      expect(extractClientIp(req)).toBe('198.51.100.50')
    })

    it('6.1.6: Supports multi-header array for x-forwarded-for', () => {
      const req = makeMockReq({
        'x-forwarded-for': ['1.1.1.1', '198.51.100.60']
      })
      expect(extractClientIp(req)).toBe('198.51.100.60')
    })

    it('6.1.7: Supports multi-header array with mixed comma-delimited strings', () => {
      const req = makeMockReq({
        'x-forwarded-for': ['1.1.1.1, 2.2.2.2', '3.3.3.3, 198.51.100.70']
      })
      expect(extractClientIp(req)).toBe('198.51.100.70')
    })

    it('6.1.8: Falls back to socket.remoteAddress when headers absent', () => {
      const req = makeMockReq({}, '198.51.100.80')
      expect(extractClientIp(req)).toBe('198.51.100.80')
    })

    it('6.1.9: Canonicalizes IPv4-mapped socket.remoteAddress', () => {
      const req = makeMockReq({}, '::ffff:198.51.100.90')
      expect(extractClientIp(req)).toBe('198.51.100.90')
    })

    it('6.1.10: Canonicalizes IPv6 socket.remoteAddress', () => {
      const req = makeMockReq({}, '2001:0DB8::0001')
      expect(extractClientIp(req)).toBe('2001:db8::1')
    })

    it('6.1.11: Returns UNKNOWN_CLIENT_IP when all headers and socket address absent', () => {
      const req = makeMockReq({})
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('6.1.12: Falls back to socket when all headers are malformed', () => {
      const req = makeMockReq({
        'x-forwarded-for': 'invalid-header-content'
      }, '127.0.0.1')
      expect(extractClientIp(req)).toBe('127.0.0.1')
    })

    it('6.1.13: Returns UNKNOWN_CLIENT_IP when all headers and socket are malformed', () => {
      const req = makeMockReq({
        'x-forwarded-for': 'invalid-header-content'
      }, 'invalid-socket-address')
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })

    it('6.1.14: Handles vercel header as string array', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': ['198.51.100.100', '1.1.1.1']
      })
      expect(extractClientIp(req)).toBe('198.51.100.100')
    })

    it('6.1.15: Handles real-ip header as string array', () => {
      const req = makeMockReq({
        'x-real-ip': ['198.51.100.101', '1.1.1.1']
      })
      expect(extractClientIp(req)).toBe('198.51.100.101')
    })
  })

  // =========================================================================
  // Section 7: Rate Limiter Identity Collapse & Memory Bounding (15 tests)
  // =========================================================================
  describe('7. Rate Limiter Identity Collapse & Memory Bounding', () => {
    it('7.1.1: Uppercase and lowercase IPv6 share the exact same rate limit bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('2001:DB8::1').allowed).toBe(true)
      }
      expect(checkRateLimit('2001:db8::1').allowed).toBe(false)
    })

    it('7.1.2: Expanded and compressed IPv6 share the exact same rate limit bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('2001:0db8:0000:0000:0000:0000:0000:0001').allowed).toBe(true)
      }
      expect(checkRateLimit('2001:db8::1').allowed).toBe(false)
    })

    it('7.1.3: IPv4-mapped IPv6 and standard IPv4 share the exact same rate limit bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('::ffff:192.168.1.1').allowed).toBe(true)
      }
      expect(checkRateLimit('192.168.1.1').allowed).toBe(false)
    })

    it('7.1.4: Hexadecimal IPv4-mapped IPv6 shares the same rate limit bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('::ffff:c0a8:0101').allowed).toBe(true)
      }
      expect(checkRateLimit('192.168.1.1').allowed).toBe(false)
    })

    it('7.1.5: IPv4 with port variations share the exact same rate limit bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('192.168.1.1:8080').allowed).toBe(true)
      }
      expect(checkRateLimit('192.168.1.1:443').allowed).toBe(false)
      expect(checkRateLimit('192.168.1.1').allowed).toBe(false)
    })

    it('7.1.6: Bracketed and unbracketed IPv6 share the exact same rate limit bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('[2001:db8::1]:8080').allowed).toBe(true)
      }
      expect(checkRateLimit('2001:db8::1').allowed).toBe(false)
    })

    it('7.1.7: IPv4 leading-zero variation shares the exact same rate limit bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('192.168.001.001').allowed).toBe(true)
      }
      expect(checkRateLimit('192.168.1.1').allowed).toBe(false)
    })

    it('7.1.8: Distinct client IP addresses remain completely isolated', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('10.0.0.1').allowed).toBe(true)
      }
      expect(checkRateLimit('10.0.0.1').allowed).toBe(false)
      // Unrelated IP has full allowance
      const res = checkRateLimit('10.0.0.2')
      expect(res.allowed).toBe(true)
      expect(res.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1)
    })

    it('7.1.9: Multiple malformed ingress strings collapse into the single __unknown_ingress__ bucket', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const junkIp = `invalid-ip-${i}`
        expect(checkRateLimit(junkIp).allowed).toBe(true)
      }
      // 11th malformed ingress attempt is blocked
      expect(checkRateLimit('another-malformed-ip').allowed).toBe(false)
      expect(checkRateLimit(UNKNOWN_CLIENT_IP).allowed).toBe(false)
    })

    it('7.1.10: Exhaustion of __unknown_ingress__ bucket does not block legitimate IPs', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit('malformed-noise')
      }
      expect(checkRateLimit(UNKNOWN_CLIENT_IP).allowed).toBe(false)
      expect(checkRateLimit('192.168.1.200').allowed).toBe(true)
    })

    it('7.1.11: Enforces RATE_LIMIT_MAX_ENTRIES memory bound under IP flood attack', () => {
      // Flood 10,500 distinct IP keys
      for (let i = 0; i < 10500; i++) {
        const b3 = Math.floor(i / 256)
        const b4 = i % 256
        checkRateLimit(`11.${b3}.${b4}.1`)
      }
      expect(getRateLimitMapSize()).toBeLessThanOrEqual(RATE_LIMIT_MAX_ENTRIES)
    })

    it('7.1.12: resetRateLimitsForTesting clears all entries completely', () => {
      checkRateLimit('10.0.0.1')
      checkRateLimit('10.0.0.2')
      expect(getRateLimitMapSize()).toBeGreaterThanOrEqual(2)
      resetRateLimitsForTesting()
      expect(getRateLimitMapSize()).toBe(0)
    })

    it('7.1.13: Correctly computes remaining count decrements', () => {
      const ip = '172.16.1.1'
      expect(checkRateLimit(ip).remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1)
      expect(checkRateLimit(ip).remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2)
      expect(checkRateLimit(ip).remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 3)
    })

    it('7.1.14: Reset time is positive and bounded within the rate limit window', () => {
      const ip = '172.16.1.2'
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit(ip)
      }
      const blocked = checkRateLimit(ip)
      expect(blocked.allowed).toBe(false)
      expect(blocked.resetTime).toBeGreaterThan(0)
      expect(blocked.resetTime).toBeLessThanOrEqual(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
    })

    it('7.1.15: Concurrent requests from same IP decrement the exact same counter', () => {
      const ip = '172.16.1.3'
      const results = [checkRateLimit(ip), checkRateLimit(ip), checkRateLimit(ip)]
      expect(results[0].remaining).toBe(9)
      expect(results[1].remaining).toBe(8)
      expect(results[2].remaining).toBe(7)
    })
  })

  // =========================================================================
  // Section 8: Dedicated Mutation Tests M01 through M25 (25 tests)
  // =========================================================================
  describe('8. Dedicated Mutation Tests (M01-M25)', () => {
    it('M01: Leftmost X-Forwarded-For injection does not bypass rate limit', () => {
      const req = makeMockReq({ 'x-forwarded-for': '8.8.8.8, 198.51.100.2' })
      expect(extractClientIp(req)).toBe('198.51.100.2')
    })

    it('M02: Repeated X-Forwarded-For headers preserve reverse-proxy priority', () => {
      const req = makeMockReq({ 'x-forwarded-for': ['8.8.8.8', '198.51.100.2'] })
      expect(extractClientIp(req)).toBe('198.51.100.2')
    })

    it('M03: Uppercase IPv6 normalization collapes into same canonical identity', () => {
      const a = canonicalizeIp('2001:DB8::1')
      const b = canonicalizeIp('2001:db8::1')
      expect(a).toBe('2001:db8::1')
      expect(b).toBe('2001:db8::1')
      expect(a).toBe(b)
    })

    it('M04: Zero-padded expanded IPv6 collapses to RFC 5952 canonical identity', () => {
      expect(canonicalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1')
    })

    it('M05: Single-zero IPv6 run is not illegally compressed', () => {
      expect(canonicalizeIp('2001:db8:0:1:1:1:1:1')).toBe('2001:db8:0:1:1:1:1:1')
    })

    it('M06: Equal-length zero runs tie-breaker compresses the first run', () => {
      expect(canonicalizeIp('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1')
    })

    it('M07: Bracketed IPv6 brackets stripped to canonical form', () => {
      expect(canonicalizeIp('[2001:db8::1]')).toBe('2001:db8::1')
    })

    it('M08: Bracketed IPv6 with port stripped to canonical form', () => {
      expect(canonicalizeIp('[2001:db8::1]:8080')).toBe('2001:db8::1')
    })

    it('M09: IPv4 with port stripped to canonical form', () => {
      expect(canonicalizeIp('198.51.100.2:443')).toBe('198.51.100.2')
    })

    it('M10: IPv4-mapped IPv6 dotted-quad collapses to canonical IPv4', () => {
      expect(canonicalizeIp('::ffff:198.51.100.2')).toBe('198.51.100.2')
    })

    it('M11: IPv4-mapped IPv6 full hex collapses to canonical IPv4', () => {
      expect(canonicalizeIp('::ffff:c633:6402')).toBe('198.51.100.2')
    })

    it('M12: IPv4 leading zeros normalize to prevent bucket fragmentation', () => {
      expect(canonicalizeIp('198.051.100.002')).toBe('198.51.100.2')
    })

    it('M13: Surrounding quotes stripped from IP address', () => {
      expect(canonicalizeIp('"198.51.100.2"')).toBe('198.51.100.2')
      expect(canonicalizeIp("'198.51.100.2'")).toBe('198.51.100.2')
    })

    it('M14: Surrounding whitespace trimmed from IP address', () => {
      expect(canonicalizeIp('  198.51.100.2  ')).toBe('198.51.100.2')
    })

    it('M15: Embedded whitespace rejected as invalid IP', () => {
      expect(canonicalizeIp('198. 51.100.2')).toBeNull()
    })

    it('M16: Null byte injection rejected as invalid IP', () => {
      expect(canonicalizeIp('198.51.100.2\0.evil.com')).toBeNull()
    })

    it('M17: CRLF header injection rejected as invalid IP', () => {
      expect(canonicalizeIp('198.51.100.2\r\nX-Evil: true')).toBeNull()
    })

    it('M18: Semicolon parameter injection rejected as invalid IP', () => {
      expect(canonicalizeIp('198.51.100.2; drop table')).toBeNull()
    })

    it('M19: Oversized header rejected to prevent memory exhaustion', () => {
      expect(canonicalizeIp('a'.repeat(2000))).toBeNull()
    })

    it('M20: Invalid IPv4 octet > 255 rejected as invalid IP', () => {
      expect(canonicalizeIp('198.51.100.256')).toBeNull()
      expect(canonicalizeIp('300.1.1.1')).toBeNull()
    })

    it('M21: Invalid IPv6 character rejected as invalid IP', () => {
      expect(canonicalizeIp('2001:db8::xyz')).toBeNull()
    })

    it('M22: Multiple double-colons rejected as invalid IP', () => {
      expect(canonicalizeIp('2001:db8::1::2')).toBeNull()
    })

    it('M23: X-Vercel-Forwarded-For edge supremacy overrides spoofed headers', () => {
      const req = makeMockReq({
        'x-vercel-forwarded-for': '198.51.100.99',
        'x-real-ip': '1.2.3.4',
        'x-forwarded-for': '5.6.7.8'
      })
      expect(extractClientIp(req)).toBe('198.51.100.99')
    })

    it('M24: X-Real-IP reverse proxy precedence overrides untrusted X-Forwarded-For', () => {
      const req = makeMockReq({
        'x-real-ip': '198.51.100.88',
        'x-forwarded-for': '5.6.7.8'
      })
      expect(extractClientIp(req)).toBe('198.51.100.88')
    })

    it('M25: Malformed IP fails closed to __unknown_ingress__ bucket', () => {
      const req = makeMockReq({ 'x-forwarded-for': 'not-an-ip-at-all' })
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })
  })
})
