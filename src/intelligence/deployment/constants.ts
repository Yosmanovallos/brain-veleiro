export const DEPLOYMENT_SKILL_ID = "intelligence.deployment.s13r";
export const DEPLOYMENT_INPUT_MARKER = "DEPLOYMENT_INPUT_JSON:";
export const DEPLOYMENT_QUALITY_CONTRACT_REF = "brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml";
export const LIMITS = { max_repository_facts: 256, max_environment_variables: 64, max_health_checks: 16, max_deployment_evidence: 256, max_evidence_refs_per_claim: 8, max_total_evidence_refs: 512, max_safe_ref_chars: 160, max_text_chars_per_field: 2000, max_rendered_projection_bytes: 262144 } as const;
export const canonical = (v: unknown): string => JSON.stringify(normalize(v));
function normalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, x]) => [k, normalize(x)]));
  return v;
}
export const safeRef = (x: unknown): x is string => typeof x === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]{0,159}$/.test(x) && !sensitiveMaterial(x);
export function sensitiveMaterial(value: unknown): boolean {
  const seen = new Set<object>();
  const walk = (v: unknown, depth: number): boolean => {
    if (depth > 20) return true;
    if (typeof v === "string") return /(?:\bBearer\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:^|\n)\s*[A-Z][A-Z0-9_]*=[^\n]+|(?:password|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*\S+|\b(?:sk-[A-Za-z0-9]{12,}|AKIA[A-Z0-9]{16})\b)/i.test(v);
    if (!v || typeof v !== "object") return false;
    if (seen.has(v)) return true;
    seen.add(v);
    const hit = Object.entries(v).some(([k, x]) => /^(?:value|password|secret|token|api_key|authorization|cookie|private_key|raw_env|raw_response|credentials)$/i.test(k) && k !== "value" || (k === "value" && typeof x !== "string") || walk(x, depth + 1));
    seen.delete(v);
    return hit;
  };
  return walk(value, 0);
}
