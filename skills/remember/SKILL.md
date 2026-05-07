---
name: remember
description: Capture knowledge to your Second Brain when triggered by "remember this", "save this", or "brain dump"
---

# Remember — Brain Dump Skill

Immediate capture: when the user says "remember this", "save this", "brain dump", etc., route content to the right place in the Second Brain.

## ⚠️ Built-in Tools Only (NO Bash for file ops!)

| Operation | ✅ Use This | ❌ NOT This |
|-----------|------------|-------------|
| List files | `LS` tool | `bash ls` |
| Find files | `Glob` tool | `bash find` |
| Search content | `Grep` tool | `bash grep` |
| Read files | `Read` tool | `bash cat` |
| Create files | `Write` tool | `bash echo >` |
| Update files | `Edit` tool (old_string → new_string) | `bash sed` / rewrite |

**Only use bash for:** running `build-index.js`.

---

## Brain Dump Pipeline

### Step 1: Get Knowledge Index

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/build-index.js --compact
```

Use this to prevent duplicates and enable smart linking.

### Step 1b: Check REMEMBER.md

Read REMEMBER.md files (cascading):
1. `{brain}/REMEMBER.md` (global preferences)
2. `./REMEMBER.md` in current project (project-specific, if exists)

Apply all rules from both. Project additions layer on top of global. User instructions override defaults.

### Step 2: Parse User Input

Extract from conversational input: person names, project references, tasks, decisions, learnings, area updates, URLs.

### Step 2.4: Journal the capture FIRST

Before creating or editing any L2 file, append the user's verbatim quote to `{brain}/Journal/{TODAY}.md` (create the file if it doesn't exist; use the daily template from `reference.md`). This becomes the source-of-truth for the `evidence:` field on every L2 file you create in this capture.

Format inside the journal file:

```markdown
## {Topic / Project name}
- "{verbatim user quote}"
```

The journal entry's filesystem path is what every `evidence.source` will reference. Never invent a `chat/...` or `session/...` path that doesn't correspond to a real file.

### Step 2.5: Tag with epistemic type

For every chunk of content extracted in Step 2, classify it as one of:

- `world-fact` — verifiable claim about reality (decision, technical fact, learning)
- `belief` — subjective claim with implicit confidence (preference, hypothesis, judgment)
- `observation` — synthesized profile per entity (creates/updates `People/<x>.md`, `Projects/<x>/<x>.md`, `Areas/<x>.md`)
- `experience` — first-person event log (always Journal/<date>.md)

Heuristics (apply in order; first match wins):

1. Contains a date or "met with" / "called" → **experience**
2. Phrase patterns "we decided", "going with", "chose X over Y" → **world-fact**
3. Predicate about an entity ("works as", "lives in", "based in", "leads the team") → **observation**
4. Words "prefers", "probably", "I think", "seems like", "better to" → **belief**
5. Else default → **world-fact**

When creating or editing a file, write/preserve the frontmatter `type:` field accordingly. For beliefs, `confidence` is REQUIRED (use your best estimate 0.0–1.0).

The same rules live in `scripts/schema.js` (`detectType`); use that as canonical reference if uncertain.

### Step 3: Build Resolution Map

Resolve every name/reference against the knowledge index:
- **Matches existing** → `Edit` tool to update
- **New entity** → `Write` tool to create
- **Ambiguous** → ask user

**Fuzzy matching:** "John", "john smith", "John S." → `People/john-smith.md` if exists.

### Step 3.5: Dedup check (before any new belief/world-fact write)

Before creating a new `Notes/<slug>.md` for a belief or world-fact, check if a similar one already exists:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/append-evidence.js find-similar {brain} <slug> belief
```

Or for world-fact: pass `world-fact` as the type filter.

**If no similar file → proceed to Step 4 (Write new).**

**If a similar file is returned → run the polarity check (Step 3.6) BEFORE appending.**

### Step 3.6: Polarity check (only when Step 3.5 found a similar belief)

Read the existing file (its body + the `evidence:` array). Compare the new claim's stance to the existing belief's stance. There are exactly three outcomes:

1. **Same direction (re-affirms existing belief)** → append as positive evidence:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/append-evidence.js append <filepath> '{"source":"Journal/<TODAY>.md","quote":"<verbatim>","date":"<TODAY>"}'
   ```
   This increments `sources_count`, appends to `evidence:`, updates `updated:`, refuses duplicate sources (idempotent).

2. **Opposite direction (contradicts existing belief)** → append as counter-evidence and log the event:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/append-evidence.js append-counter <filepath> '{"source":"Journal/<TODAY>.md","quote":"<verbatim>","date":"<TODAY>"}'
   node ${CLAUDE_PLUGIN_ROOT}/scripts/evolution-log.js CONTRADICT "<filepath> counter from Journal/<TODAY>.md"
   ```
   The first command appends to `counter_evidence:`, leaves `sources_count` untouched, and **automatically flips `freshness: contradicted`** when counter entries outnumber positive ones. The second writes a `CONTRADICT` line to `~/.local/state/remember/evolution.log` for audit.

3. **Unrelated (different topic, fuzzy match was wrong)** → ignore the find-similar match and create a new file via Step 4.

#### Polarity rules — apply in order, first match wins

- **Explicit negation of the existing claim** (e.g. existing: *"prefer Postgres for small projects"*, new: *"actually SQLite is better for small projects"*) → counter.
- **Reversal of preference** (existing: *"X over Y"*, new: *"Y over X"*) → counter.
- **Same subject, opposite verdict** (existing: *"Redis is overkill for X"*, new: *"Redis is the right call for X"*) → counter.
- **Restatement, paraphrase, or new evidence in the same direction** → positive.
- **Adjacent topic, same domain, neither confirms nor contradicts** → ignore find-similar; create a new note.
- **You are not at least 80% confident the polarity is opposite** → default to positive evidence. Don't guess.

