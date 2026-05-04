---
name: remember:init
description: Initialize Remember Second Brain structure and configuration
---

# /remember:init - Initialize Remember

Creates the Second Brain directory structure, Persona file, REMEMBER.md, and configures `REMEMBER_BRAIN_PATH` in Claude settings.

## Steps

### 1. Ask for Path

**Prompt user:**
```
Where should I create your Second Brain?

Default: ~/remember
Custom: Enter a full path (e.g., ~/Documents/my-brain)
```

If user presses Enter → use default `~/remember`.
Validate: expand `~`, check if writable. If exists, confirm or choose different.

### 2. Detect Install Scope & Configure Settings

Detect scope:
- `${CLAUDE_PLUGIN_ROOT}` contains `/.claude/plugins/cache/` → **user scope** → `~/.claude/settings.json`
- Otherwise → **project scope** → `.claude/settings.json`

Ask: **"Install globally or for this project?"** to let user override.

**Read the target settings.json**, then **MERGE** (don't overwrite existing keys):

```json
{
  "env": {
    "REMEMBER_BRAIN_PATH": "/chosen/path"
  },
  "permissions": {
    "additionalDirectories": ["/chosen/path"],
    "allow": [
      "Bash(* /chosen/path*)",
      "Bash(echo *)",
      "Read(~/.claude/**)",
      "Edit(~/.claude/**)"
    ]
  }
}
```

**Note:** Use expanded absolute path in Bash rules (not `~/`).

See `reference.md` for detailed merge rules.

### 3. Create Directory Structure

```bash
mkdir -p {brain_path}/{Inbox,Journal,Projects,Areas,Notes,People,Tasks,Resources,Templates,Archive}
```

### 4. Create Persona.md (if it doesn't exist)

**Skip if `{brain_path}/Persona.md` already exists** — the user may have customized it. Never overwrite an existing Persona.

Otherwise, ask:
1. **What's your name?** (default: User)
2. **What's your timezone?** (default: UTC)
3. **What languages do you speak?** (default: English)

Create `{brain_path}/Persona.md` using the template in `reference.md`. The template ships with five sections:

- `## Mission` — identity (Name/Timezone/Languages/Role)
- `## Directives` — hard rules (user-edited)
- `## Disposition` — soft traits, auto-updated later by `/remember:evolve` (Phase 2)
- `## Top Beliefs` — auto-managed by `/remember:evolve` (Phase 3); empty until first run
- `## Evidence Log` — append-only behavioural evidence

The user fills `## Mission` and `## Directives`. The other three are populated automatically as the brain learns.

### 4b. Create REMEMBER.md (if it doesn't exist)

**Skip if file exists** — user may have already customized it.

Read the template from `assets/templates/remember.md` (relative to plugin root) and write it **verbatim** to `{brain_path}/REMEMBER.md`. Do NOT add examples, explanations, or any other content — the sections must remain empty so the user fills them in.

**Note:** This creates the global REMEMBER.md. Users can also create a project-level `REMEMBER.md` in any project root for project-specific rules that layer on top of global preferences.

### 5. Create Tasks File

Create `{brain_path}/Tasks/tasks.md` — see `reference.md` for template.

### 6. Create Templates

Create `Templates/project.md` and `Templates/person.md` — see `reference.md` for content.

### 7. Initialize Git (Optional)

Ask: "Initialize git repository?"

If yes:
```bash
cd {brain_path} && git init && git add . && git commit -m "init: second brain"
```

### 8. Confirm

```
Second Brain initialized at {brain_path}/

Structure: Inbox, Journal, Projects, Areas, Notes, People, Tasks, Resources, Archive
Persona: Created (will learn your patterns over time)
REMEMBER.md: Created (edit to customize brain behavior)
Settings: REMEMBER_BRAIN_PATH written to {settings_file}

Next steps:
- Work normally — Persona loads every session
- Say "remember this: ..." to capture thoughts
- Run /remember:process to extract value from past sessions
- Edit REMEMBER.md to customize capture and processing rules
```

## Error Handling

- Path already exists with content: skip existing dirs, only create missing ones
- settings.json has existing content: merge, don't overwrite
- Safe to run multiple times (won't delete existing content)
