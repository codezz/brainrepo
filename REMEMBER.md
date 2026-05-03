# Remember — Default Rulebook

Default rules used by the Remember plugin to route knowledge captures. The plugin merges this file with your own `REMEMBER.md`. See plugin README for customization docs.

## Routing

- Person interaction → `People/<name>.md`
- Decision concerning a project → `Projects/<project>/decisions/YYYY-MM-DD-<topic>.md`
- Meeting notes → `Projects/<project>/meetings/YYYY-MM-DD-<who>.md`
- Project work / log entry → `Projects/<project>/<project>.md` (## Log section)
- Project quick capture pending review → `Projects/<project>/inbox.md` (append)
- Sub-project item (`Projects/<x>/projects/<y>/`) → write to the **parent** project KB with a `[<sub>]` tag in the filename or first line
- Technical learning / atomic note → `Notes/<topic>.md`
- Cross-project lesson or pattern → `Resources/lessons/<topic>.md` or `Resources/patterns/<topic>.md`
- Daily log / cross-project decisions → `Journal/{{TODAY}}.md`
- Area (career/health/family/finances) → `Areas/<area>.md`
- Link/article → `Resources/`
- Unclear → `Inbox/`

## Task Routing

- URGENT (deadline today/this week) → `Tasks/tasks.md` (## Focus, max 10 total)
- IMPORTANT (ready to start, next in queue) → `Tasks/tasks.md` (## Next Up, max 15 total)
- PROJECT-SPECIFIC (detailed, backlog, context-heavy) → `Projects/<project>/tasks.md`
- `Tasks/tasks.md` is the global FOCUS file. Project `tasks.md` is the per-project backlog.
- NEVER duplicate tasks between global `tasks.md` and project `tasks.md` — task lives in ONE place only.

## Processing

- READ existing file FIRST — match style, append don't replace
- YAML frontmatter: `created`, `updated` (today: {{TODAY}}), `tags`
- File names: `kebab-case.md`. People files: `firstname.md` or `firstname-lastname.md`
- Date prefix `YYYY-MM-DD-` for time-anchored entries (decisions, meetings)
- Use `[[wikilinks]]` everywhere — Obsidian handles backlinks automatically
- Link format: `[[People/name]]` or `[[Projects/name/name|Display Name]]`
- Create folders/files on demand (mkdir -p) if they don't exist
- Append to logs (`tasks.md`, `inbox.md`, `Journal/`) rather than overwrite
- If the target project can't be determined, fall back to `Inbox/`. Never write captures into `REMEMBER.md`.

## Linking

- Link FORWARD only. Obsidian's Backlinks panel handles reverse links automatically.
- In frontmatter: `related: ["[[Notes/topic]]", "[[Projects/name/name]]"]`

## Multi-File Updates

Only update multiple files when adding ACTUAL CONTENT (not just backlinks):

- `People/<name>.md` → add interaction entry to ## Interactions, update `last_contact`
- `Projects/<project>/<project>.md` → add work log entry to ## Log
- `Projects/<project>/decisions/<file>.md` → create new file for the decision
- `Projects/<project>/meetings/<file>.md` → create new file for the meeting
- `Projects/<project>/tasks.md` → append to detailed backlog
- `Journal/<date>.md` → daily summary grouped by project
- `Tasks/tasks.md` → ONLY urgent (Focus) or important (Next Up) tasks
- `Persona.md` → new evidence line if a behavioral pattern is observed

## Format

- **People** — frontmatter (`created`, `updated`, `tags`, `role`, `relationship`, `last_contact`); sections: `## Who`, `## Notes to Remember`, `## Interactions`
- **Project file** (`<project>.md`) — sections: `## Overview`, `## Roadmap` (if applicable), `## Log`. Detailed tasks live in `tasks.md`, decisions in `decisions/`, meetings in `meetings/`.
- **Decision file** — frontmatter (`created`, `tags: [decision]`); body: context + decision + alternatives + outcome
- **Meeting file** — frontmatter (`created`, `attendees`, `tags: [meeting]`); body: agenda + notes + action items
- **Journal entry** — sections grouped by `## Project Name` (not chronological)
- **Tasks** — `Tasks/tasks.md`: `## Focus` (max 10), `## Next Up` (max 15). Project `tasks.md`: `- [ ] Description` checkboxes.
- **Roadmaps** — descriptive text, NOT checkboxes (roadmap = strategic direction; tasks = concrete next-actions)
- **Notes** — frontmatter with `related: [wikilinks array]`

## Capture Rules

(No defaults — your `REMEMBER.md` can add capture-time auto-rules here.)

## Custom Types

(No defaults — your `REMEMBER.md` can define custom routing types here.)

## Language

- Match the user's language. Capture in original; process output in the user's primary language.

## After Save

- List all files created/updated
- Confirm `[[wikilinks]]` added (Obsidian will handle backlinks)
