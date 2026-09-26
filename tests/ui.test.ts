// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultInput } from '../src/engine/input';
import { mountApp } from '../src/ui/render';
import type { CalcInput } from '../src/engine/types';

let root: HTMLElement;
let saved: CalcInput[];

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

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.append(root);
  saved = [];
});

describe('app', () => {
  it('renders the form from the card data', () => {
    mountApp(root, defaultInput(), (i) => saved.push(i));
    expect(text('stepper-echoes-value')).toBe('0');
    expect(root.textContent).toContain('Roaming Throne');
    expect(root.textContent).toContain("Peter Parker's Camera");
    expect(root.textContent).toContain('{1}, tap');
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
    mountApp(root, defaultInput(), (i) => saved.push(i));
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
