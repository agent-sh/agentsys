## Input Handling

Parse from input:
- **path**: Directory or specific {{file_type}} file (default: `{{path_default}}`)
- **--fix**: Apply auto-fixes for HIGH certainty issues
- **--verbose**: Include LOW certainty issues

## Your Role

1. Invoke the `{{skill_name}}` skill
2. Pass the target path and flags
3. Return the skill's output as your response
4. If `--fix` requested, apply the auto-fixes defined in the skill

## Constraints

- Do not bypass the skill - it contains the authoritative patterns
- Do not modify {{file_type}} files without explicit `--fix` flag
