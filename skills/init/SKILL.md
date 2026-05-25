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

Create `{brain_path}/Persona.md` using the template in `reference.md`. The template ships with four sections:

- `## Mission` — identity (Name/Timezone/Languages/Role)
- `## Directives` — hard rules (user-edited; plugin never overwrites)
- `## Top Beliefs` — auto-managed by `promote.js` (runs after every capture); empty until your first belief meets the threshold
- `## Evidence Log` — append-only behavioural evidence

The user fills `## Mission` and `## Directives`. The other two are populated automatically as the brain learns.

### 4b. Create REMEMBER.md (if it doesn't exist)

**Skip if file exists** — user may have already customized it.

Read the template from `assets/templates/remember.md` (relative to plugin root) and write it **verbatim** to `{brain_path}/REMEMBER.md`. Do NOT add examples, explanations, or any other content — the sections must remain empty so the user fills them in.

**Note:** This creates the global REMEMBER.md. Users can also create a project-level `REMEMBER.md` in any project root for project-specific rules that layer on top of global preferences.

### 5. Create Tasks File

Create `{brain_path}/Tasks/tasks.md` — see `reference.md` for template.

### 6. Create Note Templates

Copy these files from `${CLAUDE_PLUGIN_ROOT}/assets/templates/` to `{brain_path}/Templates/`, skipping any that already exist:

- `note.md`
- `person.md`
- `project.md`
- `daily.md`
- `resource.md`

**Do NOT copy `assets/templates/remember.md`** to `Templates/`. That template is the source for the brain's ROOT `REMEMBER.md` rulebook — already handled in Step 4b. The brain's `Templates/` folder is exclusively for **note-level templates** that the `remember`/`process` skills use when creating new individual files; the root `REMEMBER.md` is a separate, single-purpose configuration file at brain root.

See `reference.md` for the body of each template.

### 7. Initialize Git (Optional)

Ask: "Initialize git repository?"

If yes:
```bash
cd {brain_path} && git init && git add . && git commit -m "init: second brain"
```

### 8. Configure MCP semantic search (`@remember-md/mcp`)

The MCP server provides a `search_brain` tool that any MCP-capable AI client (Claude Code, Cursor, Codex CLI, ChatGPT custom GPTs, Claude.ai) can call to do hybrid BM25 + vector + wikilink search over the brain.

Detect the right scope based on where the brain lives relative to the current working directory:

- Brain path is **inside** the current project (e.g. `./project-brain`, or any path under `cwd`) → **project scope** (writes `${cwd}/.mcp.json`, env uses `./relative` path)
- Brain path is **outside** the current project (e.g. `~/second-brain`) → **user scope** (writes `~/.claude.json`, env uses absolute path)

Ask the user once to confirm scope (showing the auto-detection) with a third option to skip if they want manual setup.

Run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/setup_mcp.js \
  --brain "{brain_path}" \
  --scope <user|project> \
  [--project-root "$(pwd)"]  # only when scope=project
```

The script:
- Adds `mcpServers.remember` to the chosen config file, with `command: "npx", args: ["-y", "@remember-md/mcp"]` and the appropriate `REMEMBER_BRAIN_PATH` env var.
- Is **idempotent**: re-running with the same args leaves the file untouched.
- Preserves any other `mcpServers` entries and unrelated config keys in the file.

If the user picks "skip", show them the JSON snippet they need to add manually and move on.

After patching, tell the user:

> ⚠️ Restart Claude Code (or your MCP client) to discover the new server. The `mcp__remember__search_brain` tool will appear after restart.

> First time using `search_brain`, the embedding model (`Xenova/bge-micro-v2`, ~17 MB) downloads in the background. Initial reindex builds BM25 immediately so search works from query 1; vector results layer in once embeddings finish.

### 9. Confirm

```
Second Brain initialized at {brain_path}/

Structure: Inbox, Journal, Projects, Areas, Notes, People, Tasks, Resources, Archive
Persona: Created (will learn your patterns over time)
REMEMBER.md: Created (edit to customize brain behavior)
Settings: REMEMBER_BRAIN_PATH written to {settings_file}
MCP server: Configured in {mcp_config_path} (restart Claude Code to activate)

Next steps:
- Restart Claude Code to activate the search_brain MCP tool
- Work normally — Persona loads every session
- Say "remember this: ..." to capture thoughts
- Run /remember:process to extract value from past sessions
- Edit REMEMBER.md to customize capture and processing rules
```

## Error Handling

- Path already exists with content: skip existing dirs, only create missing ones
- settings.json has existing content: merge, don't overwrite
- Safe to run multiple times (won't delete existing content)
