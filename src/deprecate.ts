/**
 * Deprecation warnings for the names that are kept until 2.0.
 *
 * Each old name warns once per process, through Node's own channel, so
 * `--no-deprecation`, `--trace-deprecation` and `--throw-deprecation` work
 * on it as on any other `DeprecationWarning`.
 *
 * @module deprecate
 * @internal
 */

/**
 * The codes already reported. Kept on `globalThis` so that two copies of the
 * framework in one process (its ESM and CJS builds, or two entry points)
 * still warn once.
 */
const REPORTED_KEY = Symbol.for("@ix-xs/djs-bot.deprecations");

function reported(): Set<string> {
  const store = globalThis as { [REPORTED_KEY]?: Set<string> };
  return (store[REPORTED_KEY] ??= new Set());
}

/**
 * Emits a `DeprecationWarning` with `code`, the first time only.
 *
 * @example deprecated("DJS_BOT_DEP_ONEOF", "oneOf()", "p.oneOf()");
 * // (node:1234) [DJS_BOT_DEP_ONEOF] DeprecationWarning: oneOf() is deprecated: use p.oneOf(). It will be removed in 2.0.
 */
export function deprecated(code: string, name: string, use?: string): void {
  const seen = reported();
  if (seen.has(code)) return;
  seen.add(code);
  const hint = use ? `use ${use}` : "it is internal and has no replacement";
  process.emitWarning(`${name} is deprecated: ${hint}. It will be removed in 2.0.`, { type: "DeprecationWarning", code });
}

/** Forgets which warnings were emitted, so a test can see each one again. */
export function resetDeprecations(): void {
  reported().clear();
}
