export const meta = {
  name: 'fable-heavy',
  description: 'Best-of-3 design, judged synthesis, disciplined implementation and execution-grounded adversarial review for big tasks on non-Fable models',
  whenToUse: 'Large, ambiguous or multi-file coding tasks on Opus/Sonnet where single-pass judgment is not enough. Pass {task: "...", bestOf: 2} to have two executors implement independently with test-based selection of the winner (~1.8x cost, for critical tasks).',
  phases: [
    { title: 'Understand', detail: 'clean-tree preflight, then scout the codebase for context' },
    { title: 'Design', detail: '3 independent approaches from different lenses' },
    { title: 'Judge', detail: 'panel ranks approaches, synthesize winning plan' },
    { title: 'Implement', detail: 'execute the plan following the fable-mode loop; optional best-of-2 with execution-grounded selection' },
    { title: 'Review', detail: 'adversarial reviewers with executed evidence + fix loop' },
  ],
}

const task = typeof args === 'string' ? args : args && args.task
if (!task) throw new Error('Pass the task as args: a string, or {task: "...", context: "..."}')
const extra = typeof args === 'object' && args && args.context ? `\nAdditional context from the user: ${args.context}` : ''

const SKILL_REF =
  'FIRST: activate the fable-mode skill (it may be installed as fable-mode or fable-mode:fable-mode) and follow its loop for everything you do; if no such skill is available, locate its SKILL.md — run `ls ~/.claude/skills/fable-mode/SKILL.md ~/.claude/plugins/*/skills/fable-mode/SKILL.md ~/.claude/plugins/*/*/skills/fable-mode/SKILL.md 2>/dev/null` — and read the first hit.'

const clip = (v, n) => {
  const s = JSON.stringify(v)
  return s.length > n ? s.slice(0, n) + '…[truncated]' : s
}

const BRIEF = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    patterns: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'patterns', 'risks'],
}

phase('Understand')
const preflight = await agent(
  'Run `git status --porcelain` in the current repository (read-only, modify nothing) and return its output verbatim — an empty string if the tree is clean.',
  { label: 'preflight', schema: { type: 'object', properties: { porcelain: { type: 'string' } }, required: ['porcelain'] } }
)
if (preflight && preflight.porcelain.trim())
  throw new Error('fable-heavy needs a clean working tree — commit or stash first. git status --porcelain reported:\n' + preflight.porcelain)
if (!preflight) log('preflight tree check failed — proceeding without a clean-tree guarantee')

const brief = (await agent(
  `Scout the current repository to prepare for this task: ${task}${extra}\n` +
    'Read the relevant code (do NOT modify anything). Return: a summary of how the affected area works today, ' +
    'the files involved, the existing patterns/conventions an implementer must follow, and the risks or gotchas.',
  { label: 'scout', schema: BRIEF }
)) || { summary: 'scout failed — no brief available', files: [], patterns: [], risks: [] }

phase('Design')
const LENSES = [
  ['mvp-first', 'smallest correct change that fully satisfies the task; minimize surface area'],
  ['risk-first', 'identify what could break (data, edge cases, integrations) and design to protect it'],
  ['architecture-first', 'design for the codebase 6 months from now: cohesion, naming, where the logic belongs'],
]
const APPROACH = {
  type: 'object',
  properties: {
    lens: { type: 'string', enum: LENSES.map(([l]) => l) },
    approach: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    tradeoffs: { type: 'string' },
  },
  required: ['lens', 'approach', 'steps', 'tradeoffs'],
}
const rawDesigns = (
  await parallel(
    LENSES.map(([lens, angle]) => () =>
      agent(
        `Design an implementation approach for this task through the ${lens} lens (${angle}).\n` +
          `Task: ${task}${extra}\n` +
          `Codebase brief: ${clip(brief, 4000)}\n` +
          'Read any code you need (do NOT modify). Return your lens name exactly as given, the approach, ' +
          'concrete ordered steps (files + what changes in each), and the tradeoffs.',
        { label: `design:${lens}`, phase: 'Design', schema: APPROACH }
      )
    )
  )
).filter(Boolean)
const seenLens = new Set()
const designs = rawDesigns.filter(d => !seenLens.has(d.lens) && seenLens.add(d.lens))
if (rawDesigns.length > designs.length) log('duplicate lens returned by a design agent — kept the first of each')
if (!designs.length) throw new Error('All design agents failed — nothing to judge')

