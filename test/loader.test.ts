import { describe, it, expect } from "vitest";
import { collectDefinitions, interopDefault } from "../src/loader.js";
import { defineCommand, defineEvent } from "../src/index.js";

const ping = defineCommand({
  name: "ping",
  description: "alive",
  run: () => undefined,
});

describe("collectDefinitions", () => {
  it("finds a clean ESM default export", () => {
    expect(collectDefinitions({ default: ping })).toEqual([ping]);
  });

  it("finds a named export", () => {
    expect(collectDefinitions({ ping })).toEqual([ping]);
  });

  it("dedupes the CJS default/module.exports aliasing", () => {
    // `module.exports = defineCommand(...)` surfaces under both keys.
    const found = collectDefinitions({ default: ping, "module.exports": ping });
    expect(found).toEqual([ping]);
  });

  it("unwraps the tsx CJS double-wrap (default.default)", () => {
    // What `await import()` yields when a TS loader compiles the feature file
    // to CommonJS: the definition sits two levels deep behind __esModule.
    const wrapper = { __esModule: true, default: ping };
    const mod = { default: wrapper, "module.exports": wrapper };
    expect(collectDefinitions(mod)).toEqual([ping]);
  });

  it("flattens arrays of definitions", () => {
    const evt = defineEvent("ready", () => undefined);
    const found = collectDefinitions({ default: [ping, evt] });
    expect(found).toHaveLength(2);
    expect(found).toContain(ping);
    expect(found).toContain(evt);
  });

  it("flattens arrays nested inside the CJS wrapper", () => {
    const evt = defineEvent("ready", () => undefined);
    const wrapper = { __esModule: true, default: [ping, evt] };
    const found = collectDefinitions({ default: wrapper, "module.exports": wrapper });
    expect(found).toHaveLength(2);
  });

  it("returns nothing for a file with no definitions", () => {
    expect(collectDefinitions({ default: { hello: "world" } })).toEqual([]);
  });
});

describe("interopDefault", () => {
  it("returns a clean default export", () => {
    const bot = { [Symbol.for("djsbot.bot")]: true };
    expect(interopDefault({ default: bot })).toBe(bot);
  });

  it("unwraps the tsx CJS __esModule wrapper", () => {
    const bot = { [Symbol.for("djsbot.bot")]: true };
    expect(interopDefault({ default: { __esModule: true, default: bot } })).toBe(bot);
  });

  it("falls back to a named `bot` export", () => {
    const bot = { [Symbol.for("djsbot.bot")]: true };
    expect(interopDefault({ bot })).toBe(bot);
  });
});
