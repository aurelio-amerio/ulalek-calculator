// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { manaText } from '../src/ui/mana';

function render(text: string): HTMLElement {
  const div = document.createElement('div');
  div.append(...manaText(text));
  return div;
}

describe('manaText', () => {
  it('returns plain text untouched', () => {
    const div = render('Cast the main spell.');
    expect(div.childNodes.length).toBe(1);
    expect(div.textContent).toBe('Cast the main spell.');
  });

  it('replaces numbers, {C} and {T} with symbols', () => {
    const div = render('{1}, {T}: pay {C}{C}');
    expect(div.querySelectorAll('.mana').length).toBe(4);
    expect(div.querySelector('.mana--1')?.getAttribute('aria-label')).toBe('1');
    expect(div.querySelector('.mana--t')?.getAttribute('aria-label')).toBe('tap');
    expect(div.querySelectorAll('.mana--c').length).toBe(2);
    expect(div.textContent).toBe(', : pay ');
  });

  it('keeps symbols it has no glyph for as text', () => {
    const div = render('{2}{W}');
    expect(div.querySelectorAll('.mana').length).toBe(1);
    expect(div.textContent).toBe('{W}');
  });

  it('turns newlines into line breaks', () => {
    const div = render('Ward {2}\nSecond line');
    expect(div.querySelectorAll('br').length).toBe(1);
    expect(div.textContent).toBe('Ward Second line');
  });
});
