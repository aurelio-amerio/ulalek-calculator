export type Tag =
  | 'colorless'
  | 'white'
  | 'creature'
  | 'enchantment'
  | 'artifact'
  | 'eldrazi'
  | 'legendary'
  | 'power-le-2';

/** A permanent that makes triggered abilities trigger an additional time. */
export interface StaticDoubler {
  id: string;
  name: string;
  /** Tags of the doubler itself, consulted when other doublers apply to it. */
  tags: Tag[];
  /** A permanent must carry all of these tags for this doubler to apply to it. */
  affects: Tag[];
  /** If set, the doubler also copies each spell you cast that carries all of these tags. */
  copiesSpell?: Tag[];
  /** Upper bound offered by the UI. */
  maxCount: number;
  note?: string;
}

/** A "copy target ability" activation. One use per combo because it taps. */
export interface ActivatedCopier {
  id: string;
  name: string;
  /** Display only: the cost the user deducts before entering colorless mana. */
  costText: string;
  /** The copied ability's source must carry all of these tags. Empty means any source. */
  affectsSourceTags: Tag[];
  note?: string;
}

export interface MainSpell {
  eldrazi: boolean;
  colorless: boolean;
}

export interface CalcInput {
  /** Colorless mana left after every cost has been paid. Integer >= 0. */
  colorless: number;
  mainSpell: MainSpell;
  /** Doubler id -> number of copies on the battlefield. */
  staticDoublers: Record<string, number>;
  /** Copier id -> whether it is activated this combo. */
  activatedCopiers: Record<string, boolean>;
  /** Eldrazi spells cast in response before any trigger resolves. Integer >= 0. */
  responseSpells: number;
}

/**
 * What the activated copiers are used for.
 * source: they target an Echoes trigger and sit under the response spell's Ulalek triggers, worth 2^k each.
 * immediate: they target an Echoes trigger with no response spell after them, worth 1 each.
 * trigger: they target a Ulalek trigger to provide the second trigger.
 * none: nothing useful to target, or no copiers selected.
 */
export type CopierRole = 'source' | 'immediate' | 'trigger' | 'none';

export interface CalcSuccess {
  ok: true;
  copies: bigint;
  duplicates: bigint;
  triggersPerCast: number;
  totalTriggers: number;
  doublerCopies: number;
  copiersUsed: number;
  copierRole: CopierRole;
  sources: number;
  immediate: number;
  payments: number;
  leftoverColorless: number;
  responseSpellCopies: bigint;
  notes: string[];
}

export interface CalcFailure {
  ok: false;
  error: string;
}

export type CalcResult = CalcSuccess | CalcFailure;

export interface Step {
  title: string;
  detail?: string;
}
