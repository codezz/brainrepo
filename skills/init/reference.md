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
```
