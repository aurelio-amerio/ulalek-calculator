import { ACTIVATED_COPIERS, STATIC_DOUBLERS } from '../engine/cards';
import { calculate } from '../engine/calculate';
import { defaultInput, normalizeInput } from '../engine/input';
import { describeLine, formatCount } from '../engine/line';
import type { CalcInput } from '../engine/types';

export interface AppHandle {
  getInput(): CalcInput;
  reset(): void;
}

type Attrs = Record<string, string>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function hint(text?: string): Node[] {
  return text ? [el('span', { class: 'hint' }, text)] : [];
}

interface StepperOpts {
  id: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
  /** Large variant with a typeable number field. */
  big?: boolean;
  get: () => number;
  set: (n: number) => void;
}

function stepper(o: StepperOpts, onChange: () => void): HTMLElement {
  const dec = el(
    'button',
    { type: 'button', class: 'stepper__btn', 'aria-label': `Decrease ${o.label}`, 'data-testid': `stepper-${o.id}-dec` },
    '−',
  );
  const inc = el(
    'button',
    { type: 'button', class: 'stepper__btn', 'aria-label': `Increase ${o.label}`, 'data-testid': `stepper-${o.id}-inc` },
    '+',
  );
  const value: HTMLInputElement | HTMLOutputElement = o.big
    ? el('input', {
        type: 'text',
        inputmode: 'numeric',
        class: 'stepper__value',
        'aria-label': o.label,
        'data-testid': `stepper-${o.id}-value`,
      })
    : el('output', { class: 'stepper__value', 'data-testid': `stepper-${o.id}-value` });

  const clamp = (n: number) => Math.min(o.max, Math.max(o.min, n));
  const syncButtons = () => {
    dec.disabled = o.get() <= o.min;
    inc.disabled = o.get() >= o.max;
  };
  const sync = () => {
    const n = o.get();
    if (value instanceof HTMLInputElement) value.value = String(n);
    else value.textContent = String(n);
    syncButtons();
  };
  const update = (n: number) => {
    o.set(clamp(n));
    sync();
    onChange();
  };
  dec.addEventListener('click', () => update(o.get() - 1));
  inc.addEventListener('click', () => update(o.get() + 1));
  if (value instanceof HTMLInputElement) {
    value.addEventListener('input', () => {
      const parsed = Number.parseInt(value.value, 10);
      o.set(clamp(Number.isFinite(parsed) ? parsed : 0));
      syncButtons();
      onChange();
    });
    value.addEventListener('blur', sync);
  }
  sync();

  return el(
    'div',
    { class: `stepper${o.big ? ' stepper--big' : ''}` },
    el('div', { class: 'stepper__text' }, el('span', { class: 'stepper__label' }, o.label), ...hint(o.hint)),
    el('div', { class: 'stepper__controls' }, dec, value, inc),
  );
}

interface ToggleOpts {
  id: string;
  label: string;
  hint?: string;
  get: () => boolean;
  set: (b: boolean) => void;
}

function toggle(o: ToggleOpts, onChange: () => void): HTMLElement {
  const box = el('input', { type: 'checkbox', role: 'switch', 'data-testid': `toggle-${o.id}` });
  box.checked = o.get();
  box.addEventListener('change', () => {
    o.set(box.checked);
    onChange();
  });
  return el(
    'label',
    { class: 'toggle' },
    el('span', { class: 'toggle__text' }, el('span', { class: 'toggle__label' }, o.label), ...hint(o.hint)),
    box,
    el('span', { class: 'toggle__track', 'aria-hidden': 'true' }),
  );
}

function card(title: string, ...children: Node[]): HTMLElement {
  return el('section', { class: 'card' }, el('h2', {}, title), ...children);
}

function buildForm(input: CalcInput, onChange: () => void): HTMLElement[] {
  return [
    card(
      'Mana',
      stepper(
        {
          id: 'colorless',
          label: 'Colorless mana left',
          hint: 'After casting the spell, any response spells, and any copier activations below.',
          min: 0,
          max: Number.MAX_SAFE_INTEGER,
          big: true,
          get: () => input.colorless,
          set: (n) => (input.colorless = n),
        },
        onChange,
      ),
    ),
    card(
      'Main spell',
      toggle(
        {
          id: 'mainEldrazi',
          label: 'Eldrazi spell',
          hint: 'Needed for Ulalek to trigger on the cast.',
          get: () => input.mainSpell.eldrazi,
          set: (b) => (input.mainSpell.eldrazi = b),
        },
        onChange,
      ),
      toggle(
        {
          id: 'mainColorless',
          label: 'Colorless',
          hint: 'Needed for Echoes of Eternity to copy it.',
          get: () => input.mainSpell.colorless,
          set: (b) => (input.mainSpell.colorless = b),
        },
        onChange,
      ),
    ),
    card(
      'Battlefield',
      ...STATIC_DOUBLERS.map((d) =>
        stepper(
          {
            id: d.id,
            label: d.name,
            hint: d.note,
            min: 0,
            max: d.maxCount,
            get: () => input.staticDoublers[d.id] ?? 0,
            set: (n) => (input.staticDoublers[d.id] = n),
          },
          onChange,
        ),
      ),
      ...ACTIVATED_COPIERS.map((c) =>
        toggle(
          {
            id: c.id,
            label: c.name,
            hint: `${c.costText}${c.note ? `. ${c.note}` : ''}`,
            get: () => input.activatedCopiers[c.id] === true,
            set: (b) => (input.activatedCopiers[c.id] = b),
          },
          onChange,
        ),
      ),
    ),
    card(
      'Cast in response',
      stepper(
        {
          id: 'responseSpells',
          label: 'Eldrazi spells cast in response',
          hint: 'Any Eldrazi spell cast before a trigger resolves (Eldritch Immunity, Nameless Inversion, Dimensional Infiltrator). Subtract its cost from the mana above.',
          min: 0,
          max: 99,
          get: () => input.responseSpells,
          set: (n) => (input.responseSpells = n),
        },
        onChange,
      ),
    ),
  ];
}

