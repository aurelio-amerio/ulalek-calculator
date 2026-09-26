# Ulalek Copy Calculator: design

Date: 2026-09-26
Status: draft for review

## Purpose

A progressive web app (PWA) that answers one question at the table: with
Ulalek, Fused Atrocity on the battlefield, a spell just cast, a known mana
pool and a known set of trigger doublers, how many copies of that spell do I
end up with if I spend all my colorless mana on Ulalek's trigger?

It runs on a PC for debugging and installs on an Android phone from GitHub
Pages. It is built for one deck (see `deck-list.md`) but the card data is
designed so that new doublers can be added by editing one data file.

## What the user said

- Ulalek is assumed to be on the battlefield.
- Inputs: mana available after casting the spell to be copied, per color,
  with colorless (C) the usual bottleneck; which trigger doublers are
  available from this deck.
- An Eldrazi spell cast in response is a generic slot, not a specific card:
  Dimensional Infiltrator, Eldritch Immunity and Nameless Inversion
  (changeling, so it counts as Eldrazi) all fill the same role. It is one
  more spell that gets doubled with the others and one more Ulalek trigger
  that keeps the doubling going, and the user pays for it.
- Two families of "second trigger": Echoes of Eternity (one or two copies),
  or an extra Ulalek trigger put on the stack by something else (Abstruse
  Archaic copying it, or another Eldrazi spell cast in response, either a
  flash Eldrazi or an Eldrazi instant).
- Output: the number of duplicates at the end of the combo.
- The deck may change. Future doublers named so far: Roaming Throne,
  Strionic Resonator, Peter Parker's Camera, Delney, Streetwise Lookout.
  Rings of Brighthearth is explicitly out (it copies activated abilities,
  not triggered ones).
- The app should be visually pleasing and easy to maintain by someone with
  no HTML or JavaScript experience.

## Decisions already made

| Decision | Choice |
| --- | --- |
| Mana model | Fixed budget entered by the user. Mana produced by the copies as they resolve is ignored (see Known simplifications). |
| Trigger input | Doublers and activated copiers come from a curated data file. Eldrazi spells cast in response are a plain count. |
| Result screen | The number plus a short breakdown. |
| Hosting | GitHub Pages, deployed by GitHub Actions on push to `main`. |
| Stack | Vite, TypeScript, `vite-plugin-pwa`, plain DOM for the UI, Vitest for tests. No UI framework. |

## Rules model

All of this follows from the printed card text and the official rulings on
Ulalek and Echoes of Eternity.

### How the loop works

Ulalek's trigger reads: "Whenever you cast an Eldrazi spell, you may pay
{C}{C}. If you do, copy all spells you control, then copy all other activated
and triggered abilities you control."

When a Ulalek trigger resolves and CC is paid, every spell on the stack is
copied (doubling them) and every *other* trigger on the stack is copied,
including other Ulalek triggers. The copied triggers are put on the stack
after the copied spells, so they sit on top and resolve first. Therefore:

- With exactly one Ulalek trigger, paying CC gives one copy and the chain
  ends.
- With two or more Ulalek triggers on the stack, each CC payment doubles the
  spells and recreates a spare trigger, so the number of doublings is limited
  only by colorless mana: `k = floor(C / 2)` payments.
