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

- _Hard rules and explicit preferences. Edit by hand or let `/remember:process` add observed patterns._

## Disposition

- _Soft traits scored 1–5 (e.g. terseness:5, formality:2, risk-tolerance:4). Auto-updated by the `evolve` skill in Phase 2._

## Top Beliefs

- _Auto-managed by the `evolve` skill (Phase 3 promotion). Empty until first run._

## Evidence Log

- _Append-only behavioural evidence with `[{date}]` prefix and confidence score._
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
