# S13M repair 2 independent verification required

Handoff ID: `2026-08-29T155500Z-S13M-codex-repair2`

Status: `INDEPENDENT_VERIFICATION_REQUIRED`; target
`707ea8ea9dd1f86ff6ef01dff0dc148d6df323c9`.

This repair replaces synthetic OI-A with actual real-path A/B execution and exposes all 50 S13M hard
invariants. Part A hashes remain unchanged. Builder typecheck/focused/full-prebuild pass on WSL Node
24.19.0; independently reproduce them, A/B runtime/gate, 30 probes, HI-001..050 and all named negative
behaviors. Keep tracked files read-only. S13N remains forbidden.
