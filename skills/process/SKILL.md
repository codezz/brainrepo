---
name: remember:process
description: Process unprocessed Claude Code sessions into your Second Brain
---

# /remember:process — Process Sessions into Second Brain

Reads unprocessed Claude Code transcripts and routes valuable content into your Second Brain using a knowledge-aware pipeline.

Only use Bash for running Node.js scripts. Use Read/Write/Edit/Glob/Grep for all file operations.

---

## Core Principles

1. **Chronology:** `session_date < file_last_modified` → OLD SESSION (append only, no replace, no frontmatter update). Otherwise → normal update.
2. **Knowledge Index:** Built in Step 1. Use throughout to resolve entities, link with `[[wikilinks]]`, prevent duplicates.
3. **REMEMBER.md overrides:** User instructions take precedence over default routing.

---

## Step 1: Build Knowledge Index

1. Read `$REMEMBER_BRAIN_PATH` env var (fallback `~/remember`). Call this `{brain}`.
2. If missing → tell user to run `/remember:init` and stop.
3. Run: `node ${CLAUDE_PLUGIN_ROOT}/scripts/build-index.js`
4. Read output — this is your map of everything that exists.

## Step 1b: Load User Instructions

Read REMEMBER.md (cascading): `{brain}/REMEMBER.md` (global) + `{project_root}/REMEMBER.md` (project, if exists). These override default routing, capture rules, templates, and custom types.

## Step 1c: Batch Chronology Map

Run once to get last-modified dates for all brain files:
```bash
cd {brain} && git log --format="%ai" --name-only --diff-filter=ACMR HEAD | paste - - | sort -k2 -u
```

Parse into a lookup map: `file_path → last_modified_date`. Use this in Step 4c instead of per-file git log calls.

## Step 2: Find Unprocessed Sessions

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/extract.js --unprocessed
```

Optional filters: `--project <name>`, `--source openclaw|claude-code`.

Show the list. Ask user which to process: **All**, **specific sessions by number**, or **Skip**.

## Step 3: Extract Each Session

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/extract.js <file_path>
```

Use the `**Session date (use for journal/tasks):**` line as SESSION_DATE for everything. Never use today's date.

## Step 4: Process Each Session

Read `@reference.md` for routing tables, templates, and classification rules.

### 4a. Build Resolution Map

Resolve every name, project, topic against the knowledge index. Fuzzy match: "John", "john smith", "John S." → `People/john-smith.md`.

### 4b. Classify Content

Apply REMEMBER.md rules first (Always/Never/Routing overrides/Custom Types), then fall through to default classification in `reference.md`. Skip: routine code generation, debugging noise, tool call chatter.

### 4b.5: Tag with epistemic type

Once classified to a folder/file by `4b`, also tag with one of: `world-fact`, `belief`, `observation`, `experience`.

Apply the same heuristics as the `remember` skill (or call `scripts/schema.js detectType` for the same logic):

1. Contains a date or "met with" / "called" → **experience** (Journal entry)
2. "we decided" / "going with" / "chose X over Y" → **world-fact**
3. Predicate about an entity ("works as", "lives in", "based in", "leads the team") → **observation** (People/Project/Area file)
4. "prefers" / "probably" / "I think" / "seems like" / "better to" → **belief**
5. Else default → **world-fact**

This skill MUST emit `type:` in the frontmatter of every newly created L2 file. For beliefs, `confidence` is REQUIRED. For all L2 files, include at least one `evidence` entry (source + quote + SESSION_DATE).

This skill does NOT trigger consolidation, reflection, or promotion. Those are the responsibility of `/remember:evolve` (Phase 2).

### 4c. Update Existing Files (Edit Tool)

Use `Edit` for surgical updates. Do NOT rewrite whole files.

**Chronology check:** Look up the file in the batch chronology map (Step 1c).
- `session_date < file_last_modified` → **OLD SESSION:** append only, insert chronologically in logs, don't replace sections, don't update frontmatter
- Otherwise → **NEW SESSION:** normal Edit, update frontmatter `updated:` field

See `reference.md` for per-type update patterns and chronology examples.

**When in doubt:** Append. Duplicate context is better than lost information.

### 4d. Create New Files (Write Tool)

Check REMEMBER.md `## Templates` first, then fall back to `reference.md` templates. Use `[[wikilinks]]` everywhere.

### 4e. Update Persona.md

Analyze session for: user corrections, stated preferences, repeated workflows, communication style, decision criteria, code style. Read current Persona.md first. Add evidence with `[{SESSION_DATE}]` prefix. Skip if no clear patterns.

## Step 5: Mark Processed & Report

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/extract.js --source <source> --mark-processed <session_id>
```

Report: list created files, updated files (note if append-only), skipped files, session dates, remaining unprocessed count. See `reference.md` for report template.

## Error Handling

- Script fails → show error, skip session, continue
- File write fails → warn, continue
- No unprocessed → tell user, suggest "remember this:"
- web_fetch fails → minimal resource note, flag for review
