---
name: remember:evolve
description: Evolve the brain — consolidate entities, reflect on beliefs, promote top beliefs to Persona. Run weekly or on demand.
---

# /remember:evolve — Evolve the Brain (periodic, weekly recommended)

The deeper LLM-driven evolution layer. The deterministic Phase 3 (promote) runs automatically after every capture — that keeps `Persona.md ## Top Beliefs` current in real time. This skill is what does the work that promote alone *can't*: re-synthesizing entity profiles, re-scoring belief confidence semantically, marking stale beliefs that should retire.

Without periodic evolution, the brain becomes append-only:
- `People/`, `Projects/`, `Areas/` files accumulate log entries but never get a refreshed `## Profile` overview
- Beliefs keep their initial confidence forever, even after 15 supporting captures that should push them to 0.95
- 6-month-old beliefs with no new evidence stay marked `stable` instead of `stale`

Three phases:

1. **Consolidate** (LLM) — re-synthesize entity profiles from accumulated facts and beliefs
2. **Reflect** (LLM) — re-evaluate beliefs against evidence, update confidence and freshness, mark contradictions
3. **Promote** (deterministic, no LLM) — also runs here, usually a no-op because auto-promote already kept Top Beliefs current

Recommended cadence: `/loop 7d /remember:evolve` (weekly) or `/loop 30d /remember:evolve` (monthly). Idempotent — safe to run any time.

After each Phase that writes (Phase 1 entity re-synthesis, Phase 2 belief frontmatter updates, Phase 3 Persona.md update via `promote.js`), call `node ${CLAUDE_PLUGIN_ROOT}/scripts/schema.js validate <filepath>` on the touched files. Surface its `warnings` (e.g. *"confidence defaulted to 0.5 — review"*) in your final report.

---

## Flags (parsed from user input)

| Flag | Effect |
|---|---|
| `--consolidate-only` | Run Phase 1 only |
| `--reflect-only` | Run Phase 2 only |
| `--promote-only` | Run Phase 3 only (no LLM — pure script call) |
| `--dry-run` | Log intended changes; write nothing |

If no flag → run all three phases in order.

---

## Step 1: Resolve brain path & load config

1. Read `$REMEMBER_BRAIN_PATH` (fallback `~/remember`). Call this `{brain}`.
2. If missing → tell user to run `/remember:init` and stop.
3. Run: `node ${CLAUDE_PLUGIN_ROOT}/scripts/build-index.js --compact` to get the brain index. Use throughout to resolve entities and prevent duplicates.
4. Load thresholds + auto_promote flag:
   ```bash
   node -e "const {loadEvolutionConfig} = require('${CLAUDE_PLUGIN_ROOT}/scripts/config'); console.log(JSON.stringify(loadEvolutionConfig()));"
   ```
   Defaults: `promotion_confidence=0.85`, `promotion_sources=5`, `stale_days=90`, `consolidate_touches=5`, `top_beliefs_n=10`.

## Step 2: Read REMEMBER.md

Cascading: `{brain}/REMEMBER.md` (global) + `./REMEMBER.md` (project, if cwd is in a project). User's `## Promotion Thresholds` section overrides the config file values.

---

## Phase 1 — Consolidate (LLM)

**Skip if `--reflect-only` or `--promote-only`.**

Goal: re-synthesize entity profile files (`type: observation`) for entities that crossed the consolidation threshold.

### Step 1a: Find entities ripe for consolidation

For each `People/<x>.md`, `Projects/<x>/<x>.md`, `Areas/<x>.md`:
1. Parse frontmatter. Skip if missing `type: observation`.
2. Compute `touches_since_last_consolidate` — count of session entries / mentions in `Journal/` that reference this entity (via `[[wikilinks]]`) since `last_consolidated`.
3. Include in candidate list if `touches_since_last_consolidate >= config.thresholds.consolidate_touches` (default 5).

### Step 1b: For each candidate, re-synthesize

For each candidate file:
1. Read the entity file + all linked Notes/Decisions (via `related:` and grep for `[[Notes/...]]` mentioning the entity).
2. Synthesize an updated `## Profile` (or `## Overview`) section from accumulated facts + beliefs. Reference linked beliefs by wikilink, do not copy them.
3. Update sections (using `Edit` tool — surgical, never replace whole file):
   - `## Profile` — synthesized summary
   - `## Active Facts` — list of `[[Notes/...]]` world-facts about this entity
   - `## Active Beliefs` — list of `[[Notes/...]]` beliefs with current confidence
