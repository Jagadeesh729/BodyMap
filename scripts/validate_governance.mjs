#!/usr/bin/env node

/**
 * BodyMap AI — Machine-Checkable Governance Validator
 *
 * Verifies the integrity, executability, least-privilege, and anti-circularity
 * of the BodyMap multi-agent governance infrastructure:
 * - AGENTS.md contract invariants
 * - ORCHESTRATION.md circularity boundaries
 * - skills/.../SKILL.md frontmatter, 7 sections, and executable command resolution
 * - .vibe/agents/*.toml schema, least privilege, and prompt resolution
 * - Forbidden destructive commands and secret leak patterns
 *
 * Exits 0 on total compliance; exits 1 with detailed failure breakdown.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { resolve, join, relative } from 'path'

const ROOT = process.cwd()

// Minimal zero-dependency TOML parser for .vibe agent specs
export function parseToml(content) {
  const result = {
    disabled_tools: [],
    tools: {}
  }
  let currentTable = null

  const lines = content.split(/\r?\n/)
  for (let line of lines) {
    line = line.trim()
    if (!line || line.startsWith('#')) continue

    // Table header: [tools.bash]
    const tableMatch = line.match(/^\[([A-Za-z0-9_.]+)\]$/)
    if (tableMatch) {
      currentTable = tableMatch[1]
      const parts = currentTable.split('.')
      let curr = result
      for (const p of parts) {
        if (!curr[p]) curr[p] = {}
        curr = curr[p]
      }
      continue
    }

    // Key-value pair
    const kvMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/)
    if (kvMatch) {
      const key = kvMatch[1]
      let valStr = kvMatch[2].trim()

      let value
      if (valStr.startsWith('"') && valStr.endsWith('"')) {
        value = valStr.slice(1, -1)
      } else if (valStr === 'true') {
        value = true
      } else if (valStr === 'false') {
        value = false
      } else if (valStr.startsWith('[') && valStr.endsWith(']')) {
        // String array
        const inner = valStr.slice(1, -1).trim()
        value = inner
          ? inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
          : []
      } else if (!isNaN(Number(valStr))) {
        value = Number(valStr)
      } else {
        value = valStr
      }

      if (currentTable) {
        const parts = currentTable.split('.')
        let curr = result
        for (const p of parts) {
          curr = curr[p]
        }
        curr[key] = value
      } else {
        result[key] = value
      }
    }
  }

  return result
}

// Parses YAML frontmatter from markdown files
export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) return null

  const yamlStr = match[1]
  const fields = {}
  for (const line of yamlStr.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const k = line.slice(0, colonIdx).trim()
      let v = line.slice(colonIdx + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      fields[k] = v
    }
  }
  return {
    frontmatter: fields,
    body: markdown.slice(match[0].length)
  }
}

export function validateAgentsContract() {
  const errors = []
  const agentsPath = resolve(ROOT, 'AGENTS.md')
  if (!existsSync(agentsPath)) {
    return { ok: false, errors: ['AGENTS.md does not exist'] }
  }

  const content = readFileSync(agentsPath, 'utf8')

  const requiredInvariants = [
    { title: 'Static Release Anchor', pattern: /12076d44528c82fdd10aeaa5db27bf0492a41159/ },
    { title: 'CORS 204 Preflight', pattern: /HTTP 204 No Content/i },
    { title: 'Absent ACAO on Disallowed Origins', pattern: /Access-Control-Allow-Origin.*strictly absent/i },
    { title: 'Non-Destructive Restoration', pattern: /Non-Destructive Restoration/i },
    { title: 'Prohibition of git checkout --', pattern: /git checkout --/ },
    { title: 'Clean Working Tree Definition', pattern: /git status --short.*completely empty/i },
    { title: 'No Disabling Browser Security', pattern: /--disable-web-security.*prohibited|never include/i },
    { title: 'Zero Real Gemini Calls', pattern: /X-Upstream-Calls.*0/i },
    { title: 'Standardized Evidence Labels', pattern: /`VERIFIED`[\s\S]*`NOT REPRODUCED`[\s\S]*`SCOPE-LIMITED`/ },
    { title: 'Orchestration Role Separation', pattern: /Architect \/ Planner[\s\S]*Implementer[\s\S]*Security Red-Team[\s\S]*Final Reviewer/ }
  ]

  for (const inv of requiredInvariants) {
    if (!inv.pattern.test(content)) {
      errors.push(`AGENTS.md is missing required invariant: ${inv.title}`)
    }
  }

  return { ok: errors.length === 0, errors }
}

export function validateOrchestrationContract() {
  const errors = []
  const orchPath = resolve(ROOT, 'ORCHESTRATION.md')
  if (!existsSync(orchPath)) {
    return { ok: false, errors: ['ORCHESTRATION.md does not exist'] }
  }

  const content = readFileSync(orchPath, 'utf8')

  const requiredSections = [
    { title: 'Anti-Circular Validation Principle', pattern: /Anti-Circular Validation/i },
    { title: '7 Conceptual Roles vs 6 Configured Subagents', pattern: /7 Conceptual Roles vs\.? 6 Configured Subagents/i },
    { title: '10-Step Orchestration Workflow', pattern: /10-Step Orchestration Workflow/i },
    { title: 'State Recovery & No-Drift Verification', pattern: /State Recovery & No-Drift Verification/i },
    { title: 'Final Reviewer Judicial Authority', pattern: /Final Reviewer/i }
  ]

  for (const s of requiredSections) {
    if (!s.pattern.test(content)) {
      errors.push(`ORCHESTRATION.md is missing section: ${s.title}`)
    }
  }

  return { ok: errors.length === 0, errors }
}

export const EXPECTED_SKILLS = [
  'api-boundary-audit',
  'artifact-integrity',
  'browser-security',
  'mutation-testing',
  'production-audit',
  'release-provenance',
  'storage-boundary-audit'
]

export const REQUIRED_SKILL_SECTIONS = [
  '## WHEN DO I RUN?',
  '## WHAT EXACTLY DO I CHECK?',
  '## WHAT COMMANDS DO I RUN?',
  '## WHAT COUNTS AS EVIDENCE?',
  '## WHAT INVALIDATES THE RESULT?',
  '## WHAT MUST I NEVER DO?',
  '## WHAT ARTIFACT DO I PRODUCE?'
]

export function validateSkills() {
  const errors = []
  const skillsDir = resolve(ROOT, 'skills')
  if (!existsSync(skillsDir)) {
    return { ok: false, errors: ['skills/ directory does not exist'] }
  }

  const actualSkills = readdirSync(skillsDir).filter(name => {
    return statSync(join(skillsDir, name)).isDirectory()
  })

  for (const expected of EXPECTED_SKILLS) {
    if (!actualSkills.includes(expected)) {
      errors.push(`Missing expected skill directory: skills/${expected}`)
    }
  }

  for (const skillName of actualSkills) {
    const skillPath = join(skillsDir, skillName, 'SKILL.md')
    if (!existsSync(skillPath)) {
      errors.push(`Skill ${skillName} is missing SKILL.md`)
      continue
    }

    const content = readFileSync(skillPath, 'utf8')
    const parsed = parseFrontmatter(content)
    if (!parsed) {
      errors.push(`Skill ${skillName} has missing or malformed YAML frontmatter`)
      continue
    }

    const { frontmatter, body } = parsed
    if (!frontmatter.name || frontmatter.name !== skillName) {
      errors.push(`Skill ${skillName} frontmatter 'name' (${frontmatter.name}) must match folder name (${skillName})`)
    }
    if (!frontmatter.description || frontmatter.description.trim().length < 15) {
      errors.push(`Skill ${skillName} has missing or trivial description`)
    }

    // Check 7 sections
    for (const sec of REQUIRED_SKILL_SECTIONS) {
      if (!body.includes(sec)) {
        errors.push(`Skill ${skillName} is missing mandatory section: ${sec}`)
      }
    }

    // Check for stale scratch references
    if (/scratch\/e42_browser_audit\.js/i.test(body)) {
      errors.push(`Skill ${skillName} references nonexistent scratch/e42_browser_audit.js`)
    }

    // Check executability of referenced files in WHAT COMMANDS DO I RUN?
    const commandsBlockMatch = body.match(/## WHAT COMMANDS DO I RUN\?([\s\S]*?)(?=##|$)/)
    if (commandsBlockMatch) {
      const block = commandsBlockMatch[1]
      // Match test files or scripts referenced
      const fileMatches = block.match(/(?:src\/__tests__\/[A-Za-z0-9_.-]+\.tsx?|scripts\/[A-Za-z0-9_.-]+\.(?:mjs|ts|js)|e2e\/[A-Za-z0-9_./-]+\.spec\.ts)/g) || []
      for (const relFile of fileMatches) {
        const targetPath = resolve(ROOT, relFile)
        if (!existsSync(targetPath)) {
          errors.push(`Skill ${skillName} command references non-existent file: ${relFile}`)
        }
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

export const EXPECTED_AGENTS = [
  'architecture-reviewer',
  'browser-auditor',
  'final-reviewer',
  'mutation-auditor',
  'release-auditor',
  'security-redteam'
]

export function validateMistralAgents() {
  const errors = []
  const agentsDir = resolve(ROOT, '.vibe/agents')
  const promptsDir = resolve(ROOT, '.vibe/prompts')

  if (!existsSync(agentsDir)) {
    return { ok: false, errors: ['.vibe/agents directory does not exist'] }
  }
  if (!existsSync(promptsDir)) {
    return { ok: false, errors: ['.vibe/prompts directory does not exist'] }
  }

  for (const agentName of EXPECTED_AGENTS) {
    const tomlPath = join(agentsDir, `${agentName}.toml`)
    if (!existsSync(tomlPath)) {
      errors.push(`Missing agent config: .vibe/agents/${agentName}.toml`)
      continue
    }

    let parsed
    try {
      const content = readFileSync(tomlPath, 'utf8')
      parsed = parseToml(content)
    } catch (e) {
      errors.push(`Failed to parse TOML in ${agentName}.toml: ${e.message}`)
      continue
    }

    if (parsed.agent_type !== 'subagent') {
      errors.push(`Agent ${agentName} agent_type must be 'subagent', got '${parsed.agent_type}'`)
    }

    if (parsed.safety !== 'strict') {
      errors.push(`Agent ${agentName} safety must be 'strict', got '${parsed.safety}'`)
    }

    if (parsed.auto_approve !== false) {
      errors.push(`Agent ${agentName} auto_approve must be false`)
    }

    // Verify system_prompt_id exists
    const promptId = parsed.system_prompt_id
    if (!promptId) {
      errors.push(`Agent ${agentName} missing system_prompt_id`)
    } else {
      const promptPath = join(promptsDir, `${promptId}.md`)
      if (!existsSync(promptPath)) {
        errors.push(`Agent ${agentName} references nonexistent prompt: ${promptId}.md`)
      }
    }

    // Least privilege verification
    const isReadOnly = ['architecture-reviewer', 'final-reviewer'].includes(agentName)
    const isAuditOnly = ['browser-auditor', 'release-auditor', 'security-redteam'].includes(agentName)

    if (isReadOnly) {
      if (parsed.tools?.bash?.permission !== 'deny') {
        errors.push(`Read-only agent ${agentName} must deny bash tool`)
      }
      if (parsed.tools?.write_file?.permission !== 'deny') {
        errors.push(`Read-only agent ${agentName} must deny write_file tool`)
      }
      if (parsed.tools?.edit_file?.permission !== 'deny') {
        errors.push(`Read-only agent ${agentName} must deny edit_file tool`)
      }
    }

    if (isAuditOnly) {
      if (parsed.tools?.write_file?.permission !== 'deny') {
        errors.push(`Audit agent ${agentName} must deny write_file tool`)
      }
      if (parsed.tools?.edit_file?.permission !== 'deny') {
        errors.push(`Audit agent ${agentName} must deny edit_file tool`)
      }
      if (parsed.tools?.bash?.permission !== 'ask') {
        errors.push(`Audit agent ${agentName} must set bash permission to 'ask'`)
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

export function validateForbiddenCommandsAndSecrets() {
  const errors = []
  const filesToScan = [
    resolve(ROOT, 'AGENTS.md'),
    resolve(ROOT, 'ORCHESTRATION.md')
  ]

  // Add all skills and prompts
  const skillsDir = resolve(ROOT, 'skills')
  if (existsSync(skillsDir)) {
    for (const s of readdirSync(skillsDir)) {
      const p = join(skillsDir, s, 'SKILL.md')
      if (existsSync(p)) filesToScan.push(p)
    }
  }

  const promptsDir = resolve(ROOT, '.vibe/prompts')
  if (existsSync(promptsDir)) {
    for (const p of readdirSync(promptsDir)) {
      filesToScan.push(join(promptsDir, p))
    }
  }

  const agentsDir = resolve(ROOT, '.vibe/agents')
  if (existsSync(agentsDir)) {
    for (const a of readdirSync(agentsDir)) {
      filesToScan.push(join(agentsDir, a))
    }
  }

  const forbiddenPatterns = [
    { name: 'Live Google API Key', regex: new RegExp('AIzaSy' + '[A-Za-z0-9_-]{33}') },
    { name: 'RSA Private Key', regex: new RegExp('-----' + 'BEGIN (?:RSA )?PRIVATE KEY-----') },
    { name: 'Hardcoded secret password', regex: /(?:password|secret)\s*[:=]\s*["'][A-Za-z0-9_!@#$%^&*]{8,}["']/i }
  ]

  for (const f of filesToScan) {
    if (!existsSync(f)) continue
    const text = readFileSync(f, 'utf8')
    const rel = relative(ROOT, f)

    for (const pat of forbiddenPatterns) {
      if (pat.regex.test(text)) {
        errors.push(`Security check failed in ${rel}: Matched forbidden pattern ${pat.name}`)
      }
    }

    // Check for destructive recovery commands outside of explicit prohibition context
    // In skills and scripts, commands must never use destructive git recovery
    if (f.endsWith('SKILL.md')) {
      const commandsSection = text.match(/## WHAT COMMANDS DO I RUN\?([\s\S]*?)(?=##|$)/)
      if (commandsSection && /git\s+checkout|git\s+reset|git\s+clean/i.test(commandsSection[1])) {
        errors.push(`Skill file ${rel} prescribes destructive git recovery command in executable commands`)
      }

      if (/git\s+checkout\s+--|git\s+reset\s+--hard|git\s+clean\s+-fd/i.test(text)) {
        // Allowed only in 'WHAT MUST I NEVER DO?' or 'WHAT INVALIDATES THE RESULT?'
        const allowedSections = text
          .replace(/## WHAT MUST I NEVER DO\?[\s\S]*?(?=##|$)/g, '')
          .replace(/## WHAT INVALIDATES THE RESULT\?[\s\S]*?(?=##|$)/g, '')
        if (/git\s+checkout\s+--|git\s+reset\s+--hard|git\s+clean\s+-fd/i.test(allowedSections)) {
          errors.push(`Skill file ${rel} suggests destructive git recovery command outside prohibitions/invalidations`)
        }
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

export function validateGovernanceSuite() {
  console.log('='.repeat(75))
  console.log('BodyMap AI — Governed Architecture & Quality System Validator')
  console.log('='.repeat(75))

  const suites = [
    { name: 'AGENTS.md Contract Invariants', fn: validateAgentsContract },
    { name: 'ORCHESTRATION.md Circularity Boundaries', fn: validateOrchestrationContract },
    { name: 'Skills Integrity & Executability', fn: validateSkills },
    { name: 'Mistral Vibe Agent Least-Privilege & Schemas', fn: validateMistralAgents },
    { name: 'Secret Leaks & Forbidden Command Forensics', fn: validateForbiddenCommandsAndSecrets }
  ]

  let allOk = true
  const allErrors = []

  for (const s of suites) {
    const res = s.fn()
    if (res.ok) {
      console.log(`\x1b[32m[PASS]\x1b[0m ${s.name}`)
    } else {
      console.log(`\x1b[31m[FAIL]\x1b[0m ${s.name}`)
      for (const err of res.errors) {
        console.log(`       - ${err}`)
        allErrors.push(`[${s.name}] ${err}`)
      }
      allOk = false
    }
  }

  console.log('-'.repeat(75))
  if (allOk) {
    console.log('\x1b[32mALL GOVERNANCE CHECKS PASSED DETERMINISTICALLY (5/5 suites)\x1b[0m')
    console.log('='.repeat(75))
    return { ok: true, errors: [] }
  } else {
    console.error(`\x1b[31mGOVERNANCE VALIDATION FAILED with ${allErrors.length} error(s)\x1b[0m`)
    console.log('='.repeat(75))
    return { ok: false, errors: allErrors }
  }
}

// CLI entry point
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = validateGovernanceSuite()
  process.exit(result.ok ? 0 : 1)
}
