# Current Certified Release Status

## Certified baseline

**TestigentAI v1.6.0 is the certified immutable baseline.**

| Item | Certified state |
|---|---|
| Release | `v1.6.0` |
| Package version | `1.6.0` |
| Certified commit | `4225e151fadcc85fd0a9861b385bda82bd1c96c0` |
| Runtime | Node.js 22.x |
| Local connected `validate:final` | PASS |
| Review hardening | 40/40 PASS |
| Framework regression | 127/127 PASS |
| Security | 0 high/critical advisories |
| Failed-job rerun recovery | PASS |
| Mixed-attempt report provenance | PASS |
| Evidence/dashboard publication | PASS |
| Release Compatibility matrix | PASS 5/5 |

Annotated tag verification:

```text
refs/tags/v1.6.0    80e723eb45af82147ff1e0d4044b8b31bce8e19c
refs/tags/v1.6.0^{} 4225e151fadcc85fd0a9861b385bda82bd1c96c0
```

The tag must not be moved or recreated.

## v1.6.0 certification evidence

Release Compatibility run `34760349497` passed:

| Hosted runner | Browser | Result |
|---|---|---|
| Ubuntu | Chromium | PASS |
| Ubuntu | Firefox | PASS |
| Ubuntu | WebKit | PASS |
| macOS | WebKit | PASS |
| Windows | Chromium | PASS |

Each compatibility job validated locked dependencies, supported Node, browser installation, static/type validation, architect-review/recovery regression, runtime/browser evidence capture and compatibility evidence upload.

Before tagging, v1.6.0 also proved the real failed-job rerun scenario: a transient Gemini outage failed the live AI lane, a later rerun succeeded, and report acquisition/provenance correctly combined same-workflow evidence without using a mutable latest pointer.

## Development candidate: v1.6.1

v1.6.1 is intentionally small and operational. It keeps all v1.6.0 release/evidence semantics unchanged while separating:

- **AI Deterministic Safety** — blocking, provider-neutral correctness gate;
- **AI Live Provider Canary (non-blocking)** — real external-provider/generation/healing availability signal.

The candidate adds environment-scoped provider-health history and one-click `ai-provider-health.html` drill-down. A provider `503` can therefore be visible as `DEGRADED` without falsely representing deterministic TestigentAI correctness as failed.

See `48-v1.6.1-AI-OPERATIONAL-RELIABILITY.md`. Until v1.6.1 passes connected validation, PR/main/rerun CI and the 5/5 compatibility matrix, **v1.6.0 remains the certified baseline**.

## Authoritative release workflow

```text
feature branch
 -> npm run validate:final
 -> PR checks
 -> merge to main
 -> main TestigentAI Multi-Project CI
 -> annotated vX.Y.Z tag
 -> automatic TestigentAI Release Compatibility matrix
```

Historical v1.4.x-v1.5.x and v1.6.0 pre-tag documents remain audit evidence; they do not override this current-status file.
