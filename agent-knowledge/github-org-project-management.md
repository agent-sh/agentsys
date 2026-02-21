# Learning Guide: GitHub Organization Project Management for Multi-Repo Open Source Ecosystems

**Generated**: 2026-02-21
**Sources**: 15 resources analyzed
**Depth**: deep

## Prerequisites

- Familiarity with GitHub Issues and Pull Requests
- Basic understanding of GitHub Organizations
- Awareness of multi-repo project structures
- Optional: GraphQL API knowledge for automation

## TL;DR

- GitHub Projects v2 is the primary tool for cross-repo org-level project management, supporting up to 50,000 items and 50 custom fields across all repos in an org.
- Issue Types (public preview, Jan 2025) and Sub-Issues enable structured work hierarchies at the org level without extra tooling.
- Automation via built-in workflows, GitHub Actions (`actions/add-to-project@v1`), and the GraphQL API is essential for keeping cross-repo boards accurate at scale.
- Successful open source orgs (Rust, Kubernetes, Astro, GitHub itself) combine a public roadmap project, RFC/enhancement-proposal repos, and working groups or SIGs to coordinate distributed contributors.
- The GraphQL API with the `project` OAuth scope unlocks full programmatic control; `read:project` is sufficient for read-only integrations.

## Core Concepts

### GitHub Projects v2

Projects v2 replaced the classic Projects board in 2022. It lives at the org level (not per-repo) and can aggregate items from any repository in the organization.

Key capabilities:
- **Views**: Table (spreadsheet-style), Board (kanban), Roadmap (Gantt-like timeline)
- **Custom fields**: Up to 50 per project. Types: text, number, date, single-select, iteration
- **Grouping, filtering, sorting**: Available across all views; filters use GitHub's advanced search syntax including AND/OR keywords and parentheses
- **Capacity**: 50,000 items per project
- **Cross-repo**: A single project can contain issues and PRs from any repo in the org

### Issue Types

Introduced in public preview January 2025. Org admins define up to 25 custom issue types (defaults: Task, Bug, Feature). Types are available across all repos and can be filtered in Projects and search.

This replaces the common pattern of using label conventions (`type: bug`, `kind/feature`) with a first-class field.

### Sub-Issues

Also in public preview. Issues can have a parent-child relationship:
- Break a large epic into sub-issues
- Progress bar displayed on the parent issue
- Sub-issues can live in different repos from the parent
- Enables hierarchical tracking without external tools

### Automation Tiers

| Plan | Built-in Workflows |
|------|--------------------|
| Free | 1 active workflow |
| Pro / Team | 5 active workflows |
| Enterprise | 20 active workflows |

Built-in workflow triggers:
- Item closed → set status
- PR merged → set status
- Item added to repo → add to project (filter by label, status, or assignee)
- Item archived by staleness (14 days, 3 weeks, or 1 month of inactivity)

For more complex rules, use GitHub Actions or the GraphQL API.

### GraphQL API

All project mutations require the `project` OAuth scope. Read-only operations use `read:project`.

Primary operations:
- `addProjectV2ItemById` - add an issue/PR to a project
- `updateProjectV2ItemFieldValue` - set a field value on an item
- `createProjectV2` - create a new project

Webhook events: `projects_v2_item` (created, edited, deleted, reordered, converted)

## Code Examples

### Auto-Add Issues from Any Repo via GitHub Actions

```yaml
# .github/workflows/add-to-project.yml
# Place this in EACH repo that should auto-add items to the org project
name: Add to Org Project

on:
  issues:
    types: [opened]
  pull_request:
    types: [opened]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v1
        with:
          project-url: https://github.com/orgs/MY-ORG/projects/42
          github-token: ${{ secrets.ADD_TO_PROJECT_PAT }}
          # Optional: only add if issue has specific label
          labeled: triage, bug, enhancement
```

The PAT must belong to an org member and have the `project` scope.

