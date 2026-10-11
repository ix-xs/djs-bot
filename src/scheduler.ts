/**
 * Job scheduler.
 *
 * Supports three schedule syntaxes:
 *  - durations via `@ix-xs/node-comfort` (`"30s"`, `"5m"`, `"1h"`, `"1d"`),
 *  - 5-field cron expressions (`"0 3 * * *"`) with `*`, lists, ranges, steps and
 *    month/weekday names (`"0 9 * * MON-FRI"`),
 *  - macros (`"@hourly"`, `"@daily"`, `"@weekly"`, `"@monthly"`, `"@yearly"`).
 *
 * Jobs respect a concurrency limit (default 1, i.e. no overlap) and receive an
 * `AbortSignal` that fires on shutdown so long runs can bail out cleanly.
 *
 * @module scheduler
 */
import comfort from "@ix-xs/node-comfort";
import type { JobContext, JobDefinition } from "./definitions.js";
import type { Logger } from "./logger.js";
import { nextCorrelationId } from "./ids.js";

/** A schedule parsed into something the scheduler can evaluate. */
export type ParsedSchedule =
  | { type: "interval"; ms: number }
  | { type: "cron"; fields: CronField[] };

type CronField = { any: true } | { any: false; values: Set<number> };

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface FieldSpec {
  readonly name: string;
  readonly lo: number;
  readonly hi: number;
  /** Symbolic names accepted for this field, mapped to their numeric value. */
  readonly names?: Record<string, number>;
}

const named = (list: string[], offset: number): Record<string, number> =>
  Object.fromEntries(list.map((label, index) => [label, index + offset]));

const CRON_FIELDS: FieldSpec[] = [
  { name: "minute", lo: 0, hi: 59 },
  { name: "hour", lo: 0, hi: 23 },
  { name: "day of month", lo: 1, hi: 31 },
  { name: "month", lo: 1, hi: 12, names: named(MONTHS, 1) },
  // 7 is accepted as an alias of Sunday, like every common cron implementation.
  { name: "day of week", lo: 0, hi: 7, names: named(WEEKDAYS, 0) },
];

function parseNumber(token: string, spec: FieldSpec): number {
  const symbolic = spec.names?.[token.toUpperCase()];
  const value = symbolic ?? (/^\d+$/.test(token) ? Number(token) : Number.NaN);
  if (Number.isNaN(value) || value < spec.lo || value > spec.hi) {
    throw new Error(`"${token}" is not a valid ${spec.name} (expected ${spec.lo}-${spec.hi})`);
  }
  return value;
}

function parseCronField(token: string, spec: FieldSpec): CronField {
  if (token === "*") return { any: true };
  const values = new Set<number>();

  for (const part of token.split(",")) {
    const [rangePart = "", stepPart, ...rest] = part.split("/");
    if (rest.length > 0 || rangePart === "") throw new Error(`"${part}" is not a valid ${spec.name}`);

    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step <= 0) throw new Error(`"${part}" has an invalid step`);

    let start = spec.lo;
    let end = spec.hi;
    if (rangePart !== "*") {
      const [from = "", to, ...extra] = rangePart.split("-");
      if (extra.length > 0) throw new Error(`"${rangePart}" is not a valid range`);
      start = parseNumber(from, spec);
      // "5/15" means "from 5, every 15"; a bare "5" is just that value.
      end = to !== undefined ? parseNumber(to, spec) : stepPart === undefined ? start : spec.hi;
      if (end < start) throw new Error(`"${rangePart}" is a descending range`);
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }

  // Normalise Sunday-as-7 so matching only ever deals with 0-6.
  if (spec.name === "day of week" && values.delete(7)) values.add(0);
  return { any: false, values };
}

/**
 * Parses a duration, a cron expression or a macro into a schedule descriptor.
 * @throws {Error} with a precise reason when the schedule is invalid.
 */
export function parseSchedule(schedule: string): ParsedSchedule {
  const trimmed = schedule.trim();
  const expanded = MACROS[trimmed.toLowerCase()] ?? trimmed;
  const parts = expanded.split(/\s+/);

  if (parts.length === 5) {
    return { type: "cron", fields: parts.map((part, index) => parseCronField(part, CRON_FIELDS[index]!)) };
  }
  if (trimmed.startsWith("@")) {
    throw new Error(`Unknown schedule macro "${trimmed}" - known: ${Object.keys(MACROS).join(", ")}.`);
  }
  const ms = parts.length === 1 ? comfort.time.parseDuration(trimmed) : undefined;
  if (ms && ms > 0) return { type: "interval", ms };
  throw new Error(`Invalid schedule "${schedule}" - use a duration like "30s", a cron like "0 3 * * *" or a macro like "@daily".`);
}

interface DateParts {
  minute: number;
  hour: number;
  dom: number;
  month: number;
  dow: number;
}

