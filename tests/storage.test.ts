// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultInput } from '../src/engine/input';
import { defaultDeck } from '../src/ui/deck';
import { DECK_STORAGE_KEY, STORAGE_KEY, loadDeck, loadInput, saveDeck, saveInput } from '../src/ui/storage';

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

  it('round-trips the deck under its own key', () => {
    const deck = { ...defaultDeck(), throne: true, echoes: false };
    saveDeck(deck);
    expect(loadDeck()).toEqual(deck);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(DECK_STORAGE_KEY)).not.toBeNull();
  });

  it('returns null when no deck is saved and normalizes junk', () => {
    expect(loadDeck()).toBeNull();
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({ echoes: 'yes', camera: true, bogus: true }));
    expect(loadDeck()).toEqual({ echoes: false, throne: false, delney: false, archaic: false, resonator: false, camera: true });
    localStorage.setItem(DECK_STORAGE_KEY, '[nope');
    expect(loadDeck()).toBeNull();
  });
});