#### Worked examples

- Existing `Notes/pref-postgres.md` (belief, "prefer Postgres for small projects, avoid Redis").
  - New: *"going with Postgres for the dollie project"* → **positive** (same direction, new instance).
  - New: *"actually SQLite is better than Postgres for small projects"* → **counter** (explicit reversal).
  - New: *"Redis works great for the dollie cache layer"* → **ignore** find-similar (different subject — Redis-as-cache vs Postgres-as-DB are not the same belief).

- Existing `Notes/pref-async-comms.md` (belief, "prefer async comms over meetings").
  - New: *"meetings are essential for kickoffs"* → **counter only if existing belief is unconditional**; if the existing belief already excludes kickoffs, treat as **ignore**.
  - New: *"Slack > meetings for status updates"* → **positive** (paraphrase).

If polarity is genuinely ambiguous, default to positive evidence and add a brief note in the chat confirmation so the user can re-route manually. Never guess "counter" — false contradictions corrupt the brain faster than missed ones.

### Step 4: Route & Write

For **existing files** → use `Edit` tool (surgical updates, not rewrites).
For **new files** → use `Write` tool with templates from `reference.md`.

Check REMEMBER.md `## Templates` section for overrides before using defaults.

Use `[[wikilinks]]` everywhere. Link forward; Obsidian handles backlinks.

See `reference.md` for detailed templates and routing tables.

### Step 5: Auto-promote (deterministic, every capture)

After all writes are done, run promote.js once. It is deterministic, fast, and zero LLM cost — so it can run on every capture without any user opt-in. This keeps `Persona.md ## Top Beliefs` in sync with the brain in real time.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/promote.js
```

The script no-ops if nothing crossed the threshold. If something promoted or demoted, surface the delta in Step 6.

### Step 6: Confirm

```
✅ Brain updated:
  - Updated People/john-smith.md (+interaction)
  - Created Notes/decision-nextjs.md
  - Updated Tasks/tasks.md (+1 Focus)
  - Updated Journal/2026-02-15.md (+1 section)
  - Notes/pref-postgres.md (+counter_evidence — freshness flipped to contradicted)
  - Persona.md ## Top Beliefs: +1 promoted ([[Notes/pref-async-comms.md]])
```

If a polarity decision was non-obvious (close call between positive and counter), say so in the confirmation so the user can correct it before the next capture.

If the auto-promote step skipped writing (e.g. `auto_promote: false` in user's config, or no Persona.md), don't bother mentioning it — silent no-op is the right UX.

---

## Content Routing

| Content | Destination |
|---------|-------------|
| Person interaction | `People/{name}.md` |
| Task with deadline | `Tasks/tasks.md` (Focus) |
| Task without deadline | `Tasks/tasks.md` (Next Up) |
| Future/roadmap task | `Projects/{name}/{name}.md` |
| Project update | `Projects/{name}/{name}.md` |
| Decision (project-scoped) | `Projects/{name}/decisions/YYYY-MM-DD-{topic}.md` |
| Decision (cross-project) | `Notes/decision-{topic}.md` |
| **Project-specific learning** (architecture, internals, gotchas of one project) | `Projects/{name}/notes/{topic}.md` |
| **Cross-cutting / general learning** (applies to many projects or generic) | `Notes/{topic}.md` |
| Area update | `Areas/{area}.md` |
| URL/resource | `Resources/{type}/{title}.md` |
| Unclear | `Inbox/{topic}.md` |

**Rule of thumb for technical notes:** if the title makes sense only when you know which project it's about (e.g. "stratus5-container-architecture" → makes sense only inside `staxwp`), it belongs in `Projects/{name}/notes/`. If the title stands alone as generic developer knowledge ("n8n-workflow-patterns", "cloudflare-bypass-curl-cffi"), it belongs in `Notes/`.

## File Naming

- Folders: `kebab-case/`
- Files: `kebab-case.md`
- People: `firstname.md` or `firstname-lastname.md`
- Dates: `YYYY-MM-DD.md`

## Schema rules

- Every L2 file (Notes/People/Projects/Areas) carries `type:`. Use `Step 2.5` heuristics or `scripts/schema.js detectType()`.
- Every captured fact must include at least one `evidence` entry: `{ source: <real-file-path>, quote: <verbatim>, date: <SESSION_DATE> }`.
- **`source:` MUST be a real file path inside the brain** — typically `Journal/<SESSION_DATE>.md` (the journaled capture from Step 2.4). Never invent paths like `chat/...`, `session/...`, or anything that doesn't exist on disk.
- For `type: belief`, `confidence: 0.0–1.0` is REQUIRED.
- `freshness: stable` is the default for new captures. The `evolve` skill (Phase 2) updates this later.
- Never overwrite L2 files. New positive evidence → `evidence:`. New contradicting claim → `counter_evidence:`. Polarity is decided live in Step 3.6 — don't defer to `/remember:evolve`.

## Validate after write

After every `Write` or `Edit` on a brain file (Notes/, People/, Projects/, Areas/, Journal/, or Persona.md), run the validator:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/schema.js validate <filepath>
```

The output is JSON: `{changed, addedFields, addedSections, warnings}`.

- If `changed: true`, the file was upgraded with missing schema fields/sections — note this in your final report.
- If `warnings` contains items (e.g. *"confidence defaulted to 0.5 — review"*), surface them in your final response so the user can refine the value.
- If `changed: false` and no warnings, your write was already complete — nothing else to do.

Aim to emit complete frontmatter on first write so the validator is a no-op. Skip validation for files outside the brain (Inbox/, Tasks/, Archive/, Templates/) — the validator returns passthrough anyway, but you can save the call.
