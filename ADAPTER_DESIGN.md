# Multi-Tool Adapter Design

## Overview

This document describes the adapter layer for supporting awsome-slash commands across multiple AI coding tools.

## Supported Tools

1. **Claude Code** - Anthropic's official CLI (primary target)
2. **Codex CLI** - OpenAI's Codex command-line interface
3. **OpenCode** - Open-source alternative AI coding assistant

## Key Finding

All three tools support **markdown-based slash commands** with similar syntax:
- Commands defined in `.md` files
- Support `$ARGUMENTS` placeholder for dynamic input
- Similar command structure and flow

## Architecture

### No Format Translation Needed ✓

Since all tools use markdown, we don't need format converters. Instead, we provide:
1. **Installation scripts** per tool
2. **Tool-specific configuration**
3. **Compatibility notes** for tool-specific features

### Directory Structure

```
awsome-slash/
├── plugins/                      # Claude Code plugins (current)
│   ├── deslop-around/
│   ├── next-task/
│   ├── project-review/
│   └── ship/
├── adapters/                     # NEW: Tool-specific adapters
│   ├── codex/
│   │   ├── install.sh           # Codex CLI installation script
│   │   ├── README.md            # Codex-specific docs
│   │   └── prompts/             # Symlinks to commands
│   ├── opencode/
│   │   ├── install.sh           # OpenCode installation script
│   │   ├── README.md            # OpenCode-specific docs
│   │   └── commands/            # Symlinks to commands
│   └── README.md                # Adapter overview
└── lib/                          # Shared utilities (unchanged)
```

## Installation Strategies

### Claude Code (Current - No Changes)

```bash
claude plugin marketplace add avifenesh/awsome-slash
claude plugin install deslop-around@awsome-slash
```

### Codex CLI (NEW)

```bash
# Clone repository
git clone https://github.com/avifenesh/awsome-slash.git
cd awsome-slash

# Run Codex installer
./adapters/codex/install.sh

# Commands become available as:
# /ship, /deslop-around, /next-task, /project-review
```

### OpenCode (NEW)

```bash
# Clone repository
git clone https://github.com/avifenesh/awsome-slash.git
cd awsome-slash

# Run OpenCode installer
./adapters/opencode/install.sh

# Commands become available as:
# /ship, /deslop-around, /next-task, /project-review
```

## Tool-Specific Differences

### Codex CLI Specifics

**Path References:**
- Update `${CLAUDE_PLUGIN_ROOT}` → `${CODEX_PROMPTS_DIR}`
- Node.js script paths need absolute paths

**Platform Detection:**
- Works as-is (uses standalone Node.js scripts)

**Limitations:**
- May not support Claude-specific subagents
- Task tool not available (use alternative approaches)

### OpenCode Specifics

**Path References:**
- Update `${CLAUDE_PLUGIN_ROOT}` → `${OPENCODE_COMMANDS_DIR}`
- Bash scripts work natively

**Platform Detection:**
- Works as-is (uses standalone Node.js scripts)

**Special Features:**
- Can use `@filename` for file includes
- Can use `!command` for bash command output injection

**Limitations:**
- May have different agent/plugin ecosystem
- Task tool may not be available

## Command Compatibility Matrix

| Command | Claude Code | Codex CLI | OpenCode | Notes |
|---------|-------------|-----------|----------|-------|
| `/deslop-around` | ✅ Full | ✅ Full | ✅ Full | Pure bash, fully compatible |
| `/next-task` | ✅ Full | ⚠️ Partial | ⚠️ Partial | Needs `gh` CLI, code validation works |
| `/project-review` | ✅ Full | ⚠️ Partial | ⚠️ Partial | Multi-agent may differ per tool |
| `/ship` | ✅ Full | ⚠️ Partial | ⚠️ Partial | CI/CD detection works, subagents may differ |

**Legend:**
- ✅ Full: Complete feature parity
- ⚠️ Partial: Core features work, some advanced features may differ
- ❌ Limited: Significant limitations

## Implementation Plan

### Phase 1: Create Adapter Directory Structure ✓
- [x] Research Codex CLI
- [x] Research OpenCode
- [x] Design adapter architecture

### Phase 2: Create Installation Scripts
- [ ] Write `adapters/codex/install.sh`
- [ ] Write `adapters/opencode/install.sh`
- [ ] Test installation on both tools

### Phase 3: Create Symlink Strategy
- [ ] Symlink command files to tool-specific directories
- [ ] Handle path variable substitutions
- [ ] Test commands on each tool

### Phase 4: Documentation
- [ ] Write `adapters/README.md`
- [ ] Write `adapters/codex/README.md`
- [ ] Write `adapters/opencode/README.md`
- [ ] Update main README with multi-tool support

### Phase 5: Testing
- [ ] Test all commands on Codex CLI
- [ ] Test all commands on OpenCode
- [ ] Document compatibility issues
- [ ] Add troubleshooting guide

## Path Variable Strategy

Commands reference paths like:
```bash
node ${CLAUDE_PLUGIN_ROOT}/lib/platform/detect-platform.js
```

**Solution**: Environment variable substitution in install scripts

```bash
# Codex install.sh
export CODEX_PROMPTS_DIR="$HOME/.codex/prompts/awsome-slash"
sed "s|\${CLAUDE_PLUGIN_ROOT}|$CODEX_PROMPTS_DIR|g" ...

# OpenCode install.sh
export OPENCODE_COMMANDS_DIR="$HOME/.opencode/commands/awsome-slash"
sed "s|\${CLAUDE_PLUGIN_ROOT}|$OPENCODE_COMMANDS_DIR|g" ...
```

## Maintenance Strategy

**Single Source of Truth**: Commands live in `plugins/*/commands/*.md`

**Adapters**: Installers create symlinks + path adjustments

**Updates**: Update command files once, run installer again to sync

## Success Criteria

- [ ] All 4 commands installable on Codex CLI
- [ ] All 4 commands installable on OpenCode
- [ ] Platform detection works on all tools
- [ ] Clear documentation per tool
- [ ] Automated installation (one command)
- [ ] Easy to update (re-run installer)

## Future Enhancements

- CI/CD testing on all 3 tools
- Version compatibility matrix
- Tool feature detection
- Graceful degradation per tool
- Auto-updater scripts
