/**
 * A tiny structured logger: pretty & colourful in development, single-line JSON
 * in production. Every interaction/job gets a child logger carrying a
 * `correlationId`, so logs are traceable end to end without extra plumbing.
 *
 * @module logger
 */

/** Ordered log levels. `silent` disables everything. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

const COLORS = {
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
} as const;

const LEVEL_COLOR: Record<Exclude<LogLevel, "silent">, keyof typeof COLORS> = {
  debug: "gray",
  info: "cyan",
  warn: "yellow",
  error: "red",
};

/** Options for creating a {@link Logger}. */
export interface LoggerOptions {
  /** Minimum level to emit. Default `"info"`. */
  level?: LogLevel;
  /** Force pretty (`true`) or JSON (`false`) output. Defaults to pretty unless `NODE_ENV=production`. */
  pretty?: boolean;
  /** Static fields merged into every record (e.g. `{ service: "tickets" }`). */
  bindings?: Record<string, unknown>;
}

/** Structured logger with level filtering and child bindings. */
export class Logger {
  private readonly level: LogLevel;
  private readonly pretty: boolean;
  private readonly bindings: Record<string, unknown>;

  public constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.pretty = options.pretty ?? process.env.NODE_ENV !== "production";
    this.bindings = options.bindings ?? {};
  }

  /**
   * Returns a new logger that always includes the given fields.
   * @example const log = logger.child({ correlationId, command: "ban" });
   */
  public child(bindings: Record<string, unknown>): Logger {
    return new Logger({
      level: this.level,
      pretty: this.pretty,
      bindings: { ...this.bindings, ...bindings },
    });
  }

  /** Logs at `debug` level. */
  public debug(obj: unknown, msg?: string): void {
    this.write("debug", obj, msg);
  }
  /** Logs at `info` level. */
  public info(obj: unknown, msg?: string): void {
    this.write("info", obj, msg);
  }
  /** Logs at `warn` level. */
  public warn(obj: unknown, msg?: string): void {
    this.write("warn", obj, msg);
  }
  /** Logs at `error` level. */
  public error(obj: unknown, msg?: string): void {
    this.write("error", obj, msg);
  }

  private write(level: Exclude<LogLevel, "silent">, obj: unknown, msg?: string): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) return;

    let message = msg;
    let fields: Record<string, unknown> = { ...this.bindings };

    if (typeof obj === "string") {
      message = obj;
    } else if (obj instanceof Error) {
      fields.err = serializeError(obj);
    } else if (obj && typeof obj === "object") {
      fields = { ...fields, ...(obj as Record<string, unknown>) };
    }

    // Errors don't JSON-serialise (message/stack are lost as `{}`). Normalise any
    // Error value in the fields - e.g. the ubiquitous `logger.error({ err }, ...)`.
    for (const [key, value] of Object.entries(fields)) {
      if (value instanceof Error) fields[key] = serializeError(value);
    }

    const time = new Date();
    if (!this.pretty) {
      process.stdout.write(
        JSON.stringify({ level, time: time.toISOString(), msg: message ?? "", ...fields }) + "\n",
      );
      return;
    }

    const c = COLORS;
    const tint = c[LEVEL_COLOR[level]];
    const ts = `${c.gray}${time.toLocaleTimeString()}${c.reset}`;
    const tag = `${tint}${c.bold}${level.toUpperCase().padEnd(5)}${c.reset}`;
    const body = message ? `${message}` : "";
    const extra = Object.keys(fields).length ? ` ${c.gray}${safeInline(fields)}${c.reset}` : "";
    const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
    stream.write(`${ts} ${tag} ${body}${extra}\n`);
  }
}

/** Serialises an Error (incl. BotError's code/hint/docs) into a loggable object. */
function serializeError(err: Error): Record<string, unknown> {
  return { name: err.name, message: err.message, stack: err.stack, ...(err as unknown as Record<string, unknown>) };
}

function safeInline(fields: Record<string, unknown>): string {
  try {
    return Object.entries(fields)
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(" ");
  } catch {
    return "[unserialisable]";
  }
}

/** Creates a root {@link Logger}. */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