function renderResult(box: HTMLElement, input: CalcInput, open: boolean, onToggle: (open: boolean) => void): void {
  const result = calculate(input);
  box.replaceChildren();
  if (!result.ok) {
    box.append(el('p', { class: 'result__error', 'data-testid': 'result-error' }, result.error));
    return;
  }

  const summary = el(
    'summary',
    { class: 'result__summary' },
    el('span', { class: 'result__count', 'data-testid': 'result-copies' }, formatCount(result.copies)),
    el('span', { class: 'result__caption' }, `copies of the main spell · ${formatCount(result.duplicates)} new`),
    el('span', { class: 'result__chevron', 'aria-hidden': 'true' }),
  );

  const steps = describeLine(input, result);
  const list = el(
    'ol',
    { class: 'steps', 'data-testid': 'steps' },
    ...steps.map((s, i) =>
      el(
        'li',
        { class: 'step', 'data-testid': `step-${i + 1}` },
        el('strong', {}, s.title),
        ...(s.detail ? [el('span', { class: 'step__detail' }, s.detail)] : []),
      ),
    ),
  );

  const formula = `${result.sources} × 2^${result.payments}${result.immediate ? ` + ${result.immediate}` : ''}`;
  const facts: [string, string][] = [
    ['Ulalek triggers per cast', String(result.triggersPerCast)],
    ['Ulalek triggers on the stack', String(result.totalTriggers)],
    ['Copies from Echoes', String(result.doublerCopies)],
    ['Copy sources before paying', String(result.sources)],
    ['{C}{C} payments', String(result.payments)],
    ['Formula', formula],
    ['Leftover colorless', String(result.leftoverColorless)],
  ];
  const dl = el('dl', { class: 'facts' }, ...facts.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));

  const body = el('div', { class: 'result__body' }, el('h2', {}, 'Line of play'), list, el('h2', {}, 'Breakdown'), dl);
  if (result.notes.length > 0) {
    body.append(el('ul', { class: 'notes', 'data-testid': 'notes' }, ...result.notes.map((n) => el('li', {}, n))));
  }

  const details = el('details', { class: 'result__details', 'data-testid': 'result-details' }, summary, body);
  details.open = open;
  details.addEventListener('toggle', () => onToggle(details.open));
  box.append(details);
}

export function mountApp(root: HTMLElement, initial: CalcInput, onChange: (input: CalcInput) => void): AppHandle {
  let input = normalizeInput(initial);
  let detailsOpen = false;

  const form = el('div', { class: 'form' });
  const resultBox = el('section', { class: 'result', 'data-testid': 'result', 'aria-live': 'polite' });

  const rerender = () => {
    onChange(normalizeInput(input));
    renderResult(resultBox, input, detailsOpen, (open) => (detailsOpen = open));
  };
  const rebuildForm = () => form.replaceChildren(...buildForm(input, rerender));

  const resetButton = el('button', { type: 'button', class: 'btn', 'data-testid': 'reset' }, 'Reset');
  const reset = () => {
    input = defaultInput();
    rebuildForm();
    rerender();
  };
  resetButton.addEventListener('click', reset);

  root.append(
    el(
      'div',
      { class: 'app' },
      el('header', { class: 'header' }, el('h1', {}, 'Ulalek ', el('span', {}, 'Calculator')), resetButton),
      form,
      el(
        'footer',
        { class: 'footer' },
        'Assumes Ulalek, Fused Atrocity is on the battlefield and that you spend all colorless mana on its trigger. Mana produced by the copies themselves is not counted: anything that makes mana inside the loop is infinite anyway.',
      ),
      resultBox,
    ),
  );
  rebuildForm();
  rerender();

  return {
    getInput: () => normalizeInput(input),
    reset,
  };
}
