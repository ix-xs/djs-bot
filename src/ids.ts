/**
 * Correlation ids.
 *
 * Every interaction, trigger and job run gets one, and each log line written on
 * its behalf carries it. They only need to be unique and short, not
 * unpredictable, so they are a per-process random tag plus a counter - which
 * costs a fraction of a random id on a path that runs for every interaction.
 *
 * @module ids
 */
import comfort from "@ix-xs/node-comfort";

/** Random per process, so two shards or two restarts never produce the same id. */
const PROCESS_TAG = comfort.id.nano(4);
let sequence = 0;

/** Returns the next correlation id, e.g. `"k3Fz-1a"`. */
export function nextCorrelationId(): string {
  return `${PROCESS_TAG}-${(++sequence).toString(36)}`;
}
