import { STATIC_DOUBLERS, ULALEK_TAGS } from './cards';
import type { MainSpell, StaticDoubler, Tag } from './types';

export function hasAll(tags: readonly Tag[], required: readonly Tag[]): boolean {
  return required.every((t) => tags.includes(t));
}

/** One entry per copy of each static doubler on the battlefield. Unknown ids are ignored. */
export function doublerInstances(counts: Record<string, number>): StaticDoubler[] {
  const out: StaticDoubler[] = [];
  for (const d of STATIC_DOUBLERS) {
    const n = counts[d.id] ?? 0;
    for (let i = 0; i < n; i++) out.push(d);
  }
  return out;
}

/** How many times a triggered ability of a permanent with these tags triggers, given the other doublers. */
export function multiplicityOf(permanentTags: readonly Tag[], others: readonly StaticDoubler[]): number {
  return 1 + others.filter((d) => hasAll(permanentTags, d.affects)).length;
}

export function ulalekTriggersPerCast(counts: Record<string, number>): number {
  return multiplicityOf(ULALEK_TAGS, doublerInstances(counts));
}

export function mainSpellTags(spell: MainSpell): Tag[] {
  const tags: Tag[] = [];
  if (spell.eldrazi) tags.push('eldrazi');
  if (spell.colorless) tags.push('colorless');
  return tags;
}

export interface CopyTriggerGroup {
  doubler: StaticDoubler;
  count: number;
}

/**
 * Copy triggers tied to a spell with these tags, grouped by doubler.
 * Each doubler instance that copies the spell fires once, plus once more for every
 * other instance whose `affects` tags it carries. Two Echoes therefore give 2 + 2.
 */
export function copyTriggers(counts: Record<string, number>, spellTags: readonly Tag[]): CopyTriggerGroup[] {
  const all = doublerInstances(counts);
  const groups = new Map<string, CopyTriggerGroup>();
  all.forEach((d, i) => {
    if (!d.copiesSpell || !hasAll(spellTags, d.copiesSpell)) return;
    const others = all.filter((_, j) => j !== i);
    const fires = multiplicityOf(d.tags, others);
    const group = groups.get(d.id) ?? { doubler: d, count: 0 };
    group.count += fires;
    groups.set(d.id, group);
  });
  return [...groups.values()];
}

export function doublerCopies(counts: Record<string, number>, spellTags: readonly Tag[]): number {
  return copyTriggers(counts, spellTags).reduce((sum, g) => sum + g.count, 0);
}
