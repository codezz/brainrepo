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
├── Persona.md      # Your patterns (AI learns this)
├── People/         # One note per person
├── Projects/       # Active work with logs and tasks
├── Notes/          # Decisions, learnings, insights
├── Journal/        # Daily notes (YYYY-MM-DD.md)
├── Tasks/          # Focus + Next Up priorities
├── Areas/          # Ongoing responsibilities
├── Resources/      # Links, articles, references
├── Inbox/          # Quick capture
├── Templates/      # Note templates
└── Archive/        # Completed projects
```

All files use YAML frontmatter + `[[wikilinks]]` — Obsidian-native, browsable in any markdown editor.

---

## Commands

| Command | What it does |
|---------|-------------|
| `/remember:process` | Extract knowledge from past AI sessions into your brain |
| `/remember:status` | Show brain stats — file counts, recent activity |
| `remember this: ...` | Instant capture — routes to the right place automatically |
| `/remember:init` | Initialize your second brain structure |

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

---

## Supported Tools

- **OpenClaw** — full support (plugin + hooks + agent tools)
- **Claude Code** — full support (hooks + skills)
- **Cursor / Codex** — planned

One brain, shared across all tools. Knowledge captured in OpenClaw is available in Claude Code and vice versa.

---

## Customize

**Cascading REMEMBER.md files** control how your brain works:

- `~/remember/REMEMBER.md` — global preferences
- `./REMEMBER.md` — project-specific rules (layers on top)

Sections: Capture Rules, Processing, Custom Types, Connections, Language, Templates.

For full documentation, see [REMEMBER.md Guide](docs/REMEMBER-md-guide.md).

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
