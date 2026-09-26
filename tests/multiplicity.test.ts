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
