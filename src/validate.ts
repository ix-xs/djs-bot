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
import comfort from "@ix-xs/node-comfort";
import { BotError } from "./errors.js";
import { CUSTOM_ID_MAX_LENGTH } from "./constants.js";

/**
 * Discord's chat-input name rule, verbatim from the API reference: letters,
 * numbers, dash, underscore (plus the modifier apostrophe and the Devanagari and
 * Thai scripts, whose marks are not letters); 1-32 characters.
 */
const CHAT_NAME = /^[-_\u02BC\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u;

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

/* -------------------------------------------------------------------------- */
/*  Command shape                                                             */
/* -------------------------------------------------------------------------- */

/** Discord's limits on application commands. */
export const COMMAND_LIMITS = {
  description: 100,
  options: 25,
  choices: 25,
  choiceName: 100,
  choiceValue: 100,
  stringLength: 6000,
  fileTypes: 10,
  /** Combined length of every name, description and choice of one command. */
  totalCharacters: 8000,
  /** Commands of each type per scope (global, or one guild). */
  perScope: { chat: 100, user: 15, message: 15 },
} as const;

const FILE_TYPE = /^(image|video|audio|\.[A-Za-z0-9]+)$/;

interface OptionLike {
  readonly kind: string;
  readonly description: string;
  readonly config: Readonly<Record<string, unknown>>;
}
interface SubcommandLike {
  readonly description: string;
  readonly options: Record<string, OptionLike>;
  readonly descriptionLocalizations?: Record<string, string | null> | undefined;
}
interface CommandLike extends Partial<SubcommandLike> {
  readonly name: string;
  readonly description: string;
  readonly subcommands?: Record<string, SubcommandLike> | undefined;
  readonly groups?: Record<string, { description: string; subcommands: Record<string, SubcommandLike> }> | undefined;
}

/** The longest of a text and its localizations: what Discord counts. */
function longest(text: string, localizations?: Record<string, string | null> | undefined): number {
  let max = text.length;
  for (const value of Object.values(localizations ?? {})) {
    if (typeof value === "string" && value.length > max) max = value.length;
  }
  return max;
}

/**
 * Validates a slash command against the limits Discord enforces at deploy time:
 * description lengths, option and choice counts, value ranges, file type
 * filters and the overall size. Failing here names the exact field, where the
 * API would only answer `400 Invalid Form Body`.
 * @throws {BotError} `DJSBOT_E015`
 */
export function assertCommandShape(command: CommandLike): void {
  const where = `command "${command.name}"`;
  const reject = (detail: string): never => {
    throw new BotError("DJSBOT_E015", { detail: `${where}: ${detail}` });
  };
  let total = command.name.length;

  const checkDescription = (what: string, text: string, localizations?: Record<string, string | null>): void => {
    const length = longest(text, localizations);
    if (text.length < 1 || length > COMMAND_LIMITS.description) {
      reject(`${what} description must be 1-${COMMAND_LIMITS.description} characters (got ${length})`);
    }
    total += length;
  };

  const checkOptions = (owner: string, options: Record<string, OptionLike> | undefined): void => {
    const entries = Object.entries(options ?? {});
    if (entries.length > COMMAND_LIMITS.options) {
      reject(`${owner} has ${entries.length} options (max ${COMMAND_LIMITS.options})`);
    }
    for (const [name, option] of entries) {
      const cfg = option.config as {
        choices?: ReadonlyArray<{ name: string; value: string | number }>;
        autocomplete?: unknown;
        minLength?: number;
        maxLength?: number;
        min?: number;
        max?: number;
        fileTypes?: readonly string[];
        descriptionLocalizations?: Record<string, string | null>;
      };
      const label = `option "${name}"`;
      total += name.length;
      checkDescription(label, option.description, cfg.descriptionLocalizations);

      const choices = cfg.choices ?? [];
      if (choices.length > COMMAND_LIMITS.choices) {
        reject(`${label} has ${choices.length} choices (max ${COMMAND_LIMITS.choices}); use autocomplete for more`);
      }
      if (choices.length > 0 && cfg.autocomplete) {
        reject(`${label} sets both choices and autocomplete; Discord accepts only one`);
      }
      for (const choice of choices) {
        // Reached from plain JavaScript only: the types refuse anything else.
        if (typeof choice !== "object" || choice === null || typeof choice.name !== "string" || choice.value === undefined) {
          reject(`${label}: each choice must be { name, value }, got ${comfort.utils.JSONString(choice, 0)}`);
        }
        if (choice.name.length < 1 || choice.name.length > COMMAND_LIMITS.choiceName) {
          reject(`${label}: choice name "${choice.name.slice(0, 20)}" must be 1-${COMMAND_LIMITS.choiceName} characters`);
        }
        if (typeof choice.value === "string" && choice.value.length > COMMAND_LIMITS.choiceValue) {
          reject(`${label}: the value of choice "${choice.name}" is over ${COMMAND_LIMITS.choiceValue} characters`);
        }
        total += choice.name.length + (typeof choice.value === "string" ? choice.value.length : 0);
      }

      const { minLength, maxLength, min, max } = cfg;
      if (minLength !== undefined && (minLength < 0 || minLength > COMMAND_LIMITS.stringLength)) {
        reject(`${label}: minLength must be 0-${COMMAND_LIMITS.stringLength}`);
      }
      if (maxLength !== undefined && (maxLength < 1 || maxLength > COMMAND_LIMITS.stringLength)) {
        reject(`${label}: maxLength must be 1-${COMMAND_LIMITS.stringLength}`);
      }
      if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
        reject(`${label}: minLength (${minLength}) is greater than maxLength (${maxLength})`);
      }
      if (min !== undefined && max !== undefined && min > max) {
        reject(`${label}: min (${min}) is greater than max (${max})`);
      }

      const fileTypes = cfg.fileTypes ?? [];
      if (fileTypes.length > COMMAND_LIMITS.fileTypes) {
        reject(`${label} lists ${fileTypes.length} file types (max ${COMMAND_LIMITS.fileTypes})`);
      }
      for (const type of fileTypes) assertFileType(type, reject, label);
    }
  };

  checkDescription("its", command.description, command.descriptionLocalizations);

  const subcommands = Object.entries(command.subcommands ?? {});
  const groups = Object.entries(command.groups ?? {});
  if (subcommands.length + groups.length > COMMAND_LIMITS.options) {
    reject(`${subcommands.length + groups.length} subcommands and groups (max ${COMMAND_LIMITS.options})`);
  }
  if (subcommands.length + groups.length === 0) checkOptions("it", command.options);

  const checkSubcommand = (path: string, sub: SubcommandLike): void => {
    total += path.split(" ").pop()!.length;
    checkDescription(`subcommand "${path}"`, sub.description, sub.descriptionLocalizations);
    checkOptions(`subcommand "${path}"`, sub.options);
  };
  for (const [name, sub] of subcommands) checkSubcommand(name, sub);
  for (const [groupName, group] of groups) {
    total += groupName.length;
    checkDescription(`group "${groupName}"`, group.description);
    const nested = Object.entries(group.subcommands ?? {});
    if (nested.length > COMMAND_LIMITS.options) {
      reject(`group "${groupName}" has ${nested.length} subcommands (max ${COMMAND_LIMITS.options})`);
    }
    for (const [name, sub] of nested) checkSubcommand(`${groupName} ${name}`, sub);
  }

  if (total > COMMAND_LIMITS.totalCharacters) {
    reject(`its names, descriptions and choices add up to ${total} characters (max ${COMMAND_LIMITS.totalCharacters})`);
  }
}

