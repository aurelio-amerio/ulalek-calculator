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
