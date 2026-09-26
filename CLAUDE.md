# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-screen PWA (Vite + TypeScript + plain DOM, no framework) that answers one Magic: The Gathering
question: with Ulalek, Fused Atrocity on the battlefield and a spell just cast, how many copies does a
given amount of colorless mana produce, and in what order must the stack be arranged to get them.
Deployed to GitHub Pages at `/ulalek-calculator/` by `.github/workflows/deploy.yml` on every push to `main`.

The authoritative rules model, the argument for why the computed maximum is the maximum, and the worked
examples table live in `docs/superpowers/specs/2026-09-26-ulalek-calculator-design.md`. Read its
"Rules model" section before touching anything in `src/engine/`.

## Commands

Node 22.12+ required.

```sh
npm install
npm run dev                       # vite --host, http://localhost:5173/ulalek-calculator/
npm test                          # vitest run (all tests)
npm run test:watch
npx vitest run tests/line.test.ts # one test file
npx vitest run -t "one Echoes"    # tests matching a name
npm run build                     # tsc --noEmit && vite build -> dist/
npm run preview
npm run icons                     # regenerates public/icons/*.png via scripts/make-icons.mjs
```

There is no linter or formatter configured. `npm run build` is the type check; CI runs `npm test` then
`npm run build`.

## Architecture

### Engine (`src/engine/`) is pure and owns all rules

No DOM imports. `calculate(input): CalcResult` in `calculate.ts` is a closed-form formula, not a search.
It encodes exactly one documented "line of play" and returns the copy count as a `bigint` (counts are
`sources * 2^k + immediate`, so they get large).

Data flow: `cards.ts` (card data, tag-based) -> `multiplicity.ts` (how many times Ulalek and Echoes
trigger, derived by matching `affects`/`copiesSpell` tags across every doubler instance) -> `calculate.ts`
(copier role allocation, payments `k`, copy count, notes) -> `line.ts` (`describeLine` turns input+result
into the ordered `Step[]` the UI prints).

`input.ts` has `normalizeInput(raw: unknown)`, which coerces anything (old localStorage shapes, garbage)
into a valid `CalcInput`. Both `mountApp` and `storage.ts` run through it, so new `CalcInput` fields must be
added there with a default or they will be dropped on load.

### The test simulator is the oracle for the engine

`tests/simulator.ts` is an explicit stack simulator (items S/R/U/E/A, see the spec) that replays the same
line of play step by step. `tests/simulator.test.ts` checks it against hand-derived numbers from the
official rulings, then asserts `calculate` agrees with it over a grid of a few thousand inputs. Any change
to the engine's algebra, the copier allocation, or card data must keep both in agreement; if the closed
form and the simulator disagree, work out from the spec which one is wrong rather than patching one to
match the other.

`tests/fixtures.ts` exports `mk(overrides)` for building a `CalcInput` in tests.

### UI (`src/ui/`) is generated from the card data

`render.ts` builds the whole form from `STATIC_DOUBLERS` and `ACTIVATED_COPIERS`, so a new card appears
in the UI without UI changes. Steppers, toggles, deck checkboxes and result elements carry
`data-testid` attributes (`stepper-<id>-inc`, `toggle-<id>`, `result-copies`, `step-N`, ...) that
`tests/ui.test.ts` (jsdom) drives. Keep those stable or update the test.

Two independent pieces of persisted state, each with its own localStorage key in `storage.ts`:

- The calculator input (`ulalek-calculator:v1`), cleared by the header Reset button.
- The deck selection (`ulalek-calculator:deck:v1`, `src/ui/deck.ts`): which cards are shown in the
  Battlefield card. Reset only from inside the deck menu. A card removed from the deck is also zeroed in
  the input by `mountApp` so it can never count.

`mana.ts` renders `{1}`, `{C}`, `{T}` etc. in oracle text as inline SVG symbols; glyph paths are
inlined from `public/icons/*.svg`. Unknown symbols like `{W}` stay as text.

Tests that need a DOM start with `// @vitest-environment jsdom`; engine tests run in node.

## Adding a card

Card data is in `src/engine/cards.ts`. A permanent that makes triggers "trigger an additional time" is a
`StaticDoubler`; a "copy target ability" activation is an `ActivatedCopier` (one use per combo, cost is
display-only text since the app never deducts costs). The `oracle` field must be the printed rules text.

Copier roles are assigned uniformly from `affectsSourceTags` alone. A copier whose real text is narrower
than that needs changes in the `calculate.ts` allocation loop and in `tests/simulator.ts`, not just a data
entry. Add a test in `tests/multiplicity.test.ts` or `tests/calculate.test.ts`; the grid test will catch
any engine/simulator drift.

## Conventions

- The app never deducts mana costs. The user enters colorless mana net of everything already paid.
  Do not add cost deduction, colored mana inputs, or alternative line-of-play search; the spec lists these
  as out of scope with reasons.
- Prose in the UI, notes and steps is plain sentences meant to be read aloud at a table.
- `MAX_COLORLESS` (999) and `MAX_RESPONSE_SPELLS` (99) in `cards.ts` bound inputs everywhere.
