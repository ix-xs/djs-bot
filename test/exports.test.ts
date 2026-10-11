import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface ApiIndex {
  /** The page of each language, by language code. */
  OUTPUTS: Record<string, string>;
  generate(language?: string): { markdown: string; names: string[] };
}

describe("the exports page of the docs", () => {
  it("lists every export, each with a description, and is up to date in every language", async () => {
    // Loaded by URL: the generator is a plain script of the docs site.
    const script = pathToFileURL(path.resolve("docs/scripts/api-index.mjs")).href;
    const { OUTPUTS, generate } = (await import(/* @vite-ignore */ script)) as ApiIndex;

    expect(Object.keys(OUTPUTS)).toContain("en");
    for (const [language, file] of Object.entries(OUTPUTS)) {
      // Throws when an export has no doc comment or no page to point at.
      const { markdown, names } = generate(language);
      const committed = readFileSync(file, "utf8").replace(/\r\n/g, "\n");

      expect(names.length).toBeGreaterThan(250);
      expect(new Set(names).size).toBeGreaterThan(250);
      expect(committed, `${language}: run \`npm run docs:api\` and commit the result`).toBe(markdown);
    }
  }, 120_000);
});
