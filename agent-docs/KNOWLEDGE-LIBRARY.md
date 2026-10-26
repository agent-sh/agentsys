# Agent Knowledge Library

Index of reference documents for AI agent development, prompt engineering, and platform integration.

## General Knowledge

| Topic | File | Key Content |
|-------|------|-------------|
| **Agent Architecture** | [AI-AGENT-ARCHITECTURE-RESEARCH.md](AI-AGENT-ARCHITECTURE-RESEARCH.md) | Reasoning patterns (ReAct, CoT, ToT, GoT, Reflexion), state management, agent loops |
| **Prompt Engineering** | [PROMPT-ENGINEERING-REFERENCE.md](PROMPT-ENGINEERING-REFERENCE.md) | System prompts, few-shot, chain-of-thought, structured output, agentic prompting |
| **Tool Use & MCP** | [FUNCTION-CALLING-TOOL-USE-REFERENCE.md](FUNCTION-CALLING-TOOL-USE-REFERENCE.md) | Function schemas, parallel calls, MCP protocol, tool security |
| **Context Optimization** | [CONTEXT-OPTIMIZATION-REFERENCE.md](CONTEXT-OPTIMIZATION-REFERENCE.md) | Token budgeting, RAG, prompt caching, lost-in-middle problem |
| **Multi-Agent Systems** | [MULTI-AGENT-SYSTEMS-REFERENCE.md](MULTI-AGENT-SYSTEMS-REFERENCE.md) | Orchestration patterns, frameworks (LangGraph, AutoGen, CrewAI), communication |
| **Instruction Following** | [LLM-INSTRUCTION-FOLLOWING-RELIABILITY.md](LLM-INSTRUCTION-FOLLOWING-RELIABILITY.md) | Instruction hierarchy, guardrails, hallucination prevention, reliability |

## Platform Integration

| Platform | File | Key Content |
|----------|------|-------------|
| **Claude Code** | [CLAUDE-CODE-REFERENCE.md](CLAUDE-CODE-REFERENCE.md) | Hooks, skills, MCP, Agent SDK, subagents, configuration |
| **OpenCode** | [OPENCODE-REFERENCE.md](OPENCODE-REFERENCE.md) | Commands, agents, MCP integration, project instructions |
| **Codex CLI** | [CODEX-REFERENCE.md](CODEX-REFERENCE.md) | Skills, sandbox, MCP, session management |

## Project-Specific

| Topic | File | Key Content |
|-------|------|-------------|
| **Workflow Agents** | [workflow.md](workflow.md) | Pre-ship gates, agent tool restrictions |
| **Release Process** | [release.md](release.md) | Version bumping, GitHub Actions, npm publishing |

## Topic Ownership

To avoid duplication, each topic has one canonical source:

- **Reasoning patterns** (ReAct, Plan-and-Execute, ToT) → AI-AGENT-ARCHITECTURE-RESEARCH.md
- **Prompting techniques** (CoT, few-shot, structured output) → PROMPT-ENGINEERING-REFERENCE.md
- **Tool/function calling** (schemas, MCP) → FUNCTION-CALLING-TOOL-USE-REFERENCE.md
- **Context management** (RAG, caching, tokens) → CONTEXT-OPTIMIZATION-REFERENCE.md
- **Multi-agent coordination** (orchestration, frameworks) → MULTI-AGENT-SYSTEMS-REFERENCE.md
- **Reliability** (guardrails, hallucinations) → LLM-INSTRUCTION-FOLLOWING-RELIABILITY.md
