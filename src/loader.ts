/**
 * Convention-based, side-effect-free loader.
 *
 * Files are *discovered* by their suffix (`*.command.ts`, `*.button.ts`, …) but
 * *routed* by the `kind` of each exported definition. Importing a file only ever
 * collects objects - it never registers anything by itself - so load order can
 * never silently change behaviour.
 *
 * @module loader
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import comfort from "@ix-xs/node-comfort";
import { FILE_SUFFIXES, LOADABLE_EXTENSIONS } from "./constants.js";
import { BotError } from "./errors.js";
import type { Registrable } from "./registry.js";

const KNOWN_KINDS = new Set([
  "command",
  "userCommand",
  "messageCommand",
  "event",
  "trigger",
  "button",
  "select",
  "modal",
  "service",
  "job",
  "plugin",
  "feature",
]);

/** A single discovered definition together with the file it came from. */
export interface LoadedItem {
  readonly item: Registrable;
  readonly file: string;
}

/**
 * Resolves the "real" default export of a dynamically imported module,
 * unwrapping the ESM/CJS interop layers a TypeScript loader (tsx, ts-node, …)
 * can add. When such a loader compiles the entry to CommonJS, `await import()`
 * yields `{ default: { __esModule: true, default: <value> } }`, so a naive
 * `mod.default` is the wrapper, not the value. We follow the `default` chain
 * (bounded) through any `__esModule` wrappers, then fall back to a named
 * `bot`/`default` export.
 */
export function interopDefault(mod: Record<string, unknown>): unknown {
  let value: unknown = "default" in mod ? mod.default : (mod as Record<string, unknown>)["module.exports"];
  for (let i = 0; i < 5; i++) {
    if (
      value !== null &&
      typeof value === "object" &&
      (value as { __esModule?: unknown }).__esModule === true &&
      "default" in (value as object)
    ) {
      value = (value as { default: unknown }).default;
    } else {
      break;
    }
  }
  return value ?? mod.bot ?? mod.default;
}

function isRegistrable(value: unknown): value is Registrable {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof (value as { kind: unknown }).kind === "string" &&
    KNOWN_KINDS.has((value as { kind: string }).kind)
  );
}

function isLoadable(file: string): boolean {
  const base = path.basename(file);
  if (base.endsWith(".d.ts")) return false;
  const ext = path.extname(file);
  if (!LOADABLE_EXTENSIONS.includes(ext as (typeof LOADABLE_EXTENSIONS)[number])) return false;
  const stem = base.slice(0, base.length - ext.length);
  return FILE_SUFFIXES.some((suffix) => stem.endsWith(suffix));
}

/**
 * Loads every convention-matching file under `dir` and returns the definitions
 * they export (default and named), each tagged with its source file.
 *
 * @throws {BotError} `DJSBOT_E060` if a matched file fails to import.
 */
export async function loadFromDirectory(dir: string): Promise<LoadedItem[]> {
  const absolute = path.resolve(dir);
  const files = (comfort.fs.getFilesIn(absolute, true) ?? []).filter(isLoadable).sort();

  const loaded: LoadedItem[] = [];
  for (const file of files) {
    let mod: Record<string, unknown>;
    try {
      mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    } catch (cause) {
      throw new BotError("DJSBOT_E060", { detail: `failed to import ${file}`, cause });
    }

    const exportsFound = collectDefinitions(mod);
    if (exportsFound.length === 0) {
      // A matched file that exports nothing usable is almost always a mistake.
      throw new BotError("DJSBOT_E060", {
        detail: `${path.basename(file)} matched a convention suffix but exports no define*() result`,
      });
    }
    for (const item of exportsFound) loaded.push({ item, file });
  }
  return loaded;
}

export function collectDefinitions(mod: Record<string, unknown>): Registrable[] {
  const found: Registrable[] = [];
  // Dedupe by reference. The same definition can surface under several keys:
  // a CommonJS module exposes `module.exports` under both `default` and
  // `module.exports`, and when a loader like tsx compiles the feature file to
  // CommonJS, `await import()` double-wraps it as
  // `{ default: { __esModule: true, default: <def> } }` - so the real
  // definition sits two levels deep. We descend (bounded) through arrays and
  // interop wrappers, stopping as soon as we reach a registrable object.
  const seen = new Set<unknown>();
  const visit = (value: unknown, depth: number): void => {
    if (value === null || value === undefined || seen.has(value)) return;
    if (isRegistrable(value)) {
      seen.add(value);
      found.push(value);
      return;
    }
    if (depth <= 0 || typeof value !== "object") return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, depth - 1);
      return;
    }
    for (const nested of Object.values(value)) visit(nested, depth - 1);
  };
  for (const value of Object.values(mod)) visit(value, 5);
  return found;
}
