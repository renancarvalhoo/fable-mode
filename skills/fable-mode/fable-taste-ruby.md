# Fable Taste — Ruby Design Defaults

Extracted behaviorally (2026-07-03): 24 forced-choice design probes answered by 3
independent Fable 5 samples (to find the stable mode and discard sampling noise)
and 2 pure Opus 4.8 samples (to find where defaults actually diverge — parity
needs no rule). Method: introspection is unreliable (self-reports of reasoning
are often post-hoc); behavioral sampling with mode-mining is not.

## Headline findings

- Fable's atomic design defaults are **24/24 stable** (3/3 agreement on every
  probe). The run-to-run variance seen in whole-task duels (same-model ceiling
  75 on the multi-warehouse task) therefore lives at the COMPOSITION level — how
  many stable micro-choices interact across a large task — not in the atomic
  choices themselves.
- Opus 4.8 already matches Fable's default on **20 of 24** probes. Taste
  divergence is narrow, not broad; the rules below cover the entire measured gap.

## Divergences — apply these defaults (Opus's instinct differs)

These are defaults for NEW code and for choices the codebase has not already
made. An established convention in the surrounding code wins over any default
below — follow it, and flag the divergence in the report if it matters.

1. **Invalid state transitions raise; they are never silent no-ops.**
   `cancel!` on an already-cancelled order raises `InvalidState`. The bang
   signals raise-on-failure, and a redundant transition usually hides a caller
   bug. (Opus default: idempotent no-op. This exact divergence decided the l2
   lifecycle duel.)
2. **Value objects are immutable AND ergonomic: frozen core plus a `with(...)`
   copy helper.** Immutability without a derivation helper pushes callers into
   rebuild-by-hand; `Data.define` gives both for free. (Opus default: frozen
   only, no derivation ergonomics.)
3. **Do not fight Ruby's setter semantics for chaining.** Assignment returns the
   value; configuration setters follow the language. If a fluent interface
   matters, use an explicit builder — never `return self` from a setter.
   (Opus default: chainable `self`-returning setters.)
4. *(Partial — Opus unstable, Fable stable)* **A Money-style value object
   exposes its raw amount** (`.cents` reader): persistence and serialization
   need it, and hiding it forces awkward workarounds.

## Parity — no rule needed (both models already default to this)

Domain-invariant violations raise domain exceptions; `find` returns nil with a
`find!` twin; validation fails at construction; rescue only what you can handle;
money is a value object over integer cents; `Data.define` for small values with
full value equality (`==`/`eql?`/`hash`); keyword arguments; strict `Money`-only
input contracts; bang = riskier twin of a safe variant; test through the public
API; one behavior per test; boundary fixes ship boundary-pinning tests; behavior
test names; quarantine-and-root-cause flakes; extract on responsibility, not
line count; `module_function` for stateless helpers; constructor injection with
defaults; comments only for what code cannot say; guard clauses.
