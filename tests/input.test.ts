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
