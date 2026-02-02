# Release Checklist

Full release guide: [agent-docs/release.md](../agent-docs/release.md)

## Version Bump Files

Update ALL these files with new version:

```bash
# Quick check current versions
grep -r '"version"' package.json .claude-plugin/ plugins/*/.claude-plugin/
```

- [ ] `package.json` → `"version": "X.Y.Z"`
- [ ] `.claude-plugin/plugin.json` → `"version": "X.Y.Z"`
- [ ] `.claude-plugin/marketplace.json` → `"version"` (10 occurrences)
- [ ] All 9 plugin.json files in `plugins/*/.claude-plugin/`

## New Plugin Checklist

If adding a NEW plugin (not just updating):

- [ ] `bin/cli.js` → Add plugin name to `plugins` array (search: PLUGINS_ARRAY)
- [ ] `bin/cli.js` → Update console output messages for OpenCode and Codex
- [ ] `docs/INSTALLATION.md` → Add `/plugin install <name>@awesome-slash` commands
- [ ] `.claude-plugin/marketplace.json` → Add new plugin entry to `plugins` array
- [ ] `plugins/<name>/.claude-plugin/plugin.json` → Create plugin manifest

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
npm install -g ./awesome-slash-*.tgz
echo "1 2 3" | awesome-slash
```

### Verify Each Platform

- [ ] **Claude Code**: Commands appear in `/plugin list`
- [ ] **OpenCode**: Commands in `~/.config/opencode/commands/`
- [ ] **OpenCode**: Agents in `~/.config/opencode/agents/` (21 files)
- [ ] **OpenCode**: MCP config in `~/.config/opencode/opencode.json`
- [ ] **Codex CLI**: Skills in `~/.codex/skills/` (8 directories)
- [ ] **Codex CLI**: MCP config in `~/.codex/config.toml`

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

- [ ] `npm view awesome-slash version` shows new version
- [ ] GitHub Releases page has new release
- [ ] `awesome-slash --version` shows new version after `npm update -g`
