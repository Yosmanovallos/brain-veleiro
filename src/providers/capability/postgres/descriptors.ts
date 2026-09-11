import type { ToolDescriptor } from "../../../core/agent/types.js";
import { LIMITS, POSTGRES_INSPECT } from "./types.js";

const DESCRIPTOR: ToolDescriptor = {
  capability_id: POSTGRES_INSPECT,
  name: "Inspect PostgreSQL metadata",
  description: "Return bounded structural metadata from an explicitly configured PostgreSQL connection. Arbitrary SQL and application row data are not available.",
  side_effects: "EXTERNAL",
  input_schema: {
    type: "object", additionalProperties: false, required: ["operation"],
    properties: {
      operation: { type: "string", enum: ["server", "schemas", "tables", "columns", "indexes", "constraints"] },
      schema: { type: "string", minLength: 1, maxLength: LIMITS.identifierBytes },
      table: { type: "string", minLength: 1, maxLength: LIMITS.identifierBytes },
    },
  },
  output_schema: {
    type: "object", additionalProperties: false,
    required: ["connection_id", "operation", "items", "truncated", "observed_at"],
    properties: {
      connection_id: { type: "string" }, operation: { type: "string" },
      items: { type: "array", maxItems: LIMITS.rows }, truncated: { type: "boolean" }, observed_at: { type: "string" },
    },
  },
};

export function descriptorsFor(): ToolDescriptor[] { return [structuredClone(DESCRIPTOR) as ToolDescriptor]; }
