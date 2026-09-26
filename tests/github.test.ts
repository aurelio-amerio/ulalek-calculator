import { describe, expect, it } from 'vitest';
import { REPO_URL, fetchStars, formatStars } from '../src/ui/github';

const response = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, json: async () => body }) as Response;

describe('github', () => {
  it('points at the repository', () => {
    expect(REPO_URL).toBe('https://github.com/aurelio-amerio/ulalek-calculator');
  });

  it('reads the star count', async () => {
    const calls: string[] = [];
    const n = await fetchStars(async (url) => {
      calls.push(String(url));
      return response(200, { stargazers_count: 42 });
    });
    expect(n).toBe(42);
    expect(calls[0]).toBe('https://api.github.com/repos/aurelio-amerio/ulalek-calculator');
  });

  it('returns null on errors, bad status and junk', async () => {
    expect(await fetchStars(async () => response(403, { message: 'rate limited' }))).toBeNull();
    expect(await fetchStars(async () => response(200, { stargazers_count: 'many' }))).toBeNull();
    expect(
      await fetchStars(async () => {
        throw new Error('offline');
      }),
    ).toBeNull();
  });

  it('formats counts compactly', () => {
    expect(formatStars(7)).toBe('7');
    expect(formatStars(1234)).toBe('1.2K');
  });
});
