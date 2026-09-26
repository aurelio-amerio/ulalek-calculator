import { ACTIVATED_COPIERS, MAX_COLORLESS, STATIC_DOUBLERS, ULALEK_TAGS } from './cards';
import { copyTriggers, hasAll, mainSpellTags, ulalekTriggersPerCast } from './multiplicity';
import type { ActivatedCopier, CalcInput, CalcResult, CopierRole } from './types';

function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** Returns an error message, or null when the input is usable. */
export function validate(input: CalcInput): string | null {
  if (!isCount(input.colorless)) return 'Colorless mana must be a whole number of 0 or more.';
  if (input.colorless > MAX_COLORLESS) return `Colorless mana must be ${MAX_COLORLESS} or less.`;
  if (!isCount(input.responseSpells)) return 'Response spells must be a whole number of 0 or more.';
  for (const d of STATIC_DOUBLERS) {
    const n = input.staticDoublers[d.id] ?? 0;
    if (!isCount(n) || n > d.maxCount) return `${d.name} count must be between 0 and ${d.maxCount}.`;
  }
  return null;
}

/** The activated copiers switched on, in data-file order. */
export function selectedCopiers(input: CalcInput): ActivatedCopier[] {
  return ACTIVATED_COPIERS.filter((c) => input.activatedCopiers[c.id] === true);
}

export function calculate(input: CalcInput): CalcResult {
  const error = validate(input);
  if (error) return { ok: false, error };

  // u: Ulalek triggers per Eldrazi cast. c: Echoes-style copies of the main spell.
  const u = ulalekTriggersPerCast(input.staticDoublers);
  const eGroups = copyTriggers(input.staticDoublers, mainSpellTags(input.mainSpell));
  const c = eGroups.reduce((sum, g) => sum + g.count, 0);
  const m = input.mainSpell.eldrazi ? 1 : 0;
  const r = input.responseSpells;
  const spellTriggers = u * m + u * r;

  // Copier allocation, see the spec's "The line of play".
  const copiers = selectedCopiers(input);
  let asSource = 0;
  let asImmediate = 0;
  let asTrigger = 0;
  for (const cp of copiers) {
    const canTargetE = c > 0 && eGroups.some((g) => hasAll(g.doubler.tags, cp.affectsSourceTags));
    const canTargetU = spellTriggers >= 1 && hasAll(ULALEK_TAGS, cp.affectsSourceTags);
    if (canTargetE) {
      if (r > 0) asSource++;
      else asImmediate++;
    } else if (canTargetU) {
      asTrigger++;
    }
  }
  const totalTriggers = spellTriggers + asTrigger;
  const copierRole: CopierRole =
    asSource > 0 ? 'source' : asImmediate > 0 ? 'immediate' : asTrigger > 0 ? 'trigger' : 'none';

  const sources = 1 + c + asSource;
  const immediate = asImmediate;
  const half = Math.floor(input.colorless / 2);
  const payments = totalTriggers === 0 ? 0 : totalTriggers === 1 ? Math.min(1, half) : half;
  const pow = 2n ** BigInt(payments);
  const copies = BigInt(sources) * pow + BigInt(immediate);

  const notes: string[] = [];
  if (totalTriggers === 0) {
    notes.push(
      'Ulalek never triggers: the main spell is not an Eldrazi spell and no Eldrazi spell is cast in response.',
    );
  }
  if (totalTriggers === 1) {
    notes.push(
      'Only one Ulalek trigger: only the first {C}{C} payment does anything. A copier or a response spell would unlock the full loop.',
    );
  }
  if (r > 0 && copiers.length === 0 && u * m >= 2) {
    notes.push(
      'The response spell adds nothing here: you already have two Ulalek triggers and no copier to put under it.',
    );
  }
  if (copierRole === 'immediate') {
    notes.push(
      'Without a response spell each copier is worth one extra copy. Cast an Eldrazi spell after activating them to double their copies with the rest.',
    );
  }
  if (copiers.length > 0 && c === 0 && spellTriggers >= 2) {
    notes.push('Copiers add nothing here: there is no Echoes trigger to copy and you already have two Ulalek triggers.');
  }
  if (copiers.length > 1 && c === 0 && spellTriggers === 1) {
    notes.push('Only the first copier matters: it provides the second Ulalek trigger.');
  }
  if (copiers.length > 0 && copierRole === 'none') {
    notes.push('Copiers have nothing to target: Ulalek never triggers and there is no Echoes trigger.');
  }

  return {
    ok: true,
    copies,
    duplicates: copies - 1n,
    triggersPerCast: u,
    totalTriggers,
    doublerCopies: c,
    copiersUsed: copiers.length,
    copierRole,
    sources,
    immediate,
    payments,
    leftoverColorless: input.colorless - 2 * payments,
    responseSpellCopies: r > 0 ? pow : 0n,
    notes,
  };
}
