// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultInput } from '../src/engine/input';
import { defaultDeck, type Deck } from '../src/ui/deck';
import { mountApp } from '../src/ui/render';
import type { CalcInput } from '../src/engine/types';

let root: HTMLElement;
let saved: CalcInput[];
let savedDecks: Deck[];

function q<T extends Element = HTMLElement>(id: string): T {
  const node = root.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`missing ${id}`);
  return node;
}
function click(id: string, times = 1) {
  for (let i = 0; i < times; i++) q<HTMLButtonElement>(id).click();
}
function text(id: string) {
  return q(id).textContent ?? '';
}
function colorlessField() {
  return q<HTMLInputElement>('stepper-colorless-value');
}
function typeColorless(value: string) {
  const field = colorlessField();
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
function setToggle(id: string, on: boolean) {
  const box = q<HTMLInputElement>(id);
  box.checked = on;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}
function has(id: string) {
  return root.querySelector(`[data-testid="${id}"]`) !== null;
}
function mountWithDeck(input: CalcInput = defaultInput(), deck: Deck = defaultDeck()) {
  return mountApp(root, input, (i) => saved.push(i), { initial: deck, onChange: (d) => savedDecks.push(d) });
}

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.append(root);
  saved = [];
  savedDecks = [];
});

describe('app', () => {
  it('renders the default deck: Echoes and Abstruse Archaic only', () => {
    mountApp(root, defaultInput(), (i) => saved.push(i));
    expect(text('stepper-echoes-value')).toBe('0');
    expect(root.textContent).not.toContain('{1}');
    expect(root.textContent).toContain('Copy target activated or triggered ability you control from a colorless source');
    expect(root.querySelectorAll('.mana--1').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('.mana--t').length).toBeGreaterThan(0);
    expect(has('toggle-archaic')).toBe(true);
    expect(has('toggle-throne')).toBe(false);
    expect(has('toggle-camera')).toBe(false);
    expect(text('deck-count')).toBe('2 of 6');
  });

  it('computes one Echoes with 6 colorless as 16 copies and shows the line', () => {
    mountApp(root, defaultInput(), (i) => saved.push(i));
    click('stepper-colorless-inc', 6);
    click('stepper-echoes-inc');
    expect(text('result-copies')).toBe('16');
    expect(text('step-1')).toContain('Cast the main spell.');
    expect(saved.at(-1)?.colorless).toBe(6);
    expect(saved.at(-1)?.staticDoublers.echoes).toBe(1);
  });

  it('toggles copiers and the main spell flags', () => {
    mountApp(root, defaultInput(), (i) => saved.push(i));
    click('stepper-colorless-inc', 6);
    click('stepper-echoes-inc');
    setToggle('toggle-archaic', true);
    expect(text('result-copies')).toBe('17');
    click('stepper-responseSpells-inc');
    expect(text('result-copies')).toBe('24');
    setToggle('toggle-mainEldrazi', false);
    expect(text('result-copies')).toBe('24');
    setToggle('toggle-mainColorless', false);
    expect(text('result-copies')).toBe('8');
  });

  it('renders single-copy doublers as switches', () => {
    mountWithDeck(defaultInput(), { ...defaultDeck(), throne: true, delney: true });
    expect(() => q('toggle-throne')).not.toThrow();
    expect(() => q('toggle-delney')).not.toThrow();
    expect(root.querySelector('[data-testid="stepper-throne-inc"]')).toBeNull();
    click('stepper-colorless-inc', 4);
    setToggle('toggle-throne', true);
    expect(saved.at(-1)?.staticDoublers.throne).toBe(1);
    expect(text('result-copies')).toBe('4');
    setToggle('toggle-throne', false);
    expect(saved.at(-1)?.staticDoublers.throne).toBe(0);
  });

  it('renders the mana symbol in place of {C}', () => {
    mountApp(root, defaultInput(), () => {});
    click('stepper-colorless-inc', 2);
    const note = q('notes');
    expect(note.querySelectorAll('.mana--c').length).toBe(2);
    expect(note.textContent).not.toContain('{C}');
    expect(note.textContent).toContain('payment does anything');
  });

  it('adding a card to the deck shows it, removing it clears its value', () => {
    const handle = mountWithDeck();
    click('stepper-colorless-inc', 4);
    setToggle('deck-throne', true);
    expect(savedDecks.at(-1)?.throne).toBe(true);
    expect(text('deck-count')).toBe('3 of 6');
    setToggle('toggle-throne', true);
    expect(text('result-copies')).toBe('4');
    setToggle('deck-throne', false);
    expect(has('toggle-throne')).toBe(false);
    expect(handle.getInput().staticDoublers.throne).toBe(0);
    expect(text('result-copies')).toBe('2');
  });

  it('shows a hint when the deck has no doublers or copiers', () => {
    mountWithDeck();
    setToggle('deck-echoes', false);
    setToggle('deck-archaic', false);
    expect(has('battlefield-empty')).toBe(true);
    expect(has('stepper-echoes-inc')).toBe(false);
  });

  it('global reset keeps the deck, deck reset restores the default cards', () => {
    const handle = mountWithDeck();
    setToggle('deck-echoes', false);
    setToggle('deck-camera', true);
    setToggle('toggle-camera', true);
    click('reset');
    expect(has('toggle-camera')).toBe(true);
    expect(has('stepper-echoes-inc')).toBe(false);
    expect(handle.getDeck().camera).toBe(true);
    click('deck-reset');
    expect(handle.getDeck()).toEqual(defaultDeck());
    expect(savedDecks.at(-1)).toEqual(defaultDeck());
    expect(has('toggle-camera')).toBe(false);
    expect(has('stepper-echoes-inc')).toBe(true);
    expect(handle.getInput().activatedCopiers.camera).toBe(false);
  });

  it('clears saved values of cards outside the saved deck on mount', () => {
    const handle = mountWithDeck({ ...defaultInput(), colorless: 4, staticDoublers: { echoes: 0, throne: 1, delney: 0 } });
    expect(handle.getInput().staticDoublers.throne).toBe(0);
    expect(text('result-copies')).toBe('2');
    expect(saved.at(-1)?.staticDoublers.throne).toBe(0);
  });

  it('mounts with a saved deck', () => {
    mountWithDeck(defaultInput(), { ...defaultDeck(), echoes: false, throne: true });
    expect(has('stepper-echoes-inc')).toBe(false);
    expect(has('toggle-throne')).toBe(true);
    expect(q<HTMLInputElement>('deck-throne').checked).toBe(true);
    expect(q<HTMLInputElement>('deck-echoes').checked).toBe(false);
  });

  it('links to GitHub and shows the star count once known', () => {
    const handle = mountApp(root, defaultInput(), () => {});
    const link = q<HTMLAnchorElement>('github');
    expect(link.href).toBe('https://github.com/aurelio-amerio/ulalek-calculator');
    expect(link.target).toBe('_blank');
    expect(text('github-stars')).toBe('');
    handle.setStars(12);
    expect(text('github-stars')).toBe('12');
  });

  it('respects stepper bounds', () => {
    mountApp(root, defaultInput(), () => {});
    click('stepper-echoes-inc', 10);
    expect(text('stepper-echoes-value')).toBe('3');
    click('stepper-echoes-dec', 10);
    expect(text('stepper-echoes-value')).toBe('0');
    expect(q<HTMLButtonElement>('stepper-echoes-dec').disabled).toBe(true);
  });

  it('accepts typed colorless values and clamps junk to 0', () => {
    mountApp(root, defaultInput(), () => {});
    click('stepper-echoes-inc');
    typeColorless('200');
    expect(text('result-copies')).toBe('2,535,301,200,456,458,802,993,406,410,752');
    typeColorless('abc');
    expect(text('result-copies')).toBe('2');
    typeColorless('-5');
    expect(text('result-copies')).toBe('2');
  });

  it('clamps a huge typed colorless value to the engine max instead of throwing', () => {
    const handle = mountApp(root, defaultInput(), () => {});
    expect(() => typeColorless('10000000000')).not.toThrow();
    expect(handle.getInput().colorless).toBe(999);
    expect(() => q('result-copies')).not.toThrow();
  });

  it('keeps the result panel open across re-renders', () => {
    mountApp(root, defaultInput(), () => {});
    const details = q<HTMLDetailsElement>('result-details');
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    click('stepper-colorless-inc');
    expect(q<HTMLDetailsElement>('result-details').open).toBe(true);
  });

  it('shows notes when they apply', () => {
    mountApp(root, defaultInput(), () => {});
    click('stepper-colorless-inc', 2);
    expect(text('notes')).toContain('Only one Ulalek trigger');
  });

  it('reset returns to defaults', () => {
    const handle = mountApp(root, { ...defaultInput(), colorless: 4, responseSpells: 1 }, (i) => saved.push(i));
    expect(colorlessField().value).toBe('4');
    click('reset');
    expect(colorlessField().value).toBe('0');
    expect(text('stepper-responseSpells-value')).toBe('0');
    expect(handle.getInput()).toEqual(defaultInput());
    expect(saved.at(-1)).toEqual(defaultInput());
  });
});