### GraphQL: Add Issue to Project

```graphql
mutation AddIssueToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {
    projectId: $projectId
    contentId: $contentId
  }) {
    item {
      id
    }
  }
}
```

### GraphQL: Update a Field Value

```graphql
mutation SetStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: {
      singleSelectOptionId: $optionId
    }
  }) {
    projectV2Item {
      id
    }
  }
}
```

### GraphQL: Find Project by Org and Number

```graphql
query FindProject($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      id
      title
      fields(first: 20) {
        nodes {
          ... on ProjectV2Field {
            id
            name
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}
```

### Advanced Search: Filter Issues by Type and Status

```
org:MY-ORG is:open type:feature label:roadmap
org:MY-ORG is:open type:bug (label:priority-high OR label:priority-critical)
```

## Org-Level Patterns from Real Projects

### GitHub's Public Roadmap

GitHub maintains a public project at `github.com/orgs/github/projects/4247`. Key practices:
- Quarterly columns map to release milestones
- The `shipped` label is applied when a feature lands, and the issue body is updated with a changelog link
- Items stay visible after shipping in a "Shipped" column (archive only after some time)
- This gives external contributors a real-time view of planned and recent work

### Kubernetes SIG Model

Kubernetes uses Special Interest Groups (SIGs) to coordinate work across 100+ repos:
- Each SIG owns a subset of repos and has a dedicated project board
- Kubernetes Enhancement Proposals (KEPs) live in a single `kubernetes/enhancements` repo as structured markdown files
- KEPs link to issues/PRs in implementation repos
- SIG leads triage new issues weekly and apply standardized labels (`sig/network`, `kind/feature`, etc.)

### Rust-lang RFC Process

- RFCs live in `rust-lang/rfcs` as PRs
- Working groups coordinate cross-team implementation
- A dedicated project tracks RFC lifecycle stages (proposed → accepted → stabilized → closed)
- Cross-repo coordination uses GitHub Projects with a single-select "Phase" field

### Astro (withastro)

- 51 repos under one org
- `withastro/roadmap` repo hosts RFC discussions and a public-facing roadmap project
- Uses pnpm workspaces for the core monorepo; satellite repos (integrations, adapters) auto-add to the roadmap project via GitHub Actions
- Labels are org-wide and enforced consistently

## Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Project scope creep | One project tracks everything; becomes unusable | One project per initiative or quarter; archive completed projects |
| Label inconsistency across repos | Each repo grows its own labels organically | Manage labels programmatically; use a shared label config script or action |
| Missing automation tokens | PATs expire or lack correct scopes; cross-repo actions silently fail | Use fine-grained PATs with explicit `project` scope; rotate with secrets manager |
| Stale items clogging board | Closed issues not archived; old PRs linger | Enable auto-archive: set staleness to 14 days or archive on close/merge |
| No triage process | New issues pile up without status | Add "Needs Triage" as default status; automate: new issue → Needs Triage |
| Cross-repo sub-issue confusion | Contributors open sub-issues in wrong repo | Document in CONTRIBUTING.md which repo to use for which issue type |
| Workflow count limits on Free plan | Only 1 built-in workflow on Free | Use GitHub Actions instead of built-in workflows for more rules |
| Views not shared with team | Each person builds their own view | Create named saved views in the project for common filters (My Items, This Sprint, Blocked) |

## Best Practices

1. **One source of truth per initiative** - Each major feature or release gets exactly one project. Avoid tracking the same item in multiple projects.

2. **Standardize labels org-wide** - Use a label sync action (e.g., `EndBug/add-or-update-label`) to keep labels consistent across all repos. Document the label taxonomy in a `CONTRIBUTING.md` or `.github` repo.

3. **Use Issue Types instead of type labels** - Now that Issue Types are available (Jan 2025 public preview), prefer them over label conventions for `bug`, `feature`, `task`. Labels are better for priority, status, and component.

