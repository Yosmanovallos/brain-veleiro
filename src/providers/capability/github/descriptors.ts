/**
 * S14F — GitHub Capability: the exact five public descriptors (contract §3).
 *
 * These descriptors are STATIC and host-configuration-independent. No owner,
 * repository, origin, URL, REST route, HTTP method, header, API version,
 * credential reference or provider identity appears in a capability id, name,
 * description or schema, so the concrete implementation behind one
 * `repository.*` identity can be swapped without an AgentDefinition edit
 * (S14F-HI-003, S14F-HI-005, contract §19).
 *
 * Every input and output schema is CLOSED (`additionalProperties: false`).
 */

import type { ToolDescriptor } from "../../../core/agent/types.js";
import { GITHUB_CAPABILITY_IDS, LIMITS, type GitHubCapabilityId } from "./types.js";

const SHA_PATTERN = "^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$";

const EMPTY_INPUT = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

const REVIEW_OUTPUT = {
  type: "object",
  additionalProperties: false,
  required: [
    "repository_id",
    "review_number",
    "state",
    "draft",
    "title",
    "head_branch",
    "head_sha",
    "base_branch",
    "base_sha",
    "changed_files",
    "comments_count",
    "web_url",
    "observed_at",
  ],
  properties: {
    repository_id: { type: "string" },
    review_number: { type: "integer", minimum: 1, maximum: LIMITS.reviewNumberMax },
    state: { enum: ["OPEN", "CLOSED", "MERGED"] },
    draft: { type: "boolean" },
    title: { type: "string" },
    head_branch: { type: "string" },
    head_sha: { type: "string" },
    base_branch: { type: "string" },
    base_sha: { type: "string" },
    changed_files: { type: "integer", minimum: 0 },
    comments_count: { type: "integer", minimum: 0 },
    web_url: { type: "string" },
    observed_at: { type: "string" },
  },
} as const;

const DESCRIPTORS: readonly ToolDescriptor[] = [
  {
    capability_id: "repository.remote.inspect",
    name: "Inspect the bound remote repository",
    description:
      "Return one bounded, structured observation of the single explicitly bound remote repository: its default branch, private and archived flags and canonical web URL. Read-only, but classified EXTERNAL because it crosses the local trust boundary. No description, README, topics, owner profile, permission blob, clone URL or transport metadata is returned.",
    side_effects: "EXTERNAL",
    input_schema: EMPTY_INPUT,
    output_schema: {
      type: "object",
      additionalProperties: false,
      required: ["repository_id", "default_branch", "is_private", "archived", "web_url", "observed_at"],
      properties: {
        repository_id: { type: "string" },
        default_branch: { type: "string" },
        is_private: { type: "boolean" },
        archived: { type: "boolean" },
        web_url: { type: "string" },
        observed_at: { type: "string" },
      },
    },
  },
  {
    capability_id: "repository.review.inspect",
    name: "Inspect one review request",
    description:
      "Return one bounded, structured observation of a single review request on the bound repository, identified only by its number: state, draft flag, title, head and base branch and commit id, changed-file count and comment count. The review body, comments, review threads, diff/patch, author profile and labels are never returned. Read-only, EXTERNAL.",
    side_effects: "EXTERNAL",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["review_number"],
      properties: {
        review_number: { type: "integer", minimum: 1, maximum: LIMITS.reviewNumberMax },
      },
    },
    output_schema: REVIEW_OUTPUT,
  },
  {
    capability_id: "repository.review.open",
    name: "Open one review request",
    description:
      "Open exactly one review request on the bound repository between two of its own branches. The caller must supply the expected head and base commit ids; the operation is refused when either has moved or when a matching open review already exists, and it is never retried automatically. Same-repository only: fork sources are not selectable. EXTERNAL, mutating.",
    side_effects: "EXTERNAL",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["head_branch", "base_branch", "expected_head_sha", "expected_base_sha", "title"],
      properties: {
        head_branch: { type: "string", minLength: 1, maxLength: LIMITS.branchBytes },
        base_branch: { type: "string", minLength: 1, maxLength: LIMITS.branchBytes },
        expected_head_sha: { type: "string", pattern: SHA_PATTERN },
        expected_base_sha: { type: "string", pattern: SHA_PATTERN },
        title: { type: "string", minLength: 1, maxLength: LIMITS.titleBytes },
        body: { type: "string", minLength: 1, maxLength: LIMITS.bodyBytes },
        draft: { type: "boolean" },
      },
    },
    output_schema: REVIEW_OUTPUT,
  },
  {
    capability_id: "repository.review.comment",
    name: "Comment once on one review request",
    description:
      "Post exactly one top-level conversation comment on one open review request of the bound repository. The review must still be open and its head commit id must equal the caller's expected value, otherwise nothing is posted. Inline code comments, edits and deletions are not available, and no comment is ever retried automatically. EXTERNAL, mutating.",
    side_effects: "EXTERNAL",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["review_number", "expected_head_sha", "body"],
      properties: {
        review_number: { type: "integer", minimum: 1, maximum: LIMITS.reviewNumberMax },
        expected_head_sha: { type: "string", pattern: SHA_PATTERN },
        body: { type: "string", minLength: 1, maxLength: LIMITS.bodyBytes },
      },
    },
    output_schema: {
      type: "object",
      additionalProperties: false,
      required: ["repository_id", "review_number", "comment_id", "web_url", "created_at"],
      properties: {
        repository_id: { type: "string" },
        review_number: { type: "integer", minimum: 1, maximum: LIMITS.reviewNumberMax },
        comment_id: { type: "string" },
        web_url: { type: "string" },
        created_at: { type: "string" },
      },
    },
  },
  {
    capability_id: "repository.checks.inspect",
    name: "Inspect automated checks for one commit",
    description:
      "Return a bounded, deterministically ordered observation of the automated checks recorded for exactly one full commit id on the bound repository: at most 100 entries sorted by name then id, with the total count and a truncation flag. Branch and tag names are not accepted and no check is ever created, updated or re-requested. Read-only, EXTERNAL.",
    side_effects: "EXTERNAL",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["commit_sha"],
      properties: {
        commit_sha: { type: "string", pattern: SHA_PATTERN },
      },
    },
    output_schema: {
      type: "object",
      additionalProperties: false,
      required: ["repository_id", "commit_sha", "total_checks", "truncated", "checks", "observed_at"],
      properties: {
        repository_id: { type: "string" },
        commit_sha: { type: "string" },
        total_checks: { type: "integer", minimum: 0 },
        truncated: { type: "boolean" },
        checks: {
          type: "array",
          maxItems: LIMITS.checks,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "name", "status"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              status: { enum: ["QUEUED", "IN_PROGRESS", "COMPLETED"] },
              conclusion: {
                enum: [
                  "SUCCESS",
                  "FAILURE",
                  "NEUTRAL",
                  "CANCELLED",
                  "SKIPPED",
                  "TIMED_OUT",
                  "ACTION_REQUIRED",
                  "STALE",
                  "UNKNOWN",
                ],
              },
              web_url: { type: "string" },
              started_at: { type: "string" },
              completed_at: { type: "string" },
            },
          },
        },
        observed_at: { type: "string" },
      },
    },
  },
] as const;

/** Detached copies only: a caller mutating a descriptor cannot change ours. */
export function descriptorsFor(enabled: readonly GitHubCapabilityId[]): ToolDescriptor[] {
  return GITHUB_CAPABILITY_IDS.filter((id) => enabled.includes(id)).map(
    (id) => structuredClone(DESCRIPTORS.find((d) => d.capability_id === id)!) as ToolDescriptor,
  );
}
