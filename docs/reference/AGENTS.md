# Agent Reference

Every agent in the AgentSys plugins at the commits pinned in `.claude-plugin/marketplace.json`. Each plugin repo's `agents/*.md` is the source of truth; this page summarizes it.

<!-- GEN:START:agents-counts -->
**TL;DR:** 5 agents across 11 plugins (4 have agents). Each agent names a model family (opus, sonnet, haiku; currently Opus 5.5, Sonnet 5.5, Haiku 4.5) or inherits the caller's model, and does one thing. <!-- AGENT_COUNT_TOTAL: 5 -->
<!-- GEN:END:agents-counts -->

## Quick Navigation

<!-- GEN:START:agents-nav -->
| Plugin | Agents | Jump to |
|--------|--------|---------|
<!-- GEN:END:agents-nav -->

## Overview

| Model | Resolves to | Used for |
|-------|-------------|----------|
| opus | Claude Opus 5.5 | Judgment where errors compound into later phases |
| sonnet | Claude Sonnet 5.5 | Structured analysis and validation, most agents |
| haiku | Claude Haiku 4.5 | Mechanical work with no judgment |
| inherit | the caller's model | Agents with no `model` key |

Family aliases resolve to the current model in that family, so agent files do not pin versions.

Every agent is an `agents/*.md` file with frontmatter in its plugin repo.

Plugins with no agents: foreman (command and skill; its workers are native worktree subagents); banthis, skill-curator and system-prompt-curator (skill and command only); mojo and ada-spark (skills only); zig-lsp (LSP config only).

Tool lists are abbreviated: `Bash(git, gh)` means `Bash(git:*), Bash(gh:*)`.

## deslop Plugin Agents

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| deslop-agent | sonnet | Bash(git, node), Skill, Read, Glob, Grep | Scans for AI slop with the deslop skill and returns certainty-ranked findings plus safe fixes as a `DESLOP_RESULT` block. Read-only; the caller applies fixes. |

## Other Plugin Agents

| Plugin | Agent | Model | Tools | What it does |
|--------|-------|-------|-------|--------------|
| learn | learn-agent | sonnet | WebSearch, WebFetch, Skill, Read, Write, Glob, Grep | Researches a topic and writes a cited learning guide with a RAG index under `agent-knowledge/`. |
| skillers | skillers-compactor | sonnet | Read, Write, Glob, Bash(node), Skill | Turns a redacted digest of recent sessions into themed observations and merges them into weighted knowledge files. |
| skillers | skillers-recommender | opus | Read, Glob, Grep, Bash(node), Skill | Ranks at most five hooks, skills and agents worth creating from the knowledge, checked against what is installed. |
| agnix | agnix-agent | sonnet | Bash(agnix, cargo), Read, Glob, Grep | Runs the agnix CLI for `/agnix` (with `--fix` only when asked) and returns the diagnostics as an `AGNIX_RESULT` block. |

## Navigation

[Back to Documentation Index](../README.md) | [Main README](../../README.md)
