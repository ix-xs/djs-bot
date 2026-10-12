/**
 * A tiny structured logger: pretty & colourful in development, single-line JSON
 * in production. Every interaction/job gets a child logger carrying a
 * `correlationId`, so logs are traceable end to end without extra plumbing.
 *
 * @module logger
 */
import comfort from "@ix-xs/node-comfort";

/** Ordered log levels. `silent` disables everything. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

/**
 * What pretty output needs for one stream. Colours follow the stream: they are
 * off when it is a file or a pipe, and when `NO_COLOR` asks for it. A terminal
 * gets them, and so does a CI system known to display them.
 */
function palette(stream: NodeJS.WriteStream) {
  const paint = comfort.color.create(comfort.color.detect(stream));
  return {
    stream,
    gray: paint.gray,
    tags: {
      debug: paint.gray.bold("DEBUG"),
      info: paint.cyan.bold("INFO "),
      warn: paint.yellow.bold("WARN "),
      error: paint.red.bold("ERROR"),
    } satisfies Record<Exclude<LogLevel, "silent">, string>,
  };
}

let palettes: { out: ReturnType<typeof palette>; err: ReturnType<typeof palette> } | undefined;

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
      const record = { level, time: time.toISOString(), msg: message ?? "", ...fields };
      let line: string;
      try {
        line = JSON.stringify(record);
      } catch {
        // A bigint (a permission bitfield) or a circular value: write it anyway.
        line = comfort.utils.JSONString(record, 0);
      }
      process.stdout.write(line + "\n");
      return;
    }

    palettes ??= { out: palette(process.stdout), err: palette(process.stderr) };
    const p = level === "error" || level === "warn" ? palettes.err : palettes.out;
    const ts = p.gray(comfort.time.format(time, "HH:mm:ss"));
    const body = message ? `${message}` : "";
    const extra = Object.keys(fields).length ? ` ${p.gray(inline(fields))}` : "";
    p.stream.write(`${ts} ${p.tags[level]} ${body}${extra}\n`);
  }
}

/** Serialises an Error (incl. BotError's code/hint/docs, and its cause) into a loggable object. */
function serializeError(err: Error, depth = 0): Record<string, unknown> {
  const record: Record<string, unknown> = {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(err as unknown as Record<string, unknown>),
  };
  // `cause` is not enumerable, so the spread above does not see it.
  if (err.cause !== undefined) {
    record.cause = err.cause instanceof Error && depth < 3 ? serializeError(err.cause, depth + 1) : String(err.cause);
  }
  return record;
}

/** `key=value` pairs for the pretty output. A value that JSON cannot write is still written. */
function inline(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}=${typeof v === "object" ? comfort.utils.JSONString(v, 0) : String(v)}`)
    .join(" ");
}

/** Creates a root {@link Logger}. */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
