/**
 * S14G — Browser Inspect Capability: the exact public descriptor.
 *
 * The descriptor is STATIC and host-configuration-independent. No browser_id,
 * origin, engine, executable, channel, args, headless, proxy, timeout, or
 * provider identity appears in the capability id, name, description or schema,
 * so the concrete implementation behind `browser.inspect` can be swapped without
 * an AgentDefinition edit.
 */

import type { ToolDescriptor } from "../../../core/agent/types.js";
import { BROWSER_INSPECT, LIMITS } from "./types.js";

const BROWSER_INSPECT_DESCRIPTOR: ToolDescriptor = {
  capability_id: BROWSER_INSPECT,
  name: "Inspect a remote HTTPS page",
  description:
    "Return one bounded, structured, read-only observation of a single explicitly allowed public HTTPS page: its final URL, title, provider-owned ARIA snapshot and deterministic HTTPS link list. No interaction, JavaScript execution, authentication, download, popup, screenshot, cookie, storage or non-HTTPS origin is permitted.",
  side_effects: "EXTERNAL",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["url"],
    properties: {
      url: { type: "string", minLength: 1, maxLength: LIMITS.urlBytes },
      wait_until: { type: "string", enum: ["domcontentloaded", "load"] },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "browser_id",
      "final_url",
      "title",
      "aria_snapshot",
      "links",
      "links_truncated",
      "observed_at",
    ],
    properties: {
      browser_id: { type: "string" },
      final_url: { type: "string" },
      title: { type: "string" },
      aria_snapshot: {},
      links: {
        type: "array",
        maxItems: LIMITS.maxLinksMax,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "url"],
          properties: {
            text: { type: "string" },
            url: { type: "string" },
          },
        },
      },
      links_truncated: { type: "boolean" },
      observed_at: { type: "string" },
    },
  },
} as const;

/** Detached copies only: a caller mutating a descriptor cannot change ours. */
export function descriptorsFor(): ToolDescriptor[] {
  return [structuredClone(BROWSER_INSPECT_DESCRIPTOR) as ToolDescriptor];
}
