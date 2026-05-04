# Remember Skill — Reference

Templates and routing details for brain dump capture.

---

## Task Routing

| Urgency | Signals | Destination |
|---------|---------|-------------|
| **URGENT** | Deadline soon, "asap", "urgent", "de mâine" | `Tasks/tasks.md` → ## Focus (max 10) |
| **IMPORTANT** | "Need to", "trebuie să", no deadline | `Tasks/tasks.md` → ## Next Up (max 15) |
| **BACKLOG** | "Eventually", "Phase 2", "când am timp" | `Projects/{name}/{name}.md` → Backlog |

Format: `- [ ] Task [[Projects/name/name|Name]] [⚡ if urgent] ({DATE})`

---

## Templates

### New Person
```markdown
---
created: {SESSION_DATE}
updated: {SESSION_DATE}
tags: [person]
type: observation
role: {role if known}
organization: {org if known}
last_contact: {SESSION_DATE}
last_consolidated: {SESSION_DATE}
sources_count: 1
freshness: stable
related: []
---

# {Name}

{Context from user input}

## Who
- **Role:** {role}
- **Context:** {how they relate}

## Notes to Remember
- {key info}

## Interactions

### {TODAY}
- {what user said}
```

### New Note/Decision
```markdown
---
created: {SESSION_DATE}
updated: {SESSION_DATE}
tags: [{topic-tags}]
type: world-fact            # or: belief — set per detectType heuristic
freshness: stable
sources_count: 1
# confidence: 0.7           # required if type=belief
evidence:
  - source: Journal/{SESSION_DATE}.md
    quote: "{verbatim quote from session}"
    date: {SESSION_DATE}
counter_evidence: []
related: [{wikilinks to related entities}]
---

# {Title}

{Content}
```

### New Project
```markdown
---
created: {SESSION_DATE}
updated: {SESSION_DATE}
status: active
tags: [project]
type: observation
last_consolidated: {SESSION_DATE}
sources_count: 1
freshness: stable
related: []
---

# {Project Name}

## Overview
{from user input}

## Tasks
### Active
- [ ] {any tasks mentioned}

## Log
### {TODAY}
- Project created
```

---

## Update Patterns (Edit Tool)

**People — add interaction:**
```
Read People/{name}.md first.
Edit tool:
  old_string: (last entry in ## Interactions)
  new_string: (last entry + new interaction)
Update last_contact in frontmatter.
```

**Projects — add log/task:**
```
Read Projects/{name}/{name}.md.
Edit tool to append to ## Log or ## Tasks section.
```

**Tasks — add to section:**
```
Read Tasks/tasks.md.
Edit tool to insert after ## Focus or ## Next Up header.
```

**Journal — add section:**
```
Read or create Journal/{TODAY}.md.
Edit/Write to add project section.
```

---

## Areas Intelligence

- Time-bound + deadline → Project
- Ongoing responsibility → Area (flat .md file)
- One-off insight → Note

Default areas: `career.md`, `health.md`, `family.md`, `finances.md`

---

## Resource Capture (URLs)

1. `web_fetch(url)` → title, summary
2. Create `Resources/{type}/{title}.md` with frontmatter + summary
3. Link to related entities
4. If fetch fails → minimal note with URL
