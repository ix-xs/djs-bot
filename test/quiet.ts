import { afterEach, beforeEach, vi, type MockInstance } from "vitest";

/**
 * Keeps the deprecation warnings of djs-bot's old names out of the output, in
 * the describe block that calls it: the tests there still cover those names.
 * Every other warning goes through. `deprecations.test.ts` checks the warnings
 * themselves.
 */
export function quietDeprecations(): void {
  let spy: MockInstance<typeof process.emitWarning> | undefined;
  beforeEach(() => {
    const original = process.emitWarning.bind(process) as (...args: unknown[]) => void;
    spy = vi.spyOn(process, "emitWarning").mockImplementation(((...args: unknown[]) => {
      const options = args[1];
      const code = typeof options === "object" && options !== null ? (options as { code?: unknown }).code : undefined;
      if (typeof code === "string" && code.startsWith("DJS_BOT_DEP_")) return;
      original(...args);
    }) as typeof process.emitWarning);
  });
  afterEach(() => spy?.mockRestore());
}
