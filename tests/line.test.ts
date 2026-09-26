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
