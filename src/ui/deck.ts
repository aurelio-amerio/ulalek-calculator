import { ACTIVATED_COPIERS, STATIC_DOUBLERS } from '../engine/cards';

/** Card id -> whether the card is in the deck. Cards not in the deck are hidden from the Battlefield card. */
export type Deck = Record<string, boolean>;

/** Every card the deck menu offers, in display order: static doublers first, then activated copiers. */
export const DECK_CARD_IDS: readonly string[] = [
  ...STATIC_DOUBLERS.map((d) => d.id),
  ...ACTIVATED_COPIERS.map((c) => c.id),
];

const DEFAULT_IN_DECK: readonly string[] = ['echoes', 'archaic'];

export function defaultDeck(): Deck {
  return Object.fromEntries(DECK_CARD_IDS.map((id) => [id, DEFAULT_IN_DECK.includes(id)]));
}

/** Keeps only known card ids, treating anything but `true` as "not in the deck". */
export function normalizeDeck(raw: unknown): Deck {
  const r = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(DECK_CARD_IDS.map((id) => [id, r[id] === true]));
}
