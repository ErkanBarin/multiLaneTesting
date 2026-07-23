---
name: pr-hygiene
description: PR readiness checklist for multilanetesting. Validates determinism, the no-runtime-AI guard, frozen-locator inventory sync, traceability, evidence, memory hygiene, and host-literal sanitization before a change is proposed for merge.
user-invocable: true
---

# pr-hygiene

Run this before opening a PR. The screen analog of web application's `webapp-pr-hygiene`.

## Checklist

1. **Determinism** — every touched spec passes **twice** with identical functional readback; no
   `sleep`/retry loops.
2. **No runtime AI** — `npm run check:no-runtime-ai` passes; no vision/computer-use/`screen-driver`
   discovery reachable from a test run.
3. **Partition safety** — specs replay an RPS scenario into a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`),
   never `PROD`.
4. **Functional gate** — functional truth is asserted as the gate; rendering/legibility only
   corroborate; volatile golden-image regions are masked.
5. **Frozen-locator sync** — every locator a spec uses exists under `locators/<area>/` and is recorded
   in `docs/memory/selector-index.md` with tier + "Last verified".
6. **Traceability** — each new/changed spec carries a `requirement_ref` and a row in
   `docs/traceability.md`; `docs/coverage-map.md` updated.
7. **Evidence** — JUnit + HTML emitted; artifacts attached.
8. **Host-literal sanitization** — **no host/IP literals** in committed files; env-var names only
   (`SCREEN_TARGET_HOST`, `SCREEN_RPS_PARTITION`, …). The only place real values live is `.env`
   (gitignored). `CLAUDE.md` stays gitignored.
9. **Memory hygiene** — `docs/memory/*` updated only for durable route/locator/blocker/coverage/
   traceability facts; no transcripts, secrets, temporary notes, or unverified assumptions.
10. **Types & lint** — `npm run typecheck` and `npm run lint` pass on the JS lanes.

## How to run

Start **read-only**: report which items fail before editing. Fix in the smallest slices. Re-run the
relevant checks (`check:no-runtime-ai`, `typecheck`, `lint`, the touched spec ×2) and confirm green
before proposing the PR.
