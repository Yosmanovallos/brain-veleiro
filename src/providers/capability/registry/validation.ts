import type { ToolDescriptor, ToolInvocationResult } from "../../../core/agent/index.js";

export const LIMITS = { providers: 64, capabilities: 256, perProvider: 128, id: 160, description: 2000, diagnostics: 128 } as const;

// Recognizable credential material is rejected, never echoed or silently edited.
// Arbitrary opaque strings cannot be classified as secrets; providers remain
// responsible for keeping credential values outside their public contracts.
export function sensitive(text: string): boolean {
  return /\b(?:authorization|proxy-authorization|cookie|set-cookie|password|api[_-]?key|secret|credential[_-]?ref|auth[_-]?ref|connection[_-]?ref)["']?\s*[:=]\s*\S|\bbearer\s+\S+|\bsk-[a-z0-9]{10,}|\bgh[pousr]_[a-z0-9]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(text);
}

export function safeId(value: unknown): value is string {
  return typeof value === "string" && value.length <= LIMITS.id && /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(value) && !sensitive(value);
}

export function capabilityId(value: unknown): value is string {
  return safeId(value) && !/^(github|gitlab|bitbucket|mcp|playwright|context7)\./i.test(value);
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// JSON contracts have finite traversal budgets and no accessors/prototypes.
// Sorting object keys permits equivalent schemas with different key order.
export function canonical(value: unknown): string {
  let nodes = 0;
  const visit = (v: unknown, depth: number): unknown => {
    if (++nodes > 10000 || depth > 32) throw new Error("INVALID_PUBLIC_CONTRACT");
    if (typeof v === "string") {
      if (sensitive(v)) throw new Error("INVALID_PUBLIC_CONTRACT");
      return v;
    }
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return v.map(x => visit(x, depth + 1));
    if (!record(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) throw new Error("INVALID_PUBLIC_CONTRACT");
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(v).sort()) {
      const property = Object.getOwnPropertyDescriptor(v, key)!;
      if (!("value" in property)) throw new Error("INVALID_PUBLIC_CONTRACT");
      // Optional Core fields may be explicitly undefined; JSON omits them.
      if (property.value === undefined) continue;
      out[key] = visit(property.value, depth + 1);
    }
    return out;
  };
  const text = JSON.stringify(visit(value, 0));
  if (text.length > 100000 || sensitive(text)) throw new Error("INVALID_PUBLIC_CONTRACT");
  return text;
}

export function validatedDescriptor(value: unknown): ToolDescriptor {
  const text = canonical(value);
  const d: unknown = JSON.parse(text);
  if (!record(d) || !capabilityId(d.capability_id) || typeof d.name !== "string" || !d.name.length || d.name.length > LIMITS.id ||
      typeof d.description !== "string" || d.description.length > LIMITS.description || !record(d.input_schema) ||
      (d.output_schema !== undefined && !record(d.output_schema)) ||
      !["NONE", "LOCAL", "EXTERNAL"].includes(d.side_effects as string) ||
      (d.timeout_ms !== undefined && (typeof d.timeout_ms !== "number" || !Number.isFinite(d.timeout_ms) || d.timeout_ms <= 0)) ||
      Object.keys(d).some(k => !["capability_id", "name", "description", "input_schema", "output_schema", "side_effects", "timeout_ms"].includes(k))) {
    throw new Error("INVALID_DESCRIPTOR");
  }
  return d as unknown as ToolDescriptor;
}

export function semanticSignature(d: ToolDescriptor): string {
  return canonical({ capability_id: d.capability_id, input_schema: d.input_schema,
    output_schema: d.output_schema ?? null, side_effects: d.side_effects, timeout_ms: d.timeout_ms ?? null });
}

export function validResult(value: unknown): value is ToolInvocationResult {
  if (!record(value) || typeof value.call_id !== "string" || typeof value.capability_id !== "string" ||
      typeof value.duration_ms !== "number" || !Number.isFinite(value.duration_ms) || value.duration_ms < 0) return false;
  if (value.evidence_refs !== undefined && (!Array.isArray(value.evidence_refs) || value.evidence_refs.length > LIMITS.diagnostics ||
      value.evidence_refs.some(ref => typeof ref !== "string" || ref.length > LIMITS.description))) return false;
  if (value.status === "SUCCESS") return record(value.output);
  if (value.status === "BLOCKED") return typeof value.reason === "string" && value.reason.length <= LIMITS.description;
  if (value.status !== "FAIL" || !record(value.error)) return false;
  return ["NOT_FOUND", "INVALID_INPUT", "TIMEOUT", "PERMISSION_DENIED", "UNAVAILABLE", "EXECUTION_FAILED", "INTERNAL_ERROR"].includes(value.error.code as string) &&
    typeof value.error.message === "string" && value.error.message.length <= LIMITS.description && typeof value.error.retryable === "boolean";
}
