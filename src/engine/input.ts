import { ACTIVATED_COPIERS, STATIC_DOUBLERS } from './cards';
import type { CalcInput } from './types';

export function defaultInput(): CalcInput {
  return {
    colorless: 0,
    mainSpell: { eldrazi: true, colorless: true },
    staticDoublers: Object.fromEntries(STATIC_DOUBLERS.map((d) => [d.id, 0])),
    activatedCopiers: Object.fromEntries(ACTIVATED_COPIERS.map((c) => [c.id, false])),
    responseSpells: 0,
  };
}

function asCount(value: unknown, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(value)));
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** Turns anything (saved state from an older version, garbage) into a valid CalcInput. */
export function normalizeInput(raw: unknown): CalcInput {
  const d = defaultInput();
  const r = record(raw);
  const main = record(r.mainSpell);
  const doublers = record(r.staticDoublers);
  const copiers = record(r.activatedCopiers);
  return {
    colorless: asCount(r.colorless, Number.MAX_SAFE_INTEGER, d.colorless),
    mainSpell: {
      eldrazi: asBool(main.eldrazi, d.mainSpell.eldrazi),
      colorless: asBool(main.colorless, d.mainSpell.colorless),
    },
    staticDoublers: Object.fromEntries(STATIC_DOUBLERS.map((s) => [s.id, asCount(doublers[s.id], s.maxCount, 0)])),
    activatedCopiers: Object.fromEntries(ACTIVATED_COPIERS.map((c) => [c.id, asBool(copiers[c.id], false)])),
    responseSpells: asCount(r.responseSpells, Number.MAX_SAFE_INTEGER, d.responseSpells),
  };
}
