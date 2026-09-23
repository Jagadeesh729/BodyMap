import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('RFC 9116 security.txt Compliance & Integrity', () => {
  const filePath = path.resolve(process.cwd(), 'public/.well-known/security.txt')

  it('verifies public/.well-known/security.txt exists', () => {
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('contains valid RFC 9116 required fields: Contact and Expires', () => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean)

    const contacts = lines.filter(l => l.startsWith('Contact:'))
    expect(contacts.length).toBeGreaterThanOrEqual(1)

    // Verify contact URI syntax
    for (const contactLine of contacts) {
      const uri = contactLine.replace(/^Contact:\s*/, '').trim()
      expect(uri.startsWith('mailto:') || uri.startsWith('https://')).toBe(true)
      if (uri.startsWith('mailto:')) {
        expect(uri).toContain('@')
        expect(uri).toMatch(/^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      }
    }

    const expiresLine = lines.find(l => l.startsWith('Expires:'))
    expect(expiresLine).toBeDefined()
    const expiresValue = expiresLine!.replace(/^Expires:\s*/, '').trim()

    // Must be valid RFC 3339 date-time
    const expiresDate = new Date(expiresValue)
    expect(isNaN(expiresDate.getTime())).toBe(false)

    // Must be future-dated
    expect(expiresDate.getTime()).toBeGreaterThan(Date.now())
  })

  it('contains legitimate documentation fields: Preferred-Languages, Canonical, Policy', () => {
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toContain('Preferred-Languages: en')
    expect(content).toContain('Canonical: https://bodymap-ai.vercel.app/.well-known/security.txt')
    expect(content).toContain('Policy: https://github.com/Jagadeesh729/BodyMap')
  })

  it('contains zero API keys, secrets, or private filesystem paths', () => {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Pattern: AIzaSy... (Google API key prefix)
    expect(content).not.toMatch(/AIzaSy[A-Za-z0-9_-]{33}/)
    expect(content).not.toContain('GEMINI_API_KEY')
    expect(content).not.toContain('process.env')
    expect(content).not.toContain('C:\\')
    expect(content).not.toContain('/home/')
    expect(content).not.toContain('/Users/')
  })

  it('verifies dist/.well-known/security.txt is emitted byte-identically on build', () => {
    const distPath = path.resolve(process.cwd(), 'dist/.well-known/security.txt')
    if (fs.existsSync(distPath)) {
      const publicContent = fs.readFileSync(filePath, 'utf-8')
      const distContent = fs.readFileSync(distPath, 'utf-8')
      expect(distContent).toBe(publicContent)
    }
  })
})
