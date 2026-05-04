# Evolve Skill — Reference

Detailed phase logic, prompts, and report templates for `/remember:evolve`.

---

## Architecture: where the LLM is and isn't

| Phase | LLM? | Why |
|---|---|---|
| **1. Consolidate** | YES | Synthesizing entity profiles from many disparate sources requires natural-language judgement. |
| **2. Reflect** | YES | Weighing evidence vs counter-evidence and updating confidence requires semantic understanding. |
| **3. Promote** | NO | Pure threshold filter + rank + write. Calls `scripts/promote.js`; runs on cron without LLM cost. |

The schema fields populated by Phases 1 and 2 are themselves what Phase 3 reads. The hand-off is via frontmatter — no LLM context needed at promotion time.

---

## Phase 1 — Consolidate (LLM details)

### What "touches" means

A `touch` is any of:
- A `[[People/<name>.md]]` (or Project/Area) wikilink in a `Journal/<date>.md` entry written *after* `last_consolidated`
- A capture session that mentioned the entity by resolved name
- A new `## Interactions` log entry (for People) or `## Log` entry (for Projects)

Counting heuristic: `grep -r "[[<entity-path>]]" Journal/ Inbox/ | wc -l` minus what was counted at last consolidation.

### Synthesis prompt template

When re-synthesizing `People/<x>.md`:

```
You are consolidating an observation file for {entity_name}.

INPUT:
- Current entity file: {full_text_of_entity_file}
- Linked beliefs: {array_of_belief_files_with_confidence}
- Linked world-facts: {array_of_relevant_world_fact_files}
- Recent journal mentions: {last_N_journal_entries_referencing_entity}

OUTPUT (Edit tool — surgical):
- Update ## Profile section: 2-4 sentence synthesis incorporating new info from facts/beliefs/journal
- Update ## Active Facts: bullet list of [[Notes/...]] world-fact wikilinks
- Update ## Active Beliefs: bullet list of [[Notes/...]] belief wikilinks with current confidence

CONSTRAINTS:
- Never modify ## Interactions or ## Meetings or ## Log (history sections)
- All references via [[wikilinks]] — never copy belief content
- Keep frontmatter fields stable; only update last_consolidated and sources_count
- If profile already accurate, skip the file (no-op is fine)
```

### Skip rules

Skip a candidate if:
- `last_consolidated` is today (already consolidated this run)
- The entity has zero linked beliefs AND zero linked world-facts (nothing to synthesize from)
- File has no `## Profile` or `## Overview` section to update (legacy file — let user upgrade manually)

---

## Phase 2 — Reflect (LLM details)

### Confidence update heuristic

Inputs (from frontmatter):
- `evidence: [...]` — array of `{source, quote, date}` items
- `counter_evidence: [...]` — same shape; populated by prior reflects

Compute:
- `evidence_recency_score`: 1.0 if newest evidence within 30 days, decaying linearly to 0.0 at `stale_days` (default 90)
- `evidence_volume_score`: `min(1, evidence.length / 5)` — 5 distinct sources → full score
- `contradiction_penalty`: `counter_evidence.length / (evidence.length + counter_evidence.length)`
- `new_confidence`: clip `(evidence_recency_score × evidence_volume_score) - contradiction_penalty` to [0.0, 1.0]

This is a deterministic formula the LLM should follow, not invent. Apply it to each belief.

### Freshness state machine

| Current `freshness` | Trigger | New `freshness` |
|---|---|---|
| any | `new_confidence ≥ old_confidence + 0.1` | `strengthening` |
| any | `new_confidence ≤ old_confidence - 0.1` OR new counter_evidence appeared this run | `weakening` |
| `stable` | `evidence` is empty OR all evidence dates are older than `stale_days` | `stale` |
| any | `counter_evidence.length > evidence.length` | `contradicted` |
| (none of the above) | — | unchanged |

### When NOT to write

