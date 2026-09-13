# False-Heal Safety Benchmark — v1.6.0

## Why this is separate

A self-healing system can recover a selector and still be wrong about the intended business action. Successful locator recovery therefore must not be presented as proof of safe business behavior.

TestigentAI measures false-heal prevention separately from healing success.

## Seeded safety cases

`tests/framework/false-heal-safety.spec.ts` includes deliberate defects where an action can technically execute but the required business outcome never occurs.

### Case 1 — valid locator, failed business result

A real primary button is actionable, but the required confirmation state stays hidden.

Expected behavior:

```text
click executes
business post-condition fails
scenario fails
no clean pass is produced
```

### Case 2 — high-confidence wrong AI candidate

A synthetic AI provider returns a high-confidence but wrong button.

Expected behavior:

```text
candidate can be clicked
business post-condition fails
recovery is recorded/rejected
candidate is not promoted to reusable cache
scenario fails
```

## Commands

Run only the seeded safety benchmark:

```bash
npm run test:healing:safety
```

The suite is also part of:

```bash
npm run test:review:hardening
npm run validate:final
```

## Release interpretation

A green safety benchmark proves the checked safety contracts for the seeded cases. It does not prove that all possible application-specific false-heal modes are impossible.

For pilot measurement, teams should add seeded business defects representative of their own applications and report:

```text
unsafe clean passes / seeded genuine business failures
```

The desired acceptance criterion is zero unsafe clean passes for the agreed seeded dataset.
