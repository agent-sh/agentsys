# New Agent Checklist

Adding a new specialist agent to the workflow.

## Best Practices Reference

- **Agent Design**: `agent-docs/AI-AGENT-ARCHITECTURE-RESEARCH.md`
- **Multi-Agent Systems**: `agent-docs/MULTI-AGENT-SYSTEMS-REFERENCE.md`
- **Instruction Following**: `agent-docs/LLM-INSTRUCTION-FOLLOWING-RELIABILITY.md`
- **Prompt Template**: `lib/cross-platform/RESEARCH.md` (Section 6)

## 1. Create Agent File

Location: `plugins/next-task/agents/{agent-name}.md`

Use this template structure:

```markdown
# Agent: {name}

## Role

{one-sentence description}

## Instructions

1. ALWAYS {critical constraint}
2. NEVER {prohibited action}
3. {specific step}

## Tools Available

- tool_1: description
- tool_2: description

If tool not listed, respond: "Tool not available"

## Output Format

<output>
{exact structure expected}
</output>

## Critical Constraints

{repeat most important constraints - addresses "Lost in Middle" problem}
```

**Guidelines:**
- Put critical info at START and END (Lost in Middle mitigation)
- Use explicit tool allowlisting
- Include 2-3 examples for complex tasks
- Keep descriptions concise (<100 chars per tool)
- Use imperative language

## 2. Choose Model Tier

| Complexity | Model | Use For |
|------------|-------|---------|
| Complex reasoning | `opus` | exploration, planning, implementation, review |
| Standard tasks | `sonnet` | validation, cleanup, monitoring |
| Simple operations | `haiku` | worktree setup, simple fixes |

## 3. Update Workflow Documentation

File: `agent-docs/workflow.md`

Add to the agent table:
```markdown
| Phase | Agent | Model | Required Tools | Purpose |
| X | `new-agent` | sonnet | Tool1, Tool2 | Brief purpose |
```

## 4. Update Orchestrator

File: `plugins/next-task/commands/next-task.md`

Add agent invocation at appropriate phase:
```javascript
await Task({
  subagent_type: "next-task:new-agent",
  model: "sonnet",  // or opus/haiku
  prompt: `Task description for agent`
});
```

## 5. Update Hooks (if needed)

File: `plugins/next-task/hooks/hooks.json`

If agent should trigger automatically after another agent:
```json
{
  "SubagentStop": {
    "triggers": {
      "previous-agent": "next-task:new-agent"
    }
  }
}
```

## 6. Define Tool Restrictions

In workflow.md, add to Agent Tool Restrictions table:
```markdown
| new-agent | Allowed: X, Y | Disallowed: Z |
```

## 7. Cross-Platform Compatibility

**Reference:** `checklists/cross-platform-compatibility.md`

### Automatic Handling (by installer)
The installer (`bin/cli.js`) automatically handles:
- Copies agent to `~/.config/opencode/agents/` for OpenCode
- Transforms frontmatter (tools → permissions, model names)
- Codex uses MCP tools, not native agents (no extra work needed)

### Manual Requirements
- [ ] Use `${PLUGIN_ROOT}` not `${CLAUDE_PLUGIN_ROOT}` in agent file
- [ ] All `AskUserQuestion` labels ≤30 characters (OpenCode limit)
- [ ] Use `AI_STATE_DIR` env var for state paths

### Frontmatter Transformation (automatic)

| Claude Code | OpenCode (auto-converted) |
|-------------|---------------------------|
| `tools: Bash(git:*)` | `permission: bash: allow` |
| `tools: Read, Edit` | `permission: read: allow, edit: allow` |
| `model: sonnet` | `model: anthropic/claude-sonnet-4` |
| `model: opus` | `model: anthropic/claude-opus-4` |

## 8. Run Quality Validation

```bash
# Run /enhance on the new agent
/enhance plugins/next-task/agents/new-agent.md

# Run tests
npm test
```

## 9. Test Agent

```bash
# Rebuild and install
npm pack && npm install -g ./awesome-slash-*.tgz
echo "1 2 3" | awesome-slash

# Verify agent is installed for OpenCode
ls ~/.config/opencode/agents/ | grep new-agent

# Run workflow and verify agent is called
/next-task

# Or test agent directly
Task({ subagent_type: "next-task:new-agent", prompt: "Test" })
```

## 10. Update Agent Count

File: `README.md`

Update "Specialist Agents (N Total)" section.

File: `docs/ARCHITECTURE.md`

Add to appropriate agent category table.

## Quick Reference

| Platform | Agent Location | Frontmatter |
|----------|---------------|-------------|
| Claude Code | Plugin `agents/` | Claude format (tools, model) |
| OpenCode | `~/.config/opencode/agents/` | Auto-transformed (permissions) |
| Codex CLI | N/A (uses MCP) | N/A |
