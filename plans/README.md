# Plans Directory

> Active planning artifacts for awesome-slash development initiatives.

## Current Plans

### Skills Integration (`skills-integration/`)

**Status**: Architecture Complete for /drift-detect - Ready for Implementation  
**Goal**: Integrate Agent Skills specification for cross-platform knowledge loading  
**Branch**: `skills-integration`

**Start Here**: `skills-integration/OVERVIEW.md` - Session continuity document with all context

**Structure:**
- `OVERVIEW.md` - Quick context and resume instructions
- `research/` - Background research documents (65+ sources)
- `architecture/` - Per-command architecture designs
- `phases/` - Implementation phases with milestones
- `decisions/` - Architecture Decision Records (ADRs)

**Key Documents:**
| Document | Purpose |
|----------|---------|
| `OVERVIEW.md` | Session continuity, resume instructions |
| `architecture/drift-detect.md` | Full implementation blueprint for /drift-detect |
| `research/skills-best-practices.md` | Patterns from major labs and frameworks |
| `research/context-efficiency.md` | Token optimization strategies |
| `research/skill-script-hybrid.md` | How skills complement (not replace) scripts |
| `research/platform-comparison.md` | Claude vs OpenCode vs Codex differences |
| `research/sources.md` | Bibliography of 65+ research sources |

**Architecture Principle:**  
Commands stay as explicit orchestrators (scripts). Skills provide loadable knowledge that agents consume. Skills don't replace executables.

### Repo Map (`repo-map/`)

**Status**: Active  
**Goal**: AST-based repo map plugin  
**Start Here**: `repo-map/OVERVIEW.md`

---

## Directory Structure

```
plans/
├── README.md                    # This file (RAG index)
└── skills-integration/          # Current initiative
    ├── research/                # Background research
    ├── architecture/            # Component designs
    ├── phases/                  # Implementation phases
    └── decisions/               # ADRs
```

## Usage

1. **RAG Discovery**: AI agents search this README to find relevant plans
2. **Deep Dive**: Follow links to specific documents for details
3. **Updates**: Maintain this index when adding new plans or documents

## Plan Lifecycle

```
Research → Architecture → Phases → Implementation → Cleanup
```

Plans are deleted after successful implementation. Lessons learned go into `agent-docs/`.
