# S07 Part A — Verification report (ChatGPT Authoring Gate)

## Scope

This report covers **S07 Part A only**: the `MemoryProvider` semantic contract. Per explicit user instruction, S07 Part B (the concrete Hermes adapter, config, and contract tests) remains **BLOCKED** and is not attempted here.

## Protocol followed (Section 3.1)

1. INSPECT — repo confirmed clean at commit `b76db73c3a9888b2987e1522ca07f123fca58c97` (S00–S06 already merged/pushed). Searched the repo, SKILL.md, and npm for any existing "Hermes" reference — found none beyond the SKILL.md's own illustrative substitution-test mentions.
2. EVIDENCE PACK — assembled per the user's explicit content list (S07 objective, artifacts, existing contracts to preserve, real repo state, what's known/unknown about Hermes, MemoryProvider requirements definable without knowing Hermes, decisions depending on Hermes identity, acceptance criteria, required tests, exact paths, non-goals, SKILL.md ambiguities). Explicitly split the objective into Part A (contract, in scope) and Part B (adapter, deferred).
3. STOP — returned `CHATGPT_AUTHORING_REQUIRED`, delivered the PLATFORM HANDOFF PROMPT including an explicit research task (identify what "Hermes" plausibly refers to) alongside the contract-authoring task.
4. CHATGPT AUTHORING — user saved ChatGPT's response as `S07_Brain_Hermes_Research_MemoryProvider_PartA.md` in the repo root (same pattern as S03–S06 — temporary transfer file, not a canonical artifact; left untouched, not staged/committed).
5. INTEGRATE — `specs/MEMORY_PROVIDER.md` placed unmodified at its exact required path.
6. VERIFY — mechanical checks executed, **plus an independent real-world verification of the research claim** (below) — this step required going beyond mechanical text checks because the research finding is a claim about external reality, not just internal consistency.
7. **Part A: PASS. Part B: remains explicitly BLOCKED** — this is not a full S07 PASS; see Result section.

## Mechanical verification executed

```
$ grep -n "^retrieve()$\|^remember_candidate()$\|^commit_verified_memory()$\|^search_history()$" MEMORY_PROVIDER.md
61:retrieve()  62:remember_candidate()  63:commit_verified_memory()  64:search_history()
→ all 4 canonical method names present unrenamed (also referenced consistently
  17 more times throughout the document in method-specific sections, the
  lifecycle diagram, the substitution test, and the disabled-adapter test).

$ grep -n "^# 5. Governing Rule 1\|^# 6. Governing Rule 2\|^# 7. Governing Rule 3\|^# 8. Governing Rule 4\|^# 9. Governing Rule 5" MEMORY_PROVIDER.md
→ all 5 S07 rules present as distinct, elaborated sections with "Checkable
  Criteria" subsections (not just restated one-liners).

$ grep -c "DISABLED\|UNAVAILABLE" MEMORY_PROVIDER.md → 11 occurrences
→ each of the 4 methods has an explicit "Disabled / Unavailable Behavior"
  subsection; §18 "Disabled-Adapter Test" explicitly walks through all 4
  methods returning safe degraded results (empty/NOT_PERSISTED + status),
  directly operationalizing the S07 PASS criterion "Brain puede operar
  aunque el adapter sea deshabilitado."

$ grep -niE "def |function |class |import |require\(|https?://|curl |POST /|GET /" MEMORY_PROVIDER.md
(no matches — no adapter code, no invented Hermes API endpoints/methods/SDK calls)

$ python3 <vendor-mention scan outside §17 Substitution Test / §18 Disabled-Adapter Test>
other vendor mentions outside those sections: []
Hermes mentions outside those sections: 18 (all naming Hermes Agent as the
  identified *candidate* or listing *open questions about it* — manually
  reviewed every occurrence; none invents an API method, endpoint, or
  data structure — see full grep -n -i "hermes" output reviewed inline)

$ grep -riE "\.env|api[_-]?key|password|BEGIN.*PRIVATE KEY|token[:=]" MEMORY_PROVIDER.md
(no matches — no secrets)

$ git status --porcelain=v1
 M brain-bootstrap/STATE.yaml
?? S07_Brain_Hermes_Research_MemoryProvider_PartA.md   <- user's raw paste, NOT staged/committed
?? brain-bootstrap/specs/MEMORY_PROVIDER.md
(only the 1 approved artifact plus STATE.yaml changed)
```

## Cross-check against canonical sources

