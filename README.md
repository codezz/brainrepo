# Remember.md — One Brain. Every AI Tool.

> **Your AI tools have memory. But memory is not a brain.**

Remember.md is a second brain plugin for OpenClaw and Claude Code. It organizes decisions, people, projects, and tasks from your AI sessions — past and future — into a structured, Obsidian-compatible knowledge base that travels with you across tools.

**Free. Local. Open source. Portable.**

---

## Memory vs Brain

Every AI tool now has memory — flat notes you can't search, browse, or take with you. Remember builds something different: a **structured second brain** with people, projects, decisions, and tasks connected via wikilinks.

| | Built-in memory | Remember.md |
|---|---|---|
| **Structure** | Flat key-value pairs | People, Projects, Notes, Tasks, Journal |
| **Connections** | None | `[[wikilinks]]` across all files |
| **Browsable** | No | Obsidian vault with graph view |
| **Portable** | Locked to one tool | One brain, every AI tool |
| **Past sessions** | No | Process months of history retroactively |
| **Your patterns** | No | Persona.md learns your code style |

---

## Install

### OpenClaw

```bash
openclaw plugins install @remember-md/remember
/remember:init
```

### Claude Code

Run these from your **terminal** (not from inside Claude Code):

```bash
claude plugin marketplace add remember-md/marketplace
claude plugin install remember@remember-md
```

Then start Claude Code and run `/remember:init` to create your second brain structure and configure permissions.

> **Important — use the terminal, not the `/plugin` slash command.** An unrelated plugin also named `remember` exists in the default `claude-plugins-official` marketplace. The `/plugin install remember@remember-md` slash command currently ignores the `@remember-md` qualifier and installs the wrong one. The terminal command (`claude plugin install remember@remember-md`) honors the marketplace and installs correctly. If you already got the wrong one, remove it with `claude plugin uninstall remember@claude-plugins-official`.

---

## What You Get

```
~/remember/
├── REMEMBER.md     # Your custom rules (you edit this)
├── Persona.md      # Your patterns + Top Beliefs (AI auto-manages)
├── People/         # One note per person (type: observation)
├── Projects/       # Active work with logs and tasks
├── Notes/          # World-facts, decisions, beliefs (typed)
├── Journal/        # Daily notes (YYYY-MM-DD.md)
├── Tasks/          # Focus + Next Up priorities
├── Areas/          # Ongoing responsibilities
├── Resources/      # Links, articles, references
├── Inbox/          # Quick capture
├── Templates/      # Note templates
└── Archive/        # Completed projects
```

All files use YAML frontmatter + `[[wikilinks]]` — Obsidian-native, browsable in any markdown editor.

Plugin state (audit log, thresholds) lives at `~/.local/state/remember/` — outside the brain, never touched by Obsidian.

---

## Commands

| Command | What it does |
|---------|-------------|
| `/remember:init` | Initialize your second brain structure + auto-configure MCP search (run once) |
| `remember this: ...` | Instant capture — routes to the right place automatically |
| `/remember:ask <question>` | Ask the brain. AI reformulates as an optimal search query, calls the MCP `search_brain` tool, and answers with citations. Requires the `@remember-md/mcp` server (auto-configured by `/remember:init`). |
| `/remember:status` | Show brain stats — file counts, freshness, top beliefs |
| `/remember:process` | Optional. Extract knowledge from past AI sessions into your brain |
| `/remember:evolve` | Periodic (weekly recommended). LLM-driven brain evolution — entity profile synthesis, belief confidence re-scoring, stale detection. Schedule via `/loop 7d /remember:evolve` |

---

## How It Works

### Process old sessions

Run `/remember:process` and recover months of lost knowledge from past OpenClaw and Claude Code sessions:

```
Found 47 unprocessed sessions.

✓ Extracted People/sarah-chen.md
✓ Extracted Notes/decision-database.md
✓ Created 12 journal entries
✓ Updated Tasks/tasks.md (+8 tasks)
✓ Updated Persona.md (learned your patterns)
```

### Instant capture

Say "remember this: met with Sarah, decided to use Postgres for ACID compliance" and Remember routes it:
- Person → `People/sarah.md`
- Decision → `Notes/decision-database.md`
- Task → `Tasks/tasks.md`

