# Changelog

All notable changes to Remember will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.6.0] - 2026-05-25

Adds the `/remember:ask` skill — natural-language Q&A on the brain. Closes the loop on `@remember-md/mcp` v0.1.4: users can now type `/remember:ask <question>` instead of having to know about the MCP `search_brain` tool directly.

### Added

- **`skills/ask/SKILL.md`** — wraps `mcp__remember__search_brain` with query reformulation, multi-call retry, and citation-rich synthesis.
  - Reformulates the user's natural-language question into a 3–7 word topical search phrase that matches how the brain is actually written (English for tech notes, Romanian for personal/strategic).
  - Strips stopwords and question words; keeps nouns + concepts + names.
  - Retries with alternative phrasing (up to 3 search calls total) when the first result is weak (top score < 0.020).
  - Synthesizes an answer in the user's language with `[[wikilink]]` citations using the exact paths returned by the tool.
  - Honest "not found" handling — no hallucination, suggests `remember this: ...` capture if appropriate.
  - Skips the tool call entirely when the question is answered by Persona content already in session context.
- SessionStart hint now includes `/remember:ask` alongside the other commands so the AI knows it's available.
- README Commands table updated to document `/remember:ask`.

### Prerequisite reminder

This skill requires the `@remember-md/mcp` server to be reachable in the MCP client. `/remember:init` (since v2.5.0) auto-configures it; existing installs can run `setup_mcp.js` directly or re-run `/remember:init`. After config, restart the MCP client (Claude Code, Cursor, etc.) so the new server is discovered.

## [2.5.1] - 2026-05-25

Patch: clarify `/remember:init` Step 6 — the brain's `Templates/` folder is exclusively for note-level templates (`note.md`, `person.md`, `project.md`, `daily.md`, `resource.md`). The plugin's `assets/templates/remember.md` is the source for the brain's ROOT `REMEMBER.md` rulebook (handled in Step 4b) and must never be copied into `Templates/`. SKILL.md now spells out the explicit list and an explicit guard so re-runs of init can't drift.

## [2.5.0] - 2026-05-25

