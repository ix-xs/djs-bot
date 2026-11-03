/**
 * Version checks of `djs-bot doctor`.
 *
 * @module versions
 */

/** Compares dotted versions: is `actual` at least `minimum`? */
export function atLeast(actual: string, minimum: string): boolean {
  const a = actual.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const m = minimum.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < m.length; i++) {
    if ((a[i] ?? 0) !== (m[i] ?? 0)) return (a[i] ?? 0) > (m[i] ?? 0);
  }
  return true;
}

/**
 * The first release of each Node line that fixes GHSA-xjj6-f33q-929c: before
 * it, one malicious HTTP response to the built-in `fetch()` stops the process.
 * A bot that fetches addresses its users give is exposed. The lines that are
 * not listed get no fix.
 */
const NODE_FETCH_FIX: Readonly<Record<string, string>> = { "22": "22.23.4", "24": "24.22.1", "26": "26.12.1" };

/** What to say about a Node version that has that flaw, or nothing. */
export function nodeAdvisory(version: string): string | undefined {
  const major = version.split(".")[0] ?? "";
  const fixed = NODE_FETCH_FIX[major];
  if (fixed === undefined) {
    return Number(major) > 26 ? undefined : `Node ${major} gets no fix for a flaw of its built-in fetch() (GHSA-xjj6-f33q-929c): use Node 22, 24 or 26`;
  }
  if (atLeast(version, fixed)) return undefined;
  return `Node ${version} has a flaw in its built-in fetch(): one malicious HTTP response stops the process (GHSA-xjj6-f33q-929c). Update to ${fixed} or later`;
}
