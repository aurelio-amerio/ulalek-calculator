# Ulalek Copy Calculator: design

Date: 2026-09-26
Status: draft for review

## Purpose

A progressive web app (PWA) that answers one question at the table: with
Ulalek, Fused Atrocity on the battlefield, a spell just cast, a known amount
of colorless mana and a known set of trigger doublers, how many copies of
that spell can I end up with, and in what order do I have to do things to
get that many?

It runs on a PC for debugging and installs on an Android phone from GitHub
Pages. It is built for one deck (see `deck-list.md`) but the card data is
designed so that new doublers can be added by editing one data file.

## What the user said

- Ulalek is assumed to be on the battlefield.
- Inputs: the colorless mana (C) left after casting the spell to be
  copied and after paying for anything else used in the combo (Archaic's
  activation, an Eldrazi instant cast in response); which trigger doublers
  are available from this deck. The app does not deduct any costs itself.
  Colored mana never pays for Ulalek's trigger, so it is not an input.
- An Eldrazi spell cast in response is a generic slot, not a specific card:
  Dimensional Infiltrator, Eldritch Immunity and Nameless Inversion
  (changeling, so it counts as Eldrazi) all fill the same role. It is one
  more spell that gets doubled with the others and one more Ulalek trigger
  that keeps the doubling going, and the user pays for it.
- Two families of "second trigger": Echoes of Eternity (one or two copies),
  or an extra Ulalek trigger put on the stack by something else (Abstruse
  Archaic copying it, or another Eldrazi spell cast in response, either a
  flash Eldrazi or an Eldrazi instant).
- Echoes of Eternity copies double each other, and distinct doublers
  interact with each other. The model must get those interactions right.
- Output: the maximum number of copies, and the exact order of play that
  reaches it, so the user can explain the line to the other players.
- The deck may change. Future doublers named so far: Roaming Throne,
  Strionic Resonator, Peter Parker's Camera, Delney, Streetwise Lookout.
  Rings of Brighthearth is explicitly out (it copies activated abilities,
  not triggered ones).
- The app should be visually pleasing and easy to maintain by someone with
  no HTML or JavaScript experience.

## Decisions already made

| Decision | Choice |
| --- | --- |
| Mana model | Fixed C budget entered by the user, net of every cost already paid. The app deducts nothing. Mana produced by the copies as they resolve is ignored (see Known simplifications). |
| Trigger input | Doublers and activated copiers come from a curated data file. Eldrazi spells cast in response are a plain count. |
| Engine | Closed-form formulas that encode one documented best line of play. A stack simulator in the test suite replays that line and must agree with the formulas. |
| Result screen | The number, the ordered line of play, and a short breakdown. |
| Hosting | GitHub Pages, deployed by GitHub Actions on push to `main`. |
| Stack | Vite, TypeScript, `vite-plugin-pwa`, plain DOM for the UI, Vitest for tests. No UI framework. |

## Rules model

All of this follows from the printed card text and the official rulings on
Ulalek and Echoes of Eternity.

### The objects on the stack

- **S**: the main spell, and its copies.
- **R**: a response spell (an Eldrazi spell cast before any trigger
  resolves), and its copies.
- **U**: a Ulalek trigger. "You may pay {C}{C}. If you do, copy all spells
  you control, then copy all other activated and triggered abilities you
  control." The controller pays on resolution, so copies of U also offer the
  payment.
- **E**: an Echoes of Eternity copy trigger, "Whenever you cast a colorless
  spell, copy it." Each E is tied to the spell whose cast made it trigger.
  Copies of an E are tied to the same spell.
- **A**: an activated copier's ability, "copy target triggered ability" (or
  "activated or triggered" for Peter Parker's Camera). Archaic's is limited
  to colorless sources, which Ulalek and Echoes both are.

What resolving each one does:

- **U, paid**: for every spell on the stack, put a copy on top. Then for
  every *other* ability on the stack (U, E and A, originals and copies), put
  a copy on top of those. The copied spells therefore sit under the copied
  abilities. The controller chooses the order within each group and may
  choose new targets for copied A's.
