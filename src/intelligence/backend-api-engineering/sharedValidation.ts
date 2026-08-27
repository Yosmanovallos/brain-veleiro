import {
  BACKEND_API_FORBIDDEN_KEY_PATTERN,
  BACKEND_API_FORBIDDEN_VALUE_PATTERN,
} from "./constants.js";

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function findForbiddenBindings(value: unknown, path = "$"): string[] {
  const findings: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...findForbiddenBindings(item, `${path}[${index}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = `${path}.${key}`;
      if (BACKEND_API_FORBIDDEN_KEY_PATTERN.test(key)) findings.push(childPath);
      findings.push(...findForbiddenBindings(child, childPath));
    }
  } else if (typeof value === "string" && BACKEND_API_FORBIDDEN_VALUE_PATTERN.test(value)) {
    findings.push(path);
  }
  return [...new Set(findings)];
}

export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const aa = [...a].sort();
  const bb = [...b].sort();
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

export function pushError(errors: string[], id: string, message: string): void {
  errors.push(`${id}: ${message}`);
}

export function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
