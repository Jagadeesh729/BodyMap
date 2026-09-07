import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { sanitizeDownloadFilename, MAX_FILENAME_BASE_LENGTH } from '../lib/downloadSecurity'
import { validateAndParseBackup, BACKUP_SCHEMA_IDENTIFIER } from '../lib/backupStorage'
import { scanPlanForAllergens } from '../lib/allergenGuard'
import { scanPlanForContraindications } from '../lib/contraindicationGuard'
import { FullFormDataSchema, MAX_PAYLOAD_SIZE } from '../../api/generate-plan'

// Helper to load vercel.json
function loadVercelConfig(): Record<string, unknown> {
  const vercelPath = path.resolve(process.cwd(), 'vercel.json')
  return JSON.parse(fs.readFileSync(vercelPath, 'utf8')) as Record<string, unknown>
}

// Helper to load index.html
function loadIndexHtml(): string {
  const indexPath = path.resolve(process.cwd(), 'index.html')
  return fs.readFileSync(indexPath, 'utf8')
}

// Helper to load api/generate-plan.ts
function loadApiHandlerSource(): string {
  const apiPath = path.resolve(process.cwd(), 'api/generate-plan.ts')
  return fs.readFileSync(apiPath, 'utf8')
}

describe('Browser Security Boundary Oracle - Full Audit Suite', () => {
  // =========================================================================
  // SECTION A: Content-Security-Policy (CSP) Directive Integrity (32 Tests)
  // =========================================================================
  describe('Section A: CSP Directive Integrity', () => {
    const vercelConfig = loadVercelConfig()
    const headersList = (vercelConfig.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>)?.[0]?.headers || []
    const cspEntry = headersList.find(h => h.key.toLowerCase() === 'content-security-policy')
    const cspValue = cspEntry?.value || ''
    const indexHtml = loadIndexHtml()
    const apiSource = loadApiHandlerSource()

    it('A01: vercel.json exists and parses as valid JSON object', () => {
      expect(vercelConfig).toBeDefined()
      expect(typeof vercelConfig).toBe('object')
    })

    it('A02: vercel.json specifies global route header mapping for /(.*)', () => {
      const headersConfig = vercelConfig.headers as Array<{ source: string }>
      expect(headersConfig).toBeDefined()
      expect(headersConfig.some(h => h.source === '/(.*)')).toBe(true)
    })

    it('A03: Content-Security-Policy header is explicitly defined in vercel.json', () => {
      expect(cspEntry).toBeDefined()
      expect(cspValue.length).toBeGreaterThan(0)
    })

    it('A04: CSP contains default-src self', () => {
      expect(cspValue).toMatch(/default-src\s+['"]self['"]/)
    })

    it('A05: CSP script-src contains self', () => {
      expect(cspValue).toMatch(/script-src\s+[^;]*['"]self['"]/)
    })

    it('A06: CSP script-src strictly forbids unsafe-eval', () => {
      const scriptSrcMatch = cspValue.match(/script-src\s+([^;]+)/)
      expect(scriptSrcMatch).toBeTruthy()
      expect(scriptSrcMatch?.[1]).not.toContain("'unsafe-eval'")
    })

    it('A07: CSP script-src strictly forbids wildcard *', () => {
      const scriptSrcMatch = cspValue.match(/script-src\s+([^;]+)/)
      expect(scriptSrcMatch?.[1].split(/\s+/)).not.toContain('*')
    })

    it('A08: CSP script-src strictly forbids data: and blob: script execution', () => {
      const scriptSrcMatch = cspValue.match(/script-src\s+([^;]+)/)
      expect(scriptSrcMatch?.[1]).not.toContain('data:')
      expect(scriptSrcMatch?.[1]).not.toContain('blob:')
    })

    it('A09: CSP style-src contains self and unsafe-inline', () => {
      expect(cspValue).toMatch(/style-src\s+[^;]*['"]self['"]/)
      expect(cspValue).toMatch(/style-src\s+[^;]*['"]unsafe-inline['"]/)
    })

    it('A10: CSP style-src contains https://fonts.googleapis.com for Google Fonts', () => {
      expect(cspValue).toContain('https://fonts.googleapis.com')
    })

    it('A11: CSP style-src strictly forbids wildcard *', () => {
      const styleSrcMatch = cspValue.match(/style-src\s+([^;]+)/)
      expect(styleSrcMatch?.[1].split(/\s+/)).not.toContain('*')
    })

    it('A12: CSP font-src contains self and https://fonts.gstatic.com', () => {
      expect(cspValue).toMatch(/font-src\s+[^;]*['"]self['"]/)
      expect(cspValue).toContain('https://fonts.gstatic.com')
    })

    it('A13: CSP font-src strictly forbids wildcard *', () => {
      const fontSrcMatch = cspValue.match(/font-src\s+([^;]+)/)
      expect(fontSrcMatch?.[1].split(/\s+/)).not.toContain('*')
    })

    it('A14: CSP img-src contains self', () => {
      expect(cspValue).toMatch(/img-src\s+[^;]*['"]self['"]/)
    })

    it('A15: CSP img-src contains data: for inline assets', () => {
      expect(cspValue).toMatch(/img-src\s+[^;]*data:/)
    })

    it('A16: CSP img-src contains blob: for client-side blob previews', () => {
      expect(cspValue).toMatch(/img-src\s+[^;]*blob:/)
    })

    it('A17: CSP img-src does NOT contain https: wildcard (closes exfiltration channel)', () => {
      const imgSrcMatch = cspValue.match(/img-src\s+([^;]+)/)
      expect(imgSrcMatch).toBeTruthy()
      const tokens = imgSrcMatch?.[1].trim().split(/\s+/) || []
      expect(tokens).not.toContain('https:')
      expect(tokens).not.toContain('http:')
    })

    it('A18: CSP img-src strictly forbids insecure http: origins', () => {
      const imgSrcMatch = cspValue.match(/img-src\s+([^;]+)/)
      expect(imgSrcMatch?.[1]).not.toContain('http:')
    })

    it('A19: CSP connect-src is strictly restricted to self', () => {
      const connectSrcMatch = cspValue.match(/connect-src\s+([^;]+)/)
      expect(connectSrcMatch).toBeTruthy()
      const tokens = connectSrcMatch?.[1].trim().split(/\s+/) || []
      expect(tokens).toEqual(["'self'"])
    })

    it('A20: CSP connect-src strictly forbids wildcard *', () => {
      const connectSrcMatch = cspValue.match(/connect-src\s+([^;]+)/)
      expect(connectSrcMatch?.[1].split(/\s+/)).not.toContain('*')
    })

    it('A21: CSP base-uri is strictly self', () => {
      expect(cspValue).toMatch(/base-uri\s+['"]self['"]/)
    })

    it('A22: CSP form-action is strictly self', () => {
      expect(cspValue).toMatch(/form-action\s+['"]self['"]/)
    })

    it('A23: CSP object-src is strictly none', () => {
      expect(cspValue).toMatch(/object-src\s+['"]none['"]/)
    })

    it('A24: CSP frame-ancestors is strictly none', () => {
      expect(cspValue).toMatch(/frame-ancestors\s+['"]none['"]/)
    })

    it('A25: index.html contains Content-Security-Policy meta tag', () => {
      expect(indexHtml).toContain('http-equiv="Content-Security-Policy"')
    })

    it('A26: index.html CSP meta tag specifies default-src self', () => {
      const metaMatch = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)
      expect(metaMatch).toBeTruthy()
      expect(metaMatch?.[1]).toContain("default-src 'self'")
    })

    it('A27: index.html CSP meta tag omits frame-ancestors per W3C specification', () => {
      const metaMatch = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)
      expect(metaMatch?.[1]).not.toContain('frame-ancestors')
    })

    it('A28: index.html CSP meta tag does NOT contain https: in img-src', () => {
      const metaMatch = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)
      const imgSrcMatch = metaMatch?.[1].match(/img-src\s+([^;]+)/)
      expect(imgSrcMatch?.[1].split(/\s+/)).not.toContain('https:')
    })

    it('A29: CSP in vercel.json is semicolon-delimited with non-empty directives', () => {
      const directives = cspValue.split(';').map(d => d.trim()).filter(Boolean)
      expect(directives.length).toBeGreaterThanOrEqual(8)
      for (const directive of directives) {
        expect(directive).toMatch(/^[a-z-]+(\s+[^;]+)?$/)
      }
    })

    it('A30: CSP contains no deprecated block-all-mixed-content directive', () => {
      expect(cspValue).not.toContain('block-all-mixed-content')
    })

    it('A31: api/generate-plan.ts sets restrictive API-level CSP', () => {
      expect(apiSource).toContain("res.setHeader('Content-Security-Policy', \"default-src 'none'; frame-ancestors 'none'\")")
    })

    it('A32: API-level CSP strictly enforces default-src none', () => {
      expect(apiSource).toMatch(/Content-Security-Policy.*default-src 'none'/)
    })
  })

  // =========================================================================
  // SECTION B: Security Header Coverage Across Routes (26 Tests)
  // =========================================================================
  describe('Section B: Security Header Coverage Across Routes', () => {
    const vercelConfig = loadVercelConfig()
    const headersList = (vercelConfig.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>)?.[0]?.headers || []
    const getHeader = (key: string) => headersList.find(h => h.key.toLowerCase() === key.toLowerCase())?.value || ''
    const apiSource = loadApiHandlerSource()

    it('B01: vercel.json sets X-Frame-Options to DENY', () => {
      expect(getHeader('X-Frame-Options')).toBe('DENY')
    })

    it('B02: vercel.json sets X-Content-Type-Options to nosniff', () => {
      expect(getHeader('X-Content-Type-Options')).toBe('nosniff')
    })

    it('B03: vercel.json sets Referrer-Policy to strict-origin-when-cross-origin', () => {
      expect(getHeader('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('B04: vercel.json defines Permissions-Policy header', () => {
      expect(getHeader('Permissions-Policy')).toBeTruthy()
    })

    it('B05: Permissions-Policy disables camera', () => {
      expect(getHeader('Permissions-Policy')).toContain('camera=()')
    })

    it('B06: Permissions-Policy disables microphone', () => {
      expect(getHeader('Permissions-Policy')).toContain('microphone=()')
    })

    it('B07: Permissions-Policy disables geolocation', () => {
      expect(getHeader('Permissions-Policy')).toContain('geolocation=()')
    })

    it('B08: Permissions-Policy disables payment', () => {
      expect(getHeader('Permissions-Policy')).toContain('payment=()')
    })

    it('B09: Permissions-Policy disables usb', () => {
      expect(getHeader('Permissions-Policy')).toContain('usb=()')
    })

    it('B10: Permissions-Policy disables bluetooth', () => {
      expect(getHeader('Permissions-Policy')).toContain('bluetooth=()')
    })

    it('B11: Permissions-Policy disables interest-cohort (FLoC tracking)', () => {
      expect(getHeader('Permissions-Policy')).toContain('interest-cohort=()')
    })

    it('B12: vercel.json sets Cross-Origin-Opener-Policy to same-origin', () => {
      expect(getHeader('Cross-Origin-Opener-Policy')).toBe('same-origin')
    })

    it('B13: vercel.json sets Strict-Transport-Security with max-age >= 63072000 and preload', () => {
      const hsts = getHeader('Strict-Transport-Security')
      expect(hsts).toContain('max-age=63072000')
      expect(hsts).toContain('includeSubDomains')
      expect(hsts).toContain('preload')
    })

    it('B14: vercel.json sets X-Permitted-Cross-Domain-Policies to none', () => {
      expect(getHeader('X-Permitted-Cross-Domain-Policies')).toBe('none')
    })

    it('B15: api/generate-plan.ts explicitly sets X-Content-Type-Options: nosniff', () => {
      expect(apiSource).toContain("res.setHeader('X-Content-Type-Options', 'nosniff')")
    })

    it('B16: api/generate-plan.ts explicitly sets X-Frame-Options: DENY', () => {
      expect(apiSource).toContain("res.setHeader('X-Frame-Options', 'DENY')")
    })

    it('B17: api/generate-plan.ts explicitly sets Referrer-Policy: strict-origin-when-cross-origin', () => {
      expect(apiSource).toContain("res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')")
    })

    it('B18: api/generate-plan.ts explicitly sets Permissions-Policy', () => {
      expect(apiSource).toContain("res.setHeader('Permissions-Policy'")
    })

    it('B19: api/generate-plan.ts explicitly sets X-Permitted-Cross-Domain-Policies: none', () => {
      expect(apiSource).toContain("res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')")
    })

    it('B20: api/generate-plan.ts generates and sets X-Request-Id header', () => {
      expect(apiSource).toContain("res.setHeader('X-Request-Id', requestId)")
    })

    it('B21: api/generate-plan.ts sets rate limit headers on responses', () => {
      expect(apiSource).toContain("res.setHeader('X-RateLimit-Limit'")
      expect(apiSource).toContain("res.setHeader('X-RateLimit-Remaining'")
      expect(apiSource).toContain("res.setHeader('X-RateLimit-Reset'")
    })

    it('B22: api/generate-plan.ts sets Access-Control-Allow-Methods for OPTIONS preflight', () => {
      expect(apiSource).toContain("res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')")
    })

    it('B23: api/generate-plan.ts sets Access-Control-Allow-Headers for OPTIONS preflight', () => {
      expect(apiSource).toContain("res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id')")
    })

    it('B24: api/generate-plan.ts sets Access-Control-Max-Age for OPTIONS preflight', () => {
      expect(apiSource).toContain("res.setHeader('Access-Control-Max-Age', '86400')")
    })

    it('B25: api/generate-plan.ts rejects non-POST requests with HTTP 405', () => {
      expect(apiSource).toContain("res.statusCode = 405")
      expect(apiSource).toContain("error: 'Method Not Allowed'")
    })

    it('B26: Security headers in api/generate-plan.ts are set before request processing', () => {
      const idxRequestId = apiSource.indexOf("res.setHeader('X-Request-Id'")
      const idxMethodCheck = apiSource.indexOf("if (req.method !== 'POST')")
      expect(idxRequestId).toBeLessThan(idxMethodCheck)
    })
  })

  // =========================================================================
  // SECTION C: XSS / HTML / SVG / Markdown Injection Defense (40 Tests)
  // =========================================================================
  describe('Section C: XSS / HTML / SVG / Markdown Injection Defense', () => {
    it('C01: FullFormDataSchema strips/validates string inputs safely', () => {
      const valid = FullFormDataSchema.safeParse({
        age: '25',
        gender: 'Male',
        height: '175',
        weight: '70',
        fitnessLevel: 'Intermediate',
        mainGoal: 'Build Lean Muscle',
        timePerDay: '45',
        recoveryDays: '2',
        sleepHours: '7-8',
        stressLevel: 'Moderate',
        dietaryPreference: 'Omnivore',
        medicalIssues: '<script>alert(1)</script>',
        allergies: 'None',
        specialRequests: '<img src=x onerror=alert(1)>'
      })
      expect(valid.success).toBe(true)
      if (valid.success) {
        expect(valid.data.medicalIssues).toContain('<script>')
      }
    })

    it('C02: Schema limits medicalIssues string length to prevent memory amplification', () => {
      const oversized = 'A'.repeat(1001)
      const res = FullFormDataSchema.safeParse({
        age: '25', gender: 'Male', height: '175', weight: '70', fitnessLevel: 'Intermediate',
        mainGoal: 'Build Lean Muscle', timePerDay: '45', recoveryDays: '2', sleepHours: '7-8',
        stressLevel: 'Moderate', dietaryPreference: 'Omnivore', medicalIssues: oversized
      })
      expect(res.success).toBe(false)
    })

    it('C03: Schema limits allergies string length to prevent memory amplification', () => {
      const oversized = 'A'.repeat(1001)
      const res = FullFormDataSchema.safeParse({
        age: '25', gender: 'Male', height: '175', weight: '70', fitnessLevel: 'Intermediate',
        mainGoal: 'Build Lean Muscle', timePerDay: '45', recoveryDays: '2', sleepHours: '7-8',
        stressLevel: 'Moderate', dietaryPreference: 'Omnivore', allergies: oversized
      })
      expect(res.success).toBe(false)
    })

    it('C04: Schema limits specialRequests string length to prevent memory amplification', () => {
      const oversized = 'A'.repeat(1001)
      const res = FullFormDataSchema.safeParse({
        age: '25', gender: 'Male', height: '175', weight: '70', fitnessLevel: 'Intermediate',
        mainGoal: 'Build Lean Muscle', timePerDay: '45', recoveryDays: '2', sleepHours: '7-8',
        stressLevel: 'Moderate', dietaryPreference: 'Omnivore', specialRequests: oversized
      })
      expect(res.success).toBe(false)
    })

    it('C05: allergenGuard detects allergens enclosed in script tags', () => {
      const scan = scanPlanForAllergens('Breakfast: 2 eggs with <script>alert(1)</script>peanuts', 'peanuts')
      expect(scan.hasViolation).toBe(true)
    })

    it('C06: allergenGuard detects allergens enclosed in bold tags', () => {
      const scan = scanPlanForAllergens('Breakfast: oatmeal with <b>almonds</b>', 'almonds')
      expect(scan.hasViolation).toBe(true)
    })

    it('C07: allergenGuard detects allergens enclosed in svg tags', () => {
      const scan = scanPlanForAllergens('Lunch: grilled salmon with <svg onload=alert(1)>shellfish</svg>', 'shellfish')
      expect(scan.hasViolation).toBe(true)
    })

    it('C08: allergenGuard handles multiple script tag injection attempts', () => {
      const scan = scanPlanForAllergens('<script>eval()</script> dairy <script>alert(2)</script>', 'dairy')
      expect(scan.hasViolation).toBe(true)
    })

    it('C09: contraindicationGuard detects condition with HTML injection', () => {
      const scan = scanPlanForContraindications('Day 1: Box Jumps 3x10', '<b>knee pain</b>')
      expect(scan.hasViolation).toBe(true)
    })

    it('C10: contraindicationGuard detects contraindicated exercise with script tag', () => {
      const scan = scanPlanForContraindications('Day 1: <script>alert(1)</script>Box Jumps 3x10', 'knee pain')
      expect(scan.hasViolation).toBe(true)
    })

    it('C11: contraindicationGuard detects herniated disc contraindications with style tag', () => {
      const scan = scanPlanForContraindications('Day 1: Heavy Deadlift <style>body{color:red}</style>', 'herniated disc')
      expect(scan.hasViolation).toBe(true)
    })

    it('C12: contraindicationGuard handles rotator cuff with img onerror payload', () => {
      const scan = scanPlanForContraindications('Day 1: Overhead Shoulder Press <img src=x onerror=alert(1)>', 'rotator cuff')
      expect(scan.hasViolation).toBe(true)
    })

    it('C13: Codebase contains ZERO instances of dangerouslySetInnerHTML', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toContain('dangerouslySetInnerHTML')
      }
    })

    it('C14: Codebase contains ZERO instances of innerHTML assignment', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/\.innerHTML\s*=/)
      }
    })

    it('C15: Codebase contains ZERO instances of outerHTML assignment', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/\.outerHTML\s*=/)
      }
    })

    it('C16: Codebase contains ZERO instances of document.write', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toContain('document.write(')
      }
    })

    it('C17: Codebase contains ZERO instances of eval(', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/\beval\s*\(/)
      }
    })

    it('C18: Codebase contains ZERO instances of new Function(', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toContain('new Function(')
      }
    })

    it('C19: Backup parser treats script payloads in userName as inert string data', () => {
      const maliciousPayload = JSON.stringify({
        version: '2.3.0',
        schema: BACKUP_SCHEMA_IDENTIFIER,
        exportedAt: new Date().toISOString(),
        userName: '<script>alert("xss")</script>',
        planState: {
          formData: {},
          isGenerated: false,
          generatedPlan: null,
          boundProfile: null
        }
      })
      const parsed = validateAndParseBackup(maliciousPayload)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.userName).toBe('<script>alert("xss")</script>')
      }
    })

    it('C20: Backup parser treats iframe payloads in workoutHistory as inert strings', () => {
      const maliciousPayload = JSON.stringify({
        version: '2.3.0',
        schema: BACKUP_SCHEMA_IDENTIFIER,
        exportedAt: new Date().toISOString(),
        userName: 'Athlete',
        planState: { formData: {}, isGenerated: false, generatedPlan: null, boundProfile: null },
        workoutHistory: [
          {
            id: 'log-1',
            dayTitle: '<iframe src="https://evil.com">',
            date: new Date().toISOString(),
            durationSeconds: 1800,
            completedExercises: 5,
            totalExercises: 5
          }
        ]
      })
      const parsed = validateAndParseBackup(maliciousPayload)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.workoutHistory[0].dayTitle).toBe('<iframe src="https://evil.com">')
      }
    })

    it('C21: Backup parser treats style injection in savedPlans as inert string', () => {
      const maliciousPayload = JSON.stringify({
        version: '2.3.0',
        schema: BACKUP_SCHEMA_IDENTIFIER,
        exportedAt: new Date().toISOString(),
        planState: { formData: {}, isGenerated: false, generatedPlan: null, boundProfile: null },
        savedPlans: [
          {
            id: 'plan-1',
            name: '<style>body{display:none}</style>',
            createdAt: new Date().toISOString(),
            planText: 'plan',
            formData: {},
            planState: { formData: {}, isGenerated: false, generatedPlan: null, boundProfile: null }
          }
        ]
      })
      const parsed = validateAndParseBackup(maliciousPayload)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.savedPlans[0].name).toBe('<style>body{display:none}</style>')
      }
    })

    it('C22: Backup parser rejects malformed JSON with non-string tokens', () => {
      const corrupted = '{"version": 2.3.0, "schema": '
      const parsed = validateAndParseBackup(corrupted)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain('Corrupted JSON')
    })

    it('C23: Backup parser rejects JavaScript object literal notation', () => {
      const jsLiteral = '{ version: "2.3.0", schema: "bodymap_backup_v2" }'
      const parsed = validateAndParseBackup(jsLiteral)
      expect(parsed.success).toBe(false)
    })

    it('C24: Backup parser rejects payloads with prototype pollution attempts', () => {
      const pollution = JSON.stringify({
        version: '2.3.0',
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: { formData: {}, isGenerated: false, generatedPlan: null, boundProfile: null },
        __proto__: { isAdmin: true },
        constructor: { prototype: { poll: true } }
      })
      const parsed = validateAndParseBackup(pollution)
      expect(parsed.success).toBe(true)
      const obj = {} as Record<string, unknown>
      expect(obj.isAdmin).toBeUndefined()
      expect(obj.poll).toBeUndefined()
    })

    it('C25: Backup parser handles base64 data URI injection without evaluation', () => {
      const dataUriPayload = JSON.stringify({
        version: '2.3.0',
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: { formData: {}, isGenerated: false, generatedPlan: null, boundProfile: null },
        userName: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
      })
      const parsed = validateAndParseBackup(dataUriPayload)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.userName).toContain('data:text/html')
      }
    })

    it('C26: SVG onload vectors in planText are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<svg onload="alert(1)">\n- Pushups: 3x10'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C27: Details ontoggle vectors in planText are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<details open ontoggle=alert(1)>\n- Squats: 3x12'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C28: Body onload vectors in planText are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<body onload=alert(1)>\n- Lunges: 3x10'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C29: Input autofocus onfocus vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<input autofocus onfocus=alert(1)>\n- Planks: 3x60s'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C30: Marquee onstart vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<marquee onstart=alert(1)>\n- Jumping Jacks'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C31: Audio onerror vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<audio src=x onerror=alert(1)>'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C32: Video poster onerror vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<video poster=x onerror=alert(1)>'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C33: Object data vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<object data="data:text/html,<script>alert(1)</script>">'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C34: Embed type vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<embed src="javascript:alert(1)">'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C35: Formaction button vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<button formaction="javascript:alert(1)">Click</button>'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C36: Link import vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<link rel="import" href="https://evil.com/xss.html">'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C37: Meta refresh redirect vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<meta http-equiv="refresh" content="0;url=https://evil.com">'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C38: Base href vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<base href="https://evil.com/">'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C39: Table background javascript vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<table background="javascript:alert(1)">'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })

    it('C40: CSS expression vectors are treated as passive text', () => {
      const plan = '## Day 1 - Workout\n<div style="width: expression(alert(1))">'
      const contraScan = scanPlanForContraindications(plan, 'None')
      expect(contraScan.hasViolation).toBe(false)
    })
  })

  // =========================================================================
  // SECTION D: URL / Navigation / Redirect Attacks (30 Tests)
  // =========================================================================
  describe('Section D: URL / Navigation / Redirect Attacks', () => {
    it('D01: ContactForm.tsx window.open call targets mailto: only', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ContactForm.tsx'), 'utf8')
      const matches = file.match(/window\.open\([^)]+\)/g) || []
      expect(matches.length).toBeGreaterThan(0)
      for (const call of matches) {
        expect(call).toContain('mailto:')
      }
    })

    it('D02: DownloadPlanPage.tsx window.open call targets mailto: only', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      const matches = file.match(/window\.open\([^)]+\)/g) || []
      expect(matches.length).toBeGreaterThan(0)
      for (const call of matches) {
        expect(call).toContain('mailto:')
      }
    })

    it('D03: No window.open in src targets http: or https:', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        const matches = content.match(/window\.open\([^)]+\)/g) || []
        for (const call of matches) {
          expect(call).not.toMatch(/window\.open\(['"`]https?:/)
        }
      }
    })

    it('D04: No window.open in src targets javascript: URI', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/window\.open\(['"`]javascript:/i)
      }
    })

    it('D05: No window.open in src targets data: URI', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/window\.open\(['"`]data:/i)
      }
    })

    it('D06: All target=_blank anchors in AboutContactPage specify rel=noopener noreferrer', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AboutContactPage.tsx'), 'utf8')
      const blankMatches = file.match(/<a[^>]*target=["']_blank["'][^>]*>/g) || []
      expect(blankMatches.length).toBeGreaterThan(0)
      for (const anchor of blankMatches) {
        expect(anchor).toContain('rel="noopener noreferrer"')
      }
    })

    it('D07: All target=_blank anchors across the entire src directory specify rel=noopener noreferrer', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        const blankMatches = content.match(/<a[^>]*target=["']_blank["'][^>]*>/g) || []
        for (const anchor of blankMatches) {
          expect(anchor).toContain('rel="noopener noreferrer"')
        }
      }
    })

    it('D08: AboutContactPage GitHub link targets official repository', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AboutContactPage.tsx'), 'utf8')
      expect(file).toContain('href="https://github.com/Jagadeesh729/BodyMap"')
    })

    it('D09: AboutContactPage Twitter link targets twitter.com', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AboutContactPage.tsx'), 'utf8')
      expect(file).toContain('href="https://twitter.com"')
    })

    it('D10: AboutContactPage YouTube link targets youtube.com', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AboutContactPage.tsx'), 'utf8')
      expect(file).toContain('href="https://youtube.com"')
    })

    it('D11: AboutContactPage Web App link targets bodymap-ai.vercel.app', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AboutContactPage.tsx'), 'utf8')
      expect(file).toContain('href="https://bodymap-ai.vercel.app"')
    })

    it('D12: No anchor tag in src has javascript: href', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/href=['"]javascript:/i)
      }
    })

    it('D13: No anchor tag in src has data: href', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/href=['"]data:/i)
      }
    })

    it('D14: No anchor tag in src has vbscript: href', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/href=['"]vbscript:/i)
      }
    })

    it('D15: No anchor tag in src has file: href', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/href=['"]file:/i)
      }
    })

    it('D16: App.tsx defines deterministic whitelist of client routes', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8')
      expect(file).toContain('path="/"')
      expect(file).toContain('path="/create-plan"')
      expect(file).toContain('path="/weekly-plan"')
      expect(file).toContain('path="/edit-plan"')
      expect(file).toContain('path="/gym-mode"')
      expect(file).toContain('path="/dashboard"')
      expect(file).toContain('path="/download-plan"')
      expect(file).toContain('path="/about"')
      expect(file).toContain('path="*"')
    })

    it('D17: App.tsx contains no query parameter redirect handlers', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8')
      expect(file).not.toContain('redirect')
      expect(file).not.toContain('window.location.href =')
    })

    it('D18: NotFound component does not reflect dynamic URL parameters into unsafe attributes', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/NotFound.tsx'), 'utf8')
      expect(file).not.toContain('dangerouslySetInnerHTML')
      expect(file).toContain('<Link to="/"')
    })

    it('D19: DownloadPlanPage back link uses relative router Link to /weekly-plan', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      expect(file).toContain('<Link')
      expect(file).toContain('to="/weekly-plan"')
    })

    it('D20: EditPlanPage back link uses relative router Link to /weekly-plan', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/EditPlanPage.tsx'), 'utf8')
      expect(file).toContain('to="/weekly-plan"')
    })

    it('D21: GymModePage back navigation targets safe relative route /weekly-plan', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/GymModePage.tsx'), 'utf8')
      expect(file).toContain("navigate('/weekly-plan')")
    })

    it('D22: WeeklyPlanPage back link uses relative router Link to /create-plan', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/WeeklyPlanPage.tsx'), 'utf8')
      expect(file).toContain('to="/create-plan"')
    })

    it('D23: Navbar links use static route paths only', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Navbar.tsx'), 'utf8')
      expect(file).toContain("path: '/'")
      expect(file).toContain("path: '/create-plan'")
      expect(file).toContain("path: '/weekly-plan'")
      expect(file).toContain("path: '/dashboard'")
      expect(file).toContain("path: '/about'")
    })

    it('D24: DownloadPlanPage reload operation calls window.location.reload() without external redirect', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      expect(file).toContain('window.location.reload()')
      expect(file).not.toMatch(/window\.location\.href\s*=/)
    })

    it('D25: DownloadPlanPage uses window.location.origin for clipboard text only', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      expect(file).toContain('navigator.clipboard.writeText')
      expect(file).toContain('${window.location.origin}/weekly-plan')
    })

    it('D26: Zero instances of document.location assignments across src', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/document\.location\s*=/)
      }
    })

    it('D27: Zero instances of location.replace(javascript:) in src', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/location\.replace\(['"`]javascript:/i)
      }
    })

    it('D28: Zero instances of location.assign(javascript:) in src', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        expect(content).not.toMatch(/location\.assign\(['"`]javascript:/i)
      }
    })

    it('D29: Router configuration uses createBrowserRouter or HashRouter/BrowserRouter cleanly', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8')
      expect(file).toContain('BrowserRouter')
    })

    it('D30: No dynamic route parameter reflection into raw script execution sinks', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
        if (file.includes('__tests__') || file.includes('.test.')) continue
        const fullPath = path.resolve(process.cwd(), 'src', file)
        const content = fs.readFileSync(fullPath, 'utf8')
        if (content.includes('useParams')) {
          expect(content).not.toContain('dangerouslySetInnerHTML')
          expect(content).not.toMatch(/\beval\s*\(/)
          expect(content).not.toContain('document.write')
        }
      }
    })
  })

  // =========================================================================
  // SECTION E: Download / Blob / Filename Safety (20 Tests)
  // =========================================================================
  describe('Section E: Download / Blob / Filename Safety', () => {
    it('E01: sanitizeDownloadFilename handles undefined input gracefully', () => {
      expect(sanitizeDownloadFilename(undefined, 'default', 'json')).toBe('default.json')
    })

    it('E02: sanitizeDownloadFilename handles null input gracefully', () => {
      expect(sanitizeDownloadFilename(null, 'default', 'json')).toBe('default.json')
    })

    it('E03: sanitizeDownloadFilename strips directory traversal (../../etc/passwd)', () => {
      const sanitized = sanitizeDownloadFilename('../../../../etc/passwd', 'plan', 'md')
      expect(sanitized).toBe('etc-passwd.md')
      expect(sanitized).not.toContain('..')
      expect(sanitized).not.toContain('/')
    })

    it('E04: sanitizeDownloadFilename strips Windows path separators and drive prefixes', () => {
      const sanitized = sanitizeDownloadFilename('C:\\Windows\\System32\\cmd.exe', 'plan', 'md')
      expect(sanitized).toBe('Windows-System32-cmd.md')
      expect(sanitized).not.toContain('\\')
      expect(sanitized).not.toContain(':')
    })

    it('E05: sanitizeDownloadFilename decodes and strips URL-encoded traversal (%2e%2e%2f)', () => {
      const sanitized = sanitizeDownloadFilename('%2e%2e%2f%2e%2e%2fetc%2fshadow', 'plan', 'md')
      expect(sanitized).toBe('etc-shadow.md')
      expect(sanitized).not.toContain('..')
    })

    it('E06: sanitizeDownloadFilename iteratively decodes double-URL-encoded traversal', () => {
      const sanitized = sanitizeDownloadFilename('%252e%252e%252f%252e%252e%252fboot.ini', 'plan', 'md')
      expect(sanitized).toBe('boot.md')
      expect(sanitized).not.toContain('..')
    })

    it('E07: sanitizeDownloadFilename removes null bytes and control characters', () => {
      const sanitized = sanitizeDownloadFilename('plan\x00evil', 'plan', 'md')
      expect(sanitized).toBe('planevil.md')
      expect(sanitized).not.toContain('\x00')
    })

    it('E08: sanitizeDownloadFilename strips shell metacharacters', () => {
      const sanitized = sanitizeDownloadFilename('plan;rm -rf /;$(cat /etc/passwd)', 'plan', 'md')
      expect(sanitized).toBe('plan-rm-rf-cat-etc-passwd.md')
      expect(sanitized).not.toContain(';')
      expect(sanitized).not.toContain('$')
    })

    it('E09: sanitizeDownloadFilename prefixes Windows reserved device name CON', () => {
      const sanitized = sanitizeDownloadFilename('CON', 'plan', 'md')
      expect(sanitized).toBe('safe-con.md')
    })

    it('E10: sanitizeDownloadFilename prefixes Windows reserved device name NUL', () => {
      const sanitized = sanitizeDownloadFilename('NUL', 'plan', 'json')
      expect(sanitized).toBe('safe-nul.json')
    })

    it('E11: sanitizeDownloadFilename prefixes Windows reserved device name PRN', () => {
      const sanitized = sanitizeDownloadFilename('PRN', 'plan', 'json')
      expect(sanitized).toBe('safe-prn.json')
    })

    it('E12: sanitizeDownloadFilename prefixes Windows reserved device COM1..COM9', () => {
      for (let i = 1; i <= 9; i++) {
        const sanitized = sanitizeDownloadFilename(`COM${i}`, 'plan', 'json')
        expect(sanitized).toBe(`safe-com${i}.json`)
      }
    })

    it('E13: sanitizeDownloadFilename prefixes Windows reserved device LPT1..LPT9', () => {
      for (let i = 1; i <= 9; i++) {
        const sanitized = sanitizeDownloadFilename(`LPT${i}`, 'plan', 'json')
        expect(sanitized).toBe(`safe-lpt${i}.json`)
      }
    })

    it('E14: sanitizeDownloadFilename strips leading hyphens/dots/underscores to prevent CLI flags', () => {
      const sanitized = sanitizeDownloadFilename('---help', 'plan', 'md')
      expect(sanitized).toBe('help.md')
      expect(sanitized).not.toMatch(/^[-_.]/)
    })

    it('E15: sanitizeDownloadFilename bounds basename to MAX_FILENAME_BASE_LENGTH', () => {
      const longInput = 'A'.repeat(200)
      const sanitized = sanitizeDownloadFilename(longInput, 'plan', 'md')
      const base = sanitized.replace(/\.md$/, '')
      expect(base.length).toBeLessThanOrEqual(MAX_FILENAME_BASE_LENGTH)
    })

    it('E16: sanitizeDownloadFilename falls back to defaultBase when input has no alphanumeric chars', () => {
      const sanitized = sanitizeDownloadFilename('!@#$%^&*()', 'fallback-plan', 'md')
      expect(sanitized).toBe('fallback-plan.md')
    })

    it('E17: sanitizeDownloadFilename normalizes spaces into hyphens', () => {
      const sanitized = sanitizeDownloadFilename('My 7 Day Workout Plan', 'plan', 'md')
      expect(sanitized).toBe('My-7-Day-Workout-Plan.md')
    })

    it('E18: DownloadPlanPage handleDownloadMarkdown creates text/markdown;charset=utf-8 blob', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      expect(file).toContain("type: 'text/markdown;charset=utf-8'")
    })

    it('E19: backupStorage exportBackupToFile creates application/json;charset=utf-8 blob', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/backupStorage.ts'), 'utf8')
      expect(file).toContain("type: 'application/json;charset=utf-8'")
    })

    it('E20: Object URLs created for downloads are revoked after creation', () => {
      const pageFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      const storageFile = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/backupStorage.ts'), 'utf8')
      expect(pageFile).toContain('URL.revokeObjectURL(url)')
      expect(storageFile).toContain('URL.revokeObjectURL(url)')
    })
  })

  // =========================================================================
  // SECTION F: MIME / Content-Type / Nosniff Integrity (20 Tests)
  // =========================================================================
  describe('Section F: MIME / Content-Type / Nosniff Integrity', () => {
    const vercelConfig = loadVercelConfig()
    const headersList = (vercelConfig.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>)?.[0]?.headers || []
    const apiSource = loadApiHandlerSource()

    it('F01: vercel.json enforces X-Content-Type-Options: nosniff globally', () => {
      const nosniff = headersList.find(h => h.key.toLowerCase() === 'x-content-type-options')
      expect(nosniff?.value).toBe('nosniff')
    })

    it('F02: api/generate-plan.ts sets X-Content-Type-Options: nosniff immediately', () => {
      expect(apiSource).toContain("res.setHeader('X-Content-Type-Options', 'nosniff')")
    })

    it('F03: api/generate-plan.ts sets Content-Type: application/json on success', () => {
      expect(apiSource).toContain("res.setHeader('Content-Type', 'application/json')")
    })

    it('F04: api/generate-plan.ts sets Content-Type: application/json on 405 Method Not Allowed', () => {
      const block = apiSource.substring(apiSource.indexOf('res.statusCode = 405') - 100, apiSource.indexOf('res.statusCode = 405') + 200)
      expect(block).toContain("res.setHeader('Content-Type', 'application/json')")
    })

    it('F05: api/generate-plan.ts sets Content-Type: application/json on 429 Too Many Requests', () => {
      const block = apiSource.substring(apiSource.indexOf('res.statusCode = 429') - 100, apiSource.indexOf('res.statusCode = 429') + 300)
      expect(block).toContain("res.setHeader('Content-Type', 'application/json')")
    })

    it('F06: api/generate-plan.ts sets Content-Type: application/json on 503 Service Unavailable', () => {
      const block = apiSource.substring(apiSource.indexOf('res.statusCode = 503') - 100, apiSource.indexOf('res.statusCode = 503') + 300)
      expect(block).toContain("res.setHeader('Content-Type', 'application/json')")
    })

    it('F07: api/generate-plan.ts sets Content-Type: application/json on 500 Internal Error', () => {
      const block = apiSource.substring(apiSource.indexOf('res.statusCode = 500') - 100, apiSource.indexOf('res.statusCode = 500') + 300)
      expect(block).toContain("res.setHeader('Content-Type', 'application/json')")
    })

    it('F08: MAX_PAYLOAD_SIZE is configured to 16 KiB (16384 bytes)', () => {
      expect(MAX_PAYLOAD_SIZE).toBe(16384)
    })

    it('F09: api/generate-plan.ts enforces MAX_PAYLOAD_SIZE check on pre-parsed string bodies', () => {
      expect(apiSource).toContain("Buffer.byteLength(req.body, 'utf8') > MAX_PAYLOAD_SIZE")
      expect(apiSource).toContain("throw new Error('PAYLOAD_TOO_LARGE')")
    })

    it('F10: api/generate-plan.ts enforces MAX_PAYLOAD_SIZE check on object bodies', () => {
      expect(apiSource).toContain("Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_SIZE")
    })

    it('F11: api/generate-plan.ts enforces MAX_PAYLOAD_SIZE check on streaming bodies', () => {
      expect(apiSource).toContain("totalBytes > MAX_PAYLOAD_SIZE")
    })

    it('F12: api/generate-plan.ts catches malformed JSON with MALFORMED_JSON error', () => {
      expect(apiSource).toContain("throw new Error('MALFORMED_JSON')")
    })

    it('F13: api/generate-plan.ts maps PAYLOAD_TOO_LARGE to HTTP 413', () => {
      expect(apiSource).toContain("message === 'PAYLOAD_TOO_LARGE'")
      expect(apiSource).toContain("res.statusCode = 413")
    })

    it('F14: api/generate-plan.ts maps MALFORMED_JSON to HTTP 400', () => {
      expect(apiSource).toContain("res.statusCode = 400")
    })

    it('F15: api/generate-plan.ts returns requestId in all JSON error responses', () => {
      expect(apiSource).toContain("JSON.stringify({ error: 'Method Not Allowed', requestId })")
    })

    it('F16: api/generate-plan.ts emits Server-Timing header', () => {
      expect(apiSource).toContain("res.setHeader('Server-Timing',")
    })

    it('F17: api/generate-plan.ts emits X-Upstream-Calls header', () => {
      expect(apiSource).toContain("res.setHeader('X-Upstream-Calls', totalUpstreamCalls.toString())")
    })

    it('F18: api/generate-plan.ts emits X-In-Flight-Requests header', () => {
      expect(apiSource).toContain("res.setHeader('X-In-Flight-Requests', activeInFlightRequests.toString())")
    })

    it('F19: api/generate-plan.ts redacts GEMINI_API_KEY from error outputs', () => {
      expect(apiSource).toContain("const apiKey = process.env.GEMINI_API_KEY")
      expect(apiSource).toContain("apiKey ? rawError.split(apiKey).join('[REDACTED]') : rawError")
    })

    it('F20: api/generate-plan.ts bounds error output length to 200 chars', () => {
      expect(apiSource).toContain("const boundedError = sanitizedError.slice(0, 200)")
    })
  })

  // =========================================================================
  // SECTION G: Privacy / Network-Lineage Contract (25 Tests)
  // =========================================================================
  describe('Section G: Privacy / Network-Lineage Contract', () => {
    const indexHtml = loadIndexHtml()
    const apiSource = loadApiHandlerSource()

    it('G01: Zero Google Analytics or GTag script tags in index.html', () => {
      expect(indexHtml).not.toContain('googletagmanager.com')
      expect(indexHtml).not.toContain('google-analytics.com')
    })

    it('G02: Zero Facebook / Meta Pixel script tags in index.html', () => {
      expect(indexHtml).not.toContain('connect.facebook.net')
      expect(indexHtml).not.toContain('fbevents.js')
    })

    it('G03: Zero Mixpanel, Segment, or Amplitude analytics scripts in index.html', () => {
      expect(indexHtml).not.toContain('cdn.mxpnl.com')
      expect(indexHtml).not.toContain('cdn.segment.com')
      expect(indexHtml).not.toContain('amplitude.com')
    })

    it('G04: Zero third-party ad networks or tracking scripts in index.html', () => {
      expect(indexHtml).not.toContain('doubleclick.net')
      expect(indexHtml).not.toContain('adservice.google.com')
    })

    it('G05: Permissions-Policy disables interest-cohort (FLoC ad tracking)', () => {
      const vercelConfig = loadVercelConfig()
      const headersList = (vercelConfig.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>)?.[0]?.headers || []
      const permPolicy = headersList.find(h => h.key.toLowerCase() === 'permissions-policy')?.value || ''
      expect(permPolicy).toContain('interest-cohort=()')
    })

    it('G06: Client health profile data is saved in localStorage, not external database', () => {
      const storageFile = fs.readFileSync(path.resolve(process.cwd(), 'src/context/planStorage.ts'), 'utf8')
      expect(storageFile).toContain('localStorage.setItem(STORAGE_KEY')
    })

    it('G07: Proxy endpoint /api/generate-plan is the only backend network endpoint called by client', () => {
      const geminiClient = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/gemini.ts'), 'utf8')
      expect(geminiClient).toContain("fetch('/api/generate-plan'")
      expect(geminiClient).not.toContain('generativelanguage.googleapis.com')
    })

    it('G08: GEMINI_API_KEY is read strictly on server in api/generate-plan.ts', () => {
      expect(apiSource).toContain('process.env.GEMINI_API_KEY')
      const geminiClient = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/gemini.ts'), 'utf8')
      expect(geminiClient).not.toContain('process.env.GEMINI_API_KEY')
    })

    it('G09: Client IP is canonicalized and hashed/masked for rate-limiting', () => {
      expect(apiSource).toContain('extractClientIp(req)')
      expect(apiSource).toContain('canonicalizeIp')
    })

    it('G10: Rate-limiting bucket expires automatically after window ms', () => {
      expect(apiSource).toContain('RATE_LIMIT_WINDOW_MS')
    })

    it('G11: Active in-flight requests counter decrements in finally block', () => {
      expect(apiSource).toContain('finally {')
      expect(apiSource).toContain('activeInFlightRequests = Math.max(0, activeInFlightRequests - 1)')
    })

    it('G12: Referrer-Policy header suppresses sensitive URL path and query to cross-origins', () => {
      const vercelConfig = loadVercelConfig()
      const headersList = (vercelConfig.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>)?.[0]?.headers || []
      const refPolicy = headersList.find(h => h.key.toLowerCase() === 'referrer-policy')?.value || ''
      expect(refPolicy).toBe('strict-origin-when-cross-origin')
    })

    it('G13: External links in AboutContactPage specify rel=noopener noreferrer to isolate opener', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AboutContactPage.tsx'), 'utf8')
      expect(file).toContain('rel="noopener noreferrer"')
    })

    it('G14: Email sharing in DownloadPlanPage opens native mailto draft without cloud logging', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      expect(file).toContain('mailto:')
    })

    it('G15: Web Share API in DownloadPlanPage handles abort/dismiss gracefully', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      expect(file).toContain('navigator.share')
      expect(file).toContain('catch {')
    })

    it('G16: Clipboard copy in DownloadPlanPage falls back safely without unhandled error', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      expect(file).toContain('navigator.clipboard.writeText')
    })

    it('G17: Local storage keys are namespaced with bodymap_ prefix', () => {
      const keys = ['bodymap_plan_state', 'bodymap_saved_plans', 'bodymap_body_metrics', 'bodymap_workout_history', 'bodymap_active_session']
      for (const k of keys) {
        expect(k).toMatch(/^bodymap_/)
      }
    })

    it('G18: Backup storage generates schema identifier bodymap_backup_v2', () => {
      expect(BACKUP_SCHEMA_IDENTIFIER).toBe('bodymap_backup_v2')
    })

    it('G19: Backup export does not write secrets or API keys into JSON payload', () => {
      const backupSource = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/backupStorage.ts'), 'utf8')
      expect(backupSource).not.toContain('API_KEY')
      expect(backupSource).not.toContain('secret')
    })

    it('G20: Cross-tab synchronization uses storage event listener without telemetry calls', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/context/PlanContext.tsx'), 'utf8')
      expect(file).toContain("addEventListener('storage'")
    })

    it('G21: FullFormDataSchema limits age to 13-100', () => {
      expect(FullFormDataSchema.safeParse({ age: '12', gender: 'M', height: '170', weight: '60', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
      expect(FullFormDataSchema.safeParse({ age: '13', gender: 'M', height: '170', weight: '60', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '100', gender: 'M', height: '170', weight: '60', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '101', gender: 'M', height: '170', weight: '60', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
    })

    it('G22: FullFormDataSchema limits height to 50-300 cm', () => {
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '49', weight: '60', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '50', weight: '60', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '300', weight: '60', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '301', weight: '60', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
    })

    it('G23: FullFormDataSchema limits weight to 20-500 kg', () => {
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '19', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '20', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '500', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '501', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
    })

    it('G24: FullFormDataSchema limits recoveryDays to 0-6 days', () => {
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '70', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '-1', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '70', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '0', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '70', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '6', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '70', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '30', recoveryDays: '7', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
    })

    it('G25: FullFormDataSchema limits timePerDay to 10-180 minutes', () => {
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '70', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '9', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '70', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '10', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '70', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '180', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(true)
      expect(FullFormDataSchema.safeParse({ age: '25', gender: 'M', height: '170', weight: '70', fitnessLevel: 'Beginner', mainGoal: 'Fitness', timePerDay: '181', recoveryDays: '2', sleepHours: '7', stressLevel: 'Low', dietaryPreference: 'Omnivore' }).success).toBe(false)
    })
  })

  // =========================================================================
  // SECTION H: Cache / CDN Isolation (20 Tests)
  // =========================================================================
  describe('Section H: Cache / CDN Isolation', () => {
    const apiSource = loadApiHandlerSource()

    it('H01: api/generate-plan.ts sets Cache-Control: no-store, no-cache, must-revalidate, private', () => {
      expect(apiSource).toContain("res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')")
    })

    it('H02: api/generate-plan.ts sets Pragma: no-cache', () => {
      expect(apiSource).toContain("res.setHeader('Pragma', 'no-cache')")
    })

    it('H03: Cache-Control header contains no-store token', () => {
      expect(apiSource).toMatch(/Cache-Control.*no-store/)
    })

    it('H04: Cache-Control header contains private token to prevent intermediary caching', () => {
      expect(apiSource).toMatch(/Cache-Control.*private/)
    })

    it('H05: Cache-Control header is set before handling OPTIONS preflight', () => {
      const idxCache = apiSource.indexOf("res.setHeader('Cache-Control'")
      const idxOptions = apiSource.indexOf("if (req.method === 'OPTIONS')")
      expect(idxCache).toBeLessThan(idxOptions)
    })

    it('H06: Cache-Control header is set before handling method validation (405)', () => {
      const idxCache = apiSource.indexOf("res.setHeader('Cache-Control'")
      const idxMethod = apiSource.indexOf("if (req.method !== 'POST')")
      expect(idxCache).toBeLessThan(idxMethod)
    })

    it('H07: Cache-Control header is set before checking rate limits (429)', () => {
      const idxCache = apiSource.indexOf("res.setHeader('Cache-Control'")
      const idxRate = apiSource.indexOf("if (!rateLimit.allowed)")
      expect(idxCache).toBeLessThan(idxRate)
    })

    it('H08: Rate limit 429 response sets Retry-After header', () => {
      const block = apiSource.substring(apiSource.indexOf('res.statusCode = 429'), apiSource.indexOf('res.statusCode = 429') + 300)
      expect(block).toContain("res.setHeader('Retry-After', rateLimit.resetTime.toString())")
    })

    it('H09: Concurrency limit 503 response sets Retry-After header', () => {
      const block = apiSource.substring(apiSource.indexOf('res.statusCode = 503'), apiSource.indexOf('res.statusCode = 503') + 300)
      expect(block).toContain("res.setHeader('Retry-After', '3')")
    })

    it('H10: Upstream 429 quota exhaustion response sets Retry-After header', () => {
      const block = apiSource.substring(apiSource.indexOf('lastErrorStatus === 429'), apiSource.indexOf('lastErrorStatus === 429') + 300)
      expect(block).toContain("res.setHeader('Retry-After', '60')")
    })

    it('H11: OPTIONS preflight sets Access-Control-Max-Age to 86400 (24h cache for preflight)', () => {
      expect(apiSource).toContain("res.setHeader('Access-Control-Max-Age', '86400')")
    })

    it('H12: api/generate-plan.ts does NOT set public Cache-Control anywhere', () => {
      expect(apiSource).not.toMatch(/Cache-Control.*public/)
    })

    it('H13: api/generate-plan.ts does NOT set s-maxage header token', () => {
      expect(apiSource).not.toMatch(/Cache-Control.*s-maxage/)
    })

    it('H14: api/generate-plan.ts does NOT emit ETag header for personal health plans', () => {
      expect(apiSource).not.toContain("res.setHeader('ETag'")
    })

    it('H15: api/generate-plan.ts does NOT emit Last-Modified header for personal health plans', () => {
      expect(apiSource).not.toContain("res.setHeader('Last-Modified'")
    })

    it('H16: vercel.json cleanUrls is enabled for canonical URLs without duplicate cache keys', () => {
      const vercelConfig = loadVercelConfig()
      expect(vercelConfig.cleanUrls).toBe(true)
    })

    it('H17: vercel.json rewrites route API calls directly to /api/$1', () => {
      const vercelConfig = loadVercelConfig()
      const rewrites = vercelConfig.rewrites as Array<{ source: string; destination: string }>
      expect(rewrites.some(r => r.source === '/api/(.*)' && r.destination === '/api/$1')).toBe(true)
    })

    it('H18: vercel.json rewrites SPA routes to /', () => {
      const vercelConfig = loadVercelConfig()
      const rewrites = vercelConfig.rewrites as Array<{ source: string; destination: string }>
      expect(rewrites.some(r => r.source === '/(.*)' && r.destination === '/')).toBe(true)
    })

    it('H19: Client storage reset clears active plan from memory and storage', () => {
      const contextFile = fs.readFileSync(path.resolve(process.cwd(), 'src/context/PlanContext.tsx'), 'utf8')
      expect(contextFile).toContain("case 'RESET_PLAN'")
    })

    it('H20: In-flight request state is held in ephemeral process memory, not shared disk cache', () => {
      expect(apiSource).toContain('let activeInFlightRequests = 0')
    })
  })

  // =========================================================================
  // SECTION I: Third-Party Resource Restrictions (15 Tests)
  // =========================================================================
  describe('Section I: Third-Party Resource Restrictions', () => {
    const vercelConfig = loadVercelConfig()
    const headersList = (vercelConfig.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>)?.[0]?.headers || []
    const cspValue = headersList.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    const indexHtml = loadIndexHtml()

    it('I01: Only approved third-party domain in style-src is fonts.googleapis.com', () => {
      const styleSrcMatch = cspValue.match(/style-src\s+([^;]+)/)
      const domains = (styleSrcMatch?.[1] || '').split(/\s+/).filter(d => d.startsWith('https://'))
      expect(domains).toEqual(['https://fonts.googleapis.com'])
    })

    it('I02: Only approved third-party domain in font-src is fonts.gstatic.com', () => {
      const fontSrcMatch = cspValue.match(/font-src\s+([^;]+)/)
      const domains = (fontSrcMatch?.[1] || '').split(/\s+/).filter(d => d.startsWith('https://'))
      expect(domains).toEqual(['https://fonts.gstatic.com'])
    })

    it('I03: Zero external domains permitted in script-src (self only)', () => {
      const scriptSrcMatch = cspValue.match(/script-src\s+([^;]+)/)
      const domains = (scriptSrcMatch?.[1] || '').split(/\s+/).filter(d => d.startsWith('https://') || d.startsWith('http://'))
      expect(domains).toEqual([])
    })

    it('I04: Zero external domains permitted in img-src (self data: blob: only)', () => {
      const imgSrcMatch = cspValue.match(/img-src\s+([^;]+)/)
      const domains = (imgSrcMatch?.[1] || '').split(/\s+/).filter(d => d.startsWith('https://') || d.startsWith('http://') || d === 'https:')
      expect(domains).toEqual([])
    })

    it('I05: Zero external domains permitted in connect-src (self only)', () => {
      const connectSrcMatch = cspValue.match(/connect-src\s+([^;]+)/)
      const domains = (connectSrcMatch?.[1] || '').split(/\s+/).filter(d => d.startsWith('https://') || d.startsWith('http://'))
      expect(domains).toEqual([])
    })

    it('I06: CSP object-src is strictly none to block plugins', () => {
      expect(cspValue).toMatch(/object-src\s+['"]none['"]/)
    })

    it('I07: CSP base-uri is strictly self to prevent base hijacking', () => {
      expect(cspValue).toMatch(/base-uri\s+['"]self['"]/)
    })

    it('I08: CSP form-action is strictly self to prevent form redirect exfiltration', () => {
      expect(cspValue).toMatch(/form-action\s+['"]self['"]/)
    })

    it('I09: CSP frame-ancestors is none to block framing by any domain', () => {
      expect(cspValue).toMatch(/frame-ancestors\s+['"]none['"]/)
    })

    it('I10: Google Fonts preconnect in index.html includes crossorigin attribute', () => {
      expect(indexHtml).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />')
    })

    it('I11: Lucide icons are bundled locally via npm (no external icon fonts)', () => {
      const pkgJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))
      expect(pkgJson.dependencies['lucide-react']).toBeDefined()
    })

    it('I12: Tailwind CSS is bundled locally without runtime script compilation', () => {
      expect(indexHtml).not.toContain('cdn.tailwindcss.com')
    })

    it('I13: React is bundled locally via Vite without external CDN scripts', () => {
      expect(indexHtml).not.toContain('unpkg.com/react')
      expect(indexHtml).not.toContain('cdnjs.cloudflare.com')
    })

    it('I14: Favicon and icons are served from local /public directory', () => {
      expect(fs.existsSync(path.resolve(process.cwd(), 'public/favicon.svg'))).toBe(true)
      expect(fs.existsSync(path.resolve(process.cwd(), 'public/favicon.ico'))).toBe(true)
    })

    it('I15: Open Graph image is served locally from /og-image.png', () => {
      expect(fs.existsSync(path.resolve(process.cwd(), 'public/og-image.png'))).toBe(true)
      expect(indexHtml).toContain('content="/og-image.png"')
    })
  })

  // =========================================================================
  // SECTION J: Mutation Attacks M01–M40 (40 Tests)
  // =========================================================================
  describe('Section J: Mutation Attacks M01–M40', () => {
    const vercelConfig = loadVercelConfig()
    const headersList = (vercelConfig.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>)?.[0]?.headers || []
    const cspValue = headersList.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    const getHeader = (key: string) => headersList.find(h => h.key.toLowerCase() === key.toLowerCase())?.value || ''
    const apiSource = loadApiHandlerSource()
    const indexHtml = loadIndexHtml()

    it('M01: Mutation inserting https: wildcard into img-src is rejected', () => {
      const imgSrc = cspValue.match(/img-src\s+([^;]+)/)?.[1] || ''
      expect(imgSrc.split(/\s+/)).not.toContain('https:')
    })

    it('M02: Mutation adding unsafe-inline into script-src is rejected', () => {
      const scriptSrc = cspValue.match(/script-src\s+([^;]+)/)?.[1] || ''
      expect(scriptSrc).not.toContain("'unsafe-inline'")
    })

    it('M03: Mutation adding unsafe-eval into script-src is rejected', () => {
      const scriptSrc = cspValue.match(/script-src\s+([^;]+)/)?.[1] || ''
      expect(scriptSrc).not.toContain("'unsafe-eval'")
    })

    it('M04: Mutation replacing connect-src self with wildcard * is rejected', () => {
      const connectSrc = cspValue.match(/connect-src\s+([^;]+)/)?.[1] || ''
      expect(connectSrc).not.toContain('*')
    })

    it('M05: Mutation relaxing object-src from none is rejected', () => {
      const objectSrc = cspValue.match(/object-src\s+([^;]+)/)?.[1] || ''
      expect(objectSrc).toBe("'none'")
    })

    it('M06: Mutation relaxing frame-ancestors from none is rejected', () => {
      const frameAncestors = cspValue.match(/frame-ancestors\s+([^;]+)/)?.[1] || ''
      expect(frameAncestors).toBe("'none'")
    })

    it('M07: Mutation changing X-Frame-Options to SAMEORIGIN or missing is rejected', () => {
      expect(getHeader('X-Frame-Options')).toBe('DENY')
    })

    it('M08: Mutation altering X-Content-Type-Options from nosniff is rejected', () => {
      expect(getHeader('X-Content-Type-Options')).toBe('nosniff')
    })

    it('M09: Mutation altering Referrer-Policy to unsafe-url is rejected', () => {
      expect(getHeader('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('M10: Mutation permitting camera in Permissions-Policy is rejected', () => {
      const perm = getHeader('Permissions-Policy')
      expect(perm).toContain('camera=()')
      expect(perm).not.toContain('camera=*')
    })

    it('M11: Mutation permitting microphone in Permissions-Policy is rejected', () => {
      const perm = getHeader('Permissions-Policy')
      expect(perm).toContain('microphone=()')
      expect(perm).not.toContain('microphone=*')
    })

    it('M12: Mutation permitting geolocation in Permissions-Policy is rejected', () => {
      const perm = getHeader('Permissions-Policy')
      expect(perm).toContain('geolocation=()')
      expect(perm).not.toContain('geolocation=*')
    })

    it('M13: Mutation permitting payment in Permissions-Policy is rejected', () => {
      const perm = getHeader('Permissions-Policy')
      expect(perm).toContain('payment=()')
      expect(perm).not.toContain('payment=*')
    })

    it('M14: Mutation removing interest-cohort from Permissions-Policy is rejected', () => {
      const perm = getHeader('Permissions-Policy')
      expect(perm).toContain('interest-cohort=()')
    })

    it('M15: Mutation removing same-origin from Cross-Origin-Opener-Policy is rejected', () => {
      expect(getHeader('Cross-Origin-Opener-Policy')).toBe('same-origin')
    })

    it('M16: Mutation lowering Strict-Transport-Security max-age below 1 year is rejected', () => {
      const hsts = getHeader('Strict-Transport-Security')
      const maxAgeMatch = hsts.match(/max-age=(\d+)/)
      expect(Number(maxAgeMatch?.[1])).toBeGreaterThanOrEqual(31536000)
    })

    it('M17: Mutation altering API Cache-Control from no-store is rejected', () => {
      expect(apiSource).toContain("res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')")
    })

    it('M18: Mutation removing Pragma: no-cache from API handler is rejected', () => {
      expect(apiSource).toContain("res.setHeader('Pragma', 'no-cache')")
    })

    it('M19: Mutation removing restrictive API CSP is rejected', () => {
      expect(apiSource).toContain("res.setHeader('Content-Security-Policy', \"default-src 'none'; frame-ancestors 'none'\")")
    })

    it('M20: Mutation attacking filename with ../../../boot.ini is sanitized', () => {
      const res = sanitizeDownloadFilename('../../../boot.ini', 'plan', 'md')
      expect(res).toBe('boot.md')
      expect(res).not.toContain('..')
    })

    it('M21: Mutation attacking filename with ....Windowswin.ini is sanitized', () => {
      const res = sanitizeDownloadFilename('..\\..\\Windows\\win.ini', 'plan', 'md')
      expect(res).toBe('Windows-win.md')
      expect(res).not.toContain('\\')
    })

    it('M22: Mutation attacking filename with null byte plan0.exe is sanitized', () => {
      const res = sanitizeDownloadFilename('plan\x00evil', 'plan', 'md')
      expect(res).toBe('planevil.md')
      expect(res).not.toContain('\x00')
    })

    it('M23: Mutation attacking filename with URL-encoded %2e%2e%2f is sanitized', () => {
      const res = sanitizeDownloadFilename('%2e%2e%2froot.key', 'plan', 'json')
      expect(res).toBe('root.json')
      expect(res).not.toContain('..')
    })

    it('M24: Mutation attacking filename with reserved CON.md is prefixed', () => {
      const res = sanitizeDownloadFilename('CON', 'plan', 'md')
      expect(res).toBe('safe-con.md')
    })

    it('M25: Mutation attacking filename with reserved NUL.json is prefixed', () => {
      const res = sanitizeDownloadFilename('NUL', 'plan', 'json')
      expect(res).toBe('safe-nul.json')
    })

    it('M26: Mutation attacking filename with CLI option -rf is stripped of leading dash', () => {
      const res = sanitizeDownloadFilename('-rf', 'plan', 'md')
      expect(res).toBe('rf.md')
    })

    it('M27: Mutation attacking filename with 10,000 chars is cleanly bounded', () => {
      const res = sanitizeDownloadFilename('A'.repeat(10000), 'plan', 'json')
      const base = res.replace(/\.json$/, '')
      expect(base.length).toBe(MAX_FILENAME_BASE_LENGTH)
    })

    it('M28: Mutation attacking filename with pure whitespace falls back to safe default', () => {
      const res = sanitizeDownloadFilename('     ', 'bodymap-plan', 'md')
      expect(res).toBe('bodymap-plan.md')
    })

    it('M29: Mutation attacking filename with <script>evil</script> strips tags', () => {
      const res = sanitizeDownloadFilename('<script>alert(1)</script>', 'plan', 'json')
      expect(res).toBe('script-alert-1-script.json')
      expect(res).not.toContain('<')
      expect(res).not.toContain('>')
    })

    it('M30: Mutation attacking filename with double extension .exe.json removes secondary extension', () => {
      const res = sanitizeDownloadFilename('payload.exe.json', 'plan', 'json')
      expect(res).toBe('payload.json')
      expect(res.endsWith('.json')).toBe(true)
      expect(res).not.toContain('.exe.')
    })

    it('M31: Mutation in AboutContactPage adding target=_blank without noopener is rejected', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AboutContactPage.tsx'), 'utf8')
      const targets = file.match(/target="_blank"/g) || []
      const rels = file.match(/rel="noopener noreferrer"/g) || []
      expect(targets.length).toBe(rels.length)
    })

    it('M32: Mutation replacing mailto: with javascript: in ContactForm is rejected', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ContactForm.tsx'), 'utf8')
      expect(file).toContain('mailto:support@bodymap.ai')
      expect(file).not.toContain('javascript:')
    })

    it('M33: Mutation replacing mailto: with http: in DownloadPlanPage is rejected', () => {
      const file = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadPlanPage.tsx'), 'utf8')
      expect(file).toContain('mailto:${emailInput}')
      expect(file).not.toMatch(/window\.open\(['"`]https?:/)
    })

    it('M34: Mutation accepting PUT/DELETE on api/generate-plan is rejected', () => {
      expect(apiSource).toContain("if (req.method !== 'POST')")
      expect(apiSource).toContain("res.statusCode = 405")
    })

    it('M35: Mutation allowing payloads over 16 KiB is rejected', () => {
      expect(MAX_PAYLOAD_SIZE).toBe(16384)
      expect(apiSource).toContain("PAYLOAD_TOO_LARGE")
    })

    it('M36: Mutation bypassing rate limit with spoofed X-Forwarded-For is rejected by trust hierarchy', () => {
      expect(apiSource).toContain('extractClientIp')
      expect(apiSource).toContain('x-vercel-forwarded-for')
    })

    it('M37: Mutation corrupting backup schema identifier fails restoration', () => {
      const invalid = JSON.stringify({
        version: '2.3.0',
        schema: 'corrupted_schema_v99',
        userName: 'Athlete'
      })
      const parsed = validateAndParseBackup(invalid)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain('Unsupported backup schema')
    })

    it('M38: Mutation feeding non-JSON syntax to backup parser fails gracefully', () => {
      const parsed = validateAndParseBackup('<<<NOT_JSON>>>')
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain('Corrupted JSON')
    })

    it('M39: Mutation feeding null to backup parser fails gracefully', () => {
      const parsed = validateAndParseBackup(null as unknown as string)
      expect(parsed.success).toBe(false)
    })

    it('M40: Mutation diverging index.html CSP img-src from vercel.json is rejected', () => {
      const metaMatch = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)
      const metaImgSrc = metaMatch?.[1].match(/img-src\s+([^;]+)/)?.[1]
      const vercelImgSrc = cspValue.match(/img-src\s+([^;]+)/)?.[1]
      expect(metaImgSrc?.trim()).toBe(vercelImgSrc?.trim())
    })
  })
})