/** One formatter per timezone: building an `Intl.DateTimeFormat` is expensive. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function partsInZone(date: Date, timeZone?: string): DateParts {
  if (!timeZone) {
    return {
      minute: date.getMinutes(),
      hour: date.getHours(),
      dom: date.getDate(),
      month: date.getMonth() + 1,
      dow: date.getDay(),
    };
  }
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      minute: "2-digit",
      hour: "2-digit",
      hour12: false,
      day: "2-digit",
      month: "2-digit",
    });
    formatters.set(timeZone, fmt);
  }
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) map[part.type] = part.value;
  return {
    minute: Number(map.minute),
    hour: Number(map.hour) % 24,
    dom: Number(map.day),
    month: Number(map.month),
    dow: WEEKDAYS.indexOf((map.weekday ?? "Sun").toUpperCase()),
  };
}

/** Whether a parsed cron expression matches the minute `date` falls in. */
export function cronMatches(fields: CronField[], date: Date, timeZone?: string): boolean {
  const { minute, hour, dom, month, dow } = partsInZone(date, timeZone);
  const [fMinute, fHour, fDom, fMonth, fDow] = fields as [CronField, CronField, CronField, CronField, CronField];
  const hit = (field: CronField, value: number): boolean => field.any || field.values.has(value);

  if (!hit(fMinute, minute) || !hit(fHour, hour) || !hit(fMonth, month)) return false;
  // Standard cron: when both the day of month and the day of week are
  // restricted, the job runs when EITHER matches ("the 1st, and every Monday").
  if (!fDom.any && !fDow.any) return hit(fDom, dom) || hit(fDow, dow);
  return hit(fDom, dom) && hit(fDow, dow);
}

/** Hooks the scheduler calls back into. */
export interface SchedulerOptions {
  /** Called when a job throws, after it has been logged. */
  onError?: (error: unknown, job: JobDefinition) => void;
}

/** Runs and supervises the registered jobs. */
export class Scheduler {
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Map<string, number>();
  private readonly active = new Set<Promise<void>>();
  private readonly abort = new AbortController();
  private cronTimer?: NodeJS.Timeout;
  private lastCronMinute = -1;
  private stopped = false;

  public constructor(
    private readonly jobs: readonly JobDefinition[],
    private readonly makeContext: (job: JobDefinition, signal: AbortSignal, correlationId: string) => JobContext,
    private readonly logger: Logger,
    private readonly options: SchedulerOptions = {},
  ) {}

  /** Starts all job timers. */
  public start(): void {
    const cronJobs: Array<{ job: JobDefinition; fields: CronField[] }> = [];

    for (const job of this.jobs) {
      const parsed = parseSchedule(job.schedule);
      if (job.runOnStart) this.launch(job);
      if (parsed.type === "interval") {
        const timer = setInterval(() => this.launch(job), parsed.ms);
        timer.unref?.();
        this.timers.push(timer);
      } else {
        cronJobs.push({ job, fields: parsed.fields });
      }
    }

    if (cronJobs.length === 0) return;

    // Wake up right after each minute boundary instead of polling, so a cron
    // job fires at hh:mm:00 rather than up to a polling interval late.
    const arm = (): void => {
      if (this.stopped) return;
      const delay = 60_000 - (Date.now() % 60_000) + 25;
      this.cronTimer = setTimeout(() => {
        const now = new Date();
        const minute = Math.floor(now.getTime() / 60_000);
        if (minute !== this.lastCronMinute) {
          this.lastCronMinute = minute;
          for (const { job, fields } of cronJobs) {
            // One job that cannot be evaluated must not stop the clock for the others.
            try {
              if (cronMatches(fields, now, job.timezone)) this.launch(job);
            } catch (error) {
              this.logger.error({ err: error, job: job.name }, "Job schedule could not be evaluated");
            }
          }
        }
        arm();
      }, delay);
      this.cronTimer.unref?.();
    };
    arm();
  }

  private launch(job: JobDefinition): void {
    const run = this.execute(job).finally(() => this.active.delete(run));
    this.active.add(run);
  }

  private async execute(job: JobDefinition): Promise<void> {
    if (this.stopped) return;
    const active = this.running.get(job.name) ?? 0;
    if (active >= job.concurrency) {
      this.logger.debug({ job: job.name }, "Job skipped (concurrency limit)");
      return;
    }
    this.running.set(job.name, active + 1);
    const started = Date.now();
    const correlationId = nextCorrelationId();
    try {
      await job.run(this.makeContext(job, this.abort.signal, correlationId));
      this.logger.debug({ job: job.name, correlationId, ms: Date.now() - started }, "Job finished");
    } catch (error) {
      this.logger.error({ err: error, job: job.name, correlationId }, "Job failed");
      try {
        this.options.onError?.(error, job);
      } catch {
        /* an error hook must never break the scheduler */
      }
    } finally {
      this.running.set(job.name, (this.running.get(job.name) ?? 1) - 1);
    }
  }

  /**
   * Stops all timers, signals running jobs to abort, and waits for them to
   * finish - but never longer than `graceMs`.
   */
  public async stop(graceMs = 10_000): Promise<void> {
    this.stopped = true;
    for (const timer of this.timers) clearInterval(timer);
    if (this.cronTimer) clearTimeout(this.cronTimer);
    this.abort.abort();

    if (this.active.size === 0) return;
    let timer: NodeJS.Timeout | undefined;
    const grace = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, graceMs);
      timer.unref?.();
    });
    await Promise.race([Promise.allSettled([...this.active]), grace]);
    if (timer) clearTimeout(timer);
  }
}
