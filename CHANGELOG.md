# Changelog

All notable changes to Remember will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Default rulebook moved to plugin-root `REMEMBER.md`** (was `assets/templates/brain-dump-context.md`).
  - Plugin defaults and user customizations now share the same section format (`## Section Name`).
  - User `REMEMBER.md` sections with the same name as a default are **appended** to the default.
  - User sections named `## Override: <Name>` **fully replace** the matching default.
  - User sections that don't match any default are passed through verbatim at the end.
  - Removed hardcoded section whitelist — any section in user's `REMEMBER.md` reaches the LLM now.

- **Default routing updated to per-project KB layout:**
  - Decisions → `Projects/<project>/decisions/YYYY-MM-DD-<topic>.md` (was `Notes/decision-<topic>.md`)
  - Meetings → `Projects/<project>/meetings/YYYY-MM-DD-<who>.md` (new — previously inlined)
  - Project quick captures → `Projects/<project>/inbox.md` (new)
  - Per-project task backlog → `Projects/<project>/tasks.md` (was inlined in `<project>.md`)
  - Sub-projects (`Projects/<x>/projects/<y>/`) bubble KB to the parent with a `[<sub>]` tag.

### Refactored

- Extracted `scripts/build-context.js` — shared module for capture context building.
- `index.js` (OpenClaw) and `scripts/user_prompt.js` (Claude Code) now both call `buildCaptureContext()`. ~70 lines of duplicate logic removed.

### Migration

If you depend on the previous routing (decisions in `Notes/`, all project content in `<project>.md`), add to your `REMEMBER.md`:

```md
## Override: Routing
- Person interaction → People/<name>.md
- Decision → Notes/decision-<topic>.md
- Project work → Projects/<project>/<project>.md
- Daily log → Journal/{{TODAY}}.md
- Area → Areas/<area>.md
- Unclear → Inbox/

## Override: Task Routing
- URGENT → Tasks/tasks.md (## Focus, max 10)
- IMPORTANT → Tasks/tasks.md (## Next Up, max 15)
- PROJECT-SPECIFIC → Projects/<project>/<project>.md (## Tasks)
```

## [2.2.0] - 2026-05-04

Three-Layer Memory release: turns Remember from a capture/process tool into a self-evolving brain. Schema foundation + new `/remember:evolve` skill + deterministic helpers that keep cron costs at zero.

### Added — Schema foundation

- **Epistemic schema** — additive frontmatter on L2 files (`type`, `freshness`, `confidence`, `sources_count`, `evidence[]`, `counter_evidence[]`). Fully backward-compatible; files without these fields keep working.
- **`scripts/schema.js`** — shared constants (`TYPES`, `FRESHNESS`, `DEFAULT_THRESHOLDS`), `detectType(text)` heuristic, `validateFrontmatter(meta)` validator. Single source of truth used by every schema-aware skill.
- **`scripts/evolution-log.js`** — append-only audit log writer at `~/.local/state/remember/evolution.log`.
- **`scripts/config.js`** — new `loadEvolutionConfig()` merging hard defaults with optional `~/.local/state/remember/config.json` (thresholds, `auto_promote`, paths).
- **Persona.md template refresh** — five sections: `## Mission`, `## Directives`, `## Disposition`, `## Top Beliefs`, `## Evidence Log`. Existing Persona.md files are preserved (init now skips when the file already exists).
- **`status` skill upgrade** — shows schema breakdown by type, freshness counts, top-N beliefs by confidence, last 5 evolution.log entries.

### Added — Evolution

- **`/remember:evolve`** — single weekly entry point with three internal phases:
  1. **Consolidate (LLM)** — re-synthesize entity profiles (People/Projects/Areas) from accumulated mentions
  2. **Reflect (LLM)** — re-score belief confidence, update freshness trend, mark contradictions
  3. **Promote (deterministic)** — pin top beliefs into `Persona.md ## Top Beliefs` based on configurable thresholds. Calls `scripts/promote.js`; runs without LLM cost.
  Power flags: `--consolidate-only`, `--reflect-only`, `--promote-only`, `--dry-run`.
- **`scripts/promote.js`** — deterministic Top Beliefs pinning. CLI-ready (`node scripts/promote.js [--dry-run]`) for cron flows that don't want to invoke an LLM. Filters by configurable thresholds, ranks by `confidence × log(sources+1)`, writes wikilinks (never copies). Demotion logged to `evolution.log`.
- **REMEMBER.md `## Promotion Thresholds`** — new default-rulebook section users can override (`promotion_confidence`, `promotion_sources`, `top_beliefs_n`, `stale_days`, `consolidate_touches`, `auto_promote`).

### Cron pattern

Built on Claude Code's `/loop`:

```
/loop 7d /remember:evolve
```

No external scheduler needed. For audit, `tail ~/.local/state/remember/evolution.log` or run `/remember:status`.

### Changed

- `remember` and `process` skills now type-tag every captured fact and emit evidence in frontmatter (uses `scripts/schema.js detectType()` for consistency).
- `process` skill explicitly does NOT auto-trigger consolidation. All evolution lives in `/remember:evolve`.
- `init` skill now skips `Persona.md` if it already exists — never overwrites a customized Persona.

