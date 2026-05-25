# Init Skill — Reference

Templates and merge rules for `/remember:init`.

---

## Settings Merge Rules

- `env`: add/update `REMEMBER_BRAIN_PATH` key, keep other env vars
- `permissions.additionalDirectories`: append brain path if not present, keep existing
- `permissions.allow`: append rules if not present, keep existing
- All other keys: preserve unchanged

Write merged JSON back to settings file.

---

## Persona.md Template

```markdown
---
created: {{date}}
updated: {{date}}
tags: [persona, system]
---

# Persona

Loaded at every session start. Updated by the Remember plugin's evolution skills.

---

## Mission

- **Name:** {{name}}
- **Timezone:** {{timezone}}
- **Languages:** {{languages}}
- **Role:** _to be filled in_

## Directives

- _Hard rules and explicit preferences. Edit by hand. The plugin never overwrites this section._

## Top Beliefs

- _Auto-managed by promote.js (runs after every capture). Empty until your first explicit `remember this:` lands a belief that meets the threshold._

## Evidence Log

- _Append-only behavioural evidence with `[{date}]` prefix._
```

---

## Tasks File Template

```markdown
---
created: {{date}}
tags: [tasks, overview]
---

# Tasks Overview

Central hub for all tasks.
```

---

## Project Template (Templates/project.md)

```markdown
---
created: {{date}}
status: active
tags: [project]
related: []
---

# {{name}}

## Overview

## Goals
- [ ] Goal 1

## Log
### {{date}}
- Created project
```

---

## Person Template (Templates/person.md)

```markdown
---
created: {{date}}
tags: [person]
---

# {{name}}

## Who
- **Role:**
- **Relationship:**

## Interactions

### {{date}}
- [First interaction]
```

---

## .gitignore Template

```
.DS_Store
.tmp/
.remember/
```

The `.remember/` line is important — that's where `@remember-md/mcp` keeps its derived index (`.remember/index.db`). It must stay out of git: it's machine-specific and fully rebuildable from the markdown source.

---

## MCP Server Setup

### Auto-detection rule

```
function classifyScope(brainPath, cwd):
  if brainPath is inside cwd → 'project'
  else                       → 'user'
```

Use `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup_mcp.js` to patch the config — it handles JSON merge, idempotency, and writes the right relative/absolute path based on scope.

### User-scope (~/.claude.json) snippet

```json
{
  "mcpServers": {
    "remember": {
      "command": "npx",
      "args": ["-y", "@remember-md/mcp"],
      "env": {
        "REMEMBER_BRAIN_PATH": "/Users/gabi/second-brain"
      }
    }
  }
}
```

### Project-scope (.mcp.json in project root) snippet

```json
{
  "mcpServers": {
    "remember": {
      "command": "npx",
      "args": ["-y", "@remember-md/mcp"],
      "env": {
        "REMEMBER_BRAIN_PATH": "./project-brain"
      }
    }
  }
}
```

Project-scope paths are stored relative to the project root for portability — when another teammate (or your other machine) checks out the project, the relative path resolves correctly regardless of absolute filesystem location.

### Cross-tool config

The same `mcpServers.remember` entry works in:
- `~/.claude.json` — Claude Code user level
- `.mcp.json` at project root — Claude Code project level (overrides user level for that project)
- `.cursor/mcp.json` — Cursor IDE
- Any other MCP-capable client (Codex CLI, ChatGPT custom GPTs, Claude.ai web via MCP bridge, etc.)

### Pinning a version

For reproducibility, pin the version explicitly:

```json
"args": ["-y", "@remember-md/mcp@0.1.0"]
```

Without the version, `npx` resolves to the `latest` dist-tag.

### Disabling auto-update

The MCP server is updated transparently — `npx -y` always uses cached or latest. To stay on a fixed version across upgrades, either pin (above) or install globally:

```bash
npm install -g @remember-md/mcp
# then change config to:
"command": "remember-mcp",
"args": []
```