- If new state == old state AND `|new_confidence - old_confidence| < 0.05` → skip the file. Reduces noise in evolution.log.
- If a belief was reflected within the last 7 days (track via `last_reflected` frontmatter field if present, else by checking evolution.log for recent REFLECT entries on this path) → skip unless `--reflect-only` is set.

### Logging

For every change:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/evolution-log.js REFLECT "Notes/{slug}.md conf {old}→{new} freshness={new}"
```

For state transitions:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/evolution-log.js STALE "Notes/{slug}.md last_seen={date}"
node ${CLAUDE_PLUGIN_ROOT}/scripts/evolution-log.js CONTRADICT "Notes/{slug}.md counter_evidence={count}"
```

---

## Phase 3 — Promote (script details)

The skill calls `scripts/promote.js`. The script's logic is fully deterministic and tested (`tests/promote.test.js`):

1. **Find beliefs:** walk `Notes/*.md`, filter `type: belief`, parse confidence/sources/freshness.
2. **Filter candidates:** `confidence ≥ T_conf ∧ sources_count ≥ T_src ∧ freshness IN (stable, strengthening)`. Defaults: T_conf=0.85, T_src=5.
3. **Rank:** `score = confidence × log(sources_count + 1)`. Sort desc.
4. **Take top N:** default N=10.
5. **Read current `Persona.md ## Top Beliefs`** — extract the existing wikilinks.
6. **Compute deltas:** `promoted` = in new top, not in current. `demoted` = in current, not in new top.
7. **If `auto_promote: true` and Persona.md exists:**
   - Replace `## Top Beliefs` section content (wikilinks only, formatted as numbered list).
   - Append PROMOTE / DEMOTE events to evolution.log.
8. **If `auto_promote: false`:** compute deltas but write nothing. Caller can still inspect the result.

The skill should call the script with `--dry-run` if the user passed `--dry-run`. Otherwise plain invocation.

---

## Report templates

### Full run

```
🧠 Brain evolved (date: {YYYY-MM-DD})

Phase 1 — Consolidate
  Entities re-synthesized: {N}
  - [[People/cezar.md]] (+3 touches since 2026-04-12)
  - [[Projects/dollie/dollie.md]] (+5 touches since 2026-04-20)

Phase 2 — Reflect
  Beliefs re-evaluated: {N}
    stable:        {N}
    strengthening: {N}
    weakening:     {N}  ⚠️  review recommended
    stale:         {N}
    contradicted:  {N}  ⚠️

Phase 3 — Promote
  Pinned top {N} beliefs to Persona.md.
  Promoted: {N}
    - [[Notes/pref-async-comms.md]] conf=0.91 sources=8
  Demoted: {N}
    - [[Notes/pref-keto.md]] (now conf=0.74)

Audit: ~/.local/state/remember/evolution.log
```

### Dry run

Same template but prefix each section with `[dry run]` and end with:

```
(dry run — no changes written)
Run again without --dry-run to apply.
```

### Single-phase run

If `--reflect-only`, omit Phase 1 and Phase 3 sections entirely. Same for the others.

---

## Idempotency guarantees

Running `/remember:evolve` twice in a row should produce minimal log noise the second time:

- **Phase 1:** entities consolidated this run skip the next (same-day `last_consolidated`).
- **Phase 2:** beliefs reflected this run skip the next (recent REFLECT in log; or `last_reflected` frontmatter).
- **Phase 3:** if Top Beliefs unchanged, no PROMOTE/DEMOTE events; the file write is still a no-op (same content).

Cron-safe to run hourly even though weekly is the recommended cadence.

---

## When to escalate to user

- A belief flips from `stable` to `contradicted` — surface in the report; the user may want to manually review.
- A belief in `## Top Beliefs` is being demoted because it became `contradicted` — definitely surface.
- Phase 1 finds no entities to consolidate AND Phase 2 finds no beliefs to reflect AND Phase 3 finds zero candidates → tell the user the brain is too sparse to evolve yet; suggest more captures.
