# S14E — Documentation/Search Semantic Contract

Version: 1.0.0. Status: AUTHORING_READY. Parent: S14. Classification: RUNTIME_INFRASTRUCTURE. Depth: DEEP.
Semantic-authoring baseline: `a16040a59fd8513b01e711654a09b0ac09ebcfc5`.
Source: supplied `S14E_AUTHORING_CONTEXT.md`, especially sections 2–6 and 8–11. Repository facts below are packet-reported, not independently fetched by this author.

## 1. Authority and decisions

This is complete proposed Part A semantics for integration and review, not authorization for Part B. Preserve S14 global contracts and existing Core. Part B needs a separate recorded authorization after byte-identical Part A integration and factual compatibility checks. No new GitHub authoring/acceptance comment ID is claimed here.

Confirmed by packet: S14D integrated at baseline; acceptance 5609528853 replies to verifier 5595385959; generic CapabilityProvider/registry/Restricted interfaces exist; documentation.search is absent; research.lookup is an existing separate S11 capability.

Authored decisions, not claims about existing functionality:

- v1 exposes exactly `documentation.search`, a real deterministic search over explicitly supplied documentation snapshots in memory.
- No runtime filesystem ingestion, web search, HTTP, Context7, MCP, embeddings, database, persistence or dependency addition. A caller prepares reviewed documentation records before construction; Part B must demonstrate search on varied actual text, not fixture-ID answers.
- This is useful offline documentation retrieval, not a claim of live/fresh/global documentation coverage. Future external providers need their own authorization and truthful side effects; v1 `NONE` cannot be reused to disguise network access.
- Provider-local immutable snapshot, bounded literal search, explicit provenance, configuration-only provider replacement. No delegation or autonomous planner.

Reason: the packet supplies working local provider and runtime interfaces, but no approved external transport/authentication contract. v1 establishes and verifies the neutral search boundary without pulling S14I forward. No external product facts or new dependencies are needed for this design.

## 2. Existing runtime compatibility

Implement existing `CapabilityProvider.list_capabilities(request?)` and `invoke(ToolInvocationRequest)` returning existing ToolInvocationResult. Keep existing status/error unions. Do not add a cancellation field, provider selector or auth field to Core or AgentDefinition.

Provider placement: `src/providers/capability/documentation/`. Proposed public class: `InMemoryDocumentationCapabilityProvider`; constructor/config syntax may follow local conventions without changing semantics. No imports from S11 intelligence are required: reuse its architectural pattern, not its tag-matching algorithm or source-authority assertions. Preserve `research.lookup` and its users byte-for-byte.

Descriptor: capability_id `documentation.search`; name `Documentation Search`; description `Searches an explicitly supplied offline documentation snapshot and returns literal excerpts with provenance.`; side_effects `NONE`; timeout_ms `5000`. Input/output schemas must faithfully encode sections 4–6, including required keys, bounds and additionalProperties false on closed objects. Runtime validates independently of schemas. Return defensive descriptor copies; caller mutation cannot change future behavior.

Registry → selected provider remains explicit, wrapped by RestrictedCapabilityProvider in the existing runtime. Capability or NONE denial prevents provider invocation. No registry special case. Swap in separate registry configurations, preserving AgentDefinition, permissions and request semantic input; do not require co-registration of divergent descriptors or relax registry collisions.

## 3. Trusted snapshot configuration

Configuration is a plain JSON object, exactly `{ corpus_id, snapshot_id, documents }`. IDs throughout match `^[a-z][a-z0-9-]{0,63}$`. No discovery from cwd, environment, account, installed CLI or fixture identity. No model override of config.

Each document is exactly `{ document_id, revision, title, text }`; revision uses the same opaque-ID grammar. document_id is unique within the snapshot. Revision is supplied provenance, not verified freshness. Documents array may be empty. Unknown keys, nulls, wrong types, nonfinite numbers, lone surrogates, forbidden controls and invalid IDs fail construction with a fixed safe configuration error, without exposing the bad value. Supported inputs are ordinary inert JSON data; arbitrary JS getters/proxies are outside the public trust model.

Bounds (UTF-8 bytes unless explicitly stated): at most 256 documents; title 1..256 bytes and not whitespace-only; text 1..65536 bytes; total normalized title+text bytes across corpus <=4194304. Normalize CRLF and bare CR to LF before validating text byte/line bounds and calculating content hashes. Reject C0 controls except TAB/LF in text; title allows no C0 controls. Reject DEL in either. Each LF-delimited text line <=1024 bytes. Empty lines and a final empty line are allowed; splitting on LF defines 1-based line numbers. No trimming or Unicode normalization of stored text/title.

Copy validated records into a private immutable snapshot; never retain mutable caller arrays/objects as execution data. Record insertion order cannot affect results. Compute lowercase SHA-256 of each complete normalized UTF-8 text using existing runtime crypto, with no new package. No disk index or write. Configuration construction is bounded by the corpus limits; invocation deadlines do not cover prior construction.

