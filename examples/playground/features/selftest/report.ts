import type { BaseContext } from "../../../../src/index.js";

/** One line of a self-test checklist. */
export type Check = readonly [label: string, ok: boolean, detail?: string];

/**
 * Renders a checklist, logs it as one structured `selftest` line (so a run can
 * be followed from the terminal) and returns the text to show the user.
 */
export function report(ctx: BaseContext, step: string, checks: readonly Check[]): string {
  const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);
  ctx.logger[failed.length ? "error" : "info"](
    { selftest: step, passed: checks.length - failed.length, failed },
    failed.length ? "selftest step FAILED" : "selftest step passed",
  );
  const lines = checks.map(([label, ok, detail]) => `${ok ? "✅" : "❌"} ${label}${detail ? ` - ${detail}` : ""}`);
  return [`**${step}**`, ...lines].join("\n");
}