### Adaptive Persona

`Persona.md` evolves with you — code style, naming conventions, review preferences, communication patterns. Loaded automatically every OpenClaw and Claude Code session so your AI knows how you work.

### Self-evolving brain

Captured facts aren't static. The brain has three layers and an epistemic schema (`type` / `freshness` / `confidence` / `evidence`) that lets it grow:

- **L1 — Capture** — `Inbox/`, `Journal/`, `Tasks/`. Append-only, raw.
- **L2 — Curate** — `Notes/`, `People/`, `Projects/`, `Areas/`. Each fact is tagged as `world-fact`, `belief`, `observation`, or `experience`, with evidence and a freshness trend.
- **L3 — Pinned** — `Persona.md`. Always loaded; auto-managed top beliefs.

Evolution happens in two layers:

**Always-on (zero effort, runs at capture time):**
- **Auto-promote** runs after every capture — `Persona.md ## Top Beliefs` is always in sync with the strongest beliefs in your brain. Pure deterministic, zero LLM cost.
- **Contradictions** are detected and routed to `counter_evidence:` in real time during capture (Step 3.6 of the `remember` skill). Freshness flips to `contradicted` automatically when counter outweighs supporting evidence.
- **Bootstrap thresholds** make sure your very first explicit capture lands in Persona, even before you accumulate the standard threshold of evidence.

**Periodic (run `/remember:evolve`, weekly recommended):**
- **Consolidate** — re-synthesize People/Project/Area profiles from accumulated mentions. Without this, entity files become log-only and never get the overview that makes them useful.
- **Reflect** — re-score belief confidence based on accumulated evidence vs. counter-evidence; mark beliefs `stale` after `stale_days` (default 90) without new evidence.
- **Promote** — also runs here, usually a no-op because auto-promote already kept Top Beliefs current.

The always-on layer keeps the brain functional from day one. The periodic layer is what makes the brain actually *evolve* over time — refined beliefs, synthesized profiles, retired stale ideas. Skipping `/remember:evolve` indefinitely means the brain accumulates without rephrasing itself.

### Schedule with `/loop` (recommended)

```
/loop 7d /remember:evolve
```

`/loop` is built into Claude Code — no extra plugin or cron daemon needed.

---

## Supported Tools

- **OpenClaw** — full support (plugin + hooks + agent tools)
- **Claude Code** — full support (hooks + skills)
- **Cursor / Codex** — planned

One brain, shared across all tools. Knowledge captured in OpenClaw is available in Claude Code and vice versa.

---

## Customize

The plugin ships with its own `REMEMBER.md` (default rulebook). You customize behavior by adding sections to your own `REMEMBER.md`:

- `~/remember/REMEMBER.md` — your global preferences
- `./REMEMBER.md` — project-specific rules (layers on top, when cwd is in a project)

For each section in your `REMEMBER.md`:

- **Same name as a default** (e.g. `## Routing`) → your content is **appended** to the default.
- **`## Override: <Name>`** → your content **fully replaces** the default for that section.
- **Any other name** → passed through verbatim at the end as a user-defined section.

