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

function collectDefinitions(mod: Record<string, unknown>): Registrable[] {
  const found: Registrable[] = [];
  // Dedupe by reference: importing a CommonJS module exposes `module.exports`
  // under both `default` and `module.exports`, so the same object appears twice.
  const seen = new Set<unknown>();
  const add = (value: unknown) => {
    if (isRegistrable(value) && !seen.has(value)) {
      seen.add(value);
      found.push(value);
    }
  };
  for (const value of Object.values(mod)) {
    if (Array.isArray(value)) value.forEach(add);
    else add(value);
  }
  return found;
}
