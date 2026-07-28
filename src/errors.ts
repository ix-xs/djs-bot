/**
 * Typed, coded errors with actionable hints and a docs link.
 *
 * Every framework-thrown error carries a stable `DJSBOT_Exxx` code so it can be
 * grepped, documented, and matched on in production. This is the opposite of an
 * anonymous `throw new Error("something went wrong")`.
 *
 * @module errors
 */
import { DOCS_BASE_URL } from "./constants.js";

/** Catalogue of framework error codes and their default messages/hints. */
export const ERROR_CATALOGUE = {
  DJSBOT_E001: {
    title: "Missing bot token",
    hint: "Provide `token` in defineBot()/forge.config or set the DISCORD_TOKEN env var.",
  },
  DJSBOT_E002: {
    title: "Missing application client id",
    hint: "Set `clientId` in config or the DISCORD_CLIENT_ID env var — required to deploy commands.",
  },
  DJSBOT_E010: {
    title: "Duplicate command name",
    hint: "Two commands registered under the same name. Command names must be unique.",
  },
  DJSBOT_E011: {
    title: "Duplicate component id",
    hint: "Two components share the same id. Button/select/modal ids must be unique per type.",
  },
  DJSBOT_E012: {
    title: "Unknown component interaction",
    hint: "Received an interaction whose customId key is not registered. Did you forget to load the feature?",
  },
  DJSBOT_E020: {
    title: "customId too long",
    hint: `Encoded customId exceeds Discord's ${100}-char limit. Store the payload out-of-band and keep only a short key.`,
  },
  DJSBOT_E021: {
    title: "Invalid customId payload",
    hint: "The component payload could not be decoded. It may have been produced by an incompatible version.",
  },
  DJSBOT_E030: {
    title: "Service resolution failed",
    hint: "A service dependency is missing or forms a cycle. Check the `deps` arrays.",
  },
  DJSBOT_E031: {
    title: "Unknown service",
    hint: "Requested a service that was never registered.",
  },
  DJSBOT_E040: {
    title: "Feature contract not satisfied",
    hint: "A feature/plugin `requires` a capability that nothing `provides`.",
  },
  DJSBOT_E041: {
    title: "Capability conflict",
    hint: "Two plugins provide the same capability without an explicit override.",
  },
  DJSBOT_E050: {
    title: "Invalid option value",
    hint: "A command option failed runtime validation at the Discord boundary.",
  },
  DJSBOT_E060: {
    title: "Loader error",
    hint: "A discovered file could not be imported or exported no valid definitions.",
  },
  DJSBOT_E070: {
    title: "Privileged intent required",
    hint: "An event needs a privileged intent. Enable it in the Developer Portal, or set intents:'auto'.",
  },
} as const;

/** Union of all known error codes. */
export type ErrorCode = keyof typeof ERROR_CATALOGUE;

/** Options accepted when constructing a {@link BotError}. */
export interface BotErrorOptions {
  /** Extra human context appended to the catalogue title. */
  readonly detail?: string;
  /** Overrides the catalogue hint for this specific occurrence. */
  readonly hint?: string;
  /** The underlying error, preserved as `cause`. */
  readonly cause?: unknown;
  /** Arbitrary structured metadata for logging. */
  readonly meta?: Record<string, unknown>;
}

/**
 * A framework error with a stable code, an actionable hint, and a docs link.
 *
 * @example
 * throw new BotError("DJSBOT_E001", { detail: "no token found in env" });
 */
export class BotError extends Error {
  /** The stable error code (e.g. `DJSBOT_E001`). */
  public readonly code: ErrorCode;
  /** A short, actionable suggestion for fixing the problem. */
  public readonly hint: string;
  /** Deep-link to the docs page for this code. */
  public readonly docs: string;
  /** Optional structured metadata attached for logging. */
  public readonly meta?: Record<string, unknown>;

  public constructor(code: ErrorCode, options: BotErrorOptions = {}) {
    const entry = ERROR_CATALOGUE[code];
    const message = options.detail ? `${entry.title}: ${options.detail}` : entry.title;
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "BotError";
    this.code = code;
    this.hint = options.hint ?? entry.hint;
    this.docs = `${DOCS_BASE_URL}#${code.toLowerCase()}`;
    if (options.meta) this.meta = options.meta;
    Error.captureStackTrace?.(this, BotError);
  }

  /** Renders a multi-line, developer-friendly representation. */
  public override toString(): string {
    return `${this.name} [${this.code}]: ${this.message}\n  ↳ ${this.hint}\n  ↳ ${this.docs}`;
  }
}

/** Type guard for {@link BotError}. */
export function isBotError(value: unknown): value is BotError {
  return value instanceof BotError;
}
