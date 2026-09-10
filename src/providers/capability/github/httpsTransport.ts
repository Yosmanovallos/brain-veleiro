/**
 * S14F — GitHub Capability: the built-in Node 24 HTTPS transport (contract §6).
 *
 * This is the ONLY module that opens a network connection, and it can only ever
 * reach the single fixed origin `https://api.github.com`. There is no base-URL
 * override, no proxy, no custom CA path, no DNS hook, no GraphQL endpoint, no
 * redirect following and no `gh` / `git` / `curl` / shell fallback. Only Node
 * built-ins are used: this phase adds no package dependency.
 */

import { request as httpsRequest } from "node:https";
import {
  GITHUB_ORIGIN,
  GitHubTransportError,
  type GitHubTransport,
  type GitHubTransportRequest,
  type GitHubTransportResponse,
} from "./types.js";

const HOSTNAME = "api.github.com";
const PORT = 443;

export class NodeHttpsGitHubTransport implements GitHubTransport {
  async send(request: GitHubTransportRequest): Promise<GitHubTransportResponse> {
    // Defence in depth: the origin is a compile-time literal, and is re-checked
    // here so no caller can retarget the one authorized host.
    if (request.origin !== GITHUB_ORIGIN) throw new GitHubTransportError("NETWORK");
    if (request.method !== "GET" && request.method !== "POST") throw new GitHubTransportError("NETWORK");

    const payload = request.body === undefined ? undefined : Buffer.from(request.body, "utf-8");
    const headers: Record<string, string | number> = { ...request.headers };
    if (payload !== undefined) headers["content-length"] = payload.byteLength;

    return await new Promise<GitHubTransportResponse>((resolve, rejectPromise) => {
      let settled = false;
      const clientRequest = httpsRequest({
        protocol: "https:",
        hostname: HOSTNAME,
        port: PORT,
        method: request.method,
        path: request.path,
        headers,
        // A dedicated socket per invocation: nothing this provider created
        // outlives the invocation in a shared pool.
        agent: false,
        setHost: true,
      });

      const cleanup = (): void => {
        request.signal.removeEventListener("abort", onAbort);
      };
      const fail = (kind: "TIMEOUT" | "NETWORK" | "OVERFLOW"): void => {
        if (settled) return;
        settled = true;
        cleanup();
        clientRequest.destroy();
        rejectPromise(new GitHubTransportError(kind));
      };
      const succeed = (response: GitHubTransportResponse): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(response);
      };
      function onAbort(): void {
        fail("TIMEOUT");
      }

      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) {
        fail("TIMEOUT");
        return;
      }

      clientRequest.on("error", () => fail("NETWORK"));

      clientRequest.on("response", (response) => {
        const chunks: Buffer[] = [];
        let consumed = 0;

        response.on("data", (chunk: Buffer) => {
          consumed += chunk.byteLength;
          if (consumed > request.max_response_bytes) {
            response.destroy();
            fail("OVERFLOW");
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", () => fail("NETWORK"));
        response.on("aborted", () => fail("NETWORK"));
        response.on("end", () => {
          const safeHeaders: Record<string, string> = Object.create(null) as Record<string, string>;
          for (const [key, value] of Object.entries(response.headers)) {
            if (value === undefined) continue;
            safeHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
          }
          succeed({
            // A 3xx is returned verbatim to the provider, which fails it closed:
            // this transport never follows a redirect.
            status: response.statusCode ?? 0,
            headers: safeHeaders,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      });

      if (payload !== undefined) clientRequest.write(payload);
      clientRequest.end();
    });
  }
}
