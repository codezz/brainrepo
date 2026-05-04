---
name: remember:digest
description: Generate a weekly or monthly summary of brain evolution into Journal/digests/
---

# /remember:digest — Brain Evolution Summary

Reads `~/.local/state/remember/evolution.log`, aggregates auto-changes since the last digest, and writes a structured markdown summary to `Journal/digests/<label>.md`.

Pure read + aggregate — does NOT modify any belief / observation files. Cron-able alongside `/remember:evolve`.

---

## Modes

| Flag | Range | Output filename |
|---|---|---|
| (default) `--week` | Current ISO week (Monday 00:00 UTC → next Monday) | `Journal/digests/<YYYY>-W<NN>.md` |
| `--month` | Current calendar month (UTC) | `Journal/digests/<YYYY>-<MM>.md` |
| `--last-week` | Previous ISO week | `Journal/digests/<YYYY>-W<NN>.md` (prior week) |
| `--last-month` | Previous calendar month | `Journal/digests/<YYYY>-<MM>.md` (prior month) |

---

## Step 1: Resolve brain path

1. Read `$REMEMBER_BRAIN_PATH` (fallback `~/remember`). Call this `{brain}`.
2. If `{brain}` doesn't exist → tell user to run `/remember:init` and stop.
3. Ensure `{brain}/Journal/digests/` exists (`mkdir -p` if not).

## Step 2: Compute date range

Use `scripts/digest.js` helpers. Default to current ISO week:

```bash
node -e "const d = require('${CLAUDE_PLUGIN_ROOT}/scripts/digest'); const {start, end} = d.weekRange(new Date()); console.log(JSON.stringify({start, end, label: d.isoWeekLabel(start)}));"
```

For `--last-week`, subtract 7 days from today before calling `weekRange`. For month modes, build `start = first day of that month`, `end = first day of next month`, label = `YYYY-MM`.

## Step 3: Run the digest

Easiest path is to invoke the script's CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/digest.js [--month]
```

This prints the rendered markdown to stdout. Capture and write to `{brain}/Journal/digests/<label>.md`:

```bash
LABEL=$(...)  # from Step 2
node ${CLAUDE_PLUGIN_ROOT}/scripts/digest.js > "{brain}/Journal/digests/${LABEL}.md"
```

If a digest for this label already exists, **overwrite** it. The digest is regenerated from the log every time it runs — there's no incremental state.

## Step 4: Surface "review needed" items to the user

After writing the file, scan the summary for items that need human attention and surface them in the chat response (NOT in the digest file itself):

- **Contradicted** beliefs — the user may want to delete or rewrite
- **Demoted** beliefs — flag what dropped out of Top Beliefs and why
- **Stale** beliefs older than 90 days — candidates for archive
- **No-change weeks** — suggest more captures or a `/remember:process` run

Example chat response:

```
📊 Wrote Journal/digests/2026-W19.md.

Highlights:
  ✅ 3 beliefs promoted to Persona Top
  ⚠️  1 belief contradicted — review [[Notes/x.md]]
  ⚠️  2 entities consolidated (Cezar, Dollie)

Tail of audit log: ~/.local/state/remember/evolution.log
```

If the digest is empty (no entries in range), surface that too — suggest more captures.

## Step 5: Commit (optional)

If the brain is git-tracked, suggest the user commit the digest:

```
Suggestion: git add Journal/digests/ && git commit -m "digest: 2026-W19"
```

DO NOT commit automatically — the user owns commit decisions.

---

## Cron pattern

Recommended cadence:

```
/loop 7d /remember:evolve
/loop 7d /remember:digest
```

Run `evolve` first (so the log captures the week's changes), then `digest` to summarize. If you want them stitched: `/loop 7d "/remember:evolve && /remember:digest"`.

For monthly digests:

```
/loop 30d /remember:digest --last-month
```

(`--last-month` so you summarize the month that just ended, not the partial current month.)

---

## Error handling

- Missing `evolution.log` → write a digest with `_No changes — log file not yet created._`
- Empty range → still write the file, with `_No changes this week_` body. Useful for "nothing happened" weeks (legitimate signal).
- Malformed log lines → silently skipped by `parseLog`; not surfaced in the digest.
- Disk full / write fail → report the error to the user, leave any partial file as-is, do not retry automatically.

---

## What this skill does NOT do

- Does NOT modify beliefs, observations, evidence, or `Persona.md`. Read-only.
- Does NOT trigger consolidation/reflection/promotion. Run `/remember:evolve` for that.
- Does NOT email / notify externally. Output is local markdown only.
