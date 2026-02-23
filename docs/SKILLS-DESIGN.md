# SoulPrint Skills System Design

Based on ZeroClaw's skills architecture, adapted for cloud (Cloudflare Workers + R2).

## Overview

Skills are reusable instruction sets that teach the AI how to do specific tasks.

## Storage

### Global Skills (available to all users)
```
R2: skills/{skill-name}/SKILL.md
R2: skills/{skill-name}/SKILL.toml (optional - advanced config)
```

### User Skills (private to user)
```
R2: users/{userId}/skills/{skill-name}/SKILL.md
```

## SKILL.md Format (Simple)

```markdown
# Website Builder

Build and deploy websites for users.

## When to Use
- User asks to build a website
- User wants to deploy HTML/CSS/JS
- User mentions "landing page" or "web page"

## Steps
1. Ask user for website purpose and style preferences
2. Generate HTML/CSS with modern design
3. Preview code with user
4. Deploy to Vercel when approved

## Best Practices
- Use semantic HTML
- Mobile-first responsive design
- Fast loading (minimal JS)
- Accessible (ARIA labels)

## Tools Used
- deploy_website (Vercel)
- generate_image (for assets)
```

## SKILL.toml Format (Advanced)

```toml
[skill]
name = "website-builder"
description = "Build and deploy websites"
version = "1.0.0"
author = "SoulPrint"
tags = ["web", "deployment", "design"]

[[triggers]]
patterns = ["build.*website", "create.*page", "make.*landing"]

[[tools]]
name = "deploy_website"
required = true

[[prompts]]
role = "system"
content = "You are a website builder expert..."
```

## API Endpoints

### List Skills
```
GET /api/skills
Response: { skills: [{ name, description, enabled }] }
```

### Toggle Skill
```
POST /api/skills/:name/toggle
Body: { enabled: boolean }
```

### Get Skill Details
```
GET /api/skills/:name
Response: { name, description, content, version }
```

## System Prompt Injection

Skills are loaded and injected into the system prompt:

```xml
<available_skills>
  <skill>
    <name>website-builder</name>
    <description>Build and deploy websites</description>
    <location>skills/website-builder/SKILL.md</location>
  </skill>
</available_skills>
```

## Default Skills (Built-in)

1. **website-builder** — Build and deploy websites
2. **image-generator** — Generate images with AI
3. **code-runner** — Execute Python/JS code
4. **web-researcher** — Search and analyze web content
5. **file-manager** — Manage user files

## User Skill Management

Users can:
- Enable/disable global skills
- Create custom private skills
- Share skills (future)

## Implementation Plan

1. Add `getUserSkills()` helper
2. Add skill loading to system prompt
3. Create `/api/skills` endpoints
4. Add default skills to R2
5. UI for skill management (later)
