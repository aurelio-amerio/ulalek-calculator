import type { CalcInput } from '../src/engine/types';

interface Overrides {
  colorless?: number;
  mainSpell?: Partial<CalcInput['mainSpell']>;
  doublers?: Record<string, number>;
  copiers?: string[];
  responseSpells?: number;
}

/** A colorless Eldrazi main spell with 6 colorless mana and nothing else, unless overridden. */
export function mk(o: Overrides = {}): CalcInput {
  return {
    colorless: o.colorless ?? 6,
    mainSpell: { eldrazi: true, colorless: true, ...o.mainSpell },
    staticDoublers: { echoes: 0, throne: 0, delney: 0, ...o.doublers },
    activatedCopiers: {
      archaic: (o.copiers ?? []).includes('archaic'),
      resonator: (o.copiers ?? []).includes('resonator'),
      camera: (o.copiers ?? []).includes('camera'),
    },
    responseSpells: o.responseSpells ?? 0,
  };
}
