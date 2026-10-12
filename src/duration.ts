/**
 * Reading a duration the way every option of the framework accepts one.
 *
 * @module duration
 */
import comfort from "@ix-xs/node-comfort";

/**
 * Milliseconds from a number, or from text such as `"30s"` or `"5m"`. Returns
 * `fallback` when there is nothing to read: no value, or text that is not a
 * duration.
 */
export function durationMs(value: number | string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  return typeof value === "number" ? value : (comfort.time.parseDuration(value) ?? fallback);
}
