#!/bin/sh
set -e

SKILL_DIR="$HOME/.claude/skills/fable-mode"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SKILL_DIR"
cp "$SRC_DIR/skills/fable-mode/SKILL.md" "$SRC_DIR/skills/fable-mode/fable-operating-logic.md" "$SRC_DIR/skills/fable-mode/fable-taste-ruby.md" "$SKILL_DIR/"

echo "Installed fable-mode skill to $SKILL_DIR"
echo ""
echo "Recommended: add to your ~/.claude/CLAUDE.md:"
echo "  ## Model Parity"
echo "  - When running on any model other than Fable (Opus, Sonnet, Haiku), invoke the \`fable-mode\` skill at the start of any coding task and follow its loop"
echo ""
echo "Optional: copy workflows/fable-heavy.js into your project's .claude/workflows/ for the heavy multi-agent pipeline."
