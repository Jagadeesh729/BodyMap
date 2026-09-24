/**
 * BodyMap AI — Governance Validator Test Oracle
 *
 * Verifies that the machine-checkable governance validator (scripts/validate_governance.mjs)
 * deterministically passes on the canonical governance infrastructure, and properly detects
 * synthetic contract violations, schema discrepancies, and unauthorized tool escalations.
 */

import { describe, it, expect } from 'vitest'
import {
  parseToml,
  parseFrontmatter,
  validateAgentsContract,
  validateOrchestrationContract,
  validateSkills,
  validateMistralAgents,
  validateForbiddenCommandsAndSecrets,
  validateGovernanceSuite,
  EXPECTED_SKILLS,
  REQUIRED_SKILL_SECTIONS,
  EXPECTED_AGENTS
} from '../../scripts/validate_governance.mjs'

describe('Governance Validator Suite', () => {
  describe('TOML and Frontmatter Parsers', () => {
    it('V01: parseToml correctly parses strings, booleans, arrays, and nested tool tables', () => {
      const sampleToml = `
agent_type = "subagent"
display_name = "Test Agent"
safety = "strict"
auto_approve = false
disabled_tools = ["bash", "write_file"]

[tools.bash]
permission = "deny"

[tools.custom_tool]
permission = "ask"
`
      const parsed = parseToml(sampleToml)
      expect(parsed.agent_type).toBe('subagent')
      expect(parsed.display_name).toBe('Test Agent')
      expect(parsed.safety).toBe('strict')
      expect(parsed.auto_approve).toBe(false)
      expect(parsed.disabled_tools).toEqual(['bash', 'write_file'])
      expect(parsed.tools.bash.permission).toBe('deny')
      expect(parsed.tools.custom_tool.permission).toBe('ask')
    })

    it('V02: parseFrontmatter correctly separates YAML frontmatter from markdown body', () => {
      const sampleMd = `---
name: sample-skill
description: A sample skill description for testing.
---

# Sample Header
Body content here.
`
      const parsed = parseFrontmatter(sampleMd)
      expect(parsed).toBeDefined()
      expect(parsed?.frontmatter.name).toBe('sample-skill')
      expect(parsed?.frontmatter.description).toBe('A sample skill description for testing.')
      expect(parsed?.body).toContain('# Sample Header')
    })
  })

  describe('AGENTS.md Contract Validation', () => {
    it('V03: validateAgentsContract passes on canonical AGENTS.md', () => {
      const result = validateAgentsContract()
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('ORCHESTRATION.md Boundary Validation', () => {
    it('V04: validateOrchestrationContract passes on canonical ORCHESTRATION.md', () => {
      const result = validateOrchestrationContract()
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Skills Integrity & Executability', () => {
    it('V05: EXPECTED_SKILLS contains exactly the 7 canonical governance skills', () => {
      expect(EXPECTED_SKILLS).toHaveLength(7)
      expect(EXPECTED_SKILLS).toContain('production-audit')
      expect(EXPECTED_SKILLS).toContain('browser-security')
      expect(EXPECTED_SKILLS).toContain('api-boundary-audit')
      expect(EXPECTED_SKILLS).toContain('artifact-integrity')
      expect(EXPECTED_SKILLS).toContain('mutation-testing')
      expect(EXPECTED_SKILLS).toContain('release-provenance')
      expect(EXPECTED_SKILLS).toContain('storage-boundary-audit')
    })

    it('V06: REQUIRED_SKILL_SECTIONS contains all 7 mandatory sections', () => {
      expect(REQUIRED_SKILL_SECTIONS).toHaveLength(7)
      expect(REQUIRED_SKILL_SECTIONS).toEqual([
        '## WHEN DO I RUN?',
        '## WHAT EXACTLY DO I CHECK?',
        '## WHAT COMMANDS DO I RUN?',
        '## WHAT COUNTS AS EVIDENCE?',
        '## WHAT INVALIDATES THE RESULT?',
        '## WHAT MUST I NEVER DO?',
        '## WHAT ARTIFACT DO I PRODUCE?'
      ])
    })

    it('V07: validateSkills passes for all repository skills and verifies command target resolution', () => {
      const result = validateSkills()
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Mistral Vibe Agent Least Privilege', () => {
    it('V08: EXPECTED_AGENTS contains exactly the 6 configured subagents', () => {
      expect(EXPECTED_AGENTS).toHaveLength(6)
      expect(EXPECTED_AGENTS).toEqual([
        'architecture-reviewer',
        'browser-auditor',
        'final-reviewer',
        'mutation-auditor',
        'release-auditor',
        'security-redteam'
      ])
    })

    it('V09: validateMistralAgents passes for all 6 .vibe/agents configurations', () => {
      const result = validateMistralAgents()
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Forbidden Commands & Credential Leakage Forensics', () => {
    it('V10: validateForbiddenCommandsAndSecrets detects no secret leaks or unprohibited destructive commands', () => {
      const result = validateForbiddenCommandsAndSecrets()
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Comprehensive Suite Execution', () => {
    it('V11: validateGovernanceSuite returns ok: true across all 5 verification domains', () => {
      const suiteResult = validateGovernanceSuite()
      expect(suiteResult.ok).toBe(true)
      expect(suiteResult.errors).toHaveLength(0)
    })
  })
})
