# Release Checklist

Full release guide: [agent-docs/release.md](../agent-docs/release.md)

## Version Bump

Single command stamps version into all files (`package.json` is the source of truth):

```bash
# Bump version everywhere (package.json, package-lock.json, plugin.json,
# marketplace.json, site/content.json) via npm lifecycle + stamp-version.js
# Note: plugin repos have independent versions — not stamped here
npx agentsys-dev bump X.Y.Z
# or: npm version X.Y.Z --no-git-tag-version
```

- [ ] Run the bump command above
- [ ] Verify with: `npx agentsys-dev validate consistency`

## New Plugin Checklist

If adding a NEW standalone plugin repo to the marketplace:

- [ ] Create repo under agent-sh org (or use `scripts/graduate-plugin.js`)
- [ ] Plugin has `.claude-plugin/plugin.json` with version and description
- [ ] `.claude-plugin/marketplace.json` in agentsys → Add entry with source URL, requires, core
- [ ] `docs/INSTALLATION.md` → Add to plugin list
- [ ] Add repo to agent-core sync matrix (if plugin uses lib/)

## Documentation Updates

- [ ] `CHANGELOG.md` → New entry at top (Added/Changed/Fixed/Removed)
- [ ] `docs/ARCHITECTURE.md` → If architecture changed

## Pre-Release Validation

```bash
npm test                    # All tests pass
npm pack --dry-run          # Package builds correctly
git status                  # No uncommitted changes
```

## Cross-Platform Verification

**Reference:** `checklists/cross-platform-compatibility.md`

```bash
# Build and install for all platforms
npm pack
npm install -g ./agentsys-*.tgz
echo "1 2 3" | agentsys
```

### Verify Each Platform

- [ ] **Claude Code**: Commands appear in `/plugin list`
- [ ] **OpenCode**: Commands in `~/.config/opencode/commands/`
- [ ] **OpenCode**: Agents in `~/.config/opencode/agents/` (21 files)
- [ ] **OpenCode**: MCP config in `~/.config/opencode/opencode.json`
- [ ] **Codex CLI**: Skills in `~/.codex/skills/` (8 directories)
- [ ] **Codex CLI**: MCP config in `~/.codex/config.toml`
- [ ] **Cursor**: Skills in `.cursor/skills/`, commands in `.cursor/commands/` (project-scoped)

### Verify Skill Descriptions (Codex)

```bash
# Check that all skills have trigger phrases
head -5 ~/.codex/skills/*/SKILL.md
# Should show: description: "Use when user asks to..."
```

## Release Commands

```bash
# Commit version bump
git add -A && git commit -m "chore: release vX.Y.Z"

# Create and push tag (triggers GitHub Actions)
git tag vX.Y.Z
git push origin main --tags

# Pre-release tags (publish to npm tag + prerelease GH)
# 1) Bump ALL version fields to X.Y.Z-rc.N or X.Y.Z-beta.N and commit
# 2) Tag that prerelease commit
git tag vX.Y.Z-rc.1    # npm tag: rc
git tag vX.Y.Z-beta.1  # npm tag: beta
git push origin main --tags
```

## Post-Release Verification

- [ ] `npm view agentsys version` shows new version
- [ ] GitHub Releases page has new release
- [ ] `agentsys --version` shows new version after `npm update -g`