- **U, unpaid**: nothing.
- **E**: put a copy of its spell on top of the stack.
- **A**: put a copy of the targeted ability on top of the stack.
- **S or R**: resolves and leaves the stack. The count of S copies that
  resolve is the answer.

Copies created this way are not "cast", so cast triggers (U, E, Glaring
Fleshraker, Kozilek's Unsealing) never fire for them.

### Sources of Ulalek triggers and copies

1. **Static doublers**: permanents that make a triggered ability "trigger an
   additional time". Echoes applies to colorless permanents (Ulalek and
   other Echoes). Roaming Throne naming Eldrazi applies to Eldrazi creatures
   (Ulalek, not Echoes). Delney applies to creatures with power 2 or less
   (Ulalek at 2/5, not Echoes). Multiple copies stack additively. Two Echoes
   double each other's E trigger, which is why 1, 2 and 3 Echoes give 1, 4
   and 9 spell copies (official ruling).
2. **Activated copiers**: Abstruse Archaic ({1}), Strionic Resonator ({2}),
   Peter Parker's Camera ({2} and a film counter). Each taps, so one
   activation per combo. What the activation is worth depends on what it
   targets and on what is above it on the stack; see The line of play.
3. **Response spells**: each Eldrazi spell cast in response triggers Ulalek
   `u` more times (see below). The spell itself is doubled with everything
   else. Its identity does not matter, and it need not be colorless.

### Tags and multiplicity

- A permanent's *tags* describe it: `colorless`, `creature`, `eldrazi`,
  `enchantment`, `power-le-2`, and so on. Ulalek's tags are `colorless`,
  `creature`, `eldrazi`, `legendary`, `power-le-2`.
- A static doubler declares `affects`: the tags a permanent must have for
  the doubler to apply to it. It may also declare `copiesSpell`: the tags a
  spell must have for the doubler's own copy trigger to fire.
- `multiplicity(P)` for a permanent P = 1 + the number of static doubler
  instances D, other than P itself, whose `affects` tags are all present on
  P. Two copies of Echoes each count as an instance.
- `u = multiplicity(Ulalek)`: Ulalek triggers per Eldrazi cast.
- `c` = sum, over every static doubler instance D with a `copiesSpell`
  whose tags are all present on the main spell, of `multiplicity(D)`. This
  is the number of E triggers tied to the main spell. Two Echoes give
  2 + 2 = 4. A non-colorless main spell gives 0.

### Why the maximum is what it is

The main spell S is cast first and is the bottom of the stack for the whole
combo, so every E tied to S resolves while S is still there.

Call an object a **copy source** for S if resolving it, and everything it
leads to, produces exactly one more resolved copy of S: a live copy of S, an
E tied to S, or an A that targets an E tied to S (A makes an E copy, which
makes an S copy). A copy source that sits *below* a paid U on the stack is
copied by that payment, so it becomes two copy sources. A copy source above
every remaining U resolves once and is worth exactly 1.

With `k` payments available, a copy source that is below all the U's before
the first payment is therefore worth `2^k`, and nothing can be worth more.
The maximum is reached by getting every copy source under all the U's
before paying anything, then paying `k` times while keeping the U copies on
top each round. Three facts fix what can be arranged:

- Triggers from the same cast go on the stack together in the order the
  controller chooses, so S's E triggers can go under S's U triggers.
- An A is activated with priority, so it always lands on top of whatever is
  already there. The only way to get a U above an A is to cast an Eldrazi
  response spell *after* activating A. Without a response spell, an A can
  only be worth 1 copy (targeting an E) or 1 extra U (targeting a U).
- The number of payments is limited by C, not by the number of U's, as soon
  as there are two U's on the stack. A second U guarantees that each
  payment recreates a spare U. Extra U's beyond two are worthless.

### The line of play

Given `u`, `c`, the number of copiers `a`, the number of response spells
`r`, the main spell's Eldrazi flag `m` (1 or 0), and colorless mana `C`:

1. `T = u * m + u * r`, the Ulalek triggers that spells produce.
2. Copier allocation:
   - If `c > 0` (there is an E tied to S) and `r > 0`: every copier targets
     an E tied to S and is activated *before* the response spell is cast, so
     it is a copy source worth `2^k`.
   - If `c > 0` and `r = 0`: every copier targets an E tied to S and is worth
     exactly 1.
   - If `c = 0` and `T >= 1`: every copier targets a U and adds one U.
     `T` becomes `T + a`. Only the first one can matter.
   - If `c = 0` and `T = 0`: copiers have nothing useful to target.