Integration release. `/remember:init` now auto-configures the [`@remember-md/mcp`](https://github.com/remember-md/mcp) MCP server so the `search_brain` tool is available across Claude Code, OpenClaw, Cursor, Codex CLI, and any other MCP client — zero manual config required.

### Added — Auto-configure MCP server in `/remember:init`

- **`scripts/setup_mcp.js`** — new helper that patches the appropriate Claude Code MCP config file (user-level `~/.claude.json` or project-level `./.mcp.json`) with a `mcpServers.remember` entry pointing at `npx -y @remember-md/mcp`. Idempotent — re-running with the same args is a no-op. Preserves any existing `mcpServers` entries and unrelated config keys.
- **Auto-scope detection** — brain inside the current working directory → project scope (writes `./.mcp.json` with relative `REMEMBER_BRAIN_PATH`); brain outside → user scope (writes `~/.claude.json` with absolute path). Project-scope relative paths are portable across machines.
- **`skills/init/SKILL.md` Step 8** — new step calls `setup_mcp.js` after structure creation, with an option to skip (and print a copy-pasteable JSON snippet) for users who prefer manual config.
- **`skills/init/reference.md`** — full JSON snippets for user-scope and project-scope MCP entries, plus cross-tool config notes (Cursor, Codex, ChatGPT custom GPTs, Claude.ai web), version pinning, and global install path.
- **`.gitignore` template** — `.remember/` added so users don't accidentally commit the SQLite index that the MCP server keeps inside their brain folder.
- 16 new tests in `tests/setup_mcp.test.js` covering: scope classification, config-path resolution, user/project entry shape, idempotency (no mtime change on re-run), merge with existing config, env update on brain path change, empty/malformed config handling.

### What this unlocks

After `/remember:init` (one-time), every MCP-capable AI tool can call the `search_brain` tool to do hybrid BM25 + vector + 1-hop wikilink retrieval over your markdown brain. Restart Claude Code (or whichever client) after init to discover the new tool.

The MCP server (`@remember-md/mcp`) is shipped via `npx` — no install step, no native compilation, no toolchain. First invocation downloads `Xenova/bge-micro-v2` (~17 MB) in the background; BM25 results are available from query 1 (lexical-first hybrid).

## [2.4.0] - 2026-05-05

UX-first release. Closes the gaps the v2.3 product review surfaced: empty Top Beliefs for new users, false promises in the Persona template, contradictions detected but never routed, and a confusing "you must run cron" mental model.

### Added — Bootstrap thresholds

- **`scripts/schema.js`** exports `BOOTSTRAP_THRESHOLDS` — relaxed thresholds (`promotion_confidence: 0.7`, `promotion_sources: 1`) applied while total beliefs in the brain are below `bootstrap_max_beliefs` (default 20).
- **`scripts/promote.js`** — new `effectiveThresholds(beliefsCount, config)` helper. Bootstrap mode kicks in automatically for cold-start brains so the very first explicit `remember this:` capture lands in `Persona.md ## Top Beliefs`. Bootstrap takes the more permissive of (user config, bootstrap defaults) per field — explicit user overrides are never made stricter. Disable with `bootstrap: false` in `~/.local/state/remember/config.json`.
- Empty placeholder in Persona now states the *current* threshold and brain size (e.g. *"need conf≥0.7 sources≥1 (bootstrap mode). Currently 3 belief(s) in brain."*) so users see why nothing pinned yet.
- 6 new tests, total 83 / 0 fail.

### Added — Auto-promote at capture time

- `skills/remember/SKILL.md` Step 5 + `skills/process/SKILL.md` Step 6 — `promote.js` now runs at the end of every `remember this:` capture and once per `/remember:process` batch. `Persona.md ## Top Beliefs` stays in sync in real time, no cron required for the deterministic layer.
- `/remember:evolve` is now correctly framed as the *periodic* LLM-driven layer (entity profile re-synthesis, belief confidence re-scoring, stale detection) — recommended weekly via `/loop 7d /remember:evolve` for brains that should keep evolving past auto-promote.

### Added — AI-driven passive capture nudge

- `scripts/session_start.js` — when `session.passive_nudge: true` (default), injects a session-start instruction asking the AI to detect — semantically, in any language — moments when the user reveals a stable preference, decision, or recurring pattern, and to suggest capture once per topic. The AI never auto-saves; the user confirms with the next message. Replaces brittle regex-based detection.
- Disable with `passive_nudge: false` in `config.defaults.json` or `REMEMBER.md`.

### Added — Contradiction detection at capture time

- **`scripts/append-evidence.js`** — new `appendCounterEvidence(filepath, entry)` function. Appends to `counter_evidence:`, leaves `sources_count` untouched, and **automatically flips `freshness: contradicted`** when counter entries outnumber positive ones. CLI: `node append-evidence.js append-counter`.
- `skills/remember/SKILL.md` Step 3.6 + `skills/process/SKILL.md` Step 4b.7 — explicit polarity check after dedup. Three branches: same direction (positive evidence), opposite direction (counter + `CONTRADICT` log), unrelated (ignore find-similar). Includes worked examples and explicit "don't guess counter — false contradictions corrupt the brain faster than missed ones" rule.
- 4 new tests for `appendCounterEvidence` (idempotency, freshness flip, missing block init, duplicate source refusal).

### Added — Backup nudge in `/remember:status`

- `skills/status/SKILL.md` Step 5 — checks if `{brain}/.git/` exists. If missing, surfaces a non-blocking warning at the end of stats output suggesting `git init && git commit`. If present, shows `Backup: ✅ git-tracked` (with uncommitted-file count when relevant).

### Removed — Persona Disposition section

- Disposition was claimed in the template to be *"auto-managed by `/remember:evolve` Phase 2"* but no codepath ever wrote to it. Removed from the init template, `PERSONA_SECTIONS` constant, and the schema-upgrade placeholders. Existing user Personas with a `## Disposition` section are preserved untouched (`validateAndUpgrade` is non-destructive on legacy sections).
- Persona now ships with four canonical sections: Mission, Directives, Top Beliefs, Evidence Log.

### Changed — keyword set is now English-only by default

- `config.defaults.json` brain-dump keywords reduced to English: `save this`, `remember this`, `brain dump`, `note to self`, `capture this`, `save to brain`, `write to brain`, `add to brain`. The AI nudge replaces hardcoded multilingual keyword detection (e.g. Romanian `salvează`, `notează`, `reține`). Users wanting their language as a hard keyword can append it via `## Override: Capture Rules` in their `REMEMBER.md`.
- `scripts/config.js` fallback synced to match.

### Changed — README

- Commands table re-ordered: `init` first, `remember this:` second, `status` third. `process` and `evolve` clearly marked as their cadence (one-off, periodic).
- Self-evolving brain section split into "Always-on (zero effort)" + "Periodic (run `/remember:evolve`)" with concrete consequences of skipping the periodic layer.
- New runtime config table documenting `passive_nudge`, `load_persona`, `bootstrap`, and the promotion thresholds.
- FAQ honest about the always-on / periodic split.

### Changed — Default rulebook moved to plugin-root `REMEMBER.md` (was `assets/templates/brain-dump-context.md`)

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

## [2.3.0] - 2026-05-05

Dedup + OpenClaw parity. Same-day patches that move v2.2.x from "schema is in place" to "schema actually grows over time."

### Added — Dedup

- **`scripts/append-evidence.js`** — `appendEvidence(filepath, entry)` and `findSimilarBelief(brain, slug)`. When a similar belief or world-fact already exists, the skill appends evidence to it (incrementing `sources_count`, updating `updated:`, refusing duplicate sources) instead of creating a new file. Closes the gap that prevented Top Beliefs from ever being promoted: every capture before this PR landed at `sources_count: 1`.
- CLI: `node scripts/append-evidence.js append|find-similar`.
- 7 new tests, total now 71 / 0 fail.

### Added — Skill instructions

- `remember/SKILL.md` Step 3.5: Dedup check before any new belief/world-fact write.
- `process/SKILL.md` Step 4b.6: Same.

### Added — OpenClaw agent tools

`index.js` registers four new tools alongside the existing `remember_brain_dump_context` and `remember_brain_index`:

- `remember_promote` — runs evolve Phase 3 deterministically (no LLM cost). Cron-safe.
- `remember_validate` — runs `validateAndUpgrade` on a single file. Useful when an agent writes outside standard skill paths.
- `remember_append_evidence` — dedup-aware append with `source` / `quote` / `date` params.
- `remember_find_similar_belief` — returns the absolute path of an existing similar file or `(none)`.

OpenClaw's `session_start` hint now mentions `/remember:evolve` alongside the existing commands.

### Docs

- `docs/MIGRATING.md` — full migration guide for v2.0.x and v2.1.x users (Path A lazy / Path B `/remember:process` / Path C one-shot backfill script).

## [2.2.2] - 2026-05-05

Drop the `PostToolUse` hook from v2.2.1 — after deployment we judged it added complexity without unique coverage. Skills already write through `Write`/`Edit`, so calling the validator explicitly from the skill prompt is simpler, more visible, and easier to debug.

### Removed

- `scripts/post_write.js` (was the hook handler).
- `PostToolUse` matcher in `hooks/hooks.json`.

### Changed

- `remember`, `process`, `evolve` skills now have an explicit "validate after write" step: `node ${CLAUDE_PLUGIN_ROOT}/scripts/schema.js validate <path>` after every brain Write/Edit. Output JSON `{changed, addedFields, addedSections, warnings}` is surfaced to the user when warnings exist.

### Kept

- `validateAndUpgrade()` and `inferExpectedSchema()` in `scripts/schema.js` — the validator library is still useful as both a callable from skills and a CLI utility.
- All 64 tests still pass (validator coverage unchanged).

### Why

Hook ran only on Claude-Code-driven `Write`/`Edit`, not on Obsidian/git/external edits — same coverage as a skill-driven call, with extra invisible plumbing. Pragmatic over perfect.

## [2.2.1] - 2026-05-05

Self-healing schema. Every brain file write now passes through a validator that adds missing schema fields and Persona sections automatically.

### Added

- **`scripts/schema.js validateAndUpgrade(filepath, opts)`** — reads a brain file, infers expected schema from its path, back-fills missing frontmatter fields (or Persona sections), writes if changed. Returns `{changed, addedFields, addedSections, warnings}`. Idempotent.
- **`scripts/schema.js inferExpectedSchema(filepath, opts)`** — pure helper mapping path → expected shape. Powers the validator.
- **`scripts/post_write.js`** — `PostToolUse` hook handler invoked by Claude Code after every `Write` / `Edit`. Calls `validateAndUpgrade` if the file is inside `$REMEMBER_BRAIN_PATH`; outside the brain it's a silent no-op. Surfaces additions and warnings as `additionalContext`.
- **`hooks/hooks.json`** — new `PostToolUse` matcher on `Write|Edit` registering the post-write handler. 5s timeout.
- **CLI:** `node scripts/schema.js validate <path>` for ad-hoc invocation.
- 19 new tests in `tests/schema-validate-upgrade.test.js`. Total now 64 / 0 fail.

### Schema rules per path

| Path | Expected | Defaults added |
|---|---|---|
| `Notes/<x>.md` | `world-fact` (or `belief` if explicit) | `type`, `freshness=stable`, `sources_count=1` |
| `Notes/<x>.md` with `type: belief` and no `confidence` | — | `confidence=0.5` + warning to user for review |
| `People/<x>.md` | `observation` | `type`, `last_consolidated`, `sources_count`, `freshness` |
| `Areas/<x>.md` | `observation` | same as People |
| `Projects/<x>/<x>.md` | `observation` | same as People |
| `Projects/<x>/decisions/*.md`, `meetings/*.md` | `world-fact` | `type`, `freshness`, `sources_count` |
| `Journal/<YYYY-MM-DD>.md` | `experience` | `type` |
| `Persona.md` | required sections present | empty placeholders for `Mission`, `Directives`, `Disposition`, `Top Beliefs`, `Evidence Log` |
| `Inbox/`, `Tasks/`, anything else | passthrough | — |

### Skills updated

- `remember`, `process`, `evolve` — `## Schema rules` / equivalent sections now reference the post-write hook so the LLM knows the safety net is in place and surfaces hook warnings to the user.

### Why

User raised the principle: every file update should self-verify schema/sections rather than relying on manual one-shot migrations. Now lives in code: the migration script that backfilled 132 legacy files (commit `04b9c2f` in second-brain) is the last hand-rolled migration — future schema additions become lazy upgrades on touch.

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
