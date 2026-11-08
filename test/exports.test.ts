import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface Model {
  symbols: { name: string; kind: string; text?: string; guide?: string; slug: string }[];
}

interface ApiModel {
  MODEL: string;
  TRANSLATIONS: Record<string, string>;
  build(): Model;
  serialise(model: Model): string;
  translationProblems(model: Model, language: string): { pending: Record<string, unknown>; unused: string[] };
}

describe("the API reference of the docs", () => {
  // Loaded by URL: the generator is a plain script of the docs site.
  const load = async () => (await import(/* @vite-ignore */ pathToFileURL(path.resolve("docs/scripts/api-model.mjs")).href)) as ApiModel;

  it("has every export, each documented and explained in the guide, and is up to date", async () => {
    const { MODEL, build, serialise } = await load();
    const model = build();
    const committed = readFileSync(MODEL, "utf8").replace(/\r\n/g, "\n");

    expect(model.symbols.length).toBeGreaterThan(250);
    expect(new Set(model.symbols.map((s) => s.slug)).size, "two exports share a page address").toBe(model.symbols.length);
    for (const symbol of model.symbols) {
      expect(symbol.text, `${symbol.name} has no doc comment`).toBeTruthy();
      expect(symbol.guide, `${symbol.name} has no page of the guide`).toBeTruthy();
    }
    expect(committed, "run `npm run docs:api` and commit the result").toBe(serialise(model));
  }, 120_000);

  it("is fully translated, with nothing left over", async () => {
    const { TRANSLATIONS, build, translationProblems } = await load();
    const model = build();
    for (const language of Object.keys(TRANSLATIONS)) {
      const { pending, unused } = translationProblems(model, language);
      expect(Object.keys(pending), `${language}: run \`npm run docs:api -- --pending\``).toEqual([]);
      expect(unused, `${language}: entries no export uses any more`).toEqual([]);
    }
  }, 120_000);
});