3. Payments: `k = 0` if `T = 0`; `k = min(1, floor(C / 2))` if `T = 1`;
   `k = floor(C / 2)` if `T >= 2`.
4. `sources = 1 + c + (a if c > 0 and r > 0 else 0)`.
5. `immediate = a if c > 0 and r = 0 else 0`.
6. **Copies of S** = `sources * 2^k + immediate`. Duplicates = copies minus 1.
7. Each response spell ends up as at least `2^k` copies (Echoes would add
   more if it is colorless, which the app does not know).
8. Leftover C = `C - 2k`.

Order of operations the app prints (steps that do not apply are omitted):

1. Cast S. Ulalek triggers `u` times; Echoes triggers `c` times. Put the
   Echoes triggers on the stack first, then the Ulalek triggers on top.
2. With those triggers on the stack, activate each copier, targeting an
   Echoes trigger (or, when there is none, a Ulalek trigger).
3. Holding priority, cast the response spell in response, so that its
   Ulalek triggers land above the copier abilities. Ulalek triggers `u`
   more times; put those on top.
4. Let the top Ulalek trigger resolve and pay {C}{C}. Put the spell copies
   on the stack, then the ability copies, with the Ulalek copies on top of
   the Echoes and copier copies.
5. Repeat step 4 until `k` payments are made. After payment `i` there are
   `sources * 2^i` copy sources on the stack.
6. Stop paying. Let everything resolve. Each copier ability copies an
   Echoes trigger, each Echoes trigger copies S, each copy of S resolves.
7. Result: `copies` copies of S in total, `duplicates` of them new.

Notes the app adds when they apply:

- "Only one Ulalek trigger: only the first payment does anything."
- "Ulalek never triggers: the main spell is not an Eldrazi spell and
  nothing else is cast."
- "The response spell adds nothing here: you already have two Ulalek
  triggers and no copier to put under it." (when `r > 0`, `a = 0` and
  `u * m >= 2`)
- "Extra copiers add nothing here." (when `c = 0` and `a > 1`, or `c = 0`
  and `T >= 2` before copiers)

Worked examples (main spell is a colorless Eldrazi spell, C = 6 after
paying for everything):

| Setup | u | c | T | k | sources | immediate | Copies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nothing else | 1 | 0 | 1 | 1 | 1 | 0 | 2 |
| Archaic | 1 | 0 | 2 | 3 | 1 | 0 | 8 |
| One response spell | 1 | 0 | 2 | 3 | 1 | 0 | 8 |
| One Echoes | 2 | 1 | 2 | 3 | 2 | 0 | 16 |
| One Echoes, Archaic | 2 | 1 | 2 | 3 | 2 | 1 | 17 |
| One Echoes, Archaic, one response spell | 2 | 1 | 4 | 3 | 3 | 0 | 24 |
| Two Echoes | 3 | 4 | 3 | 3 | 5 | 0 | 40 |
| Two Echoes, Archaic and Resonator, one response spell | 3 | 4 | 6 | 3 | 7 | 0 | 56 |
| One Echoes plus Roaming Throne | 3 | 1 | 3 | 3 | 2 | 0 | 16 |
| Non-Eldrazi colorless spell, one Echoes, no response | 2 | 1 | 0 | 0 | 2 | 0 | 2 |
| Non-Eldrazi colorless spell, one Echoes, one response | 2 | 1 | 2 | 3 | 2 | 0 | 16 |

### Mana

The only mana input is C, a non-negative integer: the colorless mana left
after casting the main spell, any response spells, and any activated
copiers. Ulalek's trigger costs {C}{C}, which only colorless mana can pay,
so colored mana does not affect the result and is not entered. The app
reports the leftover C (0 or 1) after the payments.

### Known simplifications