phase('Judge')
const VERDICT = {
  type: 'object',
  properties: {
    ranking: { type: 'array', items: { type: 'string', enum: ['mvp-first', 'risk-first', 'architecture-first'] } },
    reasoning: { type: 'string' },
  },
  required: ['ranking', 'reasoning'],
}
const votes = (
  await parallel(
    ['correctness', 'maintainability', 'delivery-speed'].map(criterion => () =>
      agent(
        `You are judging ${designs.length} implementation approaches for: ${task}\n` +
          `Judge PRIMARILY by ${criterion}. You may read the code to check claims.\n` +
          `Approaches: ${clip(designs, 9000)}\n` +
          `Return a ranking of lens names (best first) and your reasoning. Valid lens names — echo them EXACTLY: ${designs.map(d => d.lens).join(', ')}.`,
        { label: `judge:${criterion}`, phase: 'Judge', schema: VERDICT }
      )
    )
  )
).filter(Boolean)
if (!votes.length) throw new Error('All judge agents failed — cannot rank designs')

const scores = {}
designs.forEach(d => {
  scores[d.lens] = 0
})
votes.forEach(v =>
  [...new Set(v.ranking)]
    .filter(lens => lens in scores)
    .forEach((lens, i) => {
      scores[lens] += designs.length - i
    })
)
const ranked = designs.slice().sort((a, b) => scores[b.lens] - scores[a.lens])
const winner = ranked[0]
if (ranked[1] && scores[ranked[1].lens] === scores[winner.lens])
  log(`judge tie between ${winner.lens} and ${ranked[1].lens} — winner picked by lens order`)
log(`Winning approach: ${winner.lens} (scores: ${JSON.stringify(scores)})`)

const PLAN = {
  type: 'object',
  properties: {
    plan: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
  },
  required: ['plan', 'steps'],
}
const plan = await agent(
  `Synthesize the final implementation plan for: ${task}\n` +
    `Base it on the winning approach (${winner.lens}): ${clip(winner, 5000)}\n` +
    `Graft in clearly superior ideas from the runners-up: ${clip(designs.filter(d => d !== winner), 6000)}\n` +
    `Judges' reasoning: ${clip(votes.map(v => v.reasoning), 3000)}\n` +
    'Return the plan narrative and concrete ordered steps.',
  { label: 'synthesize', phase: 'Judge', schema: PLAN }
)
if (!plan) throw new Error('Plan synthesis failed')

phase('Implement')
const bestOf = typeof args === 'object' && args && args.bestOf === 2 ? 2 : 1
const executorPrompt =
  `${SKILL_REF}\n` +
  'Implement this plan in the repository step by step, verifying each step (run the relevant tests) before the next. ' +
  'Do NOT create git commits — leave all changes uncommitted in the working tree.\n' +
  `Task: ${task}${extra}\n` +
  `Plan: ${clip(plan, 6000)}\n` +
  `Codebase brief: ${clip(brief, 4000)}\n`

let implReport
if (bestOf === 2) {
  const IMPL = {
    type: 'object',
    properties: { root: { type: 'string' }, report: { type: 'string' } },
    required: ['root', 'report'],
  }
  const candidates = (
    await parallel(
      [1, 2].map(n => () =>
        agent(
          executorPrompt +
            'Return: root (the absolute path of your working directory — run pwd) and report (files changed, what you verified with commands + results, anything left open).',
          { label: `executor:${n}`, phase: 'Implement', isolation: 'worktree', schema: IMPL }
        )
      )
    )
  ).filter(Boolean)
  if (!candidates.length) throw new Error('Both executors failed')
  if (candidates.length === 1) log('one executor failed — single candidate, no selection possible')

  let winning = candidates[0]
  if (candidates.length === 2) {
    const PICK = {
      type: 'object',
      properties: { winner: { type: 'string', enum: ['A', 'B'] }, evidence: { type: 'string' } },
      required: ['winner', 'evidence'],
    }
    const pick = await agent(
      `Two independent implementations of the same plan exist in two directories.\n` +
        `Candidate A: ${candidates[0].root}\nCandidate B: ${candidates[1].root}\n` +
        `Task: ${task}\nPlan: ${clip(plan, 6000)}\n` +
        'Select the winner by EXECUTION EVIDENCE, not code style: run the full test suite in both directories, ' +
        'then write distinguishing tests (boundaries, error paths and edge cases the plan implies but the suites may not pin) ' +
        'and run them against BOTH candidates. Write those tests in a scratch directory OUTSIDE both candidates (mktemp -d) and point them at each candidate with explicit load paths — never create or leave files inside the candidate directories. ' +
        'Prefer the candidate with more passing evidence; break ties toward the smaller, more convention-matching diff. Return winner (A or B) and the evidence (commands + outputs that decided it).',
      { label: 'select:tests', phase: 'Implement', schema: PICK }
    )
    if (pick) {
      winning = pick.winner === 'B' ? candidates[1] : candidates[0]
      log(`best-of-2 winner: ${pick.winner} — ${pick.evidence.slice(0, 120)}`)
    } else {
      log('select:tests failed — defaulting to candidate A without execution evidence')
    }
  }

  const APPLY = {
    type: 'object',
    properties: {
      applied: { type: 'boolean' },
      filesChanged: { type: 'array', items: { type: 'string' } },
      report: { type: 'string' },
    },
    required: ['applied', 'filesChanged', 'report'],
  }
  implReport = await agent(
    `A winning implementation exists in the worktree at ${winning.root}. Transfer it to the current repository's working tree with exactly this procedure:\n` +
      `1. git -C ${winning.root} add -A   (captures untracked and staged files in the patch)\n` +
      `2. git -C ${winning.root} diff --cached --binary > <a temp file OUTSIDE both repositories>\n` +
      '3. git apply that patch in the current repository — do NOT commit.\n' +
      'If the patch is empty or fails to apply, return applied=false with the reason in report — do NOT run tests on an unchanged tree.\n' +
      'On success, run the relevant tests HERE and confirm they pass.\n' +
      `The winning executor's report: ${winning.report}\n` +
      'Return: applied, filesChanged (paths changed in THIS repository), and report (what you verified with commands + results, anything left open).',
    { label: 'apply-winner', phase: 'Implement', schema: APPLY }
  )
  if (!implReport || !implReport.applied || !implReport.filesChanged.length) {
    const TREE = {
      type: 'object',
      properties: { dirty: { type: 'boolean' }, summary: { type: 'string' } },
      required: ['dirty', 'summary'],
    }
    const tree = await agent(
      'Run `git status --porcelain` and `git diff --stat` in the current repository and report whether the working tree has uncommitted changes. Read-only — do not modify anything.',
      { label: 'tree-check', phase: 'Implement', schema: TREE }
    )
    if (tree && tree.dirty) {
      log('apply-winner report missing or inconsistent but the tree HAS changes — continuing into Review')
      implReport = implReport || { applied: true, filesChanged: [], report: `apply-winner report lost; tree state: ${tree.summary}` }
    } else {
      throw new Error('best-of-2 winner transfer failed — no changes applied to the main tree')
    }
  }
} else {
  implReport = await agent(
    executorPrompt + 'Return: files changed, what you verified (commands + results), and anything left open.',
    { label: 'executor', phase: 'Implement' }
  )
  if (!implReport) throw new Error('Executor failed — nothing implemented')
}

