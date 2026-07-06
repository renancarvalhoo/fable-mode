#!/bin/sh
set -e

case "$1" in
  -h|--help)
    echo "Usage: ./install.sh"
    echo "Installs the fable-mode skill to ~/.claude/skills/fable-mode"
    echo "and the fable-heavy workflow to ~/.claude/workflows/"
    exit 0
    ;;
esac

SKILL_DIR="$HOME/.claude/skills/fable-mode"
WORKFLOW_DIR="$HOME/.claude/workflows"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SKILL_DIR" "$WORKFLOW_DIR"
rm -f "$SKILL_DIR"/*.md
cp "$SRC_DIR/skills/fable-mode/"*.md "$SKILL_DIR/"
cp "$SRC_DIR/workflows/fable-heavy.js" "$WORKFLOW_DIR/"

echo "Installed fable-mode skill to $SKILL_DIR"
echo "Installed fable-heavy workflow to $WORKFLOW_DIR/fable-heavy.js"
echo ""
echo "Recommended: add to your ~/.claude/CLAUDE.md:"
echo "  ## Model Parity"
echo "  - When running on any model other than Fable (Opus, Sonnet, Haiku), invoke the \`fable-mode\` skill at the start of any coding task and follow its loop"
echo ""
echo "Optional: copy workflows/fable-heavy.js into a project's .claude/workflows/ to pin it per project."