Available default sections (see plugin's `REMEMBER.md`): `Routing`, `Task Routing`, `Processing`, `Linking`, `Multi-File Updates`, `Format`, `Capture Rules`, `Custom Types`, `Language`, `After Save`.

For full documentation, see [REMEMBER.md Guide](docs/REMEMBER-md-guide.md).

### Runtime config

A few knobs live outside `REMEMBER.md` because they control plugin runtime, not capture routing. Edit `config.defaults.json` (plugin-wide) or pass overrides via `~/.local/state/remember/config.json`:

| Key | Default | What it does |
|---|---|---|
| `session.passive_nudge` | `true` | At session start, ask the AI to detect — semantically, in any language — when you reveal a stable preference, decision, or recurring pattern, and to suggest capture once per topic with `💡 Want me to remember this?`. The AI never auto-saves; you confirm with the next message. Set to `false` to require explicit `remember this:` for every capture. |
| `session.load_persona` | `true` | Inject `Persona.md` at every session start. Disable if you want a clean context. |
| `thresholds.promotion_confidence` | `0.85` | Confidence floor for a belief to pin into `Persona.md ## Top Beliefs`. |
| `thresholds.promotion_sources` | `5` | Independent-source floor for the same. |
| `bootstrap` | `true` | Cold-start mode: while total beliefs < 20, relax thresholds to `conf ≥ 0.7` and `sources ≥ 1` so the very first explicit capture lands in Persona. Set `false` to apply normal thresholds from day one. |

---

## Privacy & Portability

- **Local markdown files** — nothing leaves your machine
- **No cloud, no telemetry, no tracking**
- **Git-friendly** — version control your entire brain
- **No vendor lock-in** — works with Obsidian, Logseq, any editor
- **Portable** — one brain across every AI tool

---

## FAQ

**Q: How is Remember different from OpenClaw memory or Claude MEMORY.md?**
A: Built-in memory stores flat notes locked inside one tool. Remember builds a structured second brain — People, Projects, Decisions, Tasks, Journal — connected via wikilinks and browsable in Obsidian. It processes past sessions retroactively and is portable across AI tools.

**Q: Can it process old sessions?**
A: Yes. Run `/remember:process` to scan past OpenClaw and Claude Code sessions and extract decisions, people, tasks, and insights into your knowledge base. Works on sessions from months ago.

**Q: Can I use it with both OpenClaw and Claude Code?**
A: Yes. Both plugins point to the same brain directory. Knowledge captured in one tool is available in the other.

**Q: Do I need Obsidian?**
A: No, but Obsidian gives the best experience — graph view, backlinks, search. Remember creates Obsidian-native markdown that works in any editor.

**Q: How does it learn my coding patterns?**
A: Persona.md captures your code style, naming conventions, and workflow preferences over time. It's loaded at the start of every session so your AI knows how you work.

**Q: Do I need to run `/remember:evolve` manually?**
A: The deterministic parts (promoting top beliefs, flipping freshness on contradictions) run automatically after every capture — that part is hands-off. But the LLM-driven parts (re-synthesizing People/Project/Area profiles, re-scoring belief confidence, marking stale beliefs) only happen when you run `/remember:evolve`. Recommended cadence is weekly via `/loop 7d /remember:evolve`. Skip it indefinitely and the brain accumulates without ever rephrasing itself — usable, but stagnant.

**Q: What does `/remember:evolve` actually do when I run it?**
A: Three phases. (1) Re-synthesizes entity profiles (People/Projects/Areas) from accumulated mentions. (2) Re-scores belief confidence based on evidence vs counter-evidence and marks freshness (stable/strengthening/weakening/stale/contradicted). (3) Promotes top beliefs into `Persona.md ## Top Beliefs` — usually a no-op because auto-promote already ran at capture time. Configure thresholds in `~/.local/state/remember/config.json` or your `REMEMBER.md`.

**Q: Will the brain overwrite my hand-curated Persona?**
A: No. The plugin only manages `## Top Beliefs` (by reference — wikilinks, not copies). Mission, Directives, and Evidence Log stay in your hands. To turn off auto-promotion entirely: set `auto_promote: false` in `~/.local/state/remember/config.json`.

**Q: Where's the audit trail?**
A: `~/.local/state/remember/evolution.log` — append-only, ISO-timestamped, one line per auto-change. Tail it whenever you want to see what the brain did on its own. Run `/remember:status` to see the latest entries inline.

**Q: How much does it cost?**
A: Free, always. MIT licensed, open source.

---

## Requirements

- **OpenClaw** or **Claude Code** (latest version)
- Node.js (bundled with Claude Code; required for OpenClaw)
- Git (optional, for version control)

## Credits

Built on ideas from:
- [continuous-learning-v2](https://github.com/affaan-m/everything-claude-code/tree/main/skills/continuous-learning-v2) — Hooks architecture
- **PARA Method** (Tiago Forte) — Organization structure
- **Zettelkasten** (Niklas Luhmann) — Linked thinking

## License

MIT — see [LICENSE](LICENSE).

---

**Remember.md — One brain. Every AI tool.** [Star on GitHub](https://github.com/remember-md/remember)
