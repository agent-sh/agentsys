# New Skill Checklist

Adding a new skill to the project. Skills follow the **Agent Skills Open Standard** (agentskills.io).

## Agent Skills Open Standard Reference

The Agent Skills Open Standard is supported by 20+ tools: Claude Code, Cursor, OpenCode, Codex, Windsurf, Cline, and others.

### Critical Requirements

1. **Directory name MUST match skill name** - The parent directory name MUST equal the `name` field in SKILL.md frontmatter
   - Directory: `skills/my-skill/SKILL.md` → name: `my-skill`
   - **NOT**: `skills/something-else/SKILL.md` → name: `my-skill` (INVALID)

2. **name field** - REQUIRED
   - Max 64 characters
   - Lowercase letters, numbers, and hyphens only
   - Pattern: `^[a-z0-9-]{1,64}$`

3. **description field** - REQUIRED
   - Max 1024 characters
   - Must explain WHAT the skill does AND WHEN to use it
   - Include trigger phrases for discoverability

### Skill Loading Behavior

- **Startup**: Only metadata loaded (~100 tokens per skill)
- **Invocation**: Full skill content loaded on-demand
- **Progressive disclosure**: Keeps context clean until needed

### Skill Tool Requirement

If an agent says "MUST invoke skill X" or "execute the X skill", the agent MUST have `Skill` in its tools list:

```yaml
---
tools: Skill, Read, Glob, Grep
---
```

## 1. Create Skill Directory

Location follows the pattern: `plugins/{plugin-name}/skills/{skill-name}/SKILL.md`

**Directory name = skill name** (this is the critical rule):
```
plugins/skillers/skills/compact/SKILL.md           # WRONG - name mismatch
plugins/skillers/skills/skillers-compact/SKILL.md  # CORRECT
```

## 2. Create SKILL.md File

```markdown
---
name: {skill-name}
description: {what it does}. Use when {trigger conditions}.
---

# {Skill Name}

## When to Use

{Clear conditions for when this skill should be invoked}

## Implementation

{Instructions for the agent executing this skill}

## Output Format

{Expected output structure}
```

### Guidelines

- **name**: Must match parent directory exactly
- **description**: First sentence = what, second = when/triggers
- Include concrete trigger phrases users might say
- Keep implementation instructions actionable
- Provide output format examples

## 3. Update Agent (if skill is agent-invoked)

If an agent invokes this skill, ensure the agent has `Skill` in its tools:

```yaml
---
model: sonnet
tools: Skill, Read, Glob, Grep, Bash(git:*)
---

MUST invoke the `{skill-name}` skill using the Skill tool.
```

## 4. Cross-Platform Compatibility

**Reference:** `checklists/cross-platform-compatibility.md`

### Automatic Handling (by installer)
The installer (`bin/cli.js`) handles:
- Copies skills to `~/.config/opencode/skills/` for OpenCode
- Copies skills to `~/.codex/skills/` for Codex

### Manual Requirements
- [ ] Use `${PLUGIN_ROOT}` not `${CLAUDE_PLUGIN_ROOT}` in skill file
- [ ] Use `AI_STATE_DIR` env var for state paths

## 5. Run Quality Validation

```bash
# Lint the new skill with agnix
npx agnix plugins/{plugin}/skills/{skill-name}/SKILL.md

# Validate skill name matches directory
ls -la plugins/{plugin}/skills/{skill-name}/
```

## 6. Update Documentation

If the skill is user-invocable:
- Add to plugin's commands/SKILL.md list
- Update README.md skills table

## Validation Checklist

Before committing:
- [ ] Directory name matches skill `name` field exactly
- [ ] `name` field: lowercase, hyphens, max 64 chars
- [ ] `description` field: explains WHAT and WHEN
- [ ] If agent-invoked: agent has `Skill` in tools list
- [ ] `npx agnix` reports no errors

## Common Mistakes

### 1. Directory/Name Mismatch (MOST COMMON)

```
# WRONG
skills/compact/SKILL.md
---
name: skillers-compact  # Doesn't match directory!
---

# CORRECT
skills/skillers-compact/SKILL.md
---
name: skillers-compact  # Matches directory
---
```

### 2. Missing Skill Tool in Agent

```yaml
# WRONG - says "invoke skill" but can't
---
tools: Read, Glob, Grep
---
MUST invoke the skillers-compact skill.

# CORRECT
---
tools: Skill, Read, Glob, Grep
---
MUST invoke the skillers-compact skill.
```

### 3. Vague Description

```yaml
# WRONG - no trigger info
description: Analyzes prompts

# CORRECT - explains when to use
description: Analyze prompts for clarity and structure. Use when reviewing agent prompts, command files, or general instructions.
```

## Automated Tests

Run `npm test -- --testPathPatterns=agent-skill-compliance` to validate:
- All agents invoking skills have `Skill` tool
- All skill directories match their skill names
- All skill names follow the standard format
