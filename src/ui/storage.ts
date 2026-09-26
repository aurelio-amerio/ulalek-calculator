import { normalizeInput } from '../engine/input';
import type { CalcInput } from '../engine/types';
import { normalizeDeck, type Deck } from './deck';

export const STORAGE_KEY = 'ulalek-calculator:v1';
export const DECK_STORAGE_KEY = 'ulalek-calculator:deck:v1';

function load<T>(key: string, normalize: (raw: unknown) => T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the app keeps working without persistence.
  }
}

export function loadInput(): CalcInput | null {
  return load(STORAGE_KEY, normalizeInput);
}

export function saveInput(input: CalcInput): void {
  save(STORAGE_KEY, input);
}

/** The cards the user marked as being in their deck. Kept apart from the input so a global reset leaves it alone. */
export function loadDeck(): Deck | null {
  return load(DECK_STORAGE_KEY, normalizeDeck);
}

export function saveDeck(deck: Deck): void {
  save(DECK_STORAGE_KEY, deck);
}
