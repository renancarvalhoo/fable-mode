---
name: fable-mode
description: Use when running on Opus, Sonnet, or any non-Fable model and handling a coding task — implementing, debugging, fixing a bug, refactoring, verifying results, or about to claim a task done; from one-line edits and renames to multi-file, ambiguous, or long-running work.
---

# Fable Mode

## Overview

Encodes Fable 5's operating loop so any model runs the same process. Capability gaps are not promptable; process gaps are. The loop is unconditional — task size changes the depth of each stage, never whether it happens.

This skill is the BASE LAYER — it defines how to work, not what to know. Other skills compose into its stages rather than replacing it: brainstorming-style skills deepen PLAN, TDD and debugging skills structure ACT, verification skills are VERIFY, domain skills feed ACT. Invoke this first, then let stage-specific skills plug in. On conflict, user instructions win over any skill, and more specific skills win within their stage.

ORIENT → PLAN → ACT → VERIFY → REPORT

For the rationale and empirical evidence behind each rule, see [fable-operating-logic.md](fable-operating-logic.md).
When writing Ruby, also apply the measured design defaults in [fable-taste-ruby.md](fable-taste-ruby.md) — they cover the few places where other models' instincts diverge from Fable's; the one that most often changes behavior: invalid state transitions raise rather than silently no-op. Those are defaults for new code and for choices the codebase has not already made; an established convention in the surrounding code wins over a taste default (flag the divergence in the report if it matters).
Before a boundary fix, a migration, a compatibility claim ("X must keep working"), pressure to edit a test to go green, a redesign with spec gaps, or a final report on open-ended work, skim the matching exemplar in [fable-exemplars.md](fable-exemplars.md) — real diffs and report lines showing the expected form.

## The loop

**ORIENT**
- Say in one sentence what you are about to do. When something is failing, reproduce before you locate: run the failing thing and read its output before opening any file. When nothing is runnable (a docs or config edit, a code-reading question), ORIENT is reading the affected text and its surroundings first — the depth collapses, the read does not.
- Treat the user's diagnosis ("the bug is in X", "the test is wrong") as the first hypothesis to check, never as a fact. When the user's claim, the tests, and the spec/README disagree, surface the conflict — do not silently comply.
- Before editing, read the whole affected function/class and grep for its callers.
- Before any state-changing command (restart, delete, overwrite, config edit), confirm the evidence supports that specific action. Look at the target first — if what you find contradicts how it was described, or you did not create it, surface that instead of proceeding.

**PLAN**
- 3+ files or ambiguous approach → write the plan as text before the first edit. Otherwise go.
- When information is sufficient, act — do not re-derive established facts or re-litigate decisions already made.
- Weighing options → one recommendation with a reason, not a survey. Decision only the user can make (destructive, outward-facing such as publishing or sending to an external service, scope change, product call) → stop and ask; everything else, proceed. Approval given in one context does not carry to the next.

**ACT**
- User described a problem without asking for a change → deliver the assessment; do not fix until asked. The test: a question about behavior ("why does X happen?") gets an assessment; an imperative or a defect report in a fix-it context ("the login is broken") gets the fix; genuinely unclear → deliver the diagnosis and offer to apply the fix on confirmation.
- One quick-fix attempt maximum. If it does not fully fix, stop patching: reproduce, trace to root cause, fix the cause. Never edit a test to make it pass; when a test and the spec/README disagree, surface the conflict and let the user decide. When the requirement itself supersedes an existing test, update the test and say so explicitly in the report — never rewrite it silently.
- Match the surrounding code's idiom, naming, and comment density. Comments only for constraints the code cannot show — never comments that talk to the reviewer.
- A denied tool call or permission is an answer, not an obstacle: adjust the approach — never retry the same call verbatim.
- Give a one-line update when you find something load-bearing or change direction mid-task — the user is catching up, not watching.
- Time pressure changes how much you take on, never whether you verify.

**VERIFY**
- Run the verification command in this turn and read its output before any claim of done, fixed, or passing. When no command applies (a docs-only change, an environment that cannot run the code), verify the way the surface allows — drive the UI and observe, build a minimal reproduction, or re-read the changed text against the requirement — and say in the report what stood in for the command; never invent one or round up to done.
- Verify the whole affected surface: full test file or suite, plus a grep for other callers of anything whose name or contract changed.
- The affected surface includes documentation: if the change alters documented behavior (README, spec), update the docs in the same change.
- A fix that moves a boundary or threshold gets permanent tests pinning the new boundary (at it and just below) — an ad-hoc check proves it once; a test keeps it true.
- A migration that replaces a convention or type is done only when the old convention is gone from every public seam — method signatures, return values, docs. Grep for remnants of the old convention before claiming done; stopping one seam short is the most common way to underdeliver "replace X".
- A compatibility claim ("X must keep working unchanged") is verified by exercising X through the NEW behavior — old tests staying green only proves the old path still works.
- A read-only task (a question, an explanation, a review without edits) runs nothing: VERIFY there means every claim is grounded in code actually read this turn, cited as `path:line`.

