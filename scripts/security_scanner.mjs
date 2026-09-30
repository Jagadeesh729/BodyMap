/**
 * BodyMap AI — Unified Sensitive Content & Credential Scanner
 * ==========================================================
 * Canonical security scanner used across release_gate.mjs,
 * verify_artifact_integrity.mjs, and deployment_smoke_gate.mjs.
 */

export const SENSITIVE_PATTERNS = [
  { id: 'SEC_GOOGLE_API_KEY', name: 'Google/Gemini API Key', pattern: /AIzaSy[A-Za-z0-9_-]{20,}/ },
  { id: 'SEC_GEMINI_KEY_ASSIGN', name: 'Gemini API Key Assignment', pattern: /GEMINI_API_KEY\s*=\s*["'][A-Za-z0-9_-]{10,}["']/i },
  { id: 'SEC_BEARER_TOKEN', name: 'Bearer Token', pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/i },
  { id: 'SEC_JWT_TOKEN', name: 'JWT Credential Token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/ },
  { id: 'SEC_PRIVATE_KEY', name: 'Private Key Header', pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/ },
  { id: 'SEC_AWS_KEY', name: 'AWS Access Key ID', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'SEC_SOURCE_MAP', name: 'Source Map Directive', pattern: /sourceMappingURL\s*=/i },
  { id: 'SEC_LOCAL_ENDPOINT', name: 'Development Endpoint (Localhost/Loopback)', pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)(?:\/|["'\s]|$)/i },
];

const BINARY_EXTENSIONS = new Set([
  '.ico', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip'
]);

/**
 * Checks if a filename represents a known binary asset.
 */
export function isBinaryAsset(filePath) {
  const dotIdx = filePath.lastIndexOf('.');
  if (dotIdx === -1) return false;
  const ext = filePath.slice(dotIdx).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Scans a text string for sensitive patterns.
 * Returns { valid: boolean, findings: Array<{ id: string, name: string, match: string }> }
 */
export function scanTextContent(content, filePath = '') {
  const findings = [];
  for (const { id, name, pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({
        id,
        name,
        filePath,
        message: `Sensitive pattern [${name}] detected in ${filePath || 'content'}`,
      });
    }
  }
  return {
    valid: findings.length === 0,
    findings,
  };
}

/**
 * Scans a file buffer or string, respecting binary file boundaries.
 * Returns { valid: boolean, skippedBinary: boolean, findings: Array }
 */
export function scanFileContent(bufferOrString, filePath = '') {
  if (isBinaryAsset(filePath)) {
    return { valid: true, skippedBinary: true, findings: [] };
  }
  const text = typeof bufferOrString === 'string' ? bufferOrString : bufferOrString.toString('utf8');
  const res = scanTextContent(text, filePath);
  return {
    valid: res.valid,
    skippedBinary: false,
    findings: res.findings,
  };
}