- Copies created by Ulalek are not "cast", so cast triggers (Echoes' copy
  trigger, Glaring Fleshraker, Kozilek's Unsealing) never fire for copies.

### Sources of extra Ulalek triggers

1. **Static doublers**: permanents that make a triggered ability "trigger an
   additional time". Each one that applies to Ulalek adds one trigger per
   Eldrazi cast. Echoes of Eternity applies to colorless permanents. Roaming
   Throne (naming Eldrazi) applies to Eldrazi creatures. Delney applies to
   creatures with power 2 or less. Multiple copies stack.
2. **Activated copiers**: "copy target triggered ability" abilities that cost
   mana and tap. Each use adds one Ulalek trigger. Abstruse Archaic ({1},
   colorless sources only), Strionic Resonator ({2}), Peter Parker's Camera
   ({2} and a film counter). Because they tap, each gives one use per combo.
3. **Response spells**: another Eldrazi spell cast before any Ulalek trigger
   resolves. It triggers Ulalek again, and the new trigger is doubled by the
   static doublers just like the first one. The spell itself is also on the
   stack and gets doubled with everything else. Which card it is does not
   matter to the maths, so the app takes a count of such spells. They need
   not be colorless (Nameless Inversion is black but is an Eldrazi spell
   through changeling). The user enters the mana left after paying for
   them.

### Copies from static doublers

Echoes of Eternity also has its own cast trigger: "Whenever you cast a
colorless spell, copy it." Because Echoes is itself a colorless permanent,
a second Echoes makes the first one's copy trigger fire twice, and vice
versa. The ruling confirms: one Echoes gives 1 extra copy, two give 4, three
give 9. Roaming Throne and Delney do not copy spells and do not affect Echoes
(Echoes is not a creature).

### The formula

Notation:

- A permanent's *tags* describe it: `colorless`, `creature`, `eldrazi`,
  `enchantment`, `power-le-2`, and so on. Ulalek's tags are `colorless`,
  `creature`, `eldrazi`, `legendary`, `power-le-2`.
- A static doubler declares `affects`: the tags a permanent must have for
  the doubler to apply to it. It may also declare `copiesSpell`: the tags a
  spell must have for the doubler's own copy trigger to fire.
- `multiplicity(P)` for a permanent P = 1 + the number of static doubler
  instances D, other than P itself, whose `affects` tags are all present on
  P. Two copies of Echoes each count as an instance.

Then, for a main spell with tags S:

- `u = multiplicity(Ulalek)`: Ulalek triggers per Eldrazi cast.
- `c(S)` = sum, over every static doubler instance D with a `copiesSpell`
  whose tags are all present on S, of `multiplicity(D)`. This is the number
  of extra copies of the spell created by the doublers' own triggers. With
  two Echoes this gives 2 + 2 = 4, matching the ruling.
- `T = u * (1 if the main spell is an Eldrazi spell else 0) + u * (number of
  response spells) + (number of activated copiers used)`.
- `Cleft` = colorless mana left after paying for the activated copiers (see
  Mana payment).
- `k = floor(Cleft / 2)` if `T >= 2`; `min(1, floor(Cleft / 2))` if `T = 1`;
  `0` if `T = 0`.
- **Copies of the main spell on the stack at the end** =
  `(1 + c(S)) * 2^k`. Duplicates = copies minus 1.
- Each response spell is doubled by Ulalek too, so it ends up as at least
  `2^k` copies. Echoes would add more if the spell is colorless, but since
  the app does not know the card, it reports `2^k` as a secondary line when
  the count is above 0.

Worked examples (main spell is a colorless Eldrazi spell, C = 6 after
casting it):

| Setup | u | c | T | k | Copies |
| --- | --- | --- | --- | --- | --- |
| Nothing else | 1 | 0 | 1 | 1 | 2 |
| Archaic (pays 1 generic from a colored source) | 1 | 0 | 2 | 3 | 8 |
| One Echoes | 2 | 1 | 2 | 3 | 16 |
| Two Echoes | 3 | 4 | 3 | 3 | 40 |
| One Echoes plus Roaming Throne | 3 | 1 | 3 | 3 | 16 |
| One Eldrazi spell cast in response (its cost already deducted) | 1 | 0 | 2 | 3 | 8 |

### Mana payment

The pool is six non-negative integers: W, U, B, R, G, C, entered as the
mana left after casting the main spell and any response spells. A cost is a
number of generic symbols, a count per colored symbol, and a count of {C}
symbols.

The costs of the selected activated copiers are summed and paid before any
doubling:

1. Colored symbols are paid from the matching color. If any color is short,
   the calculation fails and names the first unaffordable card.
2. {C} symbols are paid from C. If short, same failure.
3. Generic symbols are paid from leftover colored mana first, and from C
   only when colored mana runs out. This preserves C for Ulalek. Since all
   leftover colored mana has no other use, the choice of which color pays
   generic does not matter and no search is needed.

`Cleft` is what remains in C. Leftover mana of every color is reported.

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
- Activated copiers are one use each. Untap effects are not modelled.
- Copies of a response spell are counted but nothing they do on resolution
  is modelled.

## Architecture

```
src/
  engine/
    cards.ts       card data: static doublers, activated copiers,
                   Ulalek's tags
    mana.ts        ManaPool and ManaCost types, parse cost strings,
                   pay(costs, pool) -> { ok, leftover } | { ok: false, card }
    calculate.ts   calculate(input) -> CalcResult (pure function)
    types.ts       shared types
  ui/
    render.ts      builds the form from the card data, renders results
    storage.ts     save and restore the last inputs in localStorage
  main.ts          wires engine, ui and PWA registration
  styles.css       theme and layout
index.html
public/            icons, favicon
tests/             Vitest specs for engine and a UI smoke test
.github/workflows/deploy.yml
```

### Engine

The engine has no DOM dependencies and is the only place the rules live.

`CalcInput`:

```ts
{
  pool: { W, U, B, R, G, C }            // integers >= 0
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
  copies: number            // of the main spell
  duplicates: number
  triggersPerCast: number   // u
  totalTriggers: number     // T
  doublerCopies: number     // c(S)
  payments: number          // k
  cLeftForUlalek: number
  leftover: ManaPool
  responseSpellCopies: number   // copies of each response spell, 0 if none
  notes: string[]           // e.g. "Single trigger: only one payment counts"
} | {
  ok: false
  error: string             // e.g. "Cannot pay for Strionic Resonator: needs 2 more mana"
}
```

Card data shape (`cards.ts`):

```ts
StaticDoubler   { id, name, tags, affects: Tag[], copiesSpell?: Tag[], maxCount, note? }
ActivatedCopier { id, name, cost: string, affectsSourceTags: Tag[], note? }
ULALEK_TAGS     Tag[]
```

Costs are strings in Scryfall notation, for example `"{1}{U}"` or
`"{C}{C}"`, parsed by `mana.ts`. Adding a card means adding one object and
one test.

Initial data:

- Static doublers: Echoes of Eternity (max 3), Roaming Throne (max 2),
  Delney, Streetwise Lookout (max 1).
- Activated copiers: Abstruse Archaic, Strionic Resonator, Peter Parker's
  Camera.

### UI

Single screen, mobile first, generated from the card data so that new
entries appear without UI changes.

1. **Mana pool**: six steppers (W, U, B, R, G, C) with 48 px tap targets,
   C shown first and emphasised. Label: "Mana left after casting your
   spells". Helper text: the app pays for the copiers below.
2. **Main spell**: two toggles, "Eldrazi spell" and "Colorless", both on by
   default.
3. **Battlefield**: one stepper per static doubler (0 to `maxCount`) and
   one toggle per activated copier, each showing its cost. Notes from the
   data show as helper text.
4. **Cast in response**: one stepper, "Eldrazi spells cast in response",
   with helper text: any Eldrazi spell cast before a trigger resolves
   (Eldritch Immunity, Nameless Inversion, Dimensional Infiltrator);
   subtract its cost from the mana above.
5. **Result panel**, sticky at the bottom: the copy count in large type,
   duplicates beneath it, then the breakdown lines: triggers per cast and
   total, doubler copies, mana spent and C left for Ulalek, number of
   payments, the formula, leftover mana, and any notes. Errors replace the
   number with the message.
6. Reset button in the header. Footer with the known simplifications.

Results update live on every input change. Inputs persist in localStorage
and are restored on load.

Visual direction: dark theme by default with a deep violet background and a
pale accent, light theme when the system prefers it. System font stack so
it works offline without font downloads. Generous spacing and large numerals
so it reads at arm's length during a game.

### PWA

`vite-plugin-pwa` with `registerType: 'autoUpdate'`, a manifest named
"Ulalek Calculator" in standalone display mode with a themed icon set, and
Workbox precaching of the built assets so the app opens offline. Vite
`base` is `/ulalek-calculator/` to match the Pages path.

## Error handling

The engine never throws on user input. Negative or non-integer mana is
clamped by the UI steppers; the engine additionally validates and returns
`ok: false` with a message. Unaffordable selections return the offending
card name. The UI shows these inline in the result panel.

## Testing

Engine tests (Vitest):

- Every row of the worked examples table.
- `multiplicity` and `c(S)` for: no doublers, one Echoes, two Echoes, three
  Echoes (9 copies), Echoes plus Throne, Delney alone, Throne alone.
- Non-Eldrazi main spell with and without an Eldrazi response spell.
- Non-colorless main spell with Echoes (no doubler copies).
- Each activated copier and its cost.
- An activated copier whose cost cannot be paid.
- Generic paid from colored before C, and leftover reporting.
- Odd C amounts, C = 0, C = 1 with two triggers.
- Response spell counts of 0, 1 and 2, and their reported copies.

UI: a smoke test that renders the form from the data, sets a few inputs and
checks the displayed number. CI runs `npm test` and `npm run build` on every
push and pull request.

## Deployment

`.github/workflows/deploy.yml`: on push to `main`, install, test, build,
upload the `dist` folder and deploy with the official GitHub Pages actions.
The README documents `npm run dev` for local debugging, how to open the dev
server from the phone on the same network, and how to install the deployed
app from Chrome on Android ("Add to Home screen").

## Out of scope

- Simulating the stack step by step, or mana produced mid-combo.
- Multiple rounds of the combo. Re-run the app with the new mana instead.
- Editing card data inside the app.
- Naming or costing individual response spells.
- Cost reducers and untap effects.
- Any deck other than this one, beyond what the data file allows.
