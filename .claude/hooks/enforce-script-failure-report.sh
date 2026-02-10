#!/usr/bin/env bash
# enforce-script-failure-report.sh
#
# Claude Code PostToolUse hook for Bash tool invocations.
# Detects project script execution and reminds the agent to report
# failures before falling back to manual work.
#
# Input: JSON on stdin with tool_input.command
# Output: Reminder text on stdout if project script detected, nothing otherwise.
# Exit: Always 0 (hooks must not block execution)

set -euo pipefail

# Read all stdin into a variable
INPUT=$(cat 2>/dev/null || true)

# Bail fast on empty input
if [ -z "$INPUT" ]; then
  exit 0
fi

# Extract the command from tool_input.command
# Try jq first, fall back to grep+sed for environments without jq
COMMAND=""
if command -v jq >/dev/null 2>&1; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
else
  # Fallback: extract command value from JSON using grep/sed
  # Handles: "command": "npm test" or "command":"npm test"
  COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//' 2>/dev/null || true)
fi

# Bail if no command extracted
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Check if command matches project script patterns using bash pattern matching
# Single case handles both standalone and chained commands (e.g., cd ... && npm test)
IS_PROJECT_SCRIPT=false

case "$COMMAND" in
  *npm\ test*|*npm\ run\ *|*npm\ build*|*node\ scripts/*|*node\ bin/dev-cli.js*|*awesome-slash-dev*)
    IS_PROJECT_SCRIPT=true
    ;;
esac

if [ "$IS_PROJECT_SCRIPT" = true ]; then
  echo "[HOOK] Project script detected. If this command failed, you MUST report the failure with exact error output before attempting any manual workaround. Do NOT silently fall back to doing the work by hand. Fix the script, not the symptom. (CLAUDE.md Rule #13)"
fi

exit 0
