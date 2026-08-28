# S13J Postgres Data Modeling — ChatGPT Authoring Preflight

## Gate

```text
CHATGPT AUTHORING REQUEST
Step: S13J
Purpose: Author the complete canonical Part A for postgres-data-modeling.
Builder action now: INSPECT + EVIDENCE ONLY
Part B: FORBIDDEN UNTIL INTEGRATION
```

## Canonical step contract

```text
S13J — postgres-data-modeling
Schema, PK/FK, indexes, constraints, migrations, transactions, query checks.
```

Every S13x must integrate a ChatGPT-authored Skill/knowledge contract, create positive and negative
examples, run an eval through the real agent runtime, prove improvement versus no Skill, repair
mechanical defects locally, return semantic defects to ChatGPT, and receive independent verification
before the next S13x.

## Verified repository facts

- branch `main`; inspected start HEAD/origin `1986695234a226bbfd1e0dcaacbcc419e41f2a04`;
- S00–S13I are `VERIFIED PASS`; S13I independent report is versioned;
- Node 24.19 verification baseline: typecheck PASS, focused S13I 67/67, full 705/705,
  clean build and post-build 705/705;
- no S13J Skill, Quality Contract, spec, source module, test suite, agent definition, or catalog entry;
- no PostgreSQL driver, SQL parser, migration framework, ORM, database server, or container dependency;
- the only runtime database package is `better-sqlite3`, confined to the replaceable S07
  `LocalReferenceMemoryProvider`; it is not Brain Core and is not a precedent for application data;
- the Skill catalog has 12 entries, ending with S13I;
- S13I defines provider-neutral `ApiDataPortRequirement` (`READ/CREATE/UPDATE/DELETE/EXISTS/LIST/
  ATOMIC_GROUP_REQUIRED`) and `ApiAtomicityContract`, but explicitly forbids tables, columns,
  indexes, migrations, SQL, ORM, transaction isolation, locks, and connections;
- S13I Rule R12 explicitly assigns persistence modeling to S13J.

## Authority and boundaries to preserve

- Core depends on contracts, never concrete implementations; Intelligence owns reusable procedure;
- S13J must model PostgreSQL application persistence, not alter Brain's S07 MemoryProvider adapter;
- S13I owns HTTP/service/data-port intent and hands logical operations/atomicity into S13J;
- S13L owns broad AuthN/AuthZ/tenancy/secrets/tool-permission security policy; S13J may enforce only
  database-local constraints or access-shape requirements explicitly supplied by approved input;
- S13O owns retries/backoff/idempotency/async failure mechanics;
- S13P owns AI-system observability providers; S13R owns deployment/runtime provisioning;
- S14 owns executable capability/provider binding. S13J Part B must not invent a live PostgreSQL
  capability, credentials, connection pool, migration runner, ORM, or server.

## Requested canonical Part A targets

1. `brain-bootstrap/skills/POSTGRES_DATA_MODELING_SKILL_S13J.md`
2. `brain-bootstrap/quality-contracts/S13J_POSTGRES_DATA_MODELING_<DEPTH>.yaml`
3. `brain-bootstrap/specs/POSTGRES_DATA_MODELING_CONTRACT_S13J.md`

The transfer must be byte-ready, complete, internally consistent, and separately delimited by exact
path. Include a canonical resolutions preamble and explicit unresolved gaps.

## Questions ChatGPT must resolve

1. exact execution mode under the S13E hierarchy and justified Quality depth;
2. canonical input and output/result types, including how S13I logical data-port and atomicity intent
   is consumed without mutating it;
3. supported PostgreSQL modeling scope and version assumptions, if any;
4. entity/table/column/domain naming and identifier policy;
5. PK strategy, natural versus surrogate keys, FK actions, nullability, uniqueness and check policy;
6. tenant/owner scope representation without silently mandating multi-tenancy;
7. temporal/audit columns, soft delete, status modeling, monetary/decimal, timestamp/timezone and
   JSONB/array/enum rules;
8. index selection rules tied to explicit query/access patterns; composite ordering, partial/unique/
   expression indexes; redundant/unused index rejection;
9. query-check representation: predicates, joins, ordering, pagination, cardinality/selectivity,
   expected plan evidence and N+1/unbounded query failure modes;
10. transaction boundaries, isolation/locking/deadlock rules and the exact S13O boundary;
11. migration contract: forward/backward compatibility, expand/contract, data backfill, locking,
    reversibility/rollback and destructive-change approval;
12. constraint-versus-application invariant ownership and race-condition prevention;
13. schema/search_path/extension/RLS assumptions and what must remain explicit input;
14. safe handling of PII/secrets and the exact S13L boundary;
15. whether canonical outputs contain abstract schema objects, PostgreSQL DDL text, migration plans,
    query-check plans, or a combination; define authority between representations;
16. anti-self-certification: which invariants/status/blockers must be recomputed from bounded input;
17. canonical positive fixtures and at least the required negative cases (missing FK/constraint,
    invalid delete action, query-unjustified index, missing index for critical access path,
    unsafe destructive migration, non-atomic invariant, unbounded query, invented tenant/security
    assumption, provider/credential/runtime pull-forward);
18. real S12→S10→S09 execution path and whether a caller-supplied generic host remains sufficient;
19. OI-A-safe Skill-vs-no-Skill dimensions/thresholds with raw per-assertion contributions grouped
    by assertion ID and no cross-cutting assertion qualifying a dimension;
20. exact T1–Tn semantic coverage and allowed Part B module/file scope.

## Constraints and non-goals

- Codex must not author or silently revise S13J semantics.
- Do not add a PostgreSQL driver, ORM, framework, live server, credentials, connection, migration
  executor, Capability Registry, deployment, or future-step implementation in Part A or Part B.
- Do not modify S13I semantics or turn the S07 SQLite MemoryProvider into application persistence.
- Preserve provider-neutral Core/runtime boundaries and prior S13x regression behavior.
- A deterministic reference model is allowed only if it uses the real runtime, sees no frozen truth,
  and cannot branch on fixture ID, Skill ID, or with-Skill flags.
- Thresholds must be satisfiable, generalizable, and use the corrected OI-A concentration formula:
  `max(per_assertion_improved_instance_count) / total_dimension_improvement`.

## Acceptance for the authoring transfer

- three complete artifacts at exact paths plus canonical resolutions and unresolved gaps;
- standalone parseable Quality Contract YAML;
- TypeScript-compatible provider-neutral input/output shapes;
- explicit adjacent-step boundaries and forbidden scope;
- enumerated concrete T1–Tn cases, positives, negatives, evidence categories and comparison metrics;
- no invented repository state; claims tagged as verified/decision/proposal/blocked where relevant.

## Required ChatGPT action

Author and deliver the complete canonical S13J Part A transfer. Do not implement Part B. If a
repository fact is insufficient, mark the exact gap rather than inventing it.