### Tests

- New `node --test` suite (zero new dependencies). `npm test` runs:
  - `tests/schema.test.js` — 21 tests on TYPES/FRESHNESS/DEFAULT_THRESHOLDS/detectType/validateFrontmatter
  - `tests/evolution-log.test.js` — 4 tests on the audit logger
  - `tests/config.test.js` — 3 tests on `loadEvolutionConfig`
  - `tests/promote.test.js` — 17 tests on `scripts/promote.js`
- Total: 45 tests, 0 fail.

### Migration

- Existing brains keep working. Files without epistemic frontmatter count under "untyped (legacy)" in `/remember:status` and are upgraded lazily as the `remember`/`process` skills touch them.
- Existing Persona.md files are preserved. To opt into the new sections, hand-edit or delete-and-rerun `/remember:init`.
- To disable auto-promotion: set `"auto_promote": false` in `~/.local/state/remember/config.json`.

## [2.0.6] - 2026-02-20

### Added

- **Simple chronology check for old sessions** — Prevents data loss when processing backlog
  - `IF session_date < file_last_modified → append context`
  - `ELSE → normal update`
  - Old sessions append missing context (don't replace existing)
  - New sessions update normally (can replace/restructure)
  - Works for: old backlog, multi-source overlap (Claude Code + OpenClaw), re-processing

### Changed

- **Simplified anti-conflict logic** — Removed complex mode selection, deduplication checks
  - Clear IF/ELSE rule based on chronology
  - "When in doubt: append" principle
  - No content checking, no duplicate detection — just simple chronology
  - Clearer examples (old session appending after newer session processed)

## [2.0.4] - 2026-02-20

### Fixed

- Skill name fixes for openclaw.

## [2.0.3] - 2026-02-20

### Fixed

- **Plugin config reading** — Plugin now reads `brainPath` from OpenClaw plugin config (`api.pluginConfig`)
- **Config validation error** — Resolved issue where `brainPath` in configSchema was declared but never read
- Fallback chain: pluginConfig.brainPath → `REMEMBER_BRAIN_PATH` env var → default `~/remember`
- Existing scripts work unchanged (env var set automatically from config)

## [2.0.0] - 2026-02-20

### Breaking Changes

- **OpenClaw native plugin** — Migrated from hybrid Claude Code/OpenClaw plugin to pure OpenClaw plugin architecture
- Requires OpenClaw 2026.2.17+ for proper plugin object pattern support

### Fixed

- **Plugin export pattern** — Changed from bare function export to plugin object with `id`, `name`, `description`, `version`, `configSchema`, and `register(api)` method (OpenClaw best practice)
- **Hook registration** — Replaced non-existent `registerPluginHooksFromDir()` with `api.on('session_start', ...)` for Persona.md injection
- Persona injection now properly registered via OpenClaw lifecycle hooks API
- Removed SDK compatibility warning on plugin load

### Changed

- **Persona injection** — Inlined `truncateEvidence()` logic directly into session_start hook (removed dependency on `openclaw-hooks/` directory structure)
- Tools (`remember_brain_dump_context`, `remember_brain_index`) now registered via `api.registerTool()` instead of standalone exports

### Added

- **npm package metadata** — Added keywords, author, files whitelist, publishConfig for npm publishing
- `.npmignore` — Excludes development files, assets, Python cache from npm package
- `openclaw.type: "plugin"` field in package.json for OpenClaw plugin registry

### Removed

- `openclaw-hooks/` directory logic (inlined into index.js)
- Python cache files (`__pycache__/`)

## [1.6.0] - 2026-02-16

### Added

- **Cascading REMEMBER.md support** — two levels of customization:
  - **Global:** `{brain}/REMEMBER.md` — user's universal preferences (existing behavior)
  - **Project:** `{project_root}/REMEMBER.md` — project-specific additions that layer on top
- Project sections **append** to global sections (not replace). If both have `## Capture Rules`, content is concatenated.
- `scripts/user_prompt.sh` now loads and merges both global and project REMEMBER.md files
- `skills/process/SKILL.md`, `skills/remember/SKILL.md`, `skills/init/SKILL.md` updated with cascading instructions
- New "Cascading: Global + Project" section in `docs/REMEMBER-md-guide.md` with full explanation and examples
- FAQ updated: project-specific REMEMBER.md is now supported

## [1.5.1] - 2026-02-16

### Changed

- **Skills refactored for Claude Code best practices:**
  - Progressive disclosure: split SKILL.md into concise instructions + reference.md (935→465 lines, -50%)
  - Skill names fixed: `brain:init`→`init`, `brain:process`→`process`, `brain:status`→`status` (colons invalid per spec, avoids double-namespace)
  - Commands: `/remember:init`, `/remember:process`, `/remember:status`
  - Removed invalid `user-invocable` frontmatter (not in official spec)
  - Shortened `remember` skill description to single line

### Removed

- **`brain-session` skill** — redundant with `session_start.sh` hook (same functionality)

### Fixed

- `config.defaults.json` version mismatch
- Missing CHANGELOG release links for v1.4.6 and v1.5.0

## [1.5.0] - 2026-02-16

### Added

- **REMEMBER.md** — User-editable instructions file for customizing brain behavior
  - `## Capture Rules` — define what to always/never capture, thresholds
  - `## Processing` — routing overrides, output style, tagging rules
  - `## Custom Types` — define entity types beyond standard PARA
  - `## Connections` — auto-linking rules and people context
  - `## Language` — multilingual capture/processing preferences
  - `## Templates` — override default note templates
  - `## Notes` — free-form context and preferences
- `/brain:init` now creates a starter `REMEMBER.md` with empty sections (Step 4b)
- Brain dump hook (`user_prompt.sh`) injects relevant REMEMBER.md sections as user overrides after default routing instructions
- `/brain:process` reads REMEMBER.md for routing, template, and capture customization (Step 1b)
- Brain dump skill reads REMEMBER.md for capture and processing overrides (Step 1b)
- Starter template at `assets/templates/remember.md`
- Full documentation guide at `docs/REMEMBER-md-guide.md`

### Design Principles

- **Pure Markdown** — no YAML/JSON schema, just headers and prose
- **All sections optional** — empty sections use defaults, zero config works exactly as before
- **Additive** — augments built-in behavior, explicit language needed to override
- **Never auto-modified** — user's file, never touched by `/brain:process` (unlike Persona.md)
- **Precedence:** REMEMBER.md > Built-in Defaults > Persona.md

## [1.4.6] - 2026-02-16

### Added

- **`scripts/build_index.py`** — New knowledge index builder that scans the brain and outputs formatted markdown tables (People, Projects, Areas, Notes, Tasks counts, Journal stats). Supports `--compact` mode for hook injection.
- **Knowledge-aware pipeline** — Both `/brain:process` and brain dump now build a Resolution Map against the knowledge index before writing, preventing duplicates and enabling smart entity linking.
- **Edit-first updates** — Skills now instruct the AI to use the `Edit` tool for surgical updates to existing files instead of rewriting entire files.
- **Pattern detection in Persona** — Enhanced behavioral pattern extraction: user corrections, stated preferences, repeated workflows, communication style, decision criteria, code style.

### Changed

- **`skills/process/SKILL.md`** — Complete rewrite. Now structured as 5 clear steps: (1) build knowledge index, (2) find unprocessed, (3) extract, (4) process with Resolution Map + Edit/Write routing, (5) mark & report. Reduced from ~500 lines of mixed concerns to focused pipeline.
- **`skills/remember/SKILL.md`** — Complete rewrite. Brain dump now runs `build_index.py --compact` first, builds Resolution Map, uses Edit tool for existing files and Write for new ones.
- **`scripts/user_prompt.sh`** — Hook now runs `build_index.py --compact` to inject full knowledge index (not just People/Projects/Areas names) into brain dump context.
- Task and persona detection now uses AI semantic analysis instead of regex patterns (multilingual support built-in)

## [1.0.0] - 2026-02-08

### Major Release: Skill to Plugin Transformation

Complete redesign from OpenClaw skill to Claude Code plugin.

### Added

- `.claude-plugin/plugin.json` — Claude Code plugin metadata
- `hooks/hooks.json` — UserPromptSubmit hook for session context + brain dump routing
- `scripts/user_prompt.sh` — Hook handler: loads Persona on first message, injects routing on brain dump keywords
- `scripts/extract.py` — Session transcript parser: extracts clean content from JSONL files
- `config.json` — Configurable brain path
- `commands/init.md` — `/brain:init` to create brain structure and Persona
- `commands/process.md` — `/brain:process` to route past sessions into brain
- `commands/status.md` — `/brain:status` to show brain file counts
- `skills/brain-session/SKILL.md` — Session context loader (loads Persona + recent context)
- PARA + Zettelkasten directory structure (Projects, People, Areas, Notes, Journal, Tasks, etc.)
- Obsidian-native wikilinks throughout
- Persona.md — behavioral patterns loaded every session, updated during processing

### Changed

- **README.md** — Rewritten for plugin usage
- **marketplace-entry.json** — Updated from skill to plugin

### Kept

- **SKILL.md** — Preserved for direct skill usage
- **LICENSE** — MIT (unchanged)
- **assets/templates/** — Note templates (unchanged)

### Breaking Changes

- Requires Claude Code (hooks needed for automatic context loading)
- Must run `/brain:init` after install

---

## [0.x] - Before 2026-02-08

Legacy versions as OpenClaw skill. See git history for details.

[2.0.0]: https://github.com/remember-md/remember/releases/tag/v2.0.0
[1.6.0]: https://github.com/remember-md/remember/releases/tag/v1.6.0
[1.5.1]: https://github.com/remember-md/remember/releases/tag/v1.5.1
[1.5.0]: https://github.com/remember-md/remember/releases/tag/v1.5.0
[1.4.6]: https://github.com/remember-md/remember/releases/tag/v1.4.6
[1.0.0]: https://github.com/remember-md/remember/releases/tag/v1.0.0
