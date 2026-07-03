export const meta = {
  name: 'fable-heavy',
  description: 'Best-of-3 design, judged synthesis, disciplined implementation and adversarial review for big tasks on non-Fable models',
  whenToUse: 'Large, ambiguous or multi-file coding tasks on Opus/Sonnet where single-pass judgment is not enough',
  phases: [
    { title: 'Understand', detail: 'scout the codebase for context' },
    { title: 'Design', detail: '3 independent approaches from different lenses' },
    { title: 'Judge', detail: 'panel ranks approaches, synthesize winning plan' },
    { title: 'Implement', detail: 'execute the plan following the fable-mode loop' },
    { title: 'Review', detail: 'adversarial reviewers + fix loop' },
  ],
}

const task = typeof args === 'string' ? args : args && args.task
if (!task) throw new Error('Pass the task as args: a string, or {task: "...", context: "..."}')
const extra = typeof args === 'object' && args && args.context ? `\nAdditional context from the user: ${args.context}` : ''

const SKILL_PATH = '~/.claude/skills/fable-mode/SKILL.md'

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
const brief = await agent(
  `Scout the current repository to prepare for this task: ${task}${extra}\n` +
    'Read the relevant code (do NOT modify anything). Return: a summary of how the affected area works today, ' +
    'the files involved, the existing patterns/conventions an implementer must follow, and the risks or gotchas.',
  { label: 'scout', schema: BRIEF }
)

phase('Design')
const LENSES = [
  ['mvp-first', 'smallest correct change that fully satisfies the task; minimize surface area'],
  ['risk-first', 'identify what could break (data, edge cases, integrations) and design to protect it'],
  ['architecture-first', 'design for the codebase 6 months from now: cohesion, naming, where the logic belongs'],
]
const APPROACH = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    approach: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    tradeoffs: { type: 'string' },
  },
  required: ['lens', 'approach', 'steps', 'tradeoffs'],
}
const designs = (
  await parallel(
    LENSES.map(([lens, angle]) => () =>
      agent(
        `Design an implementation approach for this task through the ${lens} lens (${angle}).\n` +
          `Task: ${task}${extra}\n` +
          `Codebase brief: ${JSON.stringify(brief)}\n` +
          'Read any code you need (do NOT modify). Return your lens name exactly as given, the approach, ' +
          'concrete ordered steps (files + what changes in each), and the tradeoffs.',
        { label: `design:${lens}`, phase: 'Design', schema: APPROACH }
      )
    )
  )
).filter(Boolean)

phase('Judge')
const VERDICT = {
  type: 'object',
  properties: {
    ranking: { type: 'array', items: { type: 'string' } },
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
          `Approaches: ${JSON.stringify(designs)}\n` +
          'Return a ranking of lens names (best first) and your reasoning.',
        { label: `judge:${criterion}`, phase: 'Judge', schema: VERDICT }
      )
    )
  )
).filter(Boolean)

const scores = {}
designs.forEach(d => {
  scores[d.lens] = 0
})
votes.forEach(v =>
  v.ranking.forEach((lens, i) => {
    if (lens in scores) scores[lens] += v.ranking.length - i
  })
)
const winner = designs.slice().sort((a, b) => scores[b.lens] - scores[a.lens])[0]
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
    `Base it on the winning approach (${winner.lens}): ${JSON.stringify(winner)}\n` +
    `Graft in clearly superior ideas from the runners-up: ${JSON.stringify(designs.filter(d => d !== winner))}\n` +
    `Judges' reasoning: ${JSON.stringify(votes.map(v => v.reasoning))}\n` +
    'Return the plan narrative and concrete ordered steps.',
  { label: 'synthesize', phase: 'Judge', schema: PLAN }
)

phase('Implement')
const implReport = await agent(
  `Read ${SKILL_PATH} first and follow its loop for everything you do.\n` +
    'Implement this plan in the repository step by step, verifying each step (run the relevant tests) before the next.\n' +
    `Task: ${task}${extra}\n` +
    `Plan: ${JSON.stringify(plan)}\n` +
    `Codebase brief: ${JSON.stringify(brief)}\n` +
    'Return: files changed, what you verified (commands + results), and anything left open.',
  { label: 'executor' }
)

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
]

let openFindings = []
let fixRounds = 0
for (let pass = 0; pass < 3; pass++) {
  const reviews = (
    await parallel(
      REVIEWERS.map(([name, focus]) => () =>
        agent(
          `Adversarially review the uncommitted changes in the repository (git diff + untracked files) made for: ${task}\n` +
            `Focus: ${focus}.\n` +
            'Read the actual code and verify each suspicion before reporting it. ' +
            'Report only real, confirmed issues — return an empty list if the change is clean.',
          { label: `review:${name}`, phase: 'Review', schema: FINDINGS }
        )
      )
    )
  ).filter(Boolean)
  openFindings = reviews.flatMap(r => r.findings)
  if (openFindings.length === 0 || pass === 2) break
  fixRounds += 1
  log(`Review pass ${pass + 1}: ${openFindings.length} findings — fixing`)
  await agent(
    `Read ${SKILL_PATH} first and follow its loop.\n` +
      `Fix these confirmed review findings in the repository, then re-run the relevant tests and confirm they pass:\n` +
      JSON.stringify(openFindings),
    { label: `fix:round${fixRounds}`, phase: 'Review' }
  )
}

return {
  winningLens: winner.lens,
  planSteps: plan.steps,
  implementation: implReport,
  fixRounds,
  unresolvedFindings: openFindings,
}