4. **Automate triage with GitHub Actions** - New issues opened in any repo auto-add to the org triage project with status "Needs Triage". Maintainers process the triage board, not individual repos.

5. **Keep the roadmap project public** - A public roadmap project builds contributor trust and reduces duplicate "when will X be done?" issues. Model: GitHub's own public roadmap.

6. **Use Iteration fields for sprints or releases** - Iterations are time-boxed periods (e.g., 2-week sprints). Assign items to iterations instead of milestones for better burndown tracking.

7. **Multiple saved views per audience** - Create views for: "My open items" (assignee filter), "This sprint" (iteration filter), "Blocked" (status filter), "Triage queue" (status = Needs Triage).

8. **Sub-issues for epics, not just labels** - Break large epics into sub-issues rather than relying on a checklist in the parent body. Progress tracking is automatic and cross-repo linking is supported.

9. **Automate status transitions** - Configure built-in workflows: PR merged → item status set to Done. Issue closed as not-planned → item archived. This removes manual housekeeping.

10. **Use the `.github` meta-repo** - A `.github` repo in the org stores default issue templates, PR templates, `CONTRIBUTING.md`, and Actions workflows that apply to all repos with no files.

## Field Design for Multi-Repo Projects

Recommended custom fields for an org-level project:

| Field Name | Type | Values / Notes |
|------------|------|----------------|
| Status | Single Select | Triage, Backlog, In Progress, In Review, Done, Blocked |
| Priority | Single Select | Critical, High, Medium, Low |
| Sprint / Iteration | Iteration | 2-week cadence |
| Effort | Single Select | XS, S, M, L, XL |
| Component | Single Select | Per-repo or per-area (e.g., Core, Docs, CLI, API) |
| Target Release | Single Select | v1.0, v1.1, Backlog |
| Repo | Text | Auto-populated via automation (helps when filtering Table view) |

## GitHub Actions Automation Recipes

### Auto-Set Status to "In Progress" When PR Opened

```yaml
name: PR Opened - Set In Progress

on:
  pull_request:
    types: [opened, reopened]

jobs:
  update-project:
    runs-on: ubuntu-latest
    steps:
      - name: Move linked issues to In Progress
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.PROJECT_PAT }}
          script: |
            // Use GraphQL to find project item for this PR and update status
            // Implementation varies by project ID and field IDs
```

### Sync Org Labels Across All Repos

```yaml
# Run in the .github meta-repo
name: Sync Labels

on:
  push:
    paths: ['labels.yml']
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2am

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: EndBug/label-sync@v2
        with:
          config-file: labels.yml
          delete-other-labels: false
          token: ${{ secrets.LABEL_SYNC_PAT }}
          # Applies to all repos accessible to the PAT
```

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [GitHub Projects Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects) | Official Docs | Canonical reference for all Projects v2 features |
| [GitHub's Public Roadmap](https://github.com/orgs/github/projects/4247) | Live Example | See how GitHub itself manages a public org project |
| [actions/add-to-project](https://github.com/actions/add-to-project) | GitHub Action | Official action for cross-repo auto-add |
| [Kubernetes SIG structure](https://github.com/kubernetes/community/blob/master/sig-list.md) | Reference | How Kubernetes scales to 100+ repos with SIGs |
| [withastro/roadmap](https://github.com/withastro/roadmap) | Reference | Astro's RFC and roadmap coordination model |
| [GitHub Issues API (GraphQL)](https://docs.github.com/en/graphql/reference/mutations#addprojectv2itembyid) | API Docs | GraphQL mutations for project automation |
| [EndBug/label-sync](https://github.com/EndBug/label-sync) | GitHub Action | Sync labels across all org repos |

---

*This guide was synthesized from research on GitHub Projects v2, Issue Types, Sub-Issues, GraphQL API, and real-world org patterns (Rust-lang, Kubernetes, Astro, GitHub). See `resources/github-org-project-management-sources.json` for full source list.*
