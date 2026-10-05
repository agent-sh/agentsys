---
name: maintain-cross-platform
description: "Use when preparing an AgentSys release, checking cross-platform compatibility, or changing the installer, transforms, adapters or marketplace pins. Maintainer skill for this repo only."
metadata:
  short-description: "Maintain AgentSys across its five platforms"
  scope: local
  audience: repo-maintainers
---

# Maintain cross-platform AgentSys

AgentSys installs the agent-sh plugins on Claude Code, OpenCode, Codex CLI, Cursor and Kiro. The plugins live in their own repos; this repo owns the marketplace, the installer, the transforms and the docs. Use this skill to find where a cross-platform concern lives and what to run.

Platform details (config formats, frontmatter, env vars, label limits) are in `checklists/cross-platform-compatibility.md` and `docs/CROSS_PLATFORM.md`; release steps are in `checklists/release.md` and `agent-docs/release.md`. Read them for the current facts instead of relying on memory.

## Where things live

| Concern | Location |
|---------|----------|
| Marketplace, one entry per plugin pinned by tag and commit | `.claude-plugin/marketplace.json`; re-pin with `node scripts/pin-marketplace.js [--dry-run]` (needs `gh`) |
| Installer | `bin/cli.js`: `installForClaude`, `installForOpenCode`, `installForCodex`, `installForCursor`, `installForKiro`. Claude Code installs from the marketplace; the others fetch plugin sources into `~/.agentsys/plugins/<name>` and transform them. |
| Transforms (frontmatter, tools to permissions, plugin-root paths, namespaces) | `lib/adapter-transforms.js`. `lib/` is synced from agent-sh/agent-core, so make the change there; an edit here is overwritten by the next sync. |
| Platform adapters | `adapters/opencode-plugin/` (native OpenCode plugin), `adapters/opencode/`, `adapters/codex/`; `scripts/gen-adapters.js` keeps generated files fresh |
| Dev installs | `node bin/dev-cli.js dev-install [tool]` (`scripts/dev-install.js`) |
| This repo's Kiro mirror | `.kiro/skills/` and `.kiro/agents/`: the pinned plugins' skills and agents passed through `transformSkillForKiro` and `transformAgentForKiro`. Regenerate them from the pinned commits when the pins move. |
| Versions | `package.json` is the source; `npx agentsys-dev bump X.Y.Z` stamps `package-lock.json`, `.claude-plugin/plugin.json`, `marketplace.json` and `site/content.json`. Plugin repos version independently. |
| Generated doc sections | `<!-- GEN:START:... -->` blocks, rewritten by `npx agentsys-dev gen-docs` |

## Platform differences behind most bugs

- Plugin root: `${CLAUDE_PLUGIN_ROOT}` in Claude Code, `${PLUGIN_ROOT}` in OpenCode and Codex; Cursor and Kiro get the install path inlined. Normalize backslashes in `require()` paths (`.replace(/\\/g, '/')`), because a Windows path such as `C:\Users\...` turns into escape sequences.
- State directory: use `AI_STATE_DIR` (`.opencode`, `.codex`, `.cursor`, `.kiro`; unset means `.claude`) instead of a hardcoded `.claude/`. `validate paths` catches hardcoded ones.
- OpenCode: model fields are stripped by default (`--no-strip` keeps them), tools become `permission:` entries, and AskUserQuestion labels longer than 30 characters fail.
- Codex has no commands or agents: commands become skills invoked as `$name`, so every skill description needs trigger phrases ("Use when ...").
- Kiro: commands become prompts in `~/.kiro/prompts/`, agents become JSON in `~/.kiro/agents/`, skills are copied as `SKILL.md`, and two combined reviewer agents fit its 4-subagent limit.

## Checks

| Command | Covers |
|---------|--------|
| `npm run validate` | plugins, cross-platform, consistency, paths, counts, platform-docs, agent-skill-compliance |
| `npm test` | Jest suite |
| `npm run gen-docs:check`, `node scripts/expand-templates.js --check`, `node scripts/gen-adapters.js --check` | Generated content is fresh (CI runs all three) |
| `npx agentsys-dev preflight [--all\|--release]` | Change-aware checklist checks. The pre-push hook runs it, asks for the `/enhance` confirmation, and runs `--release` when a `v*` tag is pushed. |
| `node bin/dev-cli.js validate opencode-install` | A real OpenCode install (not part of `validate`) |
| `npm pack --dry-run` | The package builds |

Before a release, smoke-test the installer: `npm pack`, `npm install -g ./agentsys-*.tgz`, run `agentsys`, and check each platform's install directory as `checklists/release.md` lists.

If this skill or a checklist no longer matches the code, fix it in the same change.

## Output

```markdown
## Cross-Platform Compatibility Check

### Validations run
- [OK|ERROR] <validator>: <one line>

### Issues
- <file:line>: <problem> - <fix>

### Docs out of date
- <file>: <what no longer matches>

### Actions taken
- <files changed>

### Next steps
- <remaining work, or "none">
```
