# Migrating to Remember v2.3

> **TL;DR** — The brain stays in markdown. Schema is additive. Existing files keep working until something touches them, then they upgrade lazily. One opt-in command (`/remember:process` on past sessions or a one-shot backfill script) brings legacy content into the new evolution pipeline.

This guide covers upgrading from any v2.0.x or v2.1.x install to **v2.3.0**.

---

## What changed

v2.2.0 introduced the **epistemic schema** — every L2 file (Notes, People, Projects, Areas) now carries `type`, `freshness`, `confidence`, `sources_count`, `evidence[]`, `counter_evidence[]` in frontmatter. The `evolve` skill (v2.2.0) and dedup helper (v2.3.0) need this schema to do useful work.

| Section | Before | After |
|---|---|---|
| `Notes/<x>.md` frontmatter | `created`, `updated`, `tags`, `related` | + `type`, `freshness`, `sources_count`, `evidence`, `counter_evidence` |
| `People/<x>.md`, `Projects/<x>/<x>.md`, `Areas/<x>.md` | flat profile | + `type: observation`, `last_consolidated`, `sources_count`, `freshness` |
| `Journal/<date>.md` | flat | + `type: experience` |
| `Persona.md` | freeform | five canonical sections: `Mission`, `Directives`, `Disposition`, `Top Beliefs`, `Evidence Log` |

**No folder restructuring.** Layout is identical.

---

## Migration paths

Choose one. They are not mutually exclusive — you can mix and match.

### Path A — Lazy, do nothing (recommended for casual users)

Just upgrade the plugin. Existing files keep working. As you capture new content with `remember this:` or process old sessions with `/remember:process`, the new schema starts appearing on touched files.

`/remember:status` will show "untyped (legacy)" counts dropping over time.

You skip evolution-driven Top Beliefs / consolidation until enough beliefs have schema, but nothing breaks.

### Path B — Bulk processing (recommended for active users)

Run `/remember:process` against your past Claude Code / OpenClaw sessions. Every session it processes will create or update L2 files using the new schema. Existing notes referenced in those sessions stay legacy until directly touched.

```
/remember:process
```

Pick a date range or "All". Each newly created file ships with full schema; updates to existing files only add fields they're missing.

### Path C — One-shot deterministic backfill (recommended for advanced users)

If you want every existing file to gain schema immediately (without LLM cost), run a backfill script that infers `type` from path:

```javascript
// save as ~/migrate-brain.js, then run: node ~/migrate-brain.js
const fs = require('node:fs');
const path = require('node:path');

const BRAIN = process.env.REMEMBER_BRAIN_PATH || path.join(require('os').homedir(), 'remember');
const TODAY = new Date().toISOString().slice(0, 10);

function infer(rel) {
  if (rel.startsWith('Journal/') && /^\d{4}-\d{2}-\d{2}\.md$/.test(path.basename(rel))) {
    return { type: 'experience' };
  }
  if (rel.startsWith('People/') || rel.startsWith('Areas/')) {
    return { type: 'observation', last_consolidated: TODAY, sources_count: 1, freshness: 'stable' };
  }
  const projMatch = rel.match(/^Projects\/([^/]+)\/(.+)$/);
  if (projMatch) {
    if (projMatch[2] === `${projMatch[1]}.md`) {
      return { type: 'observation', last_consolidated: TODAY, sources_count: 1, freshness: 'stable' };
    }
    if (projMatch[2].startsWith('decisions/') || projMatch[2].startsWith('meetings/')) {
      return { type: 'world-fact', freshness: 'stable', sources_count: 1 };
    }
  }
  if (rel.startsWith('Notes/decision-')) {
    return { type: 'world-fact', freshness: 'stable', sources_count: 1 };
  }
  if (rel.startsWith('Notes/')) {
    return { type: 'world-fact', freshness: 'stable', sources_count: 1 };
  }
  return null;
}

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.md'))
    .map(d => path.join(dir, d.name));
}

function applyFields(file, fields) {
  let text = fs.readFileSync(file, 'utf-8');
  let fm = '', body = text;
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    if (end !== -1) { fm = text.slice(4, end); body = text.slice(end + 4); }
  }
  if (/^type:/m.test(fm)) return false;  // already typed
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  const newFm = fm.trim() ? `${fm}\n${lines.join('\n')}` : lines.join('\n');
  fs.writeFileSync(file, `---\n${newFm}\n---${body.startsWith('\n') ? body : '\n' + body}`, 'utf-8');
  return true;
}

const candidates = [];
for (const sub of ['Notes', 'People', 'Areas', 'Journal']) {
  candidates.push(...listMd(path.join(BRAIN, sub)));
}
const projs = path.join(BRAIN, 'Projects');
if (fs.existsSync(projs)) {
  for (const p of fs.readdirSync(projs, { withFileTypes: true })) {
    if (!p.isDirectory()) continue;
    const main = path.join(projs, p.name, `${p.name}.md`);
    if (fs.existsSync(main)) candidates.push(main);
  }
}

let typed = 0, skipped = 0;
for (const f of candidates) {
  const fields = infer(path.relative(BRAIN, f));
  if (!fields) { skipped++; continue; }
  if (applyFields(f, fields)) typed++; else skipped++;
}
console.log(`Migrated: ${typed} typed / ${skipped} skipped`);
```

Then verify with `/remember:status` — schema breakdown should show real counts instead of 100% untyped.

### Edge cases

| Case | Recommended action |
|---|---|
| `Notes/<x>.md` that is actually a belief (subjective) but the script tagged as `world-fact` | Edit the file — change `type: world-fact` to `type: belief` and add `confidence: 0.7` (or whatever fits). The validator will flag missing `confidence` on next touch. |
| Journal entries that aren't daily logs (e.g. `Journal/2026-Q1-summary.md`) | Stay untyped — the script only matches `YYYY-MM-DD.md`. Edit by hand if you want them included. |
| `Persona.md` with hand-curated sections | The `init` skill skips existing Persona.md to preserve your content. To add the new sections (Mission/Directives/Disposition/Top Beliefs/Evidence Log), run the validator: `node $CLAUDE_PLUGIN_ROOT/scripts/schema.js validate ~/remember/Persona.md`. It appends missing sections at the bottom; reorder by hand if needed. |

---

## Verifying the upgrade

Run `/remember:status` after migration. Expected output includes:

```
Schema breakdown (by type):
  - world-fact:    {N}
  - belief:        {N}
  - observation:   {N}
  - experience:    {N}
  - untyped (legacy): {N}  ← ideally close to 0 after Path C
```

If `untyped (legacy)` is high after Path C, those are files outside the inferable patterns (e.g. `Journal/2026-Q1-summary.md`). Either rename them to fit the pattern or accept they stay untyped.

Then run `/remember:evolve --dry-run` — expect 0 promotions on the first run (sources_count is 1 for all backfilled files; promote needs ≥5 by default). Live captures and reflect cycles will accumulate sources over time.

---

## Rollback

The migration is purely additive — your existing fields are preserved. To roll back, reinstall the previous plugin version:

```
claude plugin uninstall remember@remember-md
claude plugin install remember@remember-md@2.0.6
```

The added frontmatter fields don't break anything; older versions ignore them.

---

## What's next

Once your brain has schema, set up the weekly evolve cycle:

```
/loop 7d /remember:evolve
```

`evolve` will (1) re-synthesize entity profiles in `People/`, `Projects/`, `Areas/`, (2) re-score belief confidence based on accumulated evidence, and (3) pin top beliefs to `Persona.md ## Top Beliefs`. All auto-changes are logged to `~/.local/state/remember/evolution.log` for audit.