phase('Review')
const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          issue: { type: 'string' },
          severity: { type: 'string' },
        },
        required: ['file', 'issue', 'severity'],
      },
    },
  },
  required: ['findings'],
}
const REVIEWERS = [
  ['senior-dev', 'correctness: bugs, N+1 queries, edge cases, missing test coverage'],
  ['product', 'does the change actually fulfill the task as the user asked; behavior and UX gaps'],
  ['architect', 'conventions of this codebase, cohesion, naming, whether the logic lives in the right place'],
  ['test-hunter', 'write NEW tests targeting the changed behavior (boundaries, error paths, interactions the existing suite does not pin), RUN them, and report only failures proven by execution — include the failing command and its output in the issue; delete your scratch test files afterwards'],
]

let openFindings = []
let fixRounds = 0
let reviewIncomplete = false
for (let pass = 0; pass < 3; pass++) {
  const reviews = (
    await parallel(
      REVIEWERS.map(([name, focus]) => () =>
        agent(
          `Adversarially review the uncommitted changes in the repository (git diff, git diff --cached, and untracked files) made for: ${task}\n` +
            `Focus: ${focus}.\n` +
            'Read the actual code and verify each suspicion before reporting it — where a suspicion is testable, prove it by running code or tests and cite the output in the issue. ' +
            'Ignore leftover scratch test files that are clearly not part of the change. ' +
            'Report only real, confirmed issues — return an empty list if the change is clean.',
          { label: `review:${name}`, phase: 'Review', schema: FINDINGS }
        )
      )
    )
  ).filter(Boolean)
  if (!reviews.length) {
    if (pass === 0) throw new Error('All review agents failed — the change is unreviewed, not clean')
    reviewIncomplete = true
    log(`review pass ${pass + 1} failed entirely — the last fix round is unverified; returning what is known`)
    break
  }
  openFindings = reviews.flatMap(r => r.findings)
  if (openFindings.length === 0 || pass === 2) break
  fixRounds += 1
  log(`Review pass ${pass + 1}: ${openFindings.length} findings — fixing`)
  await agent(
    `${SKILL_REF}\n` +
      `Fix these confirmed review findings in the repository, then prove each fix by execution: re-run the test or command that demonstrated the finding plus the relevant suite, and report the commands with their output — a fix without green output does not count as fixed:\n` +
      clip(openFindings, 8000),
    { label: `fix:round${fixRounds}`, phase: 'Review' }
  )
}

return {
  winningLens: winner.lens,
  planSteps: plan.steps,
  implementation: implReport,
  fixRounds,
  unresolvedFindings: openFindings,
  reviewIncomplete,
}
