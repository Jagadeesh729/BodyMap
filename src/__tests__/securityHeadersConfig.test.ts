import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('vercel.json Security Headers Configuration', () => {
  it('defines framing protection and security headers on all routes', () => {
    const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json')
    expect(fs.existsSync(vercelConfigPath)).toBe(true)

    const raw = fs.readFileSync(vercelConfigPath, 'utf-8')
    const config = JSON.parse(raw)

    expect(config.headers).toBeDefined()
    expect(Array.isArray(config.headers)).toBe(true)

    const catchAllHeaderRule = config.headers.find((h: { source: string }) => h.source === '/(.*)')
    expect(catchAllHeaderRule).toBeDefined()

    const headersList = catchAllHeaderRule.headers as Array<{ key: string; value: string }>
    
    const xFrameOptions = headersList.find((h: { key: string }) => h.key.toLowerCase() === 'x-frame-options')
    expect(xFrameOptions).toBeDefined()
    expect(xFrameOptions?.value).toBe('DENY')

    const csp = headersList.find((h: { key: string }) => h.key.toLowerCase() === 'content-security-policy')
    expect(csp).toBeDefined()
    expect(csp?.value).toContain("frame-ancestors 'none'")
    expect(csp?.value).toContain("default-src 'self'")

    const nosniff = headersList.find((h: { key: string }) => h.key.toLowerCase() === 'x-content-type-options')
    expect(nosniff).toBeDefined()
    expect(nosniff?.value).toBe('nosniff')

    const referrer = headersList.find((h: { key: string }) => h.key.toLowerCase() === 'referrer-policy')
    expect(referrer).toBeDefined()
    expect(referrer?.value).toBe('strict-origin-when-cross-origin')
  })
})
