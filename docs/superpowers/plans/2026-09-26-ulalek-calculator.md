# Ulalek Copy Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PWA that, given colorless mana and the trigger doublers on the battlefield, reports the maximum number of copies Ulalek, Fused Atrocity produces and the exact order of play to get them.

**Architecture:** A pure TypeScript engine (`src/engine`) computes the result in closed form from a tag-based card data file and generates the line of play as plain sentences. A plain-DOM UI (`src/ui`) is generated from that data and persists inputs in localStorage. A stack simulator lives only in the test suite and must agree with the closed form over an input grid.

**Tech Stack:** Vite 8, TypeScript 5.9, vite-plugin-pwa 1.3, Vitest 5 (jsdom for the UI smoke test), GitHub Actions, GitHub Pages. No UI framework, no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-ulalek-calculator-design.md`

## Global Constraints

- Node `>= 22.12` (Vitest 5 requires it; the dev machine has Node 24).
- Dev dependencies and nothing else: `vite ^8.3.1`, `vite-plugin-pwa ^1.3.0`, `vitest ^5.0.2`, `typescript ^5.9.3`, `jsdom ^30.1.1`. Do not use TypeScript 7.
- Vite `base` is `/ulalek-calculator/`; the manifest `start_url` and `scope` are the same string.
- The app deducts no mana cost. The only mana input is colorless mana, an integer `>= 0`.
- Exponential counts are `bigint`. Never convert them to `number`.
- Card names appear verbatim from `src/engine/cards.ts`: "Echoes of Eternity", "Roaming Throne", "Delney, Streetwise Lookout", "Abstruse Archaic", "Strionic Resonator", "Peter Parker's Camera".
- All rules live in `src/engine`. The UI never computes anything.
- System font stack only; no font downloads.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- If `npm` fails with `EROFS` on `~/.npm` in a sandboxed shell, prefix the command with `npm_config_cache=$TMPDIR/npm-cache`.

## Review Focus

1. **Very large colorless values** (for example 200): the result must print the exact integer with separators, never `Infinity` or scientific notation. Pinned in Task 3 (`calculate` with 200 colorless) and Task 6 (typing 200 into the field).
2. **Stale saved state** from an older app version: missing card ids, an id that no longer exists, or a count above `maxCount` must load without an error and without dropping the rest of the saved input. Pinned in Task 6 (`normalizeInput` tests).
3. **localStorage unavailable** (private mode, blocked storage): the app must render and calculate normally. Pinned in Task 6 (storage tests with a throwing stub).
4. **Non-numeric or negative text in the colorless field**: must clamp to 0, not produce `NaN` in the result. Pinned in Task 6.
5. **Result panel open state** must survive a re-render caused by tapping a stepper; otherwise the line of play collapses every time the user changes a value. Pinned in Task 6.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.ts` (placeholder, replaced in Task 6)
- Create: `tests/smoke.test.ts` (deleted in Task 2)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test`, `npm run build`, `npm run dev` all work. Vitest picks up `tests/**/*.test.ts`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ulalek-calculator",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=22.12"
  },
  "scripts": {
    "dev": "vite --host",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "node scripts/make-icons.mjs"
  },
  "devDependencies": {
    "jsdom": "^30.1.1",
    "typescript": "^5.9.3",
    "vite": "^8.3.1",
    "vite-plugin-pwa": "^1.3.0",
    "vitest": "^5.0.2"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`** (the PWA plugin is configured here already; icons arrive in Task 7)

```ts
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/ulalek-calculator/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Ulalek Calculator',
        short_name: 'Ulalek',
        description:
          'How many copies Ulalek, Fused Atrocity makes, and the order of play to get them.',
        theme_color: '#1a1030',
        background_color: '#120b22',
        display: 'standalone',
        start_url: '/ulalek-calculator/',
        scope: '/ulalek-calculator/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1a1030" />
    <meta name="description" content="How many copies Ulalek, Fused Atrocity makes, and the order of play to get them." />
    <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <title>Ulalek Calculator</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `.gitignore`, the placeholder `src/main.ts` and a smoke test**

`.gitignore`:

```
node_modules
dist
dev-dist
```

`src/main.ts`:

```ts
document.getElementById('app')!.textContent = 'Ulalek Calculator';
```

`tests/smoke.test.ts`:

```ts
import { expect, it } from 'vitest';