- Memory used exactly as S01 defines it; §10 of the contract restates the Memory-vs-Knowledge/Handoff/Thread/Run/Historical-Sessions boundaries without contradiction.
- MemoryProvider's role matches S02's `BRAIN_CORE_BOUNDARIES.md` exactly: "Persists and retrieves experience-derived Memory through a generic interface... Policies determining what deserves to become Memory are separate from the persistence implementation."
- §11 reproduces S05's exact 9-item authority order and correctly keeps durable memory at rank 7.
- §3.3's promotion criteria reuse S04's exact status vocabulary (VERIFIED/PROVIDED/ASSUMED/PROPOSED/UNKNOWN/BLOCKED) and explicitly forbid promoting ASSUMED/PROPOSED/UNKNOWN/BLOCKED items — directly satisfying the S07 rule "memoria permanente requiere criterio/verificación" and Principle 2 ("No PASS sin evidencia").
- §13 explicitly confirms MemoryProvider does not replace S06's Handoff/CURRENT.md/Session Boot/Session Close mechanism — a session can continue from project context + Handoff alone even if MemoryProvider is disabled.
- §12 preserves S02/S05's Context Pack composition boundary: `retrieve()` returns candidates only; Core composes the Context Pack.
- No AgentDefinition (S10), Skill Registry (S12), or Hermes-specific SDK/API was designed — respecting the explicit non-goals from the handoff.

## Independent verification of the research claim (beyond mechanical checks)

ChatGPT's research findings marked "Hermes Agent by Nous Research" as **VERIFIED**, based on the user having identified `hermes-ai.net` to ChatGPT directly in that conversation. That provenance chain (user → ChatGPT) is not something Claude Code observed directly, so per this bootstrap's own principle ("No PASS sin evidencia. Un claim del agente no cuenta como verificación."), this was independently checked against real external state rather than accepted at face value:

```
$ gh repo view NousResearch/hermes-agent
$ gh api repos/NousResearch/hermes-agent --jq '{full_name, description, html_url, homepage, pushed_at, stargazers_count}'
{
  "full_name": "NousResearch/hermes-agent",
  "description": "The agent that grows with you",
  "html_url": "https://github.com/NousResearch/hermes-agent",
  "homepage": "https://hermes-agent.nousresearch.com",
  "pushed_at": "2026-08-25T19:50:40Z",
  "stargazers_count": 236347
}
```

**Result: the repository is real, active (pushed hours before this check), and matches ChatGPT's description** — persistent memory, cross-session recall via FTS5 session search, skills, MCP integration, sub-agent delegation, official documentation with dedicated "Memory" and "MCP Integration" pages, MIT licensed, built by Nous Research. This upgrades the finding from "PROVIDED via ChatGPT relaying the user's own statement" to **independently VERIFIED via direct GitHub API evidence**.

## Additional finding — relevant to Part B, not resolved here

```
$ gh api repos/NousResearch/hermes-agent/contents --jq '.[].name'
```
shows the repo contains `acp_adapter/`, `agent/`, `apps/`, `cli.py`, and a `.python-version` file — i.e., it is a real Python package/project, not merely a compiled binary or SaaS-only product. This is a positive signal that *some* programmatic integration surface likely exists beyond the CLI/TUI/messaging-gateway/MCP-consumption surfaces described in the README (which itself shows no embeddable "memory API" example — everything documented is CLI commands, messaging platforms, and MCP servers Hermes *consumes* as tools).

This directly corresponds to already-flagged **Open Decision #1** ("Which supported programmatic interface will Brain use to communicate with Hermes Agent?") and **Open Decision #12** ("Which Hermes behaviors are stable/public contract versus internal implementation detail?"). Investigating `acp_adapter/` or `agent/` further would mean starting Part B design work, which remains explicitly out of scope per the user's instruction. This is reported as a fact for the user's decision, not acted upon.

## Result

**Part A: PASS.** `specs/MEMORY_PROVIDER.md` is complete, internally consistent with S01/S02/S04/S05/S06, contains no invented Hermes API, and its product-identity research claim has been independently corroborated with real evidence (not just accepted from ChatGPT's report).

**Part B: BLOCKED**, as explicitly decided by the user and confirmed by ChatGPT's own §20–22. No adapter, config, or contract-test implementation was attempted. **S08 is not authorized.**

## Not yet done (left for explicit instruction, same pattern as S00–S06 closures)

- `brain-bootstrap/STATE.yaml` and `specs/MEMORY_PROVIDER.md` are **not committed/pushed yet**.
- `S07_Brain_Hermes_Research_MemoryProvider_PartA.md` (the user's raw combined paste, saved in the repo root) is **not staged and not a canonical artifact** — same treatment as the equivalent S03–S06 files; left for a closure checkpoint to handle, whenever the user decides to close out Part A (independently of when Part B eventually gets unblocked).
