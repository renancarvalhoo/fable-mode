# fable-mode

Make Claude Opus, Sonnet — or any non-Fable model — follow **Claude Fable 5's operating process** in Claude Code.

Fable 5's practical edge is not only raw capability: a large part is *process discipline* — how it orients before acting, verifies before claiming, and reports outcomes. Capability is not promptable; process is. This repo distills that process into an [Agent Skill](https://agentskills.io) plus a multi-agent workflow that buys back the remaining gap with test-time compute.

## What's inside

| Path | What it is |
|---|---|
| `skills/fable-mode/SKILL.md` | The skill: Fable 5's operating loop — ORIENT → PLAN → ACT → VERIFY → REPORT — as an executable contract, with long-horizon protocol, red flags and common mistakes |
| `skills/fable-mode/fable-operating-logic.md` | The detailed map: every rule explained, plus the empirical evidence behind the design |
| `workflows/fable-heavy.js` | Claude Code Workflow for big tasks: scout → best-of-3 designs (mvp / risk / architecture lenses) → judge panel → synthesized plan → disciplined executor → adversarial reviewers with fix loop |

## Install

```sh
git clone https://github.com/<you>/fable-mode.git
cd fable-mode
./install.sh
```

Or manually: copy `skills/fable-mode/` into `~/.claude/skills/`.

Then wire it in your `~/.claude/CLAUDE.md` so it activates automatically:

```markdown
## Model Parity
- When running on any model other than Fable (Opus, Sonnet, Haiku), invoke the `fable-mode` skill at the start of any coding task and follow its loop
```

For the heavy pipeline, copy `workflows/fable-heavy.js` into your project's `.claude/workflows/`. The workflow's executor and fixer agents read the fable-mode skill, so it assumes the skill is installed — run `./install.sh` first.

## Usage

- **Skill**: invoke `/fable-mode` at the start of a coding task, or let the CLAUDE.md wiring trigger it.
- **Workflow**: ask Claude Code to `run the fable-heavy workflow for <your task>`. It spawns ~12 agents (designers, judges, executor, reviewers), so expect 3–5× the tokens of a plain run — use it for large, ambiguous, or multi-file tasks only.

## How the gap actually closes

- **Test-time compute**: where Fable spends more reasoning per decision, the workflow generates 3 independent designs and has a judge panel pick and synthesize.
- **Single-pass judgment**: replaced by adversarial verification — reviewers instructed to *refute*, with a fix loop.
- **Long-context coherence**: replaced by externalized state — the plan lives in a file with per-step status; every step re-orients and re-verifies.
- **What doesn't close**: the intrinsic quality of a single reasoning step. The whole design ensures no critical decision ever depends on a single reasoning step.

## How it was built

TDD for process documentation: pressure scenarios (false-lead debugging under time pressure, a "trivial" rename with a hidden caller, an authority order to edit correct tests) were run against baseline Opus 4.8 agents *without* the skill, behavior was documented, and the skill was written and re-tested against those scenarios. Honest finding: Opus 4.8 already passes short well-scoped scenarios — the skill's value is keeping that behavior stable on long, ambiguous, or context-degraded work, which is where process discipline drifts first.

## License

MIT
