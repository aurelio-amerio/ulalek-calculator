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
    oracle:
      'If a triggered ability of a colorless spell you control or another colorless permanent you control triggers, that ability triggers an additional time.\n' +
      'Whenever you cast a colorless spell, copy it. You may choose new targets for the copy. (A copy of a permanent spell becomes a token.)',
  },
  {
    id: 'throne',
    name: 'Roaming Throne',
    tags: ['colorless', 'artifact', 'creature', 'eldrazi'],
    affects: ['creature', 'eldrazi'],
    maxCount: 1,
    oracle:
      'Ward {2}\nAs this creature enters, choose a creature type.\nThis creature is the chosen type in addition to its other types.\n' +
      'If a triggered ability of another creature you control of the chosen type triggers, it triggers an additional time.',
  },
  {
    id: 'delney',
    name: 'Delney, Streetwise Lookout',
    tags: ['white', 'creature', 'legendary', 'power-le-2'],
    affects: ['creature', 'power-le-2'],
    maxCount: 1,
    oracle:
      "Creatures you control with power 2 or less can't be blocked by creatures with power 3 or greater.\n" +
      'If a triggered ability of a creature you control with power 2 or less triggers, that ability triggers an additional time.',
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
    costText: '{1}, {T}',
    affectsSourceTags: ['colorless'],
    oracle:
      'Vigilance\n{1}, {T}: Copy target activated or triggered ability you control from a colorless source. You may choose new targets for the copy. (Mana abilities can\'t be targeted.)',
  },
  {
    id: 'resonator',
    name: 'Strionic Resonator',
    costText: '{2}, {T}',
    affectsSourceTags: [],
    oracle:
      '{2}, {T}: Copy target triggered ability you control. You may choose new targets for the copy. (A triggered ability uses the words "when," "whenever," or "at.")',
  },
  {
    id: 'camera',
    name: "Peter Parker's Camera",
    costText: '{2}, {T}, remove a film counter',
    affectsSourceTags: [],
    oracle:
      'This artifact enters with three film counters on it.\n{2}, {T}, Remove a film counter from this artifact: Copy target activated or triggered ability you control. You may choose new targets for the copy.',
  },
];
