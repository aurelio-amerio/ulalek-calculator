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
      for (let throne = 0; throne <= 1; throne++)
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
