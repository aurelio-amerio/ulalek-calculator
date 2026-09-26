import { ACTIVATED_COPIERS, STATIC_DOUBLERS, ULALEK_TAGS } from '../src/engine/cards';
import type { CalcInput, StaticDoubler, Tag } from '../src/engine/types';

/**
 * Objects on the stack. Index 0 is the bottom.
 * S: the main spell or a copy of it.
 * R: a response spell or a copy of it.
 * U: a Ulalek trigger (pay {C}{C} on resolution to copy everything else).
 * E: an Echoes copy trigger tied to the main spell.
 * A: a copier ability with the kind of ability it targets.
 */
type Item =
  | { kind: 'S' }
  | { kind: 'R' }
  | { kind: 'U' }
  | { kind: 'E' }
  | { kind: 'A'; target: 'E' | 'U' };

export interface SimResult {
  mainSpellCopies: number;
  responseSpellCopies: number;
  paymentsMade: number;
  leftover: number;
}

const has = (tags: readonly Tag[], required: readonly Tag[]) => required.every((t) => tags.includes(t));

function instances(counts: Record<string, number>): StaticDoubler[] {
  const out: StaticDoubler[] = [];
  for (const d of STATIC_DOUBLERS) for (let i = 0; i < (counts[d.id] ?? 0); i++) out.push(d);
  return out;
}

/** Replays the spec's line of play on an explicit stack and counts what resolves. */
export function simulate(input: CalcInput): SimResult {
  const all = instances(input.staticDoublers);
  const u = 1 + all.filter((d) => has(ULALEK_TAGS, d.affects)).length;
  const spellTags: Tag[] = [];
  if (input.mainSpell.eldrazi) spellTags.push('eldrazi');
  if (input.mainSpell.colorless) spellTags.push('colorless');

  // Echoes-style triggers tied to the main spell, one entry per trigger with its source's tags.
  const eSources: Tag[][] = [];
  all.forEach((d, i) => {
    if (!d.copiesSpell || !has(spellTags, d.copiesSpell)) return;
    const fires = 1 + all.filter((o, j) => j !== i && has(d.tags, o.affects)).length;
    for (let n = 0; n < fires; n++) eSources.push(d.tags);
  });

  // Cast the main spell: E triggers first (bottom), then U triggers on top.
  const stack: Item[] = [{ kind: 'S' }];
  for (let i = 0; i < eSources.length; i++) stack.push({ kind: 'E' });
  if (input.mainSpell.eldrazi) for (let i = 0; i < u; i++) stack.push({ kind: 'U' });

  // Activate copiers: prefer an E tied to the main spell, else a U. Skip if nothing is legal yet.
  const pending = ACTIVATED_COPIERS.filter((cp) => input.activatedCopiers[cp.id] === true);
  const activate = () => {
    for (const cp of [...pending]) {
      const eLegal = eSources.some((t) => has(t, cp.affectsSourceTags)) && stack.some((it) => it.kind === 'E');
      const uLegal = has(ULALEK_TAGS, cp.affectsSourceTags) && stack.some((it) => it.kind === 'U');
      if (eLegal) stack.push({ kind: 'A', target: 'E' });
      else if (uLegal) stack.push({ kind: 'A', target: 'U' });
      else continue;
      pending.splice(pending.indexOf(cp), 1);
    }
  };
  activate();

  // Cast the response spells while holding priority: each adds u U triggers on top.
  for (let i = 0; i < input.responseSpells; i++) {
    stack.push({ kind: 'R' });
    for (let j = 0; j < u; j++) stack.push({ kind: 'U' });
  }
  activate(); // copiers that had no legal target before the response spells

  let colorless = input.colorless;
  let payments = 0;
  let mainCopies = 0;
  let responseCopies = 0;

  while (stack.length > 0) {
    const top = stack.pop()!;
    switch (top.kind) {
      case 'S':
        mainCopies++;
        break;
      case 'R':
        responseCopies++;
        break;
      case 'U':
        if (colorless >= 2) {
          colorless -= 2;
          payments++;
          const spells = stack.filter((it) => it.kind === 'S' || it.kind === 'R');
          const abilities = stack.filter((it) => it.kind === 'E' || it.kind === 'A');
          const triggers = stack.filter((it) => it.kind === 'U');
          // Spell copies first, then ability copies, with Ulalek copies on top.
          for (const s of spells) stack.push({ ...s });
          for (const a of abilities) stack.push({ ...a });
          for (const t of triggers) stack.push({ ...t });
        }
        break;
      case 'E':
        stack.push({ kind: 'S' });
        break;
      case 'A':
        if (top.target === 'E' && stack.some((it) => it.kind === 'E')) stack.push({ kind: 'E' });
        else if (top.target === 'U' && stack.some((it) => it.kind === 'U')) stack.push({ kind: 'U' });
        break;
    }
  }

  return {
    mainSpellCopies: mainCopies,
    responseSpellCopies: input.responseSpells > 0 ? responseCopies / input.responseSpells : 0,
    paymentsMade: payments,
    leftover: colorless,
  };
}