Only caller-approved shareable documentation belongs here. v1 does not ingest arbitrary host files or promise general DLP. As a finite additional floor, reject title/text containing either literal `-----BEGIN PRIVATE KEY-----`, `-----BEGIN RSA PRIVATE KEY-----`, `-----BEGIN OPENSSH PRIVATE KEY-----`, or a case-insensitive match for `\bBearer[ \t]+[A-Za-z0-9._~+/-]{16,}={0,2}`. Fail the entire configuration with a fixed message; do not redact excerpts or silently drop a document. This detection is deliberately incomplete and must not be called complete secret protection.

## 4. Model input

Exactly `{ query: string, limit?: integer }`. Query UTF-8 length 1..256 before normalization; no lone surrogates, C0 controls other than TAB/LF/CR, or DEL. Split query on ASCII space/TAB/LF/CR, discard empty pieces, ASCII-fold A–Z to a–z and deduplicate tokens. Require 1..16 unique tokens; each token 1..64 UTF-8 bytes. Reject otherwise. Default limit 5; inclusive valid range 1..10, no coercion. Extra properties including URL, path, provider, corpus, executable, headers, auth and filter fail INVALID_INPUT.

Tokens are literal strings, never regex/SQL/shell/URL syntax. Punctuation is literal. ASCII folding only: non-ASCII letters retain exact code points. Do not claim stemming, accent insensitivity or semantic search.

Envelope requires nonempty run_id/call_id strings of at most 128 ASCII characters from `[A-Za-z0-9._:-]`, safe integer turn >=0, finite integer timeout_ms 1..60000. Type-level envelopes are assumed; invalid envelope fields produce INVALID_INPUT with fixed messages and no work. Preserve supplied call_id/capability_id in normalized typed results; do not include query/config/content in diagnostics. Unknown capability returns NOT_FOUND. Precedence: unknown capability, envelope, input validation, search deadline, success. Validation itself is within the invocation deadline; if the deadline expires before returning a validation result, return TIMEOUT instead.

## 5. Search algorithm

For each document, ASCII-fold title and each line. A line matches if every unique token occurs as a literal substring in the title OR that single line. Tokens may split between title and line, but not across multiple text lines. Choose the first matching line in that document. At most one result per document.

Collect all matching documents, sort by document_id using ASCII lexical comparison (not localeCompare or registration order), return the first limit results. No inferred relevance score. `total_matches` is the count of matching documents before limiting; `truncated` is exactly total_matches > results.length. Complete the bounded scan before success; no partial success on timeout.

Return the entire selected normalized line as excerpt, possibly empty when all tokens match title. This keeps excerpts literal, bounded and exactly traceable. `line_start == line_end` equals the selected 1-based line. Reordering corpus inputs or repeating requests cannot alter output/evidence, except duration_ms outside the output.

Worked oracle example: document `alpha`, revision `v1`, title `Registry guide`, text `Explicit routing\nPermission denial` (the displayed `\n` denotes one actual LF). Query `registry permission` returns alpha line 2 with excerpt `Permission denial`. Query `routing denial` returns no match: the two words occur on different lines and neither in the title. Query `REGISTRY` returns line 1. Adding document `beta` titled `Registry` with text `Permission check` makes `registry permission` match both; limit 1 returns alpha, total_matches 2 and truncated true regardless of input order. These are hand-calculated examples, not the complete fixture suite.

## 6. Exact success output and evidence

Output has exactly these fields:

```ts
interface DocumentationSearchOutput {
  corpus_id: string;
  snapshot_id: string;
  coverage: "OFFLINE_SNAPSHOT";
  total_matches: number;
  truncated: boolean;
  results: Array<{
    document_id: string;
    revision: string;
    title: string;
    excerpt: string;
    line_start: number;
    line_end: number;
    content_sha256: string;
    locator: string;
  }>;
}
```

Locator is exactly `documentation://<corpus_id>/<snapshot_id>/<document_id>/<revision>#L<line_start>-L<line_end>`. All components are validated opaque IDs or positive decimal line numbers; never absolute paths or live URLs. evidence_refs is exactly the ordered result locators, including an empty array for zero matches. content_sha256 refers to full normalized document text, not the excerpt. Hash is content integrity, not proof of authority. No-match is SUCCESS with 0, false, [] and snapshot coverage, not NOT_FOUND or a claim that documentation does not exist elsewhere.

Strings are untrusted data: preserve literal content, never execute, interpolate into prompts as policy, open locators, invoke tools or treat retrieved instructions as approval. Consumer rendering/sanitization is outside v1; no UI is built. Title and excerpt may contain Markdown/HTML as inert text. A caller-approved document may still contain adversarial instructions; tests must show those do not change routing or execution.

The UTF-8 JSON-serialized complete success result must fit <=262144 bytes and the existing registry envelope (packet reports 8388608 characters and 10000 nodes). Legal maxima must succeed; this guard must not silently truncate or reject a legal maximum through accidental escaping overhead. Excess due to a provider defect fails EXECUTION_FAILED. Safe error messages <=160 ASCII characters; no raw errors/stacks/config/query. duration_ms finite nonnegative, computed from monotonic elapsed time.

## 7. Deadline, side effects and failure

