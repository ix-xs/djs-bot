/**
 * Definition-time validation of the names and ids Discord is strict about.
 *
 * Catching these when you write the definition (with a coded, actionable error)
 * is far better than a cryptic HTTP 400 at deploy time, or a component that
 * silently never routes. Kept intentionally small - it mirrors Discord's own
 * constraints, nothing more.
 *
 * @module validate
 */
import { BotError } from "./errors.js";
import { CUSTOM_ID_MAX_LENGTH } from "./constants.js";

/** Discord's chat-input name rule: letters, numbers, dash, underscore; 1-32. */
const CHAT_NAME = /^[-_\p{L}\p{N}]{1,32}$/u;

/**
 * Validates a slash-command, subcommand, group, or option name. Discord requires
 * lowercase, 1-32 chars, and only letters/numbers/`-`/`_` (no spaces).
 * @throws {BotError} `DJSBOT_E012`
 */
export function assertChatName(role: string, name: string): void {
  if (!CHAT_NAME.test(name) || name !== name.toLocaleLowerCase()) {
    throw new BotError("DJSBOT_E012", { detail: `${role} "${name}"` });
  }
}

/**
 * Validates a context-menu command name. Discord allows mixed case and spaces
 * here, but still caps the length at 32 (min 1).
 * @throws {BotError} `DJSBOT_E012`
 */
export function assertMenuName(name: string): void {
  if (name.length < 1 || name.length > 32) {
    throw new BotError("DJSBOT_E012", {
      detail: `context menu name "${name}"`,
      hint: "Context menu command names must be 1-32 characters.",
    });
  }
}

/**
 * Validates a component routing id (button/select/modal). It must be non-empty,
 * short enough to leave room for encoded params, and must not contain the `$`
 * customId separator.
 * @throws {BotError} `DJSBOT_E013`
 */
export function assertComponentId(role: string, id: string): void {
  if (id.length === 0) {
    throw new BotError("DJSBOT_E013", { detail: `${role} id is empty` });
  }
  if (id.includes("$")) {
    throw new BotError("DJSBOT_E013", { detail: `${role} id "${id}" contains "$"` });
  }
  if (id.length > CUSTOM_ID_MAX_LENGTH) {
    throw new BotError("DJSBOT_E013", { detail: `${role} id "${id}" is longer than ${CUSTOM_ID_MAX_LENGTH} chars` });
  }
}
