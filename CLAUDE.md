# CLAUDE.md - Project Guidelines

This file contains critical guidelines for AI assistants working on this codebase.

---

## Release Process

Releases include **both npm publish and GitHub tag release**.

### Steps for a New Release

1. **Update version in package.json:**
   ```bash
   npm version patch  # or minor/major
   ```

2. **Update CHANGELOG.md:**
   - Add entry under new version heading
   - Document all changes since last release
   - Follow [Keep a Changelog](https://keepachangelog.com/) format

3. **Commit the release:**
   ```bash
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "chore: release vX.Y.Z"
   ```

4. **Create and push tag:**
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin main --tags
   ```

5. **Publish to npm:**
   ```bash
   npm publish
   ```

6. **Create GitHub Release:**
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "See CHANGELOG.md for details"
   ```

### Version Numbering

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features, backward compatible
- **PATCH** (0.0.x): Bug fixes, security patches, documentation updates

---

## PR Auto-Review Process

> **IMPORTANT:** This applies to all next-task agents and ship agents.

Every PR receives automatic reviews from **4 agents**: Copilot, Claude, Gemini, and Codex.

### Mandatory Workflow

1. After creating/updating a PR, **wait at least 3 minutes** for the first round of reviews
2. **Read ALL comments** from all 4 reviewers
3. **Address EVERY comment** - no exceptions
4. Wait for the next review round and iterate
5. **Iterate until all comments are addressed** (typically 2-4 rounds)

### Rules

- **ALWAYS** address all comments, including "minor" or "out of scope" suggestions
- **NEVER** skip a comment unless:
  - The comment is factually wrong, OR
  - You have explicit user approval to skip it
- Treat all reviewer feedback as **required changes**, not suggestions
- If a comment seems incorrect, **explain why in your response** before dismissing

### Comment Resolution Process

```
For each comment:
1. Read and understand the feedback
2. Implement the fix OR explain why it's incorrect
3. Reply to the comment with what was done
4. Mark as resolved only after addressing
```

### Typical Review Cycle

```
PR Created
    ↓
Wait 3 min → Round 1 reviews arrive
    ↓
Address ALL comments → Push fixes
    ↓
Wait → Round 2 reviews arrive
    ↓
Address ALL comments → Push fixes
    ↓
Repeat until 0 unresolved comments
    ↓
Merge
```

---

## Agent Guidelines

### For next-task Agents

The following agents MUST follow the PR Auto-Review process:

- `implementation-agent` - When creating PRs
- `review-orchestrator` - When coordinating reviews
- `ci-monitor` - When watching for review comments
- `ci-fixer` - When addressing review feedback

### For ship Agents

The `/ship` command MUST:

1. Wait for initial review round after PR creation
2. Process all auto-reviewer comments before proceeding
3. Iterate on feedback until all comments are resolved
4. Never force-merge with unresolved threads

### Integration with Workflow

```
next-task workflow:
Phase 12 (Ship) → /ship command
                      ↓
              PR Created
                      ↓
              Wait 3 min for reviews
                      ↓
              Address ALL comments (Copilot, Claude, Gemini, Codex)
                      ↓
              Iterate until 0 unresolved
                      ↓
              Merge
```

---

## Code Quality Standards

### Security

- Always validate user input
- Never expose secrets in logs or errors
- Use parameterized queries for any data operations
- Follow OWASP guidelines

### Testing

- Maintain 80%+ test coverage
- Write tests for all new functionality
- Include edge cases and error paths
- Run full test suite before releases

### Documentation

- Update CHANGELOG.md with every PR
- Keep README.md synchronized with features
- Document all public APIs
- Use JSDoc for function documentation

---

## File Locations

- **State files:** `.claude/workflow-state.json`
- **Plugin manifest:** `.claude-plugin/plugin.json`
- **Marketplace config:** `.claude-plugin/marketplace.json`
- **MCP server:** `mcp-server/index.js`
- **Core libraries:** `lib/`
- **Plugins:** `plugins/`
- **Install scripts:** `scripts/install/`

---

## Quick Commands

```bash
# Run tests
npm test

# Detect platform
npm run detect

# Verify tools
npm run verify

# Release
npm version patch && git push origin main --tags && npm publish
```