- Mana produced by the copies as they resolve (for example Eldrazi Spawn
  from Kozilek's Command copies) is ignored. Anything that produces mana
  inside the loop makes the combo infinite; mana that arrives after the loop
  stops is worth at most one extra copy of the original when there are
  exactly two triggers. The app states this in its footer.
- Cost reducers (Herald of Kozilek, It That Heralds the End) are not
  modelled. The user enters the mana they actually have.
- Response spells are only assumed to be Eldrazi spells. Their own cost,
  and whether they can be cast at instant speed, is the user's call. Their
  reported copy count ignores Echoes' copy trigger.
- It That Heralds the End pumps Ulalek to 3/6, which turns Delney off. The
  Delney control carries a note saying so; the app does not detect it.
- Activated copiers are one use each and their cost is not deducted; the
  user enters C net of it. Untap effects are not modelled.
- Copies of a response spell are counted but nothing they do on resolution
  is modelled.
- The line of play is the one described above. Other lines are not
  searched; the argument in "Why the maximum is what it is" is the reason
  none of them can do better under a fixed C budget.

## Architecture

```
src/
  engine/
    cards.ts       card data: static doublers, activated copiers,
                   Ulalek's tags
    multiplicity.ts  tag matching, u and c from the card data
    calculate.ts   calculate(input) -> CalcResult (pure function)
    line.ts        describeLine(input, result) -> Step[] (the order of play)
    types.ts       shared types
  ui/
    render.ts      builds the form from the card data, renders results
    storage.ts     save and restore the last inputs in localStorage
  main.ts          wires engine, ui and PWA registration
  styles.css       theme and layout
index.html
public/            icons, favicon
tests/
  simulator.ts     stack simulator used only as a test oracle
  *.test.ts        Vitest specs
.github/workflows/deploy.yml
```

### Engine

The engine has no DOM dependencies and is the only place the rules live.

`CalcInput`:

```ts
{
  colorless: number                     // integer >= 0, net of all costs
  mainSpell: { eldrazi: boolean; colorless: boolean }
  staticDoublers: Record<id, count>     // e.g. { echoes: 2, throne: 0 }
  activatedCopiers: Record<id, boolean>
  responseSpells: number                // Eldrazi spells cast in response
}
```

`CalcResult`:

```ts
{
  ok: true
  copies: bigint            // of the main spell
  duplicates: bigint
  triggersPerCast: number   // u
  totalTriggers: number     // T after copier allocation
  doublerCopies: number     // c
  copierRole: 'source' | 'immediate' | 'trigger' | 'none'
  sources: number
  immediate: number
  payments: number          // k
  leftoverColorless: number // 0 or 1
  responseSpellCopies: bigint   // per response spell, 0n if none
  notes: string[]
} | {
  ok: false
  error: string             // e.g. "Colorless mana must be a whole number"
}
```

`Step` (from `line.ts`): `{ title: string; detail?: string }`. Steps are
plain sentences built from the input, in the order listed under The line of
play. Card names come from the data so the steps name the actual copiers
selected.

Counts use `bigint` for the exponential quantities so that large C values
print exactly. The UI formats them with thousands separators.

Card data shape (`cards.ts`):

```ts
StaticDoubler   { id, name, tags, affects: Tag[], copiesSpell?: Tag[], maxCount, note? }
ActivatedCopier { id, name, costText: string, affectsSourceTags: Tag[], note? }
ULALEK_TAGS     Tag[]
```

`costText` is display only, for example `"{1}, tap"`, shown as a reminder
to deduct it. Adding a card means adding one object and one test.

Initial data:

- Static doublers: Echoes of Eternity (max 3), Roaming Throne (max 1),
  Delney, Streetwise Lookout (max 1).
- Activated copiers: Abstruse Archaic, Strionic Resonator, Peter Parker's
  Camera.

### Test simulator

`tests/simulator.ts` models the stack as an array of objects (S, R, U, E,
A) with the resolution rules from The objects on the stack, and replays the
line of play with the fixed ordering policy: E's under U's on cast, copiers
activated targeting an E tied to S (or a U when there is none) before the
response spell is cast, U copies placed on top each round, pay while C
allows and a U is on top, then let everything resolve. It counts resolved
copies of S and of each R. It is a few hundred lines and has no dependency
on the app engine beyond the card data.

Its purpose is to catch algebra mistakes in `calculate.ts`: the tests run
both over a grid of inputs and require identical answers. Because the
simulator also encodes the policy, it is checked separately against the
hand-derived facts: the Echoes ruling numbers, and the worked examples.

### UI

Single screen, mobile first, generated from the card data so that new
entries appear without UI changes.

1. **Colorless mana**: one large stepper with 48 px tap targets and a
   direct numeric field for big values. Label: "Colorless mana left".
   Helper text: after casting the spell, any response spells, and any
   copier activations below.
2. **Main spell**: two toggles, "Eldrazi spell" and "Colorless", both on by
   default.
3. **Battlefield**: one stepper per static doubler (0 to `maxCount`) and
   one toggle per activated copier, each showing its cost as a reminder
   to deduct it. Notes from the data show as helper text.
4. **Cast in response**: one stepper, "Eldrazi spells cast in response",
   with helper text: any Eldrazi spell cast before a trigger resolves
   (Eldritch Immunity, Nameless Inversion, Dimensional Infiltrator);
   subtract its cost from the mana above.
5. **Result panel**, sticky at the bottom and expandable: collapsed, it
   shows the copy count in large type and duplicates beneath it. Expanded,
   it adds the numbered line of play, then the breakdown lines (triggers
   per cast and total, copy sources, payments, formula, leftover C) and
   any notes. Errors replace the number with the message.
6. Reset button in the header. Footer with the known simplifications.

Results update live on every input change. Inputs persist in localStorage
and are restored on load.

Visual direction: dark theme by default with a deep violet background and a
pale accent, light theme when the system prefers it. System font stack so
it works offline without font downloads. Generous spacing and large numerals
so it reads at arm's length during a game. The line of play uses numbered
steps with the card names emphasised so it can be read aloud.

### PWA

`vite-plugin-pwa` with `registerType: 'autoUpdate'`, a manifest named
"Ulalek Calculator" in standalone display mode with a themed icon set, and
Workbox precaching of the built assets so the app opens offline. Vite
`base` is `/ulalek-calculator/` to match the Pages path.

## Error handling

The engine never throws on user input. Negative or non-integer mana is
clamped by the UI stepper; the engine additionally validates and returns
`ok: false` with a message. The UI shows it inline in the result panel.

## Testing

Engine tests (Vitest):

- Every row of the worked examples table, for both `calculate` and the
  simulator.
- `multiplicity` and `c` for: no doublers, one Echoes, two Echoes, three
  Echoes (9 copies), Echoes plus Throne, Delney alone, Throne alone.
- Copier allocation in each of the four branches, and the copier role
  reported.
- Non-Eldrazi main spell with and without a response spell.
- Non-colorless main spell with Echoes (no doubler copies, copiers become
  extra triggers).
- Odd C amounts and leftover reporting, C = 0, C = 1 with two triggers.
- Response spell counts of 0, 1 and 2, and their reported copies.
- Grid test: `calculate` equals the simulator for C in 0..10, Echoes 0..3,
  Throne 0..1, Delney 0..1, copiers 0..3, response spells 0..2, and both
  main-spell toggles.
- `describeLine` produces the expected step titles for: nothing else, one
  Echoes, Echoes with copier and response spell, copier with no Echoes,
  non-Eldrazi main spell with no response.
- Each note appears exactly when its condition holds.

UI: a smoke test that renders the form from the data, sets a few inputs and
checks the displayed number and the first step. CI runs `npm test` and
`npm run build` on every push and pull request.

## Deployment

`.github/workflows/deploy.yml`: on push to `main`, install, test, build,
upload the `dist` folder and deploy with the official GitHub Pages actions.
The README documents `npm run dev` for local debugging, how to open the dev
server from the phone on the same network, and how to install the deployed
app from Chrome on Android ("Add to Home screen").

## Out of scope

- Searching over alternative lines of play, or mana produced mid-combo.
- Multiple rounds of the combo. Re-run the app with the new mana instead.
- Editing card data inside the app.
- Deducting any cost. Naming or costing individual response spells.
- Colored mana inputs.
- Cost reducers and untap effects.
- Any deck other than this one, beyond what the data file allows.
