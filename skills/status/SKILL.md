---
name: remember:status
description: Show Remember Second Brain statistics and status
---

# /remember:status - Remember Status

Displays brain statistics: file counts, recent activity, and brain health.

## Usage

```
/remember:status
```

## ⚠️ MANDATORY: Use Built-in Tools Only (NO Bash!)

**NEVER use Bash commands for brain operations.** Use Claude Code's built-in tools which are auto-approved and require zero permission prompts:

| Operation | ✅ Use This | ❌ NOT This |
|-----------|------------|-------------|
| List files | `LS` tool | `bash ls` |
| Find files | `Glob` tool | `bash find` |
| Search content | `Grep` tool | `bash grep` |
| Read files | `Read` tool | `bash cat` |
| Write/create files | `Write` tool | `bash echo >` / `bash tee` |
| Count files | `Glob` tool + count results | `bash wc` |
| Check env vars | Already available as `$REMEMBER_BRAIN_PATH` | `bash echo $VAR` |

**For complex operations** (stats, counting, multi-step), use a **subagent** (Task tool) that uses the same built-in tools.

**Why:** `additionalDirectories` auto-approves LS/Glob/Grep/Read/Write. Bash always prompts.


## Steps

### 1. Resolve Brain Path

Read `$REMEMBER_BRAIN_PATH` env var, fallback `~/remember`. Use this as `{brain_path}`.
If brain path doesn't exist → tell user to run `/remember:init`.

### 2. Show Brain Statistics

See "What to show" below for the full output template.

### 3. Show Recent Activity

List recently modified files (last 7 days) across People/, Projects/, Journal/, Notes/.

### 4. Show Persona Summary

Read `{brain_path}/Persona.md` and show a brief summary of captured patterns.

### 5. Backup health check

Check if `{brain_path}/.git/` exists (use `LS` tool on `{brain_path}/.git`):

- **Exists** → show `Backup: ✅ git-tracked`. If you want to be helpful, also run `git -C {brain_path} status --porcelain | wc -l` and surface uncommitted-file count if > 0 (e.g. `Backup: ✅ git-tracked · 12 uncommitted files — consider committing`).
- **Missing** → show a warning block at the end of the output:

  ```
  ⚠️  Backup: NOT git-tracked

  Your brain lives at {brain_path} but has no git history. A single bad
  capture or accidental delete could lose months of work.

  Recommended:
    cd {brain_path}
    git init
    git add .
    git commit -m "initial brain snapshot"

  (Optional) push to a private GitHub repo for off-machine backup.
  ```

This is non-blocking — never refuse to show stats just because backup is missing.

## What to show

````
Brain path: {brain}
Counts:
  - {N} Notes
  - {N} People
  - {N} Projects (active: {N})
  - {N} Areas
  - {N} Journal entries (latest: {date})
  - {N} Tasks (Focus: {n}, Next Up: {n})

Schema breakdown (by type):
  - world-fact: {N}
  - belief:    {N}
  - observation: {N}
  - experience: {N}
  - untyped (legacy): {N}

Freshness (L2 files only):
  - stable:        {N}
  - strengthening: {N}
  - weakening:     {N}
  - stale:         {N}
  - contradicted:  {N}

Top 5 beliefs by confidence:
  1. [[Notes/x]]  conf={c}  sources={n}  freshness={f}
  2. ...

Recent evolution.log (last 5 entries):
  {timestamp}  {TYPE}  {message}
  ...

Backup: ✅ git-tracked    (or)    ⚠️  NOT git-tracked — see warning below
````

To produce this:
1. Walk the brain — read frontmatter for each L2 markdown file (use `scripts/config.js parseFrontmatter`).
2. Tally by `type` and `freshness`.
3. Filter `type: belief` files; sort by `confidence` desc; take top 5.
4. Read tail of `~/.local/state/remember/evolution.log` (use `tail -n 5`).

Existing files without `type:` count under "untyped (legacy)" — the upgrade is lazy.

If `~/.local/state/remember/evolution.log` does not exist yet (no `evolve` runs have occurred), show `(none yet)` for the "Recent evolution.log" section or skip it.

## Implementation

Use `LS` and `Glob` tools to read directories and count files. For frontmatter parsing, use `parseFrontmatter` from `scripts/config.js`. For complex stats, use a subagent.

## Notes

- Fast command (uses built-in LS/Glob/Read tools — no Bash needed)
- Can run anytime
- No JSON metadata files required — counts come from the filesystem