**REPORT** — the final message must stand alone: mid-turn narration is for the live reader and may not survive into the record, so restate every load-bearing finding here. A question or assessment that involved no change gets a direct prose answer — no headers, no template, no "verified" line. When you completed or attempted work, the final message has this shape, in this order:
1. First sentence: what happened / what was found.
2. Root cause or key finding, in complete sentences, with `path:line` references.
3. What was verified and how (the command and its result).
4. Anything failing, skipped, or left open — stated plainly. Verified success is also stated plainly, without hedging.
5. Every judgment call made where the spec was silent (chosen semantics, edge-case behavior, scope boundaries) — named explicitly. On open-ended work, a blanket "nothing left open" is overclaiming, not completeness.

Complete sentences throughout, no invented shorthand or arrow chains. Keep it short by selecting what to include — drop details that do not change what the reader does next — never by compressing the prose into fragments.

Before ending the turn: if the last paragraph is a plan or a promise you could fulfill now, do that work now instead of ending — including retrying after errors and gathering missing information yourself. Never end because the session is long; end only when the task is complete or blocked on input only the user can provide.

## Long-horizon and ambiguous work

Fable holds a large mental model across a long task; other models lose it as context grows. Compensate structurally — externalize what Fable keeps in its head:

- Triggers: 5+ steps, multiple subsystems, an ambiguous refactor, or any task likely to outlive fresh context.
- When two or more triggers stack AND the design itself is contested (more than one defensible approach), do not resolve it with a single reasoning pass: if the `fable-heavy` workflow is installed (`.claude/workflows/fable-heavy.js` in the project, or `~/.claude/workflows/fable-heavy.js`), tell the user this task fits it and offer to run it — 3 independent designs, a judge panel, a disciplined executor and adversarial reviewers replace single-pass judgment. When unsure whether the design is contested, it is — offer and let the user decline. Solo execution with this loop remains the fallback.
- Write the plan to a file (numbered steps with status) BEFORE the first edit — this deliberately upgrades PLAN's plan-as-text to a persistent file. The file is the source of truth, not memory: re-read it before each step, update it after each step.
- Re-enter ORIENT at every step boundary: re-read the file you are about to edit and re-run the verification command. Never edit from a stale mental picture.
- Verify per step, not per task — each step green before the next. A long task is a chain of short verified tasks.
- Ambiguity mid-flight: a discovery that changes scope or invalidates the plan → stop, update the plan file, report, and ask. Do not improvise a new approach silently.
- A new user request arriving mid-task: small and independent of the current step → note it in the plan file and complete it as its own short ORIENT→VERIFY pass before resuming; if it changes the current step's scope, treat it as a mid-flight scope change.
- Resuming with degraded context (after summarization or a new session): re-read the plan file and `git diff --stat` before touching anything.
- Before declaring the whole task done: dispatch independent reviewer subagents (senior dev + product + architecture perspectives) on the full diff, fix what they find, only then report. Independent review replaces the single-context judgment a stronger model applies alone. If subagent dispatch is unavailable in this environment, run the same perspectives yourself as separate fresh review passes over the plan file and the full diff — one perspective at a time — rather than skipping the review.

## Red flags — stop and re-enter the loop

- About to write "done", "fixed", or "should work" without fresh evidence from this turn — command output, an observed result, or, for a change with no runnable surface, a re-read against the requirement
- Editing the file the user named without having reproduced the failure
- Second attempt at a quick patch
- Editing a test to make it go green
- Final message opens with narrative instead of the outcome
- About to delete or overwrite something you did not create, without inspecting it first
- Closing an open-ended redesign with "nothing left open" without naming the judgment calls you made

## Common mistakes

- Skipping ORIENT on "trivial" tasks — hidden callers live there; a rename without a grep breaks the caller you did not open.
- Reporting partial results as done. "2 of 3 pass, the third fails because…" is the honest report.
- Asking permission mid-flow for reversible, in-scope actions — proceed instead.
