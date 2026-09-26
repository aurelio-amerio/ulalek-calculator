export const REPO = 'aurelio-amerio/ulalek-calculator';
export const REPO_URL = `https://github.com/${REPO}`;

/** Star count from the GitHub API, or null when offline, rate limited or otherwise unavailable. */
export async function fetchStars(fetchImpl: typeof fetch = fetch): Promise<number | null> {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const n = body && typeof body === 'object' ? (body as { stargazers_count?: unknown }).stargazers_count : null;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

/** 1234 -> "1.2k", so the count stays short in the header. */
export function formatStars(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