/** Validates one entry of a `fileTypes` filter. */
export function assertFileType(type: string, reject: (detail: string) => never, owner: string): void {
  if (!FILE_TYPE.test(type)) {
    reject(`${owner}: "${type}" is not a valid file type; use "image", "video", "audio" or an extension like ".pdf"`);
  }
}

/**
 * Checks that no scope holds more commands of a type than Discord allows.
 * @param scope A label for the error message: `"global"` or a guild id.
 * @param commands The REST bodies planned for that scope (`type` 1, 2 or 3).
 * @throws {BotError} `DJSBOT_E015`
 */
export function assertScopeLimits(scope: string, commands: ReadonlyArray<{ type?: number }>): void {
  const count = { chat: 0, user: 0, message: 0 };
  for (const command of commands) {
    if (command.type === 2) count.user++;
    else if (command.type === 3) count.message++;
    else if (command.type === undefined || command.type === 1) count.chat++;
  }
  for (const kind of ["chat", "user", "message"] as const) {
    if (count[kind] > COMMAND_LIMITS.perScope[kind]) {
      throw new BotError("DJSBOT_E015", {
        detail: `${count[kind]} ${kind === "chat" ? "slash" : kind + " context-menu"} commands in the ${scope} scope (max ${COMMAND_LIMITS.perScope[kind]})`,
        hint: "Group related slash commands as subcommands of one command, or scope some to specific guilds with `guilds`.",
      });
    }
  }
}
