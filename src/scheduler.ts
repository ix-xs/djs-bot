/**
 * Job scheduler.
 *
 * Supports two schedule syntaxes:
 *  - durations via `@ix-xs/node-comfort` (`"30s"`, `"5m"`, `"1h"`, `"1d"`), and
 *  - 5-field cron expressions (`"0 3 * * *"`) with `*`, lists, ranges and steps.
 *
 * Jobs respect a concurrency limit (default 1, i.e. no overlap) and receive an
 * `AbortSignal` that fires on shutdown so long runs can bail out cleanly.
 *
 * @module scheduler
 */
import comfort from "@ix-xs/node-comfort";
import type { JobContext, JobDefinition } from "./definitions.js";
import type { Logger } from "./logger.js";

type ParsedSchedule =
  | { type: "interval"; ms: number }
  | { type: "cron"; fields: CronField[] };

type CronField = { any: true } | { any: false; values: Set<number> };

/** Parses a duration or cron string into an internal schedule descriptor. */
export function parseSchedule(schedule: string): ParsedSchedule {
  const trimmed = schedule.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 5) {
    return { type: "cron", fields: parts.map((p, i) => parseCronField(p, CRON_RANGES[i]!)) };
  }
  const ms = comfort.time.parseDuration(trimmed);
  if (ms && ms > 0) return { type: "interval", ms };
  throw new Error(`Invalid schedule "${schedule}" — use a duration like "30s" or a cron like "0 3 * * *".`);
}

const CRON_RANGES: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week (0 = Sunday)
];

function parseCronField(token: string, [lo, hi]: [number, number]): CronField {
  if (token === "*") return { any: true };
  const values = new Set<number>();
  for (const part of token.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    let start = lo;
    let end = hi;
    if (rangePart && rangePart !== "*") {
      const [a, b] = rangePart.split("-");
      start = Number(a);
      end = b !== undefined ? Number(b) : start;
    }
    for (let v = start; v <= end; v += step) values.add(v);
  }
  return { any: false, values };
}

function partsInZone(date: Date, timeZone?: string): { minute: number; hour: number; dom: number; month: number; dow: number } {
  if (!timeZone) {
    return {
      minute: date.getMinutes(),
      hour: date.getHours(),
      dom: date.getDate(),
      month: date.getMonth() + 1,
      dow: date.getDay(),
    };
  }
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    minute: "2-digit",
    hour: "2-digit",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) map[part.type] = part.value;
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minute: Number(map.minute),
    hour: Number(map.hour) % 24,
    dom: Number(map.day),
    month: Number(map.month),
    dow: weekdays[map.weekday ?? "Sun"] ?? 0,
  };
}

function cronMatches(fields: CronField[], date: Date, timeZone?: string): boolean {
  const { minute, hour, dom, month, dow } = partsInZone(date, timeZone);
  const values = [minute, hour, dom, month, dow];
  return fields.every((field, i) => field.any || field.values.has(values[i]!));
}

/** Runs and supervises the registered jobs. */
export class Scheduler {
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Map<string, number>();
  private readonly abort = new AbortController();
  private cronTick?: NodeJS.Timeout;
  private lastCronMinute = -1;

  public constructor(
    private readonly jobs: readonly JobDefinition[],
    private readonly makeContext: (job: JobDefinition, signal: AbortSignal) => JobContext,
    private readonly logger: Logger,
  ) {}

  /** Starts all job timers. */
  public start(): void {
    const cronJobs: Array<{ job: JobDefinition; fields: CronField[] }> = [];

    for (const job of this.jobs) {
      const parsed = parseSchedule(job.schedule);
      if (job.runOnStart) void this.execute(job);
      if (parsed.type === "interval") {
        const timer = setInterval(() => void this.execute(job), parsed.ms);
        timer.unref?.();
        this.timers.push(timer);
      } else {
        cronJobs.push({ job, fields: parsed.fields });
      }
    }

    if (cronJobs.length > 0) {
      this.cronTick = setInterval(() => {
        const now = new Date();
        if (now.getSeconds() > 5 && this.lastCronMinute === now.getMinutes()) return;
        this.lastCronMinute = now.getMinutes();
        for (const { job, fields } of cronJobs) {
          if (cronMatches(fields, now, job.timezone)) void this.execute(job);
        }
      }, 15_000);
      this.cronTick.unref?.();
    }
  }

  private async execute(job: JobDefinition): Promise<void> {
    const active = this.running.get(job.name) ?? 0;
    if (active >= job.concurrency) {
      this.logger.debug({ job: job.name }, "Job skipped (concurrency limit)");
      return;
    }
    this.running.set(job.name, active + 1);
    const started = Date.now();
    try {
      await job.run(this.makeContext(job, this.abort.signal));
      this.logger.debug({ job: job.name, ms: Date.now() - started }, "Job finished");
    } catch (error) {
      this.logger.error({ err: error, job: job.name }, "Job failed");
    } finally {
      this.running.set(job.name, (this.running.get(job.name) ?? 1) - 1);
    }
  }

  /** Stops all timers and signals running jobs to abort. */
  public stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    if (this.cronTick) clearInterval(this.cronTick);
    this.abort.abort();
  }
}
