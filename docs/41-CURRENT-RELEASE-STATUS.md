# Current Certified Release Status

## Certified baseline

**TestigentAI v1.6.1 is the current immutable certified baseline.**

| Item | Certified state |
|---|---|
| Release | `v1.6.1` |
| Tagged commit | `5c2c785` |
| Runtime | Node.js 22.x |
| Main CI | PASS |
| Main full rerun | PASS |
| AI deterministic safety | PASS |
| Live provider degradation semantics | PASS |
| Provider-health history | PASS |
| Rerun-safe provenance | PASS |
| Final business bundle | PASS |
| Release Compatibility matrix | PASS 5/5 |

Main CI run `34766206400` proved the v1.6.1 operational-reliability contract. The live Gemini provider was allowed to become `DEGRADED` under external availability/rate-limit conditions while deterministic AI safety, provider-health evidence, report provenance and the overall workflow remained valid. The full rerun also passed.

The `v1.6.1` tag must not be moved or recreated. `v1.6.0` remains preserved as the previous certified baseline.

## Development candidate: v1.7.0

v1.7.0 introduces **Agentic Test Intelligence** on top of the certified v1.6.1 baseline:

- deterministic agentic trust contracts;
- requirement-to-plan and change-impact planning;
- proposal-only generation boundary;
- deterministic generated-source reviewer;
- immutable sanitized agent decision ledger;
- governed TestigentAI MCP server;
- one-click `agentic-intelligence.html` reporting;
- blocking Agentic Deterministic Safety gates in GitHub and Azure;
- carry-forward of the certified v1.6.1 canary outcome/runtime-path hotfix.

Connected Node 22 validation for the current v1.7.0 feature-branch candidate has passed, including the complete `validate:final` gate and security policy.

v1.7.0 remains **not certified** until PR/main/rerun CI and the full 5/5 Release Compatibility matrix pass.

See:

- `docs/50-v1.7.0-AGENTIC-TEST-INTELLIGENCE.md`
- `docs/51-v1.7.0-IMPLEMENTATION-PLAN.md`
- `docs/52-v1.7.0-AGENTIC-MCP-GUIDE.md`
- `docs/53-v1.7.0-DEEP-REVIEW-VALIDATION.md`

## Authoritative release workflow

```text
feature branch
 -> npm run validate:final
 -> PR checks + rerun
 -> merge to main
 -> main CI + rerun
 -> annotated vX.Y.Z tag
 -> automatic TestigentAI Release Compatibility matrix
 -> certification record
```
