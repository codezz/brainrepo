# 🧠 BrainRepo

**Your personal knowledge repository — capture, organize, and retrieve everything.**

An AI skill for managing a Second Brain using PARA + Zettelkasten. Just markdown files in a Git repo. Works with Claude Code, OpenClaw, Obsidian, or any AI agent.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made for Obsidian](https://img.shields.io/badge/Made%20for-Obsidian-7C3AED)](https://obsidian.md)
[![AI Ready](https://img.shields.io/badge/AI-Ready-00D4AA)](https://github.com/codezz/brainrepo)

## ✨ Features

- **📥 Quick Capture** — Dump thoughts instantly, organize later
- **📁 PARA Structure** — Projects, Areas, Notes, Resources, Archive
- **🔗 Zettelkasten Links** — Connect ideas with `[[wiki-links]]`
- **👥 People Tracking** — One note per person, track relationships
- **📅 Daily Journal** — Automatic date-based notes
- **✅ Task Management** — Centralized tasks linked to projects
- **🤖 AI-Native** — Works with Claude Code, OpenClaw, Cursor, ChatGPT
- **📱 Multi-Platform** — Obsidian, VS Code, any markdown editor
- **🔒 Privacy-First** — Your files, your repo, your control

## 🚀 Quick Start

### 1. Install the Skill

**Claude Code:**
```bash
git clone https://github.com/codezz/brainrepo.git .claude/skills/brainrepo
```

**OpenClaw:**
```bash
git clone https://github.com/codezz/brainrepo.git ~/.openclaw/workspace/skills/brainrepo
```

### 2. Initialize Your Brain

Tell your AI:
```
"Set up brainrepo"
```

The AI will:
1. Ask where to create your brain (default: `~/Documents/brainrepo/`)
2. Create the folder structure
3. Initialize git (optional)
4. You're ready to go!

### 3. Start Capturing

```
"Save this: [your thought]"
"New project: [project name]"
"Add person: [name]"
```

## 📂 Structure Created

```
your-brain/
├── Inbox/          # 📥 Quick capture (process daily)
├── Projects/       # 🎯 Active work with deadlines
│   └── project-name/
│       └── index.md
├── Areas/          # 🔄 Ongoing responsibilities
│   ├── personal-growth/
│   └── family/
├── Notes/          # 💡 Permanent atomic knowledge
├── Resources/      # 📚 External links & references
├── Journal/        # 📅 Daily notes (YYYY-MM-DD.md)
├── People/         # 👥 One note per person
├── Tasks/          # ✅ Centralized task tracking
│   └── index.md
└── Archive/        # 📦 Completed projects
```

## 💡 How It Works

### 1. Capture (Anytime)
Don't think, just dump:
```
"Save this: Had an idea about improving onboarding flow"
```

### 2. Process (Evening, 5-10 min)
Move each Inbox item to its permanent home:
- Idea about a project? → `Projects/`
- Reusable knowledge? → `Notes/`
- About a person? → `People/`

### 3. Retrieve (Anytime)
```
"What do I know about [topic]?"
"Find notes related to [project]"
```

## 🤖 Commands

| Command | Action |
|---------|--------|
| "Set up brainrepo" | Initialize structure |
| "Save this: [text]" | Quick capture to Inbox |
| "New project: [name]" | Create project folder |
| "Add person: [name]" | Create person note |
| "Daily review" | Process Inbox, update Journal |
| "Weekly review" | Full system review |
| "What do I know about X?" | Search & retrieve |

## 📱 Use With

| Tool | How |
|------|-----|
| **Obsidian** | Open your brain folder as vault |
| **VS Code** | Open folder, use Markdown Preview |
| **Mobile** | Sync via iCloud/Dropbox + Obsidian Mobile |

## 📖 Documentation

- [SKILL.md](SKILL.md) — Full skill documentation
- [references/structure.md](references/structure.md) — Detailed folder guide
- [references/workflows.md](references/workflows.md) — Daily/weekly workflows
- [assets/templates/](assets/templates/) — Note templates

## 📄 License

MIT License — use it however you want.

## 🙏 Inspired By

- [PARA Method](https://fortelabs.com/blog/para/) by Tiago Forte
- [Zettelkasten](https://zettelkasten.de/) method
- [Building a Second Brain](https://www.buildingasecondbrain.com/)

---

**Made with 🧠 by [codezz](https://github.com/codezz)**

*Star ⭐ this repo if it helps you think better!*