4. Update frontmatter: `last_consolidated: {today}`, `sources_count: {touches}`, `freshness: stable`.
5. Append to evolution log:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/evolution-log.js CONSOLIDATE "{path} touches=+{n}"
   ```

**Never overwrite history sections** (`## Interactions`, `## Log`, `## Meetings`). Only refresh synthesized sections.

**Dry-run:** report what would be consolidated, write nothing.

---

## Phase 2 — Reflect (LLM)

**Skip if `--consolidate-only` or `--promote-only`.**

Goal: re-score beliefs against accumulated evidence and counter-evidence; update freshness trend.

See `@reference.md` for the full freshness state machine and confidence-update heuristics.

### Step 2a: Find beliefs to reflect on

Walk `Notes/*.md`. Filter to `type: belief`. Skip beliefs reflected within last 7 days unless `--reflect-only` is explicitly invoked.

### Step 2b: Per-belief re-evaluation

For each belief file:

1. Read frontmatter and body. Note current `confidence`, `freshness`, `sources_count`, `evidence`, `counter_evidence`.

2. Score new confidence based on:
   - Ratio of `evidence` count to `(evidence + counter_evidence)` count
   - Recency of latest evidence (penalty if all evidence is older than `stale_days`)
   - Strength of contradicting counter-evidence (if any explicit "user said the opposite" entries exist)

3. Update freshness using the state machine in `@reference.md`:
   - Confidence rose ≥ 0.1 → `strengthening`
   - Confidence dropped ≥ 0.1 OR new counter_evidence in this run → `weakening`
   - No new evidence in `stale_days` (default 90) → `stale`
   - `counter_evidence.length > evidence.length` → `contradicted`
   - Otherwise → `stable`

4. If freshness changed OR confidence changed by ≥ 0.05:
   - Update frontmatter via `Edit` tool (surgical)
   - Append:
     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/evolution-log.js REFLECT "{path} conf {old}→{new} freshness={new_freshness}"
     ```
   - For state transitions: also log `STALE`, `CONTRADICT` events as appropriate.

**Never** delete or overwrite the belief body or the existing `evidence` / `counter_evidence` arrays. Only frontmatter `confidence` and `freshness` change.

**Dry-run:** report intended changes, write nothing.

---

## Phase 3 — Promote (deterministic, no LLM)

**Skip if `--consolidate-only` or `--reflect-only`.**

Goal: pin top beliefs into `Persona.md ## Top Beliefs` based on thresholds. Pure script — no judgement required.

### Step 3a: Run the script

If `--dry-run`:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/promote.js --dry-run
```

Otherwise:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/promote.js
```

The script:
- Filters `Notes/*.md` with `type: belief` by configured thresholds (confidence, sources, freshness)
- Ranks by composite score (`confidence × log(sources_count + 1)`)
- Takes top N (default 10)
- Updates `Persona.md ## Top Beliefs` (wikilinks only, never copies)
- Demotes entries no longer meeting threshold
- Logs PROMOTE / DEMOTE events to `~/.local/state/remember/evolution.log`

If `auto_promote: false` in config, the script is still safe to call — it computes deltas but does not write.

---

## Step 4: Report

```
🧠 Brain evolved (date: {today})

Phase 1 — Consolidate
  Entities re-synthesized: {N}
  - [[People/cezar.md]] (+3 touches)
  - [[Projects/dollie/dollie.md]] (+5 touches)

Phase 2 — Reflect
  Beliefs re-evaluated: {N}
  - {N} stable
  - {N} strengthening
  - {N} weakening (review recommended)
  - {N} stale
  - {N} contradicted

Phase 3 — Promote
  Mode: {bootstrap | normal}  (bootstrap is in effect while total beliefs < 20)
  Effective thresholds: conf>={c} sources>={s}
  Top {N} beliefs pinned to Persona.md.
  Promoted: {N}
  - [[Notes/x.md]] conf=0.91 sources=8
  Demoted: {N}
  - [[Notes/y.md]] (now conf=0.74)

Audit: ~/.local/state/remember/evolution.log
```

Always show the audit log path so the user can `tail` it and verify.

---

## Error Handling

- Missing brain → tell user to `/remember:init`
- Missing Persona.md → run promote with `auto_promote: false` semantics (compute, don't write); warn user
- Empty Notes/ → all phases no-op cleanly
- Invalid frontmatter on a belief → skip that file with a warning, continue with the rest
- Phase 1 partial failure → continue to Phase 2/3 unless aborted explicitly

See `@reference.md` for detailed phase logic, freshness state machine, and report templates.
