/**
 * The Node versions the package runs on, and the checks of `djs-bot doctor`.
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
 * The first supported release of each Node line: the one that fixes
 * GHSA-xjj6-f33q-929c. Before it, one malicious HTTP response to the built-in
 * `fetch()` stops the process, and no package can prevent it. The odd lines
 * (23, 25) get no fix and are not supported. The same rule as node-comfort's.
 */
export const NODE_LINES: Readonly<Record<string, string>> = { "22": "22.23.4", "24": "24.22.1", "26": "26.12.1" };

/** The same rule, written for the `engines` field of a `package.json`. */
export const NODE_ENGINES = "^22.23.4 || ^24.22.1 || >=26.12.1";

/** Why the package cannot run on this Node version, or nothing when it can. */
export function nodeProblem(version: string): string | undefined {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  if (major > 26) return undefined;
  const minimum = NODE_LINES[String(major)];
  if (minimum === undefined) return `Node ${version} is not supported: use Node 22, 24 or 26 (${Object.values(NODE_LINES).join(", ")} or later)`;
  if (atLeast(version, minimum)) return undefined;
  return `Node ${version} is too old: on Node ${major}, djs-bot needs ${minimum} or later. Earlier releases have a flaw in their built-in fetch() that one malicious HTTP response can use to stop the process (GHSA-xjj6-f33q-929c)`;
}
