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

### Step 4: Route & Write

For **existing files** → use `Edit` tool (surgical updates, not rewrites).
For **new files** → use `Write` tool with templates from `reference.md`.

Check REMEMBER.md `## Templates` section for overrides before using defaults.

Use `[[wikilinks]]` everywhere. Link forward; Obsidian handles backlinks.

See `reference.md` for detailed templates and routing tables.

### Step 5: Confirm

```
✅ Brain updated:
  - Updated People/john-smith.md (+interaction)
  - Created Notes/decision-nextjs.md
  - Updated Tasks/tasks.md (+1 Focus)
  - Updated Journal/2026-02-15.md (+1 section)
```

---

## Content Routing

| Content | Destination |
|---------|-------------|
| Person interaction | `People/{name}.md` |
| Task with deadline | `Tasks/tasks.md` (Focus) |
| Task without deadline | `Tasks/tasks.md` (Next Up) |
| Future/roadmap task | `Projects/{name}/{name}.md` |
| Project update | `Projects/{name}/{name}.md` |
| Decision | `Notes/decision-{topic}.md` |
| Learning/insight | `Notes/{topic}.md` |
| Area update | `Areas/{area}.md` |
| URL/resource | `Resources/{type}/{title}.md` |
| Unclear | `Inbox/{topic}.md` |

## File Naming

- Folders: `kebab-case/`
- Files: `kebab-case.md`
- People: `firstname.md` or `firstname-lastname.md`
- Dates: `YYYY-MM-DD.md`

## Schema rules

- Every L2 file (Notes/People/Projects/Areas) carries `type:`. Use `Step 2.5` heuristics or `scripts/schema.js detectType()`.
- Every captured fact must include at least one `evidence` entry: `{ source: <where>, quote: <verbatim>, date: <SESSION_DATE> }`.
- For `type: belief`, `confidence: 0.0–1.0` is REQUIRED.
- `freshness: stable` is the default for new captures. The `evolve` skill (Phase 2) updates this later.
- Never overwrite L2 files. Append evidence; if a contradiction emerges, write to `counter_evidence` (the `evolve` skill handles this in Phase 2 — for live capture, just append normally).