Effective budget = min(request.timeout_ms, 5000), measured once using a monotonic clock from invoke entry. Check after validation, during scanning, after sorting/result construction and immediately before returning. No reset per document. Yield to the event loop at least every 32 scanned lines; also check between documents and before/after processing each line. No pending timers/tasks after return, hidden retries, process workers or transport. Sorting is bounded to 256 matches. A scheduling pause can delay when TIMEOUT is delivered: promise wall-clock hard real-time completion is not guaranteed. The guarantee is no SUCCESS observed after the monotonic deadline check expires, bounded work and cooperative yielding.

No public cancellation API exists in the supplied ToolInvocationRequest. Do not claim abort/resume support or mutate Core to add it. External cancellation wiring is deferred. Timeout is supported now.

`NONE` means no filesystem/network/process/database writes or accesses by provider behavior. Pure in-memory computation/allocation is permitted. Prove absence structurally and with guarded execution. Test fixture file reads outside provider execution do not establish a runtime filesystem capability.

| Situation | Normalized result |
| --- | --- |
| Unknown capability | FAIL / NOT_FOUND / retryable false |
| Invalid typed envelope or search input | FAIL / INVALID_INPUT / false |
| Deadline expired | FAIL / TIMEOUT / true |
| Internal output bound violation | FAIL / EXECUTION_FAILED / false |
| Unexpected provider exception | FAIL / INTERNAL_ERROR / false, fixed safe text |
| Restricted denial | Existing Restricted BLOCKED semantics preserved; zero underlying invoke |
| Invalid trusted config | Construction throws a fixed safe Error, no partial usable instance |

No UNAVAILABLE fallback, network retry or alternate-provider selection. Do not expose intermediate results on any FAIL/BLOCKED.

## 8. Part B scope and protected surfaces

Only additions under `src/providers/capability/documentation/**`, `tests/documentation-capability/**`, and one `brain-bootstrap/reports/S14E-documentation-search-verification.md` are eligible for later Part B authorization. These are authored target paths, not packet-proven existing files. Tests may contain reviewed text fixtures in their own subtree. No production export-barrel modification is required; import through the new directory's own index. No dependency or package/lock/config change.

Protect all previously tracked files, Core, AgentDefinition, Restricted, registry, S11 research, S14B/C/D and prior canonical artifacts. Once integrated, Part A is byte-locked. STATE.yaml/CURRENT.md changes belong only to separately authorized closure, not builder. An unforeseen wiring incompatibility returns CHATGPT_AUTHORING_REQUIRED with evidence, not a broader builder-local scope.

Part A inventory exactly the three paths in the companion quality contract. No provider/vendor identifiers in AgentDefinition. No S14F+ GitHub/browser/database/MCP behavior or S15+ workflow/verifier/orchestration subsystem; independent human-directed verification sessions remain a governance step, not an implementation of S15.

## 9. Quality gate and inherited failures

Companion YAML defines 20 hard invariants, 12 positive and 16 negative fixture IDs, and 6 non-vacuous unsafe counters. IDs are phase-local; labels never count as executable proof. Map each to named assertions and evidence. Counter detectors must fire under isolated deliberately unsafe test mutations; do not add production telemetry merely to satisfy them.

Require actual provider calls, actual registry and Restricted paths, a runAgent exercise with an existing deterministic model fake, two corpus configurations sharing one AgentDefinition, and a second independently implemented test provider with compatible semantic descriptor in a separate configuration. Corpus swap and implementation swap are separate demonstrations. Do not invoke a paid/live model.

Compare the exact Part A integration baseline with candidate in equivalent Node 24 environments. Typecheck, focused S14E and actual runtime composition must pass. Run full suite pre-build, remove only reproducible repo-local build output in isolated verification worktree to demonstrate dist absence, perform genuine build, then full post-build. Discover actual project commands rather than invent npm scripts. Do not clean the user's working tree.

Only the eight exact S14C failure identities listed in YAML may remain, and only if baseline and candidate reproduce the same assertion/cause, with no extra changed protected path caused by S14E. A familiar test name with a newly expanded scope failure is a new regression. Report raw passed/failed/skipped counts per run; call the outcome PASS_WITH_DOCUMENTED_BASELINE_FAILURES when applicable, never full-suite PASS. If baseline is green, candidate must be green. Do not repair/skip/edit the S14C tests or widen exceptions here. New failures block acceptance and return for scope resolution.

## 10. Lifecycle

Part A authored → user-approved mechanical integration → factual schema/interface/scope check → separate Part B authorization → builder candidate and evidence → fresh non-authoring/non-builder/non-fork read-only verifier on exact committed remote candidate → standalone relay → separate ChatGPT control-plane acceptance → authorized phase closure/integration. Builder cannot self-approve. No external posts or commits are authorized merely by this document.

After S14E phase acceptance: S14E PHASE_PASS; S14 IN_PROGRESS / NOT_CLOSED; S14F NOT_AUTHORIZED; HI-054 NOT_AWARDED. Rollback of failed unintegrated work preserves branches/evidence and the accepted baseline; no destructive reset or history rewriting. Semantic defects return to ChatGPT for Part A revision.
