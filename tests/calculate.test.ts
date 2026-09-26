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
