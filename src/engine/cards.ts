import type { ActivatedCopier, StaticDoubler, Tag } from './types';

/** Ulalek, Fused Atrocity: colorless (devoid) legendary Eldrazi creature, 2/5. */
export const ULALEK_TAGS: Tag[] = ['colorless', 'creature', 'eldrazi', 'legendary', 'power-le-2'];

/** Upper bound the UI and `validate` enforce on colorless mana, to keep the result a finite, displayable integer. */
export const MAX_COLORLESS = 999;

/** Upper bound the UI and `normalizeInput` enforce on response spells cast. */
export const MAX_RESPONSE_SPELLS = 99;

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
    maxCount: 1,
    note: 'Naming Eldrazi. Only affects creatures, so it does not touch Echoes. A second Throne adds no copies.',
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

/**
 * Copier roles (source / immediate / trigger / none) are assigned uniformly in calculate.ts based only
 * on `affectsSourceTags`: any copier that can target an Echoes-style trigger gets treated the same as any
 * other, and likewise for one that can only target a Ulalek trigger. Adding a copier whose real rules text
 * is narrower than that (e.g. it can copy some Echoes triggers but not others, or has some other exception)
 * needs a look at calculate.ts's allocation loop and at tests/simulator.ts, not just a new entry here.
 */
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
