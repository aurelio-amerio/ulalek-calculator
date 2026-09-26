import { selectedCopiers } from './calculate';
import type { CalcInput, CalcResult, Step } from './types';

export function formatCount(n: bigint | number): string {
  return n.toLocaleString('en-US');
}

function times(n: number, noun = 'time'): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function nameList(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The order of play that reaches the result, as plain sentences. Empty for an invalid input. */
export function describeLine(input: CalcInput, result: CalcResult): Step[] {
  if (!result.ok) return [];
  const steps: Step[] = [];
  const u = result.triggersPerCast;
  const c = result.doublerCopies;
  const k = result.payments;
  const r = input.responseSpells;
  const copierNames = selectedCopiers(input).map((cp) => cp.name);

  // 1. Cast the main spell.
  {
    const parts: string[] = [];
    if (input.mainSpell.eldrazi) parts.push(`Ulalek triggers ${times(u)}.`);
    else parts.push('Ulalek does not trigger: it is not an Eldrazi spell.');
    if (c > 0) {
      parts.push(`Echoes triggers ${times(c)}.`);
      const echoesWord = c === 1 ? 'trigger' : 'triggers';
      const thenUlalek = input.mainSpell.eldrazi ? ', then the Ulalek triggers on top' : '';
      parts.push(`Put the Echoes ${echoesWord} on the stack first${thenUlalek}.`);
    }
    steps.push({ title: 'Cast the main spell.', detail: parts.join(' ') });
  }

  // 2. Activate copiers.
  if (copierNames.length > 0) {
    const names = nameList(copierNames);
    switch (result.copierRole) {
      case 'source':
        steps.push({
          title: `Activate ${names}, targeting an Echoes trigger.`,
          detail: 'Hold priority: the response spell must be cast while these abilities are still on the stack.',
        });
        break;
      case 'immediate':
        steps.push({
          title: `Activate ${names}, targeting an Echoes trigger.`,
          detail: 'Each one makes one extra copy that resolves right away.',
        });
        break;
      case 'trigger':
        steps.push({
          title: `Activate ${names}, targeting a Ulalek trigger.`,
          detail: 'This puts a second Ulalek trigger on the stack so the loop can continue.',
        });
        break;
      case 'none':
        steps.push({ title: `Skip ${names}.`, detail: 'There is nothing useful to target.' });
        break;
    }
  }

  // 3. Cast the response spell(s).
  if (r > 0) {
    const above = result.copierRole === 'source' ? ', above the copier abilities' : '';
    steps.push({
      title: r === 1 ? 'Cast your Eldrazi spell in response.' : `Cast your ${r} Eldrazi spells in response.`,
      detail: `Ulalek triggers ${times(u, 'more time')} per spell. Put those triggers on top of the stack${above}.`,
    });
  }

  // 4 and 5. Pay.
  if (k > 0) {
    steps.push({
      title: 'Let the top Ulalek trigger resolve and pay {C}{C}.',
      detail:
        'Put the spell copies on the stack, then the ability copies, with the Ulalek copies on top of the Echoes and copier copies.',
    });
    if (k > 1) {
      const final = BigInt(result.sources) * 2n ** BigInt(k);
      steps.push({
        title: `Repeat until you have paid ${k} times.`,
        detail: `After each payment everything under the Ulalek copies doubles: ${result.sources} copy sources become ${formatCount(final)} after the last payment.`,
      });
    }
  }

  // 6. Resolve.
  {
    const parts: string[] = [];
    if (result.copierRole === 'source' || result.copierRole === 'immediate') {
      parts.push('each copier ability copies an Echoes trigger');
    }
    if (c > 0) parts.push('each Echoes trigger copies the main spell');
    parts.push('every copy of the main spell resolves');
    const detail = parts.join(', ');
    steps.push({
      title: k > 0 ? 'Stop paying and let everything resolve.' : 'Let everything resolve.',
      detail: detail.charAt(0).toUpperCase() + detail.slice(1) + '.',
    });
  }

  // 7. Result.
  {
    const parts: string[] = [];
    if (r > 0) parts.push(`Each response spell: ${formatCount(result.responseSpellCopies)} copies.`);
    parts.push(`Leftover colorless mana: ${result.leftoverColorless}.`);
    steps.push({
      title: `Result: ${formatCount(result.copies)} copies of the main spell (${formatCount(result.duplicates)} new).`,
      detail: parts.join(' '),
    });
  }

  return steps;
}
