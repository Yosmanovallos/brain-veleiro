/**
 * S14F — GitHub Capability: the FIXED operation table (contract §7).
 *
 * There is no arbitrary method/path interface. Each authorized family maps to
 * exactly one provider-owned method + route template, filled only from trusted
 * configuration (`owner`, `repository`) and already-validated semantic
 * identifiers (review number, full commit id, branch grammar). No model input
 * ever reaches a host, scheme, method, header key, query key or path template,
 * and no GraphQL, Enterprise or arbitrary REST route is representable
 * (S14F-HI-005, S14F-HI-011, S14F-HI-016).
 */

import type { GitHubOperationFamily } from "./types.js";
import type { RepositoryBinding } from "./normalize.js";

/** The only HTTP methods in the table; only two families are writes. */
export const OPERATION_METHOD: Readonly<Record<GitHubOperationFamily, "GET" | "POST">> = {
  REMOTE_INSPECT: "GET",
  REVIEW_INSPECT: "GET",
  REVIEW_HEAD_PREFLIGHT: "GET",
  REVIEW_BASE_PREFLIGHT: "GET",
  REVIEW_DUPLICATE_PREFLIGHT: "GET",
  REVIEW_OPEN: "POST",
  REVIEW_COMMENT_PREFLIGHT: "GET",
  REVIEW_COMMENT: "POST",
  CHECKS_INSPECT: "GET",
};

/** Expected success status per family; any other 2xx fails closed. */
export const OPERATION_SUCCESS_STATUS: Readonly<Record<GitHubOperationFamily, number>> = {
  REMOTE_INSPECT: 200,
  REVIEW_INSPECT: 200,
  REVIEW_HEAD_PREFLIGHT: 200,
  REVIEW_BASE_PREFLIGHT: 200,
  REVIEW_DUPLICATE_PREFLIGHT: 200,
  REVIEW_OPEN: 201,
  REVIEW_COMMENT_PREFLIGHT: 200,
  REVIEW_COMMENT: 201,
  CHECKS_INSPECT: 200,
};

export interface RouteParams {
  review_number?: number;
  commit_sha?: string;
  branch?: string;
  head_branch?: string;
  base_branch?: string;
}

/**
 * Build the one route for a family. Every interpolated value has already passed
 * the closed grammar for its type, so the result is composed exclusively of
 * URL-safe ASCII and cannot traverse out of the bound repository.
 */
export function buildRoute(
  family: GitHubOperationFamily,
  binding: RepositoryBinding,
  params: RouteParams = {},
): string {
  const repo = `/repos/${binding.owner}/${binding.repository}`;
  switch (family) {
    case "REMOTE_INSPECT":
      return repo;
    case "REVIEW_INSPECT":
    case "REVIEW_COMMENT_PREFLIGHT":
      return `${repo}/pulls/${params.review_number!}`;
    case "REVIEW_HEAD_PREFLIGHT":
    case "REVIEW_BASE_PREFLIGHT":
      return `${repo}/git/ref/heads/${params.branch!}`;
    case "REVIEW_DUPLICATE_PREFLIGHT":
      return `${repo}/pulls?state=open&head=${binding.owner}:${params.head_branch!}&base=${params.base_branch!}`;
    case "REVIEW_OPEN":
      return `${repo}/pulls`;
    case "REVIEW_COMMENT":
      return `${repo}/issues/${params.review_number!}/comments`;
    case "CHECKS_INSPECT":
      return `${repo}/commits/${params.commit_sha!}/check-runs`;
  }
}
