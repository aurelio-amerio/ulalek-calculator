import { normalizeInput } from '../engine/input';
import type { CalcInput } from '../engine/types';

export const STORAGE_KEY = 'ulalek-calculator:v1';

export function loadInput(): CalcInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return normalizeInput(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveInput(input: CalcInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
  } catch {
    // Storage blocked or full: the app keeps working without persistence.
  }
}
