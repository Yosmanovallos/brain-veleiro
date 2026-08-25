# Failure Modes

This directory documents recurring failure patterns that Brain should detect, avoid, or mitigate.

Each artifact should describe:

- symptom;
- cause;
- impact;
- detection;
- prevention;
- recovery/mitigation;
- related decisions/patterns;
- source/provenance;
- validity.

Examples:

```text
stale-context-overrides-reality.md
unbounded-tool-loop.md
provider-leakage-into-core.md
context-stuffing.md
```

Failure-mode Knowledge should be reusable across Runs/projects where applicable.
