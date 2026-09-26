import { ACTIVATED_COPIERS, MAX_COLORLESS, MAX_RESPONSE_SPELLS, STATIC_DOUBLERS } from '../engine/cards';
import { calculate } from '../engine/calculate';
import { defaultInput, normalizeInput } from '../engine/input';
import { describeLine, formatCount } from '../engine/line';
import type { CalcInput } from '../engine/types';
import { DECK_CARD_IDS, defaultDeck, normalizeDeck, type Deck } from './deck';
import { REPO_URL, formatStars } from './github';
import { manaText } from './mana';

export interface AppHandle {
  getInput(): CalcInput;
  reset(): void;
  getDeck(): Deck;
  resetDeck(): void;
  /** Shows the GitHub star count next to the repository link. */
  setStars(n: number): void;
}

export interface DeckOpts {
  initial: Deck;
  onChange: (deck: Deck) => void;
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
  return text ? [el('span', { class: 'hint' }, ...manaText(text))] : [];
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

interface CheckOpts {
  id: string;
  label: string;
  hint?: string;
  get: () => boolean;
  set: (b: boolean) => void;
}

function checkbox(o: CheckOpts, onChange: () => void): HTMLElement {
  const box = el('input', { type: 'checkbox', 'data-testid': `deck-${o.id}` });
  box.checked = o.get();
  box.addEventListener('change', () => {
    o.set(box.checked);
    onChange();
  });
  return el(
    'label',
    { class: 'check' },
    el('span', { class: 'check__text' }, el('span', { class: 'check__label' }, o.label), ...hint(o.hint)),
    box,
    el('span', { class: 'check__box', 'aria-hidden': 'true' }),
  );
}

interface DeckMenuOpts {
  deck: Deck;
  open: boolean;
  onToggle: (open: boolean) => void;
  onCard: (id: string, inDeck: boolean) => void;
  onReset: () => void;
}

function deckCount(deck: Deck): string {
  return `${DECK_CARD_IDS.filter((id) => deck[id]).length} of ${DECK_CARD_IDS.length}`;
}

/** Collapsible checklist of which doublers and copiers the deck contains. */
function deckMenu(o: DeckMenuOpts): HTMLElement {
  const count = el('span', { class: 'deck__count', 'data-testid': 'deck-count' }, deckCount(o.deck));
  const row = (id: string, name: string, note?: string) =>
    checkbox(
      {
        id,
        label: name,
        hint: note,
        get: () => o.deck[id] === true,
        set: (b) => o.onCard(id, b),
      },
      () => (count.textContent = deckCount(o.deck)),
    );
  const reset = el('button', { type: 'button', class: 'btn', 'data-testid': 'deck-reset' }, 'Reset deck');
  reset.addEventListener('click', o.onReset);
  const details = el(
    'details',
    { class: 'card card--deck', 'data-testid': 'deck' },
    el(
      'summary',
      { class: 'deck__summary' },
      el('h2', {}, 'Cards in deck'),
      count,
      el('span', { class: 'chevron', 'aria-hidden': 'true' }),
    ),
    el(
      'div',
      { class: 'deck__body' },
      el('p', { class: 'hint' }, 'Only checked cards appear under Battlefield. Unchecking a card also clears it there.'),
      el('h3', { class: 'deck__group' }, 'Trigger doublers'),
      ...STATIC_DOUBLERS.map((d) => row(d.id, d.name)),
      el('h3', { class: 'deck__group' }, 'Copiers'),
      ...ACTIVATED_COPIERS.map((c) => row(c.id, c.name, c.costText)),
      el('div', { class: 'deck__actions' }, reset),
    ),
  );
  details.open = o.open;
  details.addEventListener('toggle', () => o.onToggle(details.open));
  return details;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(path: string, cls: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('fill', 'currentColor');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

/** GitHub's "mark-github" and "star" octicons. */
const GITHUB_MARK =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z';
const STAR =
  'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z';

/** Link to the repository with a star button; the count fills in once fetched. */
function githubLink(): { link: HTMLElement; stars: HTMLElement } {
  const stars = el('span', { class: 'gh__stars', 'data-testid': 'github-stars' });
  const link = el(
    'a',
    {
      class: 'gh',
      href: REPO_URL,
      target: '_blank',
      rel: 'noopener',
      'aria-label': 'Star the project on GitHub',
      'data-testid': 'github',
    },
    icon(GITHUB_MARK, 'gh__mark'),
    el('span', { class: 'gh__text' }, 'GitHub'),
    el('span', { class: 'gh__star' }, icon(STAR, 'gh__star-icon'), 'Star', stars),
  );
  return { link, stars };
}

function card(title: string, ...children: Node[]): HTMLElement {
  return el('section', { class: 'card' }, el('h2', {}, title), ...children);
}

function buildForm(input: CalcInput, deck: Deck, onChange: () => void): HTMLElement[] {
  const doublers = STATIC_DOUBLERS.filter((d) => deck[d.id]);
  const copiers = ACTIVATED_COPIERS.filter((c) => deck[c.id]);
  const battlefield: Node[] =
    doublers.length + copiers.length === 0
      ? [
          el(
            'p',
            { class: 'hint', 'data-testid': 'battlefield-empty' },
            'No doublers or copiers in the deck. Open "Cards in deck" below to add some.',
          ),
        ]
      : [];
  return [
    card(
      'Mana',
      stepper(
        {
          id: 'colorless',
          label: 'Colorless mana left',
          hint: 'After casting the spell, any response spells, and any copier activations below.',
          min: 0,
          max: MAX_COLORLESS,
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
      ...battlefield,
      ...doublers.map((d) =>
        d.maxCount === 1
          ? toggle(
              {
                id: d.id,
                label: d.name,
                hint: d.oracle,
                get: () => (input.staticDoublers[d.id] ?? 0) > 0,
                set: (b) => (input.staticDoublers[d.id] = b ? 1 : 0),
              },
              onChange,
            )
          : stepper(
              {
                id: d.id,
                label: d.name,
                hint: d.oracle,
                min: 0,
                max: d.maxCount,
                get: () => input.staticDoublers[d.id] ?? 0,
                set: (n) => (input.staticDoublers[d.id] = n),
              },
              onChange,
            ),
      ),
      ...copiers.map((c) =>
        toggle(
          {
            id: c.id,
            label: c.name,
            hint: c.oracle,
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
          max: MAX_RESPONSE_SPELLS,
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
    box.append(el('p', { class: 'result__error', 'data-testid': 'result-error', 'aria-live': 'polite' }, result.error));
    return;
  }

  const summary = el(
    'summary',
    { class: 'result__summary' },
    el(
      'span',
      { class: 'result__count', 'data-testid': 'result-copies', 'aria-live': 'polite' },
      formatCount(result.copies),
    ),
    el('span', { class: 'result__caption' }, `copies of the main spell · ${formatCount(result.duplicates)} new`),
    el('span', { class: 'chevron', 'aria-hidden': 'true' }),
  );

  const steps = describeLine(input, result);
  const list = el(
    'ol',
    { class: 'steps', 'data-testid': 'steps' },
    ...steps.map((s, i) =>
      el(
        'li',
        { class: 'step', 'data-testid': `step-${i + 1}` },
        el('strong', {}, ...manaText(s.title)),
        ...(s.detail ? [el('span', { class: 'step__detail' }, ...manaText(s.detail))] : []),
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
  const dl = el(
    'dl',
    { class: 'facts' },
    ...facts.flatMap(([k, v]) => [el('dt', {}, ...manaText(k)), el('dd', {}, v)]),
  );

  const body = el('div', { class: 'result__body' }, el('h2', {}, 'Line of play'), list, el('h2', {}, 'Breakdown'), dl);
  if (result.notes.length > 0) {
    body.append(el('ul', { class: 'notes', 'data-testid': 'notes' }, ...result.notes.map((n) => el('li', {}, ...manaText(n)))));
  }

  const details = el('details', { class: 'result__details', 'data-testid': 'result-details' }, summary, body);
  details.open = open;
  details.addEventListener('toggle', () => onToggle(details.open));
  box.append(details);
}

export function mountApp(
  root: HTMLElement,
  initial: CalcInput,
  onChange: (input: CalcInput) => void,
  deckOpts?: DeckOpts,
): AppHandle {
  let input = normalizeInput(initial);
  let deck = normalizeDeck(deckOpts?.initial ?? defaultDeck());
  let detailsOpen = false;
  let deckOpen = false;

  const form = el('div', { class: 'form' });
  const deckBox = el('div', { class: 'deck' });
  const resultBox = el('section', { class: 'result', 'data-testid': 'result' });

  /** A card that is not in the deck must not count. */
  const clearCard = (id: string) => {
    if (id in input.staticDoublers) input.staticDoublers[id] = 0;
    if (id in input.activatedCopiers) input.activatedCopiers[id] = false;
  };
  for (const id of DECK_CARD_IDS) if (!deck[id]) clearCard(id);

  const rerender = () => {
    onChange(normalizeInput(input));
    renderResult(resultBox, input, detailsOpen, (open) => (detailsOpen = open));
  };
  const rebuildForm = () => form.replaceChildren(...buildForm(input, deck, rerender));
  const rebuildDeckMenu = () =>
    deckBox.replaceChildren(
      deckMenu({
        deck,
        open: deckOpen,
        onToggle: (open) => (deckOpen = open),
        onCard: (id, inDeck) => {
          deck[id] = inDeck;
          if (!inDeck) clearCard(id);
          deckOpts?.onChange({ ...deck });
          rebuildForm();
          rerender();
        },
        onReset: resetDeck,
      }),
    );

  const resetButton = el('button', { type: 'button', class: 'btn', 'data-testid': 'reset' }, 'Reset');
  const reset = () => {
    input = defaultInput();
    for (const id of DECK_CARD_IDS) if (!deck[id]) clearCard(id);
    rebuildForm();
    rerender();
  };
  resetButton.addEventListener('click', reset);

  function resetDeck(): void {
    deck = defaultDeck();
    for (const id of DECK_CARD_IDS) if (!deck[id]) clearCard(id);
    deckOpts?.onChange({ ...deck });
    rebuildForm();
    rebuildDeckMenu();
    rerender();
  }

  const github = githubLink();
  root.append(
    el(
      'div',
      { class: 'app' },
      el(
        'header',
        { class: 'header' },
        el('div', { class: 'header__title' }, el('h1', {}, 'Ulalek ', el('span', {}, 'Calculator')), github.link),
        resetButton,
      ),
      form,
      deckBox,
      el(
        'footer',
        { class: 'footer' },
        'Assumes Ulalek, Fused Atrocity is on the battlefield and that you spend all colorless mana on its trigger. ' +
          'Known simplifications: mana made by the copies themselves is ignored; cost reducers are not modelled; ' +
          "response spells are assumed to be Eldrazi and their own Echoes copies are ignored (they also get doubled by the same amount).",
      ),
      resultBox,
    ),
  );
  rebuildForm();
  rebuildDeckMenu();
  rerender();

  return {
    getInput: () => normalizeInput(input),
    reset,
    getDeck: () => ({ ...deck }),
    resetDeck,
    setStars: (n) => {
      github.stars.textContent = formatStars(n);
      github.stars.classList.add('gh__stars--shown');
    },
  };
}
