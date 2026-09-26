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
  const m = input.mainSpell.eldrazi ? 1 : 0;
  const spellTriggers = u * m + u * r;

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

  // 2 and 3. Activate copiers and cast the response spell(s), in the right order.
  const copierStep = (): Step | null => {
    if (copierNames.length === 0) return null;
    const names = nameList(copierNames);
    switch (result.copierRole) {
      case 'source':
        return {
          title: `Activate ${names}, targeting an Echoes trigger.`,
          detail: 'Hold priority: the response spell must be cast while these abilities are still on the stack.',
        };
      case 'immediate':
        return {
          title: `Activate ${names}, targeting an Echoes trigger.`,
          detail: 'Each one makes one extra copy that resolves right away.',
        };
      case 'trigger': {
        const detail =
          spellTriggers >= 2
            ? 'It adds one more Ulalek trigger, which is not needed here.'
            : 'This puts a second Ulalek trigger on the stack so the loop can continue.';
        return { title: `Activate ${names}, targeting a Ulalek trigger.`, detail };
      }
      case 'none':
        return { title: `Skip ${names}.`, detail: 'There is nothing useful to target.' };
    }
  };
  const responseStep = (): Step | null => {
    if (r === 0) return null;
    const above = result.copierRole === 'source' ? ', above the copier abilities' : '';
    return {
      title: r === 1 ? 'Cast your Eldrazi spell in response.' : `Cast your ${r} Eldrazi spells in response.`,
      detail: `Ulalek triggers ${times(u, 'more time')} per spell. Put those triggers on top of the stack${above}.`,
    };
  };
  // The 'trigger' copier role targets a Ulalek trigger. When the main spell is not Eldrazi, that trigger
  // only exists once a response spell has been cast, so the copier step must come after it.
  const copierAfterResponse = result.copierRole === 'trigger' && !input.mainSpell.eldrazi;
  if (copierAfterResponse) {
    const rs = responseStep();
    if (rs) steps.push(rs);
    const cs = copierStep();
    if (cs) steps.push(cs);
  } else {
    const cs = copierStep();
    if (cs) steps.push(cs);
    const rs = responseStep();
    if (rs) steps.push(rs);
  }

  // 4 and 5. Pay.
  if (k > 0) {
    const hasEchoes = c > 0;
    const hasCopierCopies = result.copierRole === 'source' || result.copierRole === 'immediate';
    let payDetail: string;
    if (hasEchoes || hasCopierCopies) {
      const tail =
        hasEchoes && hasCopierCopies
          ? 'the Echoes and copier copies'
          : hasEchoes
            ? 'the Echoes copies'
            : 'the copier copies';
      payDetail = `Put the spell copies on the stack, then the ability copies, with the Ulalek copies on top of ${tail}.`;
    } else {
      payDetail = 'Put the spell copies on the stack, then the Ulalek copies on top of the spell copies.';
    }
    steps.push({ title: 'Let the top Ulalek trigger resolve and pay {C}{C}.', detail: payDetail });
    if (k > 1) {
      const final = BigInt(result.sources) * 2n ** BigInt(k);
      const verb = result.sources === 1 ? 'becomes' : 'become';
      steps.push({
        title: `Repeat until you have paid ${k} times.`,
        detail: `After each payment everything under the Ulalek copies doubles: ${times(result.sources, 'copy source')} ${verb} ${formatCount(final)} after the last payment.`,
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
    const title =
      k > 0
        ? 'Stop paying and let everything resolve.'
        : result.totalTriggers > 0
          ? 'Decline the {C}{C} payment and let everything resolve.'
          : 'Let everything resolve.';
    steps.push({
      title,
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
