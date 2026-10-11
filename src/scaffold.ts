/**
 * What `djs-bot init` does to a `package.json` that is already there.
 *
 * @module scaffold
 */

/** The scripts the starter relies on. */
export const STARTER_SCRIPTS: Readonly<Record<string, string>> = {
  dev: "djs-bot dev",
  start: "djs-bot start",
  deploy: "djs-bot deploy",
  doctor: "djs-bot doctor",
  explain: "djs-bot explain",
  typecheck: "tsc --noEmit",
};

/** The outcome of {@link adoptPackage}. */
export interface AdoptedPackage {
  /** The package, with what the starter needs added. */
  pkg: Record<string, unknown>;
  /** What was added, in words, for the summary line. Empty when nothing changed. */
  changes: string[];
  /** Whether the package runs as ES modules afterwards, which the starter needs. */
  esm: boolean;
}

/**
 * Prepares an existing `package.json` for the starter without taking anything
 * away from it: missing scripts are added, existing ones are kept, and the
 * package is switched to ES modules only when that cannot break it, which is
 * when it has no entry file yet (the state `npm init -y` leaves it in).
 *
 * @param existing The parsed `package.json`.
 * @param mainExists Whether the file its `main` field points at exists.
 */
export function adoptPackage(existing: Record<string, unknown>, mainExists: boolean): AdoptedPackage {
  const pkg: Record<string, unknown> = { ...existing };
  const changes: string[] = [];

  if (pkg.type !== "module" && !mainExists) {
    pkg.type = "module";
    changes.push('"type": "module"');
  }

  const current = (typeof pkg.scripts === "object" && pkg.scripts !== null ? pkg.scripts : {}) as Record<string, string>;
  const added = Object.keys(STARTER_SCRIPTS).filter((name) => current[name] === undefined);
  if (added.length > 0) {
    pkg.scripts = { ...current, ...Object.fromEntries(added.map((name) => [name, STARTER_SCRIPTS[name]!])) };
    changes.push(`scripts ${added.join(", ")}`);
  }

  return { pkg, changes, esm: pkg.type === "module" };
}