it('runs tests', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Install and verify**

Run: `npm install`
Expected: a `package-lock.json` appears; no peer dependency errors.

Run: `npm test`
Expected: `1 passed`.

Run: `npm run build`
Expected: `dist/` contains `index.html`, a `manifest.webmanifest` and `sw.js`. A warning about missing icon files is acceptable at this point.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src/main.ts tests/smoke.test.ts
git commit -m "Scaffold Vite + TypeScript + PWA project

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Engine types, card data and multiplicity

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/cards.ts`
- Create: `src/engine/multiplicity.ts`
- Create: `tests/multiplicity.test.ts`
- Delete: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts`: `Tag`, `StaticDoubler`, `ActivatedCopier`, `MainSpell`, `CalcInput`, `CopierRole`, `CalcSuccess`, `CalcFailure`, `CalcResult`, `Step`.
  - `cards.ts`: `ULALEK_TAGS: Tag[]`, `STATIC_DOUBLERS: StaticDoubler[]`, `ACTIVATED_COPIERS: ActivatedCopier[]`.
  - `multiplicity.ts`: `hasAll(tags, required): boolean`, `doublerInstances(counts): StaticDoubler[]`, `multiplicityOf(permanentTags, others): number`, `ulalekTriggersPerCast(counts): number`, `mainSpellTags(spell): Tag[]`, `copyTriggers(counts, spellTags): CopyTriggerGroup[]`, `doublerCopies(counts, spellTags): number`, and the type `CopyTriggerGroup { doubler: StaticDoubler; count: number }`.

- [ ] **Step 1: Write `src/engine/types.ts`**

```ts
export type Tag =
  | 'colorless'
  | 'white'
  | 'creature'
  | 'enchantment'
  | 'artifact'
  | 'eldrazi'
  | 'legendary'
  | 'power-le-2';

/** A permanent that makes triggered abilities trigger an additional time. */
export interface StaticDoubler {
  id: string;
  name: string;
  /** Tags of the doubler itself, consulted when other doublers apply to it. */
  tags: Tag[];
  /** A permanent must carry all of these tags for this doubler to apply to it. */
  affects: Tag[];
  /** If set, the doubler also copies each spell you cast that carries all of these tags. */
  copiesSpell?: Tag[];
  /** Upper bound offered by the UI. */
  maxCount: number;
  note?: string;
}

/** A "copy target ability" activation. One use per combo because it taps. */
export interface ActivatedCopier {
  id: string;
  name: string;
  /** Display only: the cost the user deducts before entering colorless mana. */
  costText: string;
  /** The copied ability's source must carry all of these tags. Empty means any source. */
  affectsSourceTags: Tag[];
  note?: string;
}

export interface MainSpell {
  eldrazi: boolean;
  colorless: boolean;
}

export interface CalcInput {
  /** Colorless mana left after every cost has been paid. Integer >= 0. */
  colorless: number;
  mainSpell: MainSpell;
  /** Doubler id -> number of copies on the battlefield. */
  staticDoublers: Record<string, number>;
  /** Copier id -> whether it is activated this combo. */
  activatedCopiers: Record<string, boolean>;
  /** Eldrazi spells cast in response before any trigger resolves. Integer >= 0. */
  responseSpells: number;
}

/**
 * What the activated copiers are used for.
 * source: they target an Echoes trigger and sit under the response spell's Ulalek triggers, worth 2^k each.
 * immediate: they target an Echoes trigger with no response spell after them, worth 1 each.
 * trigger: they target a Ulalek trigger to provide the second trigger.
 * none: nothing useful to target, or no copiers selected.
 */
export type CopierRole = 'source' | 'immediate' | 'trigger' | 'none';

export interface CalcSuccess {
  ok: true;
  copies: bigint;
  duplicates: bigint;
  triggersPerCast: number;
  totalTriggers: number;
  doublerCopies: number;
  copiersUsed: number;
  copierRole: CopierRole;
  sources: number;
  immediate: number;
  payments: number;
  leftoverColorless: number;
  responseSpellCopies: bigint;
  notes: string[];
}

export interface CalcFailure {
  ok: false;
  error: string;
}

export type CalcResult = CalcSuccess | CalcFailure;

export interface Step {
  title: string;
  detail?: string;
}
```

- [ ] **Step 2: Write `src/engine/cards.ts`**

```ts
import type { ActivatedCopier, StaticDoubler, Tag } from './types';

/** Ulalek, Fused Atrocity: colorless (devoid) legendary Eldrazi creature, 2/5. */
export const ULALEK_TAGS: Tag[] = ['colorless', 'creature', 'eldrazi', 'legendary', 'power-le-2'];

export const STATIC_DOUBLERS: StaticDoubler[] = [
  {
    id: 'echoes',
    name: 'Echoes of Eternity',
    tags: ['colorless', 'enchantment', 'eldrazi'],
    affects: ['colorless'],
    copiesSpell: ['colorless'],
    maxCount: 3,
    note: 'Doubles triggers of your other colorless permanents and copies each colorless spell you cast. Two Echoes double each other.',
  },
  {
    id: 'throne',
    name: 'Roaming Throne',
    tags: ['colorless', 'artifact', 'creature', 'eldrazi'],
    affects: ['creature', 'eldrazi'],
    maxCount: 2,
    note: 'Naming Eldrazi. Only affects creatures, so it does not touch Echoes.',
  },
  {
    id: 'delney',
    name: 'Delney, Streetwise Lookout',
    tags: ['white', 'creature', 'legendary', 'power-le-2'],
    affects: ['creature', 'power-le-2'],
    maxCount: 1,
    note: 'Ulalek must have power 2 or less. It That Heralds the End turns this off.',
  },
];

export const ACTIVATED_COPIERS: ActivatedCopier[] = [
  {
    id: 'archaic',
    name: 'Abstruse Archaic',
    costText: '{1}, tap',
    affectsSourceTags: ['colorless'],
    note: 'Copies abilities from colorless sources only.',
  },
  {
    id: 'resonator',
    name: 'Strionic Resonator',
    costText: '{2}, tap',
    affectsSourceTags: [],
  },
  {
    id: 'camera',
    name: "Peter Parker's Camera",
    costText: '{2}, tap, remove a film counter',
    affectsSourceTags: [],
  },
];
```

- [ ] **Step 3: Write the failing tests in `tests/multiplicity.test.ts`** and delete `tests/smoke.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  copyTriggers,
  doublerCopies,
  doublerInstances,
  hasAll,
  mainSpellTags,
  multiplicityOf,
  ulalekTriggersPerCast,
} from '../src/engine/multiplicity';
import { STATIC_DOUBLERS } from '../src/engine/cards';

const COLORLESS_ELDRAZI = mainSpellTags({ eldrazi: true, colorless: true });

describe('hasAll', () => {
  it('is true when every required tag is present', () => {
    expect(hasAll(['colorless', 'creature'], ['creature'])).toBe(true);
    expect(hasAll(['colorless', 'creature'], [])).toBe(true);
  });
  it('is false when a required tag is missing', () => {
    expect(hasAll(['colorless'], ['creature'])).toBe(false);
  });
});

describe('doublerInstances', () => {
  it('expands counts into one entry per copy and ignores unknown ids', () => {
    const list = doublerInstances({ echoes: 2, throne: 1, bogus: 4 });
    expect(list.map((d) => d.id)).toEqual(['echoes', 'echoes', 'throne']);
  });
});

describe('multiplicityOf', () => {
  it('is 1 with no doublers', () => {
    expect(multiplicityOf(['colorless', 'creature'], [])).toBe(1);
  });
  it('adds one per doubler whose affects tags are all present', () => {
    const echoes = STATIC_DOUBLERS.find((d) => d.id === 'echoes')!;
    const throne = STATIC_DOUBLERS.find((d) => d.id === 'throne')!;
    expect(multiplicityOf(['colorless', 'creature', 'eldrazi'], [echoes, throne])).toBe(3);
    expect(multiplicityOf(['colorless', 'enchantment'], [echoes, throne])).toBe(2);
  });
});

describe('ulalekTriggersPerCast', () => {
  it.each([
    [{}, 1],
    [{ echoes: 1 }, 2],
    [{ echoes: 2 }, 3],
    [{ echoes: 3 }, 4],
    [{ throne: 1 }, 2],
    [{ throne: 2 }, 3],
    [{ delney: 1 }, 2],
    [{ echoes: 1, throne: 1 }, 3],
    [{ echoes: 2, throne: 2, delney: 1 }, 6],
  ])('%o -> %i', (counts, expected) => {
    expect(ulalekTriggersPerCast(counts)).toBe(expected);
  });
});

describe('copyTriggers / doublerCopies', () => {
  it.each([
    [{}, 0],
    [{ echoes: 1 }, 1],
    [{ echoes: 2 }, 4],
    [{ echoes: 3 }, 9],
    [{ throne: 1 }, 0],
    [{ delney: 1 }, 0],
    [{ echoes: 1, throne: 1 }, 1],
    [{ echoes: 2, throne: 2, delney: 1 }, 4],
  ])('colorless spell with %o -> %i copies', (counts, expected) => {
    expect(doublerCopies(counts, COLORLESS_ELDRAZI)).toBe(expected);
  });

  it('gives no copies for a non-colorless spell', () => {
    expect(doublerCopies({ echoes: 2 }, mainSpellTags({ eldrazi: true, colorless: false }))).toBe(0);
  });

  it('groups by doubler and carries the doubler definition', () => {
    const groups = copyTriggers({ echoes: 2 }, COLORLESS_ELDRAZI);
    expect(groups).toHaveLength(1);
    expect(groups[0].doubler.id).toBe('echoes');
    expect(groups[0].count).toBe(4);
  });
});

describe('mainSpellTags', () => {
  it('maps the two toggles to tags', () => {
    expect(mainSpellTags({ eldrazi: true, colorless: true })).toEqual(['eldrazi', 'colorless']);
    expect(mainSpellTags({ eldrazi: false, colorless: false })).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `rm tests/smoke.test.ts && npm test`
Expected: FAIL, "Failed to resolve import ../src/engine/multiplicity".

- [ ] **Step 5: Write `src/engine/multiplicity.ts`**

```ts
import { STATIC_DOUBLERS, ULALEK_TAGS } from './cards';
import type { MainSpell, StaticDoubler, Tag } from './types';

export function hasAll(tags: readonly Tag[], required: readonly Tag[]): boolean {
  return required.every((t) => tags.includes(t));
}

/** One entry per copy of each static doubler on the battlefield. Unknown ids are ignored. */
export function doublerInstances(counts: Record<string, number>): StaticDoubler[] {
  const out: StaticDoubler[] = [];
  for (const d of STATIC_DOUBLERS) {
    const n = counts[d.id] ?? 0;
    for (let i = 0; i < n; i++) out.push(d);
  }
  return out;
}

/** How many times a triggered ability of a permanent with these tags triggers, given the other doublers. */
export function multiplicityOf(permanentTags: readonly Tag[], others: readonly StaticDoubler[]): number {
  return 1 + others.filter((d) => hasAll(permanentTags, d.affects)).length;
}

export function ulalekTriggersPerCast(counts: Record<string, number>): number {
  return multiplicityOf(ULALEK_TAGS, doublerInstances(counts));
}

export function mainSpellTags(spell: MainSpell): Tag[] {
  const tags: Tag[] = [];
  if (spell.eldrazi) tags.push('eldrazi');
  if (spell.colorless) tags.push('colorless');
  return tags;
}

export interface CopyTriggerGroup {
  doubler: StaticDoubler;
  count: number;
}

/**
 * Copy triggers tied to a spell with these tags, grouped by doubler.
 * Each doubler instance that copies the spell fires once, plus once more for every
 * other instance whose `affects` tags it carries. Two Echoes therefore give 2 + 2.
 */
export function copyTriggers(counts: Record<string, number>, spellTags: readonly Tag[]): CopyTriggerGroup[] {
  const all = doublerInstances(counts);
  const groups = new Map<string, CopyTriggerGroup>();
  all.forEach((d, i) => {
    if (!d.copiesSpell || !hasAll(spellTags, d.copiesSpell)) return;
    const others = all.filter((_, j) => j !== i);
    const fires = multiplicityOf(d.tags, others);
    const group = groups.get(d.id) ?? { doubler: d, count: 0 };
    group.count += fires;
    groups.set(d.id, group);
  });
  return [...groups.values()];
}

export function doublerCopies(counts: Record<string, number>, spellTags: readonly Tag[]): number {
  return copyTriggers(counts, spellTags).reduce((sum, g) => sum + g.count, 0);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: all tests in `tests/multiplicity.test.ts` pass (about 30 cases).

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/cards.ts src/engine/multiplicity.ts tests/multiplicity.test.ts
git rm -q tests/smoke.test.ts
git commit -m "Add engine types, card data and trigger multiplicity

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The calculation

**Files:**
- Create: `src/engine/calculate.ts`
- Create: `tests/calculate.test.ts`
- Create: `tests/fixtures.ts`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces:
  - `calculate(input: CalcInput): CalcResult`
  - `validate(input: CalcInput): string | null`
  - `selectedCopiers(input: CalcInput): ActivatedCopier[]` (in data-file order)
  - `tests/fixtures.ts`: `mk(overrides?): CalcInput` with overrides `{ colorless?, mainSpell?: Partial<MainSpell>, doublers?: Record<string, number>, copiers?: string[], responseSpells? }`

- [ ] **Step 1: Write `tests/fixtures.ts`**

```ts
import type { CalcInput } from '../src/engine/types';

interface Overrides {
  colorless?: number;
  mainSpell?: Partial<CalcInput['mainSpell']>;
  doublers?: Record<string, number>;
  copiers?: string[];
  responseSpells?: number;
}

/** A colorless Eldrazi main spell with 6 colorless mana and nothing else, unless overridden. */
export function mk(o: Overrides = {}): CalcInput {
  return {
    colorless: o.colorless ?? 6,
    mainSpell: { eldrazi: true, colorless: true, ...o.mainSpell },
    staticDoublers: { echoes: 0, throne: 0, delney: 0, ...o.doublers },
    activatedCopiers: {
      archaic: (o.copiers ?? []).includes('archaic'),
      resonator: (o.copiers ?? []).includes('resonator'),
      camera: (o.copiers ?? []).includes('camera'),
    },
    responseSpells: o.responseSpells ?? 0,
  };
}
```

- [ ] **Step 2: Write the failing tests in `tests/calculate.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { calculate, selectedCopiers, validate } from '../src/engine/calculate';
import { mk } from './fixtures';

function ok(input = mk()) {
  const r = calculate(input);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('worked examples from the spec (C = 6)', () => {
  it.each([
    ['nothing else', mk(), 1, 0, 1, 1, 1, 0, 2n],
    ['Archaic', mk({ copiers: ['archaic'] }), 1, 0, 2, 3, 1, 0, 8n],
    ['one response spell', mk({ responseSpells: 1 }), 1, 0, 2, 3, 1, 0, 8n],
    ['one Echoes', mk({ doublers: { echoes: 1 } }), 2, 1, 2, 3, 2, 0, 16n],
    ['one Echoes, Archaic', mk({ doublers: { echoes: 1 }, copiers: ['archaic'] }), 2, 1, 2, 3, 2, 1, 17n],
    [
      'one Echoes, Archaic, one response spell',
      mk({ doublers: { echoes: 1 }, copiers: ['archaic'], responseSpells: 1 }),
      2, 1, 4, 3, 3, 0, 24n,
    ],
    ['two Echoes', mk({ doublers: { echoes: 2 } }), 3, 4, 3, 3, 5, 0, 40n],
    [
      'two Echoes, Archaic and Resonator, one response spell',
      mk({ doublers: { echoes: 2 }, copiers: ['archaic', 'resonator'], responseSpells: 1 }),
      3, 4, 6, 3, 7, 0, 56n,
    ],
    ['one Echoes plus Roaming Throne', mk({ doublers: { echoes: 1, throne: 1 } }), 3, 1, 3, 3, 2, 0, 16n],
    [
      'non-Eldrazi colorless spell, one Echoes, no response',
      mk({ mainSpell: { eldrazi: false }, doublers: { echoes: 1 } }),
      2, 1, 0, 0, 2, 0, 2n,
    ],
    [
      'non-Eldrazi colorless spell, one Echoes, one response',
      mk({ mainSpell: { eldrazi: false }, doublers: { echoes: 1 }, responseSpells: 1 }),
      2, 1, 2, 3, 2, 0, 16n,
    ],
  ])('%s', (_name, input, u, c, T, k, sources, immediate, copies) => {
    const r = ok(input);
    expect(r.triggersPerCast).toBe(u);
    expect(r.doublerCopies).toBe(c);
    expect(r.totalTriggers).toBe(T);
    expect(r.payments).toBe(k);
    expect(r.sources).toBe(sources);
    expect(r.immediate).toBe(immediate);
    expect(r.copies).toBe(copies);
    expect(r.duplicates).toBe(copies - 1n);
  });
});

describe('copier allocation', () => {
  it('source: Echoes trigger available and a response spell follows', () => {
    const r = ok(mk({ doublers: { echoes: 1 }, copiers: ['camera'], responseSpells: 1 }));
    expect(r.copierRole).toBe('source');
    expect(r.sources).toBe(3);
    expect(r.totalTriggers).toBe(4);
  });
  it('immediate: Echoes trigger available, no response spell', () => {
    const r = ok(mk({ doublers: { echoes: 1 }, copiers: ['resonator', 'camera'] }));
    expect(r.copierRole).toBe('immediate');
    expect(r.immediate).toBe(2);
    expect(r.copies).toBe(18n);
  });
  it('trigger: no Echoes trigger, Ulalek triggers at least once', () => {
    const r = ok(mk({ copiers: ['archaic', 'resonator'] }));
    expect(r.copierRole).toBe('trigger');
    expect(r.totalTriggers).toBe(3);
    expect(r.copies).toBe(8n);
  });
  it('trigger: non-colorless main spell with Echoes has no Echoes trigger to copy', () => {
    const r = ok(mk({ mainSpell: { colorless: false }, doublers: { echoes: 1 }, copiers: ['archaic'] }));
    expect(r.doublerCopies).toBe(0);
    expect(r.copierRole).toBe('trigger');
    expect(r.copies).toBe(8n);
  });
  it('none: Ulalek never triggers and there is no Echoes trigger', () => {
    const r = ok(mk({ mainSpell: { eldrazi: false }, copiers: ['archaic'] }));
    expect(r.copierRole).toBe('none');
    expect(r.copies).toBe(1n);
  });
  it('none: no copiers selected', () => {
    expect(ok(mk()).copierRole).toBe('none');
    expect(ok(mk()).copiersUsed).toBe(0);
  });
});

describe('payments and leftover', () => {
  it('caps payments at one with a single Ulalek trigger', () => {
    const r = ok(mk({ colorless: 10 }));
    expect(r.payments).toBe(1);
    expect(r.leftoverColorless).toBe(8);
    expect(r.copies).toBe(2n);
  });
  it('uses floor(C/2) with two triggers and reports the odd mana', () => {
    const r = ok(mk({ colorless: 7, doublers: { echoes: 1 } }));
    expect(r.payments).toBe(3);
    expect(r.leftoverColorless).toBe(1);
  });
  it('makes no payment with C = 0 or C = 1', () => {
    expect(ok(mk({ colorless: 0, doublers: { echoes: 1 } })).copies).toBe(2n);
    expect(ok(mk({ colorless: 1, doublers: { echoes: 1 } })).copies).toBe(2n);
  });
  it('handles very large mana exactly', () => {
    const r = ok(mk({ colorless: 200, doublers: { echoes: 1 } }));
    expect(r.payments).toBe(100);
    expect(r.copies).toBe(2n ** 101n);
    expect(r.copies.toString()).toBe('2535301200456458802993406410752');
  });
});

describe('response spells', () => {
  it('reports 0n copies when none are cast', () => {
    expect(ok(mk()).responseSpellCopies).toBe(0n);
  });
  it('reports 2^k copies per response spell', () => {
    expect(ok(mk({ responseSpells: 1 })).responseSpellCopies).toBe(8n);
    expect(ok(mk({ responseSpells: 2 })).responseSpellCopies).toBe(8n);
  });
  it('two response spells give the same main-spell count as one', () => {
    expect(ok(mk({ responseSpells: 2 })).copies).toBe(8n);
  });
});

describe('notes', () => {
  const has = (input: ReturnType<typeof mk>, fragment: string) =>
    ok(input).notes.some((n) => n.includes(fragment));

  it('single trigger', () => {
    expect(has(mk(), 'Only one Ulalek trigger')).toBe(true);
    expect(has(mk({ copiers: ['archaic'] }), 'Only one Ulalek trigger')).toBe(false);
  });
  it('never triggers', () => {
    expect(has(mk({ mainSpell: { eldrazi: false } }), 'Ulalek never triggers')).toBe(true);
    expect(has(mk({ mainSpell: { eldrazi: false }, responseSpells: 1 }), 'Ulalek never triggers')).toBe(false);
  });
  it('response spell adds nothing', () => {
    expect(has(mk({ doublers: { echoes: 1 }, responseSpells: 1 }), 'response spell adds nothing')).toBe(true);
    expect(has(mk({ doublers: { echoes: 1 }, responseSpells: 1, copiers: ['archaic'] }), 'response spell adds nothing')).toBe(false);
    expect(has(mk({ responseSpells: 1 }), 'response spell adds nothing')).toBe(false);
  });
  it('immediate copiers could be doubled', () => {
    expect(has(mk({ doublers: { echoes: 1 }, copiers: ['archaic'] }), 'Without a response spell')).toBe(true);
  });
  it('copiers add nothing with two triggers and no Echoes', () => {
    expect(has(mk({ doublers: { throne: 1 }, copiers: ['archaic'] }), 'Copiers add nothing')).toBe(true);
  });
  it('only the first copier matters', () => {
    expect(has(mk({ copiers: ['archaic', 'camera'] }), 'Only the first copier')).toBe(true);
    expect(has(mk({ copiers: ['archaic'] }), 'Only the first copier')).toBe(false);
  });
  it('copiers have nothing to target', () => {
    expect(has(mk({ mainSpell: { eldrazi: false }, copiers: ['archaic'] }), 'nothing to target')).toBe(true);
  });
  it('is empty for a clean two-Echoes line', () => {
    expect(ok(mk({ doublers: { echoes: 2 } })).notes).toEqual([]);
  });
});

describe('validate', () => {
  it('accepts a normal input', () => {
    expect(validate(mk())).toBeNull();
  });
  it.each([
    [mk({ colorless: -1 }), 'Colorless mana'],
    [mk({ colorless: 1.5 }), 'Colorless mana'],
    [mk({ colorless: Number.NaN }), 'Colorless mana'],
    [mk({ responseSpells: -2 }), 'Response spells'],
    [mk({ doublers: { echoes: 4 } }), 'Echoes of Eternity count must be between 0 and 3'],
    [mk({ doublers: { delney: -1 } }), 'Delney, Streetwise Lookout count'],
  ])('rejects %o', (input, fragment) => {
    const r = calculate(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(fragment);
  });
});

describe('selectedCopiers', () => {
  it('returns selected copiers in data-file order', () => {
    expect(selectedCopiers(mk({ copiers: ['camera', 'archaic'] })).map((c) => c.id)).toEqual(['archaic', 'camera']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/calculate.test.ts`
Expected: FAIL, "Failed to resolve import ../src/engine/calculate".

- [ ] **Step 4: Write `src/engine/calculate.ts`**

```ts
import { ACTIVATED_COPIERS, STATIC_DOUBLERS, ULALEK_TAGS } from './cards';
import { copyTriggers, hasAll, mainSpellTags, ulalekTriggersPerCast } from './multiplicity';
import type { ActivatedCopier, CalcInput, CalcResult, CopierRole } from './types';

function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** Returns an error message, or null when the input is usable. */
export function validate(input: CalcInput): string | null {
  if (!isCount(input.colorless)) return 'Colorless mana must be a whole number of 0 or more.';
  if (!isCount(input.responseSpells)) return 'Response spells must be a whole number of 0 or more.';
  for (const d of STATIC_DOUBLERS) {
    const n = input.staticDoublers[d.id] ?? 0;
    if (!isCount(n) || n > d.maxCount) return `${d.name} count must be between 0 and ${d.maxCount}.`;
  }
  return null;
}

/** The activated copiers switched on, in data-file order. */
export function selectedCopiers(input: CalcInput): ActivatedCopier[] {
  return ACTIVATED_COPIERS.filter((c) => input.activatedCopiers[c.id] === true);
}

export function calculate(input: CalcInput): CalcResult {
  const error = validate(input);
  if (error) return { ok: false, error };

  // u: Ulalek triggers per Eldrazi cast. c: Echoes-style copies of the main spell.
  const u = ulalekTriggersPerCast(input.staticDoublers);
  const eGroups = copyTriggers(input.staticDoublers, mainSpellTags(input.mainSpell));
  const c = eGroups.reduce((sum, g) => sum + g.count, 0);
  const m = input.mainSpell.eldrazi ? 1 : 0;
  const r = input.responseSpells;
  const spellTriggers = u * m + u * r;

  // Copier allocation, see the spec's "The line of play".
  const copiers = selectedCopiers(input);
  let asSource = 0;
  let asImmediate = 0;
  let asTrigger = 0;
  for (const cp of copiers) {
    const canTargetE = c > 0 && eGroups.some((g) => hasAll(g.doubler.tags, cp.affectsSourceTags));
    const canTargetU = spellTriggers >= 1 && hasAll(ULALEK_TAGS, cp.affectsSourceTags);
    if (canTargetE) {
      if (r > 0) asSource++;
      else asImmediate++;
    } else if (canTargetU) {
      asTrigger++;
    }
  }
  const totalTriggers = spellTriggers + asTrigger;
  const copierRole: CopierRole =
    asSource > 0 ? 'source' : asImmediate > 0 ? 'immediate' : asTrigger > 0 ? 'trigger' : 'none';

  const sources = 1 + c + asSource;
  const immediate = asImmediate;
  const half = Math.floor(input.colorless / 2);
  const payments = totalTriggers === 0 ? 0 : totalTriggers === 1 ? Math.min(1, half) : half;
  const pow = 2n ** BigInt(payments);
  const copies = BigInt(sources) * pow + BigInt(immediate);

  const notes: string[] = [];
  if (totalTriggers === 0) {
    notes.push(
      'Ulalek never triggers: the main spell is not an Eldrazi spell and no Eldrazi spell is cast in response.',
    );
  }
  if (totalTriggers === 1) {
    notes.push(
      'Only one Ulalek trigger: only the first {C}{C} payment does anything. A copier or a response spell would unlock the full loop.',
    );
  }
  if (r > 0 && copiers.length === 0 && u * m >= 2) {
    notes.push(
      'The response spell adds nothing here: you already have two Ulalek triggers and no copier to put under it.',
    );
  }
  if (copierRole === 'immediate') {
    notes.push(
      'Without a response spell each copier is worth one extra copy. Cast an Eldrazi spell after activating them to double their copies with the rest.',
    );
  }
  if (copiers.length > 0 && c === 0 && spellTriggers >= 2) {
    notes.push('Copiers add nothing here: there is no Echoes trigger to copy and you already have two Ulalek triggers.');
  }
  if (copiers.length > 1 && c === 0 && spellTriggers === 1) {
    notes.push('Only the first copier matters: it provides the second Ulalek trigger.');
  }
  if (copiers.length > 0 && copierRole === 'none') {
    notes.push('Copiers have nothing to target: Ulalek never triggers and there is no Echoes trigger.');
  }

  return {
    ok: true,
    copies,
    duplicates: copies - 1n,
    triggersPerCast: u,
    totalTriggers,
    doublerCopies: c,
    copiersUsed: copiers.length,
    copierRole,
    sources,
    immediate,
    payments,
    leftoverColorless: input.colorless - 2 * payments,
    responseSpellCopies: r > 0 ? pow : 0n,
    notes,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all pass. If a worked-example row fails, the row is right and the code is wrong: re-read the spec's "The line of play" before changing the test.

- [ ] **Step 6: Commit**

```bash
git add src/engine/calculate.ts tests/calculate.test.ts tests/fixtures.ts
git commit -m "Add closed-form copy calculation with copier allocation and notes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The line of play

**Files:**
- Create: `src/engine/line.ts`
- Create: `tests/line.test.ts`

**Interfaces:**
- Consumes: `calculate`, `selectedCopiers` (Task 3); `CalcInput`, `CalcResult`, `Step` (Task 2); `mk` (Task 3 fixtures).
- Produces: `describeLine(input: CalcInput, result: CalcResult): Step[]` and `formatCount(n: bigint | number): string` (thousands separators, en-US).

- [ ] **Step 1: Write the failing tests in `tests/line.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { calculate } from '../src/engine/calculate';
import { describeLine, formatCount } from '../src/engine/line';
import { mk } from './fixtures';

function line(input = mk()) {
  return describeLine(input, calculate(input));
}
const titles = (input = mk()) => line(input).map((s) => s.title);

describe('formatCount', () => {
  it('adds thousands separators to bigint and number', () => {
    expect(formatCount(2n ** 20n)).toBe('1,048,576');
    expect(formatCount(7)).toBe('7');
  });
});

describe('describeLine', () => {
  it('returns no steps for an invalid input', () => {
    expect(line(mk({ colorless: -1 }))).toEqual([]);
  });

  it('nothing else: cast, pay once, resolve, result', () => {
    expect(titles()).toEqual([
      'Cast the main spell.',
      'Let the top Ulalek trigger resolve and pay {C}{C}.',
      'Stop paying and let everything resolve.',
      'Result: 2 copies of the main spell (1 new).',
    ]);
    expect(line()[0].detail).toContain('Ulalek triggers 1 time.');
  });

  it('one Echoes: orders Echoes under Ulalek and repeats payments', () => {
    const steps = line(mk({ doublers: { echoes: 1 } }));
    expect(steps.map((s) => s.title)).toEqual([
      'Cast the main spell.',
      'Let the top Ulalek trigger resolve and pay {C}{C}.',
      'Repeat until you have paid 3 times.',
      'Stop paying and let everything resolve.',
      'Result: 16 copies of the main spell (15 new).',
    ]);
    expect(steps[0].detail).toContain('Ulalek triggers 2 times.');
    expect(steps[0].detail).toContain('Echoes triggers 1 time.');
    expect(steps[0].detail).toContain('Put the Echoes trigger on the stack first, then the Ulalek triggers on top.');
    expect(steps[2].detail).toContain('2 copy sources become 16');
    expect(steps[3].detail).toBe('Each Echoes trigger copies the main spell, every copy of the main spell resolves.');
  });

  it('Echoes with copier and response spell: copiers before the response spell', () => {
    const steps = line(mk({ doublers: { echoes: 1 }, copiers: ['archaic'], responseSpells: 1 }));
    expect(steps.map((s) => s.title)).toEqual([
      'Cast the main spell.',
      'Activate Abstruse Archaic, targeting an Echoes trigger.',
      'Cast your Eldrazi spell in response.',
      'Let the top Ulalek trigger resolve and pay {C}{C}.',
      'Repeat until you have paid 3 times.',
      'Stop paying and let everything resolve.',
      'Result: 24 copies of the main spell (23 new).',
    ]);
    expect(steps[1].detail).toContain('Hold priority');
    expect(steps[2].detail).toContain('above the copier abilities');
    expect(steps[5].detail).toBe(
      'Each copier ability copies an Echoes trigger, each Echoes trigger copies the main spell, every copy of the main spell resolves.',
    );
    expect(steps[6].detail).toContain('Each response spell: 8 copies.');
    expect(steps[6].detail).toContain('Leftover colorless mana: 0.');
  });

  it('copier with no Echoes targets a Ulalek trigger', () => {
    const steps = line(mk({ copiers: ['archaic', 'resonator'] }));
    expect(steps[1].title).toBe('Activate Abstruse Archaic and Strionic Resonator, targeting a Ulalek trigger.');
  });

  it('copier with Echoes but no response spell is immediate', () => {
    const steps = line(mk({ doublers: { echoes: 1 }, copiers: ['camera'] }));
    expect(steps[1].title).toBe("Activate Peter Parker's Camera, targeting an Echoes trigger.");
    expect(steps[1].detail).toContain('resolves right away');
  });

  it('copier with nothing to target is skipped', () => {
    const steps = line(mk({ mainSpell: { eldrazi: false }, copiers: ['archaic'] }));
    expect(steps[1].title).toBe('Skip Abstruse Archaic.');
  });

  it('non-Eldrazi main spell with no response: no payments', () => {
    const steps = line(mk({ mainSpell: { eldrazi: false }, doublers: { echoes: 1 } }));
    expect(steps.map((s) => s.title)).toEqual([
      'Cast the main spell.',
      'Let everything resolve.',
      'Result: 2 copies of the main spell (1 new).',
    ]);
    expect(steps[0].detail).toContain('Ulalek does not trigger');
  });

  it('two response spells are pluralised', () => {
    expect(titles(mk({ responseSpells: 2 }))).toContain('Cast your 2 Eldrazi spells in response.');
  });

  it('lists three copiers with commas', () => {
    const steps = line(mk({ doublers: { echoes: 1 }, copiers: ['archaic', 'resonator', 'camera'], responseSpells: 1 }));
    expect(steps[1].title).toBe(
      "Activate Abstruse Archaic, Strionic Resonator and Peter Parker's Camera, targeting an Echoes trigger.",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/line.test.ts`
Expected: FAIL, "Failed to resolve import ../src/engine/line".

- [ ] **Step 3: Write `src/engine/line.ts`**

```ts
import { selectedCopiers } from './calculate';
import type { CalcInput, CalcResult, Step } from './types';

export function formatCount(n: bigint | number): string {
  return n.toLocaleString('en-US');
}

function times(n: number, noun = 'time'): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function nameList(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The order of play that reaches the result, as plain sentences. Empty for an invalid input. */
export function describeLine(input: CalcInput, result: CalcResult): Step[] {
  if (!result.ok) return [];
  const steps: Step[] = [];
  const u = result.triggersPerCast;
  const c = result.doublerCopies;
  const k = result.payments;
  const r = input.responseSpells;
  const copierNames = selectedCopiers(input).map((cp) => cp.name);

  // 1. Cast the main spell.
  {
    const parts: string[] = [];
    if (input.mainSpell.eldrazi) parts.push(`Ulalek triggers ${times(u)}.`);
    else parts.push('Ulalek does not trigger: it is not an Eldrazi spell.');
    if (c > 0) {
      parts.push(`Echoes triggers ${times(c)}.`);
      const echoesWord = c === 1 ? 'trigger' : 'triggers';
      const thenUlalek = input.mainSpell.eldrazi ? ', then the Ulalek triggers on top' : '';
      parts.push(`Put the Echoes ${echoesWord} on the stack first${thenUlalek}.`);
    }
    steps.push({ title: 'Cast the main spell.', detail: parts.join(' ') });
  }

  // 2. Activate copiers.
  if (copierNames.length > 0) {
    const names = nameList(copierNames);
    switch (result.copierRole) {
      case 'source':
        steps.push({
          title: `Activate ${names}, targeting an Echoes trigger.`,
          detail: 'Hold priority: the response spell must be cast while these abilities are still on the stack.',
        });
        break;
      case 'immediate':
        steps.push({
          title: `Activate ${names}, targeting an Echoes trigger.`,
          detail: 'Each one makes one extra copy that resolves right away.',
        });
        break;
      case 'trigger':
        steps.push({
          title: `Activate ${names}, targeting a Ulalek trigger.`,
          detail: 'This puts a second Ulalek trigger on the stack so the loop can continue.',
        });
        break;
      case 'none':
        steps.push({ title: `Skip ${names}.`, detail: 'There is nothing useful to target.' });
        break;
    }
  }

  // 3. Cast the response spell(s).
  if (r > 0) {
    const above = result.copierRole === 'source' ? ', above the copier abilities' : '';
    steps.push({
      title: r === 1 ? 'Cast your Eldrazi spell in response.' : `Cast your ${r} Eldrazi spells in response.`,
      detail: `Ulalek triggers ${times(u, 'more time')} per spell. Put those triggers on top of the stack${above}.`,
    });
  }

  // 4 and 5. Pay.
  if (k > 0) {
    steps.push({
      title: 'Let the top Ulalek trigger resolve and pay {C}{C}.',
      detail:
        'Put the spell copies on the stack, then the ability copies, with the Ulalek copies on top of the Echoes and copier copies.',
    });
    if (k > 1) {
      const final = BigInt(result.sources) * 2n ** BigInt(k);
      steps.push({
        title: `Repeat until you have paid ${k} times.`,
        detail: `After each payment everything under the Ulalek copies doubles: ${result.sources} copy sources become ${formatCount(final)} after the last payment.`,
      });
    }
  }

  // 6. Resolve.
  {
    const parts: string[] = [];
    if (result.copierRole === 'source' || result.copierRole === 'immediate') {
      parts.push('each copier ability copies an Echoes trigger');
    }
    if (c > 0) parts.push('each Echoes trigger copies the main spell');
    parts.push('every copy of the main spell resolves');
    const detail = parts.join(', ');
    steps.push({
      title: k > 0 ? 'Stop paying and let everything resolve.' : 'Let everything resolve.',
      detail: detail.charAt(0).toUpperCase() + detail.slice(1) + '.',
    });
  }

  // 7. Result.
  {
    const parts: string[] = [];
    if (r > 0) parts.push(`Each response spell: ${formatCount(result.responseSpellCopies)} copies.`);
    parts.push(`Leftover colorless mana: ${result.leftoverColorless}.`);
    steps.push({
      title: `Result: ${formatCount(result.copies)} copies of the main spell (${formatCount(result.duplicates)} new).`,
      detail: parts.join(' '),
    });
  }

  return steps;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/line.ts tests/line.test.ts
git commit -m "Generate the line of play from the calculation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Stack simulator as test oracle

**Files:**
- Create: `tests/simulator.ts`
- Create: `tests/simulator.test.ts`

**Interfaces:**
- Consumes: `ACTIVATED_COPIERS`, `STATIC_DOUBLERS`, `ULALEK_TAGS` (Task 2 data), `CalcInput`, `Tag`, `StaticDoubler` (Task 2 types), `calculate` (Task 3), `mk` (Task 3).
- Produces: `simulate(input: CalcInput): SimResult` where `SimResult { mainSpellCopies: number; responseSpellCopies: number; paymentsMade: number; leftover: number }`. Test-only; never imported by `src`.

The simulator deliberately re-implements the tag arithmetic instead of importing `multiplicity.ts`, so that a mistake there is caught too.

- [ ] **Step 1: Write `tests/simulator.ts`**

```ts
import { ACTIVATED_COPIERS, STATIC_DOUBLERS, ULALEK_TAGS } from '../src/engine/cards';
import type { CalcInput, StaticDoubler, Tag } from '../src/engine/types';

/**
 * Objects on the stack. Index 0 is the bottom.
 * S: the main spell or a copy of it.
 * R: a response spell or a copy of it.
 * U: a Ulalek trigger (pay {C}{C} on resolution to copy everything else).
 * E: an Echoes copy trigger tied to the main spell.
 * A: a copier ability with the kind of ability it targets.
 */
type Item =
  | { kind: 'S' }
  | { kind: 'R' }
  | { kind: 'U' }
  | { kind: 'E' }
  | { kind: 'A'; target: 'E' | 'U' };

export interface SimResult {
  mainSpellCopies: number;
  responseSpellCopies: number;
  paymentsMade: number;
  leftover: number;
}

const has = (tags: readonly Tag[], required: readonly Tag[]) => required.every((t) => tags.includes(t));

function instances(counts: Record<string, number>): StaticDoubler[] {
  const out: StaticDoubler[] = [];
  for (const d of STATIC_DOUBLERS) for (let i = 0; i < (counts[d.id] ?? 0); i++) out.push(d);
  return out;
}

/** Replays the spec's line of play on an explicit stack and counts what resolves. */
export function simulate(input: CalcInput): SimResult {
  const all = instances(input.staticDoublers);
  const u = 1 + all.filter((d) => has(ULALEK_TAGS, d.affects)).length;
  const spellTags: Tag[] = [];
  if (input.mainSpell.eldrazi) spellTags.push('eldrazi');
  if (input.mainSpell.colorless) spellTags.push('colorless');

  // Echoes-style triggers tied to the main spell, one entry per trigger with its source's tags.
  const eSources: Tag[][] = [];
  all.forEach((d, i) => {
    if (!d.copiesSpell || !has(spellTags, d.copiesSpell)) return;
    const fires = 1 + all.filter((o, j) => j !== i && has(d.tags, o.affects)).length;
    for (let n = 0; n < fires; n++) eSources.push(d.tags);
  });

  // Cast the main spell: E triggers first (bottom), then U triggers on top.
  const stack: Item[] = [{ kind: 'S' }];
  for (let i = 0; i < eSources.length; i++) stack.push({ kind: 'E' });
  if (input.mainSpell.eldrazi) for (let i = 0; i < u; i++) stack.push({ kind: 'U' });

  // Activate copiers: prefer an E tied to the main spell, else a U. Skip if nothing is legal yet.
  const pending = ACTIVATED_COPIERS.filter((cp) => input.activatedCopiers[cp.id] === true);
  const activate = () => {
    for (const cp of [...pending]) {
      const eLegal = eSources.some((t) => has(t, cp.affectsSourceTags)) && stack.some((it) => it.kind === 'E');
      const uLegal = has(ULALEK_TAGS, cp.affectsSourceTags) && stack.some((it) => it.kind === 'U');
      if (eLegal) stack.push({ kind: 'A', target: 'E' });
      else if (uLegal) stack.push({ kind: 'A', target: 'U' });
      else continue;
      pending.splice(pending.indexOf(cp), 1);
    }
  };
  activate();

  // Cast the response spells while holding priority: each adds u U triggers on top.
  for (let i = 0; i < input.responseSpells; i++) {
    stack.push({ kind: 'R' });
    for (let j = 0; j < u; j++) stack.push({ kind: 'U' });
  }
  activate(); // copiers that had no legal target before the response spells

  let colorless = input.colorless;
  let payments = 0;
  let mainCopies = 0;
  let responseCopies = 0;

  while (stack.length > 0) {
    const top = stack.pop()!;
    switch (top.kind) {
      case 'S':
        mainCopies++;
        break;
      case 'R':
        responseCopies++;
        break;
      case 'U':
        if (colorless >= 2) {
          colorless -= 2;
          payments++;
          const spells = stack.filter((it) => it.kind === 'S' || it.kind === 'R');
          const abilities = stack.filter((it) => it.kind === 'E' || it.kind === 'A');
          const triggers = stack.filter((it) => it.kind === 'U');
          // Spell copies first, then ability copies, with Ulalek copies on top.
          for (const s of spells) stack.push({ ...s });
          for (const a of abilities) stack.push({ ...a });
          for (const t of triggers) stack.push({ ...t });
        }
        break;
      case 'E':
        stack.push({ kind: 'S' });
        break;
      case 'A':
        if (top.target === 'E' && stack.some((it) => it.kind === 'E')) stack.push({ kind: 'E' });
        else if (top.target === 'U' && stack.some((it) => it.kind === 'U')) stack.push({ kind: 'U' });
        break;
    }
  }

  return {
    mainSpellCopies: mainCopies,
    responseSpellCopies: input.responseSpells > 0 ? responseCopies / input.responseSpells : 0,
    paymentsMade: payments,
    leftover: colorless,
  };
}
```

- [ ] **Step 2: Write the tests in `tests/simulator.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { calculate } from '../src/engine/calculate';
import { mk } from './fixtures';
import { simulate } from './simulator';

describe('simulator against hand-derived facts', () => {
  it('reproduces the Echoes ruling with no payments', () => {
    expect(simulate(mk({ colorless: 0, doublers: { echoes: 1 } })).mainSpellCopies).toBe(2);
    expect(simulate(mk({ colorless: 0, doublers: { echoes: 2 } })).mainSpellCopies).toBe(5);
    expect(simulate(mk({ colorless: 0, doublers: { echoes: 3 } })).mainSpellCopies).toBe(10);
  });

  it.each([
    ['nothing else', mk(), 2],
    ['Archaic', mk({ copiers: ['archaic'] }), 8],
    ['one response spell', mk({ responseSpells: 1 }), 8],
    ['one Echoes', mk({ doublers: { echoes: 1 } }), 16],
    ['one Echoes, Archaic', mk({ doublers: { echoes: 1 }, copiers: ['archaic'] }), 17],
    ['one Echoes, Archaic, one response spell', mk({ doublers: { echoes: 1 }, copiers: ['archaic'], responseSpells: 1 }), 24],
    ['two Echoes', mk({ doublers: { echoes: 2 } }), 40],
    ['two Echoes, Archaic and Resonator, one response spell', mk({ doublers: { echoes: 2 }, copiers: ['archaic', 'resonator'], responseSpells: 1 }), 56],
    ['one Echoes plus Roaming Throne', mk({ doublers: { echoes: 1, throne: 1 } }), 16],
    ['non-Eldrazi colorless spell, one Echoes, no response', mk({ mainSpell: { eldrazi: false }, doublers: { echoes: 1 } }), 2],
    ['non-Eldrazi colorless spell, one Echoes, one response', mk({ mainSpell: { eldrazi: false }, doublers: { echoes: 1 }, responseSpells: 1 }), 16],
  ])('%s', (_name, input, copies) => {
    expect(simulate(input).mainSpellCopies).toBe(copies);
  });

  it('a single Ulalek trigger pays only once no matter the mana', () => {
    const r = simulate(mk({ colorless: 10 }));
    expect(r.paymentsMade).toBe(1);
    expect(r.leftover).toBe(8);
  });
});

describe('closed form equals the simulator over a grid', () => {
  const COPIERS = ['archaic', 'resonator', 'camera'];
  const cases: ReturnType<typeof mk>[] = [];
  for (let colorless = 0; colorless <= 10; colorless++)
    for (let echoes = 0; echoes <= 3; echoes++)
      for (let throne = 0; throne <= 2; throne++)
        for (let delney = 0; delney <= 1; delney++)
          for (let copiers = 0; copiers <= 3; copiers++)
            for (let responseSpells = 0; responseSpells <= 2; responseSpells++)
              for (const eldrazi of [true, false])
                for (const colorlessSpell of [true, false])
                  cases.push(
                    mk({
                      colorless,
                      doublers: { echoes, throne, delney },
                      copiers: COPIERS.slice(0, copiers),
                      responseSpells,
                      mainSpell: { eldrazi, colorless: colorlessSpell },
                    }),
                  );

  it(`agrees on ${cases.length} inputs`, () => {
    for (const input of cases) {
      const r = calculate(input);
      if (!r.ok) throw new Error(r.error);
      const s = simulate(input);
      const label = JSON.stringify(input);
      expect(r.copies, label).toBe(BigInt(s.mainSpellCopies));
      expect(r.payments, label).toBe(s.paymentsMade);
      expect(r.leftoverColorless, label).toBe(s.leftover);
      expect(r.responseSpellCopies, label).toBe(BigInt(s.responseSpellCopies));
    }
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- tests/simulator.test.ts`
Expected: PASS. The grid case covers 12,672 inputs and should finish in a few seconds.

If the grid test fails, do not adjust either side to match the other blindly. Print the failing input, replay it by hand against the spec's "The objects on the stack" rules, and fix whichever side disagrees with the rules.

- [ ] **Step 4: Commit**

```bash
git add tests/simulator.ts tests/simulator.test.ts
git commit -m "Add stack simulator test oracle and grid agreement test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: User interface

**Files:**
- Create: `src/engine/input.ts`
- Create: `src/ui/storage.ts`
- Create: `src/ui/render.ts`
- Create: `src/styles.css`
- Modify: `src/main.ts` (replace the placeholder)
- Create: `tests/input.test.ts`
- Create: `tests/storage.test.ts`
- Create: `tests/ui.test.ts`

**Interfaces:**
- Consumes: `calculate` (Task 3), `describeLine`, `formatCount` (Task 4), `STATIC_DOUBLERS`, `ACTIVATED_COPIERS` (Task 2), `CalcInput`.
- Produces:
  - `input.ts`: `defaultInput(): CalcInput`, `normalizeInput(raw: unknown): CalcInput`.
  - `storage.ts`: `loadInput(): CalcInput | null`, `saveInput(input: CalcInput): void`, `STORAGE_KEY`.
  - `render.ts`: `mountApp(root: HTMLElement, initial: CalcInput, onChange: (input: CalcInput) => void): AppHandle` with `AppHandle { getInput(): CalcInput; reset(): void }`.
  - `data-testid` attributes: `stepper-<id>-inc`, `stepper-<id>-dec`, `stepper-<id>-value` for ids `colorless`, `responseSpells` and each doubler id; `toggle-<id>` for `mainEldrazi`, `mainColorless` and each copier id; `reset`, `result`, `result-copies`, `result-error`, `result-details`, `steps`, `step-<n>`, `notes`. The colorless stepper's value node is an `<input>`; every other stepper's value node is an `<output>`.

- [ ] **Step 1: Write the failing tests in `tests/input.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { defaultInput, normalizeInput } from '../src/engine/input';

describe('defaultInput', () => {
  it('starts with a colorless Eldrazi spell, no mana and nothing else', () => {
    const d = defaultInput();
    expect(d.colorless).toBe(0);
    expect(d.mainSpell).toEqual({ eldrazi: true, colorless: true });
    expect(d.staticDoublers).toEqual({ echoes: 0, throne: 0, delney: 0 });
    expect(d.activatedCopiers).toEqual({ archaic: false, resonator: false, camera: false });
    expect(d.responseSpells).toBe(0);
  });
});

describe('normalizeInput', () => {
  it('returns defaults for garbage', () => {
    expect(normalizeInput(null)).toEqual(defaultInput());
    expect(normalizeInput('x')).toEqual(defaultInput());
    expect(normalizeInput(42)).toEqual(defaultInput());
  });

  it('keeps valid saved values', () => {
    const saved = {
      colorless: 7,
      mainSpell: { eldrazi: false, colorless: true },
      staticDoublers: { echoes: 2, throne: 1, delney: 0 },
      activatedCopiers: { archaic: true, resonator: false, camera: true },
      responseSpells: 1,
    };
    expect(normalizeInput(saved)).toEqual(saved);
  });

  it('fills in missing ids and drops unknown ones', () => {
    const n = normalizeInput({ colorless: 3, staticDoublers: { echoes: 1, old: 5 }, activatedCopiers: { bogus: true } });
    expect(n.colorless).toBe(3);
    expect(n.staticDoublers).toEqual({ echoes: 1, throne: 0, delney: 0 });
    expect(n.activatedCopiers).toEqual({ archaic: false, resonator: false, camera: false });
    expect(n.mainSpell).toEqual({ eldrazi: true, colorless: true });
    expect(n.responseSpells).toBe(0);
  });

  it('clamps counts into range and rounds down non-integers', () => {
    const n = normalizeInput({ colorless: -4, staticDoublers: { echoes: 9, delney: 2.7 }, responseSpells: 3.9 });
    expect(n.colorless).toBe(0);
    expect(n.staticDoublers.echoes).toBe(3);
    expect(n.staticDoublers.delney).toBe(1);
    expect(n.responseSpells).toBe(3);
  });

  it('treats non-numbers and non-booleans as defaults', () => {
    const n = normalizeInput({ colorless: 'lots', mainSpell: { eldrazi: 'yes' }, activatedCopiers: { archaic: 1 } });
    expect(n.colorless).toBe(0);
    expect(n.mainSpell.eldrazi).toBe(true);
    expect(n.activatedCopiers.archaic).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing tests in `tests/storage.test.ts`**

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultInput } from '../src/engine/input';
import { STORAGE_KEY, loadInput, saveInput } from '../src/ui/storage';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('storage', () => {
  it('round-trips an input', () => {
    const input = { ...defaultInput(), colorless: 9, responseSpells: 2 };
    saveInput(input);
    expect(loadInput()).toEqual(input);
  });

  it('returns null when nothing is saved', () => {
    expect(loadInput()).toBeNull();
  });

  it('normalizes stale data instead of failing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ colorless: 4, staticDoublers: { echoes: 8 } }));
    const loaded = loadInput();
    expect(loaded?.colorless).toBe(4);
    expect(loaded?.staticDoublers.echoes).toBe(3);
    expect(loaded?.activatedCopiers.archaic).toBe(false);
  });

  it('returns null for unparseable data', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadInput()).toBeNull();
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveInput(defaultInput())).not.toThrow();
    expect(loadInput()).toBeNull();
  });
});
```

- [ ] **Step 3: Write the failing tests in `tests/ui.test.ts`**

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultInput } from '../src/engine/input';
import { mountApp } from '../src/ui/render';
import type { CalcInput } from '../src/engine/types';

let root: HTMLElement;
let saved: CalcInput[];

function q<T extends Element = HTMLElement>(id: string): T {
  const node = root.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`missing ${id}`);
  return node;
}
function click(id: string, times = 1) {
  for (let i = 0; i < times; i++) q<HTMLButtonElement>(id).click();
}
function text(id: string) {
  return q(id).textContent ?? '';
}
function colorlessField() {
  return q<HTMLInputElement>('stepper-colorless-value');
}
function typeColorless(value: string) {
  const field = colorlessField();
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
function setToggle(id: string, on: boolean) {
  const box = q<HTMLInputElement>(id);
  box.checked = on;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.append(root);
  saved = [];
});

describe('app', () => {
  it('renders the form from the card data', () => {
    mountApp(root, defaultInput(), (i) => saved.push(i));
    expect(text('stepper-echoes-value')).toBe('0');
    expect(root.textContent).toContain('Roaming Throne');
    expect(root.textContent).toContain("Peter Parker's Camera");
    expect(root.textContent).toContain('{1}, tap');
  });

  it('computes one Echoes with 6 colorless as 16 copies and shows the line', () => {
    mountApp(root, defaultInput(), (i) => saved.push(i));
    click('stepper-colorless-inc', 6);
    click('stepper-echoes-inc');
    expect(text('result-copies')).toBe('16');
    expect(text('step-1')).toContain('Cast the main spell.');
    expect(saved.at(-1)?.colorless).toBe(6);
    expect(saved.at(-1)?.staticDoublers.echoes).toBe(1);
  });

  it('toggles copiers and the main spell flags', () => {
    mountApp(root, defaultInput(), (i) => saved.push(i));
    click('stepper-colorless-inc', 6);
    click('stepper-echoes-inc');
    setToggle('toggle-archaic', true);
    expect(text('result-copies')).toBe('17');
    click('stepper-responseSpells-inc');
    expect(text('result-copies')).toBe('24');
    setToggle('toggle-mainEldrazi', false);
    expect(text('result-copies')).toBe('24');
    setToggle('toggle-mainColorless', false);
    expect(text('result-copies')).toBe('8');
  });

  it('respects stepper bounds', () => {
    mountApp(root, defaultInput(), () => {});
    click('stepper-echoes-inc', 10);
    expect(text('stepper-echoes-value')).toBe('3');
    click('stepper-echoes-dec', 10);
    expect(text('stepper-echoes-value')).toBe('0');
    expect(q<HTMLButtonElement>('stepper-echoes-dec').disabled).toBe(true);
  });

  it('accepts typed colorless values and clamps junk to 0', () => {
    mountApp(root, defaultInput(), () => {});
    click('stepper-echoes-inc');
    typeColorless('200');
    expect(text('result-copies')).toBe('2,535,301,200,456,458,802,993,406,410,752');
    typeColorless('abc');
    expect(text('result-copies')).toBe('2');
    typeColorless('-5');
    expect(text('result-copies')).toBe('2');
  });

  it('keeps the result panel open across re-renders', () => {
    mountApp(root, defaultInput(), () => {});
    const details = q<HTMLDetailsElement>('result-details');
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    click('stepper-colorless-inc');
    expect(q<HTMLDetailsElement>('result-details').open).toBe(true);
  });

  it('shows notes when they apply', () => {
    mountApp(root, defaultInput(), () => {});
    click('stepper-colorless-inc', 2);
    expect(text('notes')).toContain('Only one Ulalek trigger');
  });

  it('reset returns to defaults', () => {
    const handle = mountApp(root, { ...defaultInput(), colorless: 4, responseSpells: 1 }, (i) => saved.push(i));
    expect(colorlessField().value).toBe('4');
    click('reset');
    expect(colorlessField().value).toBe('0');
    expect(text('stepper-responseSpells-value')).toBe('0');
    expect(handle.getInput()).toEqual(defaultInput());
    expect(saved.at(-1)).toEqual(defaultInput());
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: the three new files FAIL with unresolved imports.

- [ ] **Step 5: Write `src/engine/input.ts`**

```ts
import { ACTIVATED_COPIERS, STATIC_DOUBLERS } from './cards';
import type { CalcInput } from './types';

export function defaultInput(): CalcInput {
  return {
    colorless: 0,
    mainSpell: { eldrazi: true, colorless: true },
    staticDoublers: Object.fromEntries(STATIC_DOUBLERS.map((d) => [d.id, 0])),
    activatedCopiers: Object.fromEntries(ACTIVATED_COPIERS.map((c) => [c.id, false])),
    responseSpells: 0,
  };
}

function asCount(value: unknown, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(value)));
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** Turns anything (saved state from an older version, garbage) into a valid CalcInput. */
export function normalizeInput(raw: unknown): CalcInput {
  const d = defaultInput();
  const r = record(raw);
  const main = record(r.mainSpell);
  const doublers = record(r.staticDoublers);
  const copiers = record(r.activatedCopiers);
  return {
    colorless: asCount(r.colorless, Number.MAX_SAFE_INTEGER, d.colorless),
    mainSpell: {
      eldrazi: asBool(main.eldrazi, d.mainSpell.eldrazi),
      colorless: asBool(main.colorless, d.mainSpell.colorless),
    },
    staticDoublers: Object.fromEntries(STATIC_DOUBLERS.map((s) => [s.id, asCount(doublers[s.id], s.maxCount, 0)])),
    activatedCopiers: Object.fromEntries(ACTIVATED_COPIERS.map((c) => [c.id, asBool(copiers[c.id], false)])),
    responseSpells: asCount(r.responseSpells, Number.MAX_SAFE_INTEGER, d.responseSpells),
  };
}
```

- [ ] **Step 6: Write `src/ui/storage.ts`**

```ts
import { normalizeInput } from '../engine/input';
import type { CalcInput } from '../engine/types';

export const STORAGE_KEY = 'ulalek-calculator:v1';

export function loadInput(): CalcInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return normalizeInput(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveInput(input: CalcInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
  } catch {
    // Storage blocked or full: the app keeps working without persistence.
  }
}
```

- [ ] **Step 7: Write `src/ui/render.ts`**

```ts
import { ACTIVATED_COPIERS, STATIC_DOUBLERS } from '../engine/cards';
import { calculate } from '../engine/calculate';
import { defaultInput, normalizeInput } from '../engine/input';
import { describeLine, formatCount } from '../engine/line';
import type { CalcInput } from '../engine/types';

export interface AppHandle {
  getInput(): CalcInput;
  reset(): void;
}

type Attrs = Record<string, string>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function hint(text?: string): Node[] {
  return text ? [el('span', { class: 'hint' }, text)] : [];
}

interface StepperOpts {
  id: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
  /** Large variant with a typeable number field. */
  big?: boolean;
  get: () => number;
  set: (n: number) => void;
}

function stepper(o: StepperOpts, onChange: () => void): HTMLElement {
  const dec = el(
    'button',
    { type: 'button', class: 'stepper__btn', 'aria-label': `Decrease ${o.label}`, 'data-testid': `stepper-${o.id}-dec` },
    '−',
  );
  const inc = el(
    'button',
    { type: 'button', class: 'stepper__btn', 'aria-label': `Increase ${o.label}`, 'data-testid': `stepper-${o.id}-inc` },
    '+',
  );
  const value: HTMLInputElement | HTMLOutputElement = o.big
    ? el('input', {
        type: 'text',
        inputmode: 'numeric',
        class: 'stepper__value',
        'aria-label': o.label,
        'data-testid': `stepper-${o.id}-value`,
      })
    : el('output', { class: 'stepper__value', 'data-testid': `stepper-${o.id}-value` });

  const clamp = (n: number) => Math.min(o.max, Math.max(o.min, n));
  const syncButtons = () => {
    dec.disabled = o.get() <= o.min;
    inc.disabled = o.get() >= o.max;
  };
  const sync = () => {
    const n = o.get();
    if (value instanceof HTMLInputElement) value.value = String(n);
    else value.textContent = String(n);
    syncButtons();
  };
  const update = (n: number) => {
    o.set(clamp(n));
    sync();
    onChange();
  };
  dec.addEventListener('click', () => update(o.get() - 1));
  inc.addEventListener('click', () => update(o.get() + 1));
  if (value instanceof HTMLInputElement) {
    value.addEventListener('input', () => {
      const parsed = Number.parseInt(value.value, 10);
      o.set(clamp(Number.isFinite(parsed) ? parsed : 0));
      syncButtons();
      onChange();
    });
    value.addEventListener('blur', sync);
  }
  sync();

  return el(
    'div',
    { class: `stepper${o.big ? ' stepper--big' : ''}` },
    el('div', { class: 'stepper__text' }, el('span', { class: 'stepper__label' }, o.label), ...hint(o.hint)),
    el('div', { class: 'stepper__controls' }, dec, value, inc),
  );
}

interface ToggleOpts {
  id: string;
  label: string;
  hint?: string;
  get: () => boolean;
  set: (b: boolean) => void;
}

function toggle(o: ToggleOpts, onChange: () => void): HTMLElement {
  const box = el('input', { type: 'checkbox', role: 'switch', 'data-testid': `toggle-${o.id}` });
  box.checked = o.get();
  box.addEventListener('change', () => {
    o.set(box.checked);
    onChange();
  });
  return el(
    'label',
    { class: 'toggle' },
    el('span', { class: 'toggle__text' }, el('span', { class: 'toggle__label' }, o.label), ...hint(o.hint)),
    box,
    el('span', { class: 'toggle__track', 'aria-hidden': 'true' }),
  );
}

function card(title: string, ...children: Node[]): HTMLElement {
  return el('section', { class: 'card' }, el('h2', {}, title), ...children);
}

function buildForm(input: CalcInput, onChange: () => void): HTMLElement[] {
  return [
    card(
      'Mana',
      stepper(
        {
          id: 'colorless',
          label: 'Colorless mana left',
          hint: 'After casting the spell, any response spells, and any copier activations below.',
          min: 0,
          max: Number.MAX_SAFE_INTEGER,
          big: true,
          get: () => input.colorless,
          set: (n) => (input.colorless = n),
        },
        onChange,
      ),
    ),
    card(
      'Main spell',
      toggle(
        {
          id: 'mainEldrazi',
          label: 'Eldrazi spell',
          hint: 'Needed for Ulalek to trigger on the cast.',
          get: () => input.mainSpell.eldrazi,
          set: (b) => (input.mainSpell.eldrazi = b),
        },
        onChange,
      ),
      toggle(
        {
          id: 'mainColorless',
          label: 'Colorless',
          hint: 'Needed for Echoes of Eternity to copy it.',
          get: () => input.mainSpell.colorless,
          set: (b) => (input.mainSpell.colorless = b),
        },
        onChange,
      ),
    ),
    card(
      'Battlefield',
      ...STATIC_DOUBLERS.map((d) =>
        stepper(
          {
            id: d.id,
            label: d.name,
            hint: d.note,
            min: 0,
            max: d.maxCount,
            get: () => input.staticDoublers[d.id] ?? 0,
            set: (n) => (input.staticDoublers[d.id] = n),
          },
          onChange,
        ),
      ),
      ...ACTIVATED_COPIERS.map((c) =>
        toggle(
          {
            id: c.id,
            label: c.name,
            hint: `${c.costText}${c.note ? `. ${c.note}` : ''}`,
            get: () => input.activatedCopiers[c.id] === true,
            set: (b) => (input.activatedCopiers[c.id] = b),
          },
          onChange,
        ),
      ),
    ),
    card(
      'Cast in response',
      stepper(
        {
          id: 'responseSpells',
          label: 'Eldrazi spells cast in response',
          hint: 'Any Eldrazi spell cast before a trigger resolves (Eldritch Immunity, Nameless Inversion, Dimensional Infiltrator). Subtract its cost from the mana above.',
          min: 0,
          max: 99,
          get: () => input.responseSpells,
          set: (n) => (input.responseSpells = n),
        },
        onChange,
      ),
    ),
  ];
}

function renderResult(box: HTMLElement, input: CalcInput, open: boolean, onToggle: (open: boolean) => void): void {
  const result = calculate(input);
  box.replaceChildren();
  if (!result.ok) {
    box.append(el('p', { class: 'result__error', 'data-testid': 'result-error' }, result.error));
    return;
  }

  const summary = el(
    'summary',
    { class: 'result__summary' },
    el('span', { class: 'result__count', 'data-testid': 'result-copies' }, formatCount(result.copies)),
    el('span', { class: 'result__caption' }, `copies of the main spell · ${formatCount(result.duplicates)} new`),
    el('span', { class: 'result__chevron', 'aria-hidden': 'true' }),
  );

  const steps = describeLine(input, result);
  const list = el(
    'ol',
    { class: 'steps', 'data-testid': 'steps' },
    ...steps.map((s, i) =>
      el(
        'li',
        { class: 'step', 'data-testid': `step-${i + 1}` },
        el('strong', {}, s.title),
        ...(s.detail ? [el('span', { class: 'step__detail' }, s.detail)] : []),
      ),
    ),
  );

  const formula = `${result.sources} × 2^${result.payments}${result.immediate ? ` + ${result.immediate}` : ''}`;
  const facts: [string, string][] = [
    ['Ulalek triggers per cast', String(result.triggersPerCast)],
    ['Ulalek triggers on the stack', String(result.totalTriggers)],
    ['Copies from Echoes', String(result.doublerCopies)],
    ['Copy sources before paying', String(result.sources)],
    ['{C}{C} payments', String(result.payments)],
    ['Formula', formula],
    ['Leftover colorless', String(result.leftoverColorless)],
  ];
  const dl = el('dl', { class: 'facts' }, ...facts.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));

  const body = el('div', { class: 'result__body' }, el('h2', {}, 'Line of play'), list, el('h2', {}, 'Breakdown'), dl);
  if (result.notes.length > 0) {
    body.append(el('ul', { class: 'notes', 'data-testid': 'notes' }, ...result.notes.map((n) => el('li', {}, n))));
  }

  const details = el('details', { class: 'result__details', 'data-testid': 'result-details' }, summary, body);
  details.open = open;
  details.addEventListener('toggle', () => onToggle(details.open));
  box.append(details);
}

export function mountApp(root: HTMLElement, initial: CalcInput, onChange: (input: CalcInput) => void): AppHandle {
  let input = normalizeInput(initial);
  let detailsOpen = false;

  const form = el('div', { class: 'form' });
  const resultBox = el('section', { class: 'result', 'data-testid': 'result', 'aria-live': 'polite' });

  const rerender = () => {
    onChange(normalizeInput(input));
    renderResult(resultBox, input, detailsOpen, (open) => (detailsOpen = open));
  };
  const rebuildForm = () => form.replaceChildren(...buildForm(input, rerender));

  const resetButton = el('button', { type: 'button', class: 'btn', 'data-testid': 'reset' }, 'Reset');
  const reset = () => {
    input = defaultInput();
    rebuildForm();
    rerender();
  };
  resetButton.addEventListener('click', reset);

  root.append(
    el(
      'div',
      { class: 'app' },
      el('header', { class: 'header' }, el('h1', {}, 'Ulalek ', el('span', {}, 'Calculator')), resetButton),
      form,
      el(
        'footer',
        { class: 'footer' },
        'Assumes Ulalek, Fused Atrocity is on the battlefield and that you spend all colorless mana on its trigger. Mana produced by the copies themselves is not counted: anything that makes mana inside the loop is infinite anyway.',
      ),
      resultBox,
    ),
  );
  rebuildForm();
  rerender();

  return {
    getInput: () => normalizeInput(input),
    reset,
  };
}
```

- [ ] **Step 8: Write `src/styles.css`**

```css
:root {
  color-scheme: dark light;
  --bg: #120b22;
  --bg-elev: #1d1335;
  --bg-elev-2: #271a45;
  --border: #3b2a66;
  --text: #ece6fa;
  --muted: #a999cc;
  --accent: #c9a6ff;
  --accent-strong: #9d6bff;
  --danger: #ff8fa3;
  --radius: 16px;
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  --font: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #f6f2ff;
    --bg-elev: #ffffff;
    --bg-elev-2: #efe8ff;
    --border: #d9cdf5;
    --text: #1b1230;
    --muted: #5e5280;
    --accent: #6a3ddb;
    --accent-strong: #5b2fd0;
    --danger: #c0304f;
    --shadow: 0 10px 30px rgba(60, 30, 120, 0.12);
  }
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}

body {
  padding-bottom: 8rem;
}

.app {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0 8px;
}

.header h1 {
  font-size: 1.35rem;
  margin: 0;
  letter-spacing: 0.02em;
}

.header h1 span {
  color: var(--accent);
}

.btn {
  font: inherit;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--text);
  border-radius: 999px;
  padding: 8px 14px;
  min-height: 40px;
  cursor: pointer;
}

.card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin: 12px 0;
}

.card h2 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin: 0 0 6px;
}

.hint {
  display: block;
  color: var(--muted);
  font-size: 0.8rem;
  margin-top: 2px;
}

.stepper,
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--border);
  position: relative;
}

.card h2 + .stepper,
.card h2 + .toggle {
  border-top: 0;
}

.stepper__label,
.toggle__label {
  font-weight: 600;
}

.stepper__controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.stepper__btn {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-elev-2);
  color: var(--text);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.stepper__btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.stepper__value {
  min-width: 2.5ch;
  text-align: center;
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
}

.stepper--big .stepper__value {
  width: 5.5ch;
  font-size: 1.6rem;
  font-weight: 700;
  background: transparent;
  border: 0;
  color: var(--accent);
  font-family: inherit;
  padding: 0;
}

.stepper--big .stepper__value:focus {
  outline: 2px solid var(--accent);
  border-radius: 8px;
}

.toggle {
  cursor: pointer;
}

.toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle__track {
  width: 52px;
  height: 30px;
  border-radius: 999px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s;
}

.toggle__track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform 0.15s, background 0.15s;
}

.toggle input:checked + .toggle__track {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

.toggle input:checked + .toggle__track::after {
  transform: translateX(22px);
  background: #fff;
}

.toggle input:focus-visible + .toggle__track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.footer {
  color: var(--muted);
  font-size: 0.8rem;
  padding: 12px 0 24px;
}

.result {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 12px calc(12px + env(safe-area-inset-bottom));
  pointer-events: none;
}

.result__details,
.result__error {
  pointer-events: auto;
  max-width: 640px;
  margin: 0 auto;
  background: var(--bg-elev);
  border: 1px solid var(--accent-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.result__details {
  max-height: 80vh;
  overflow: auto;
}

.result__error {
  border-color: var(--danger);
  color: var(--danger);
  padding: 14px 18px;
}

.result__summary {
  list-style: none;
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 14px 18px;
  cursor: pointer;
}

.result__summary::-webkit-details-marker {
  display: none;
}

.result__count {
  font-size: 2.4rem;
  font-weight: 800;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  overflow-wrap: anywhere;
}

.result__caption {
  color: var(--muted);
}

.result__chevron {
  margin-left: auto;
  width: 10px;
  height: 10px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(-135deg);
  transition: transform 0.15s;
  flex-shrink: 0;
}

details[open] .result__chevron {
  transform: rotate(45deg);
}

.result__body {
  padding: 0 18px 18px;
}

.result__body h2 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin: 14px 0 8px;
}

.steps {
  margin: 0;
  padding-left: 1.4em;
  display: grid;
  gap: 10px;
}

.step strong {
  display: block;
}

.step__detail {
  color: var(--muted);
  font-size: 0.92rem;
}

.facts {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 16px;
  margin: 0;
}

.facts dt {
  color: var(--muted);
}

.facts dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.notes {
  margin: 12px 0 0;
  padding-left: 1.2em;
  color: var(--accent);
  font-size: 0.92rem;
}
```

- [ ] **Step 9: Replace `src/main.ts`**

```ts
import './styles.css';
import { defaultInput } from './engine/input';
import { mountApp } from './ui/render';
import { loadInput, saveInput } from './ui/storage';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
mountApp(root, loadInput() ?? defaultInput(), saveInput);
```

(The service worker registration is added in Task 7.)

- [ ] **Step 10: Run tests and type-check**

Run: `npm test`
Expected: all pass, including the eight UI tests.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Look at it in a browser**

Run: `npm run dev`
Open `http://localhost:5173/ulalek-calculator/` on the PC. Check: dark theme, steppers respond, the result sheet expands to show the line of play, the light theme appears when the OS prefers light. Stop the server.

- [ ] **Step 12: Commit**

```bash
git add src/engine/input.ts src/ui/storage.ts src/ui/render.ts src/styles.css src/main.ts tests/input.test.ts tests/storage.test.ts tests/ui.test.ts
git commit -m "Add the calculator UI with persistence and line-of-play panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: PWA icons and service worker

**Files:**
- Create: `scripts/make-icons.mjs`
- Create: `public/icons/icon.svg`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png` (generated)
- Modify: `src/main.ts` (add service worker registration)

**Interfaces:**
- Consumes: the `VitePWA` config from Task 1.
- Produces: an installable build in `dist/` with `manifest.webmanifest`, `sw.js` and the icons.

- [ ] **Step 1: Write `public/icons/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#2a1650"/>
  <circle cx="50" cy="50" r="34.5" fill="none" stroke="#9d6bff" stroke-width="3"/>
  <circle cx="50" cy="50" r="23.5" fill="none" stroke="#c9a6ff" stroke-width="7"/>
  <circle cx="50" cy="50" r="11" fill="#f3eaff"/>
</svg>
```

- [ ] **Step 2: Write `scripts/make-icons.mjs`** (a dependency-free PNG writer so no image library is needed)

```js
// Generates the PWA icons as PNG files using only Node's zlib. Run: npm run icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** pixel(x, y) returns [r, g, b, a]. */
function png(size, pixel) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw.set([r, g, b, a], y * stride + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const VIOLET = [0x2a, 0x16, 0x50, 255];
const RING_OUTER = [0x9d, 0x6b, 0xff, 255];
const RING_INNER = [0xc9, 0xa6, 0xff, 255];
const PUPIL = [0xf3, 0xea, 0xff, 255];
const CLEAR = [0, 0, 0, 0];

function eye(size, maskable) {
  const c = (size - 1) / 2;
  const half = size / 2;
  const corner = size * 0.22;
  return (x, y) => {
    if (!maskable) {
      const dx = Math.max(Math.abs(x - c) - (half - corner), 0);
      const dy = Math.max(Math.abs(y - c) - (half - corner), 0);
      if (Math.hypot(dx, dy) > corner) return CLEAR;
    }
    const d = Math.hypot(x - c, y - c) / size;
    if (d < 0.11) return PUPIL;
    if (d > 0.2 && d < 0.27) return RING_INNER;
    if (d > 0.33 && d < 0.36) return RING_OUTER;
    return VIOLET;
  };
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'icon-192.png'), png(192, eye(192, false)));
writeFileSync(join(OUT, 'icon-512.png'), png(512, eye(512, false)));
writeFileSync(join(OUT, 'icon-512-maskable.png'), png(512, eye(512, true)));
console.log('icons written to', OUT);
```

- [ ] **Step 3: Generate the icons**

Run: `npm run icons`
Expected: three PNG files in `public/icons/`. Open one in an image viewer to confirm it shows a violet square with a light ring and dot.

- [ ] **Step 4: Register the service worker in `src/main.ts`**

Replace the file with:

```ts
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { defaultInput } from './engine/input';
import { mountApp } from './ui/render';
import { loadInput, saveInput } from './ui/storage';

registerSW({ immediate: true });

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
mountApp(root, loadInput() ?? defaultInput(), saveInput);
```

- [ ] **Step 5: Build and inspect**

Run: `npm run build`
Expected: no TypeScript errors; `dist/manifest.webmanifest` lists the three PNG icons; `dist/sw.js` exists; the build log shows the precache entries including `index.html`, the JS and CSS bundles, `icon.svg` and the PNGs.

Run: `npm run preview`
Open `http://localhost:4173/ulalek-calculator/` in Chrome, open DevTools → Application → Manifest. Expected: no manifest errors, installability check passes (Chrome may still flag "not served over HTTPS" on localhost; that is fine). Stop the server.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: all pass (tests do not import `main.ts`).

- [ ] **Step 7: Commit**

```bash
git add scripts/make-icons.mjs public/icons src/main.ts
git commit -m "Add PWA icons and service worker registration

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: CI, GitHub Pages deployment and README

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` (currently empty)

**Interfaces:**
- Consumes: `npm test`, `npm run build` from earlier tasks.
- Produces: a live site at `https://aurelio-amerio.github.io/ulalek-calculator/` after a push to `main`.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Test and deploy

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write `README.md`**

````markdown
# Ulalek Calculator

A small installable web app for one question at the Commander table: with
**Ulalek, Fused Atrocity** on the battlefield and a spell just cast, how many
copies can I make with the colorless mana I have, and in what order do I have
to do things to get them?

Live: https://aurelio-amerio.github.io/ulalek-calculator/

## Using it

1. Enter the **colorless mana** you have left after paying for everything:
   the main spell, any Eldrazi spell you cast in response, and any copier
   activation (Abstruse Archaic, Strionic Resonator, Peter Parker's Camera).
   The app never deducts costs itself.
2. Set the two main-spell switches. Most Eldrazi spells are both Eldrazi and
   colorless. Turn "Eldrazi" off for something like Mystic Forge, which only
   triggers Ulalek if you cast an Eldrazi spell in response.
3. Set what is on the battlefield: Echoes of Eternity, Roaming Throne
   (naming Eldrazi), Delney, and which copiers you will activate.
4. Set how many Eldrazi spells you cast in response (Eldritch Immunity,
   Nameless Inversion, Dimensional Infiltrator all count as one each).
5. Tap the result bar at the bottom to expand the line of play and the
   breakdown.

The copy count assumes you spend all colorless mana on Ulalek's trigger and
ignores mana produced by the copies themselves; anything that makes mana
inside the loop is infinite anyway.

The rules model and the reasoning behind the line of play are in
`docs/superpowers/specs/2026-09-26-ulalek-calculator-design.md`.

## Install on Android

Open the live link in Chrome, open the browser menu and choose **Add to Home
screen** (or **Install app**). It works offline afterwards and updates itself
when a new version is deployed.

## Development

Requires Node 22.12 or newer.

```sh
npm install
npm run dev        # http://localhost:5173/ulalek-calculator/
npm test           # engine, simulator and UI tests
npm run build      # type-check and build to dist/
npm run preview    # serve dist/ locally
npm run icons      # regenerate public/icons/*.png
```

`npm run dev` listens on all interfaces, so a phone on the same Wi-Fi can
open `http://<your-pc-ip>:5173/ulalek-calculator/` to try changes before
deploying. Installing as an app from that address is not possible because it
is not HTTPS; use the live link for that.

## Deployment

Every push to `main` runs the tests, builds the site and deploys it to GitHub
Pages through `.github/workflows/deploy.yml`. Pull requests run the tests and
build without deploying.

## Adding a card

Card data lives in `src/engine/cards.ts`.

- A permanent that makes triggered abilities "trigger an additional time"
  goes in `STATIC_DOUBLERS`. `affects` lists the tags a permanent needs for
  the doubler to apply to it. `copiesSpell` is set only if the card also
  copies spells you cast, like Echoes. Ulalek's own tags are in
  `ULALEK_TAGS`.
- A "copy target ability" activation goes in `ACTIVATED_COPIERS` with its
  cost as text.

Add a test for the new card in `tests/multiplicity.test.ts` or
`tests/calculate.test.ts`. The grid test in `tests/simulator.test.ts` checks
that the closed-form result still matches the stack simulator.
````

- [ ] **Step 3: Enable GitHub Pages for Actions deployment**

Run:

```bash
gh api -X POST repos/aurelio-amerio/ulalek-calculator/pages -f build_type=workflow
```

Expected: a JSON response containing `"build_type": "workflow"`. If it returns `409` because Pages already exists, run instead:

```bash
gh api -X PUT repos/aurelio-amerio/ulalek-calculator/pages -f build_type=workflow
```

If `gh` is not authenticated, the user can do this in the repository settings under Pages → Source → GitHub Actions.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "Add CI, GitHub Pages deployment and README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 5: Verify the deployment**

Run: `gh run watch` (or `gh run list --limit 1`) and wait for the workflow to finish.
Expected: the `build` and `deploy` jobs succeed.

Open `https://aurelio-amerio.github.io/ulalek-calculator/` in Chrome. Expected: the app loads, the manifest icon shows in the install prompt, and after installing on an Android phone it opens standalone and works in airplane mode.
