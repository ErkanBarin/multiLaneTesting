# Onboarding — `multilanetesting`

For teams consuming published packages from another repository, see:
your registry administrator's npm onboarding guide

Everything a new team member or a new-system team needs to go from zero to a passing first test.
The framework builds itself through an AI agent — your job is to set up the context correctly so
the agent makes the right choices.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | `node --version` |
| npm | ≥ 10 | bundled with Node 20 |
| Python | ≥ 3.11 | only for the screen-driver lane |
| Git | any | SSH access to your team's git host |
| Claude Code or GitHub Copilot | current | the agent that builds the framework |

---

## Step 1 — Clone and install

```bash
git clone https://github.com/ErkanBarin/multiLaneTesting.git
cd multilanetesting
npm install
```

---

## Step 2 — Create your `.env`

Copy the template and fill in the values for your target system. The `.env` file is gitignored —
it never goes to remote.

```bash
cp .env.example .env
# edit .env — fill in only the sections that apply to your target system
```

Key variables:

| Variable | What it is |
|---|---|
| `MULTILANE_WEB_BASE_URL` | Base URL if the target has a web UI |
| `MULTILANE_TARGET_HOST` | Host for API contract calls |
| `MULTILANE_WS_URL` | STOMP/WebSocket endpoint |
| `SCREEN_TARGET_HOST` | VNC/RDP host for the screen-driver lane |
| `SCREEN_RPS_PARTITION` | Test partition — `TEST_A`, `TEST_B`, or `TEST_C`. **Never `PROD`.** |

---

## Step 3 — Create `CLAUDE.md` (if using Claude Code)

`CLAUDE.md` is gitignored — it holds your local, environment-specific operational truth.
Copy the template:

```bash
cp CLAUDE.md.example CLAUDE.md
# edit CLAUDE.md — fill in your system name, hosts, partition, any known blockers
```

If using GitHub Copilot instead of Claude Code, skip this step — Copilot reads
`.github/copilot-instructions.md` (already committed).

---

## Step 4 — Run the guard scripts

```bash
npm run check:no-runtime-ai    # should pass immediately (no tests yet)
npm run check:robot-contract   # should pass immediately (no tags yet)
```

If either fails before you've written any tests, something is wrong with the repo state — read the
error output before continuing.

---

## Step 5 — Open the repo in your AI agent

**Claude Code:**
```bash
claude  # opens in the current directory
```

**GitHub Copilot (VS Code):**
Open the `multilanetesting/` folder in VS Code. The `AGENTS.md` file is auto-attached.

---

## Step 6 — Run Phase 0 (surface inventory, approval gate)

Paste this to the agent, or say *"Follow `BOOTSTRAP_PROMPT.md`"*:

> Implement **Phase 0 only** (the surface inventory for `<your system name>`). Read
> `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, and `AGENTS.md` first. Stop for my sign-off after
> the memo. Tell me what you need from me to complete the inventory.

The agent will ask what surfaces the system exposes (DOM, REST, WS, screen). Answer honestly —
this determines which lanes get built and in what order. **Do not skip Phase 0.**

---

## Step 7 — Sign off the memo, then build

After Phase 0:
1. Read the memo the agent produces in `spikes/phase0-<system>/`.
2. If the surface inventory looks right, sign it off (reply "approved, proceed to Phase 1").
3. The agent builds Phase 1 (first lane MVP) — your only job during Phase 1 is to confirm the
   spec passes and evidence looks correct.

---

## What the agent builds (you don't write this by hand)

The missing directories (`apps/`, `src/`, `tests/`, `locators/`, `bin/`) are **intentionally
absent** from the starter kit. They are created by the agent during Phases 1–4. The kit ships
the *plan, conventions, and AI customization* so the agent builds everything correctly the first
time.

---

## Guardrails to enforce (remind the agent if it forgets)

- **No host literals in committed files** — env-var names only.
- **No AI in a test run** — `npm run check:no-runtime-ai` must stay green.
- **Screen specs replay into a test partition** — never `PROD`.
- **Functional truth is the gate** — a spec does not pass on a golden-image diff alone.
- **Run every new spec twice** — identical functional readback required.

---

## Multi-system usage

Once Phase 4 is complete (a second system onboards from `targets/<name>/` profiles), onboarding a
new system is:

1. Add a `targets/<new-system>/` profile (channel, partition, theme/DPI for screen specs).
2. Seed `docs/memory/route-map.md` with the new system's surfaces.
3. Run Phase 0 for the new system.
4. Phase 1 builds the first lane from the existing driver/workspace scaffolding — no core edits.
