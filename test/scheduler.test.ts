import { describe, it, expect, vi, afterEach } from "vitest";
import { defineJob, parseSchedule, isBotError, createLogger } from "../src/index.js";
import { cronMatches, Scheduler } from "../src/scheduler.js";

const cron = (expr: string) => {
  const parsed = parseSchedule(expr);
  if (parsed.type !== "cron") throw new Error("expected a cron schedule");
  return parsed.fields;
};
/** Local-time date, so the tests do not depend on the machine's timezone. */
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

describe("parseSchedule", () => {
  it("accepts durations", () => {
    expect(parseSchedule("30s")).toEqual({ type: "interval", ms: 30_000 });
    expect(parseSchedule("1h")).toEqual({ type: "interval", ms: 3_600_000 });
  });

  it("expands macros", () => {
    expect(parseSchedule("@daily")).toEqual(parseSchedule("0 0 * * *"));
    expect(parseSchedule("@hourly")).toEqual(parseSchedule("0 * * * *"));
    expect(parseSchedule("@WEEKLY")).toEqual(parseSchedule("0 0 * * 0"));
  });

  it("understands month and weekday names, and Sunday as 7", () => {
    expect(parseSchedule("0 9 * * MON-FRI")).toEqual(parseSchedule("0 9 * * 1-5"));
    expect(parseSchedule("0 0 1 jan,jul *")).toEqual(parseSchedule("0 0 1 1,7 *"));
    expect(parseSchedule("0 0 * * 7")).toEqual(parseSchedule("0 0 * * 0"));
  });

  it("treats a/n as 'from a, every n'", () => {
    const [minute] = cron("5/20 * * * *");
    expect(minute).toEqual({ any: false, values: new Set([5, 25, 45]) });
  });

  it.each([
    ["60 * * * *", /minute/],
    ["* 24 * * *", /hour/],
    ["* * 0 * *", /day of month/],
    ["* * * 13 *", /month/],
    ["*/0 * * * *", /step/],
    ["5-1 * * * *", /descending/],
    ["a * * * *", /minute/],
    ["@fortnightly", /macro/],
    ["soon", /Invalid schedule/],
    ["* * *", /Invalid schedule/],
  ])("rejects %s", (expr, reason) => {
    expect(() => parseSchedule(expr)).toThrow(reason);
  });
});

describe("cronMatches", () => {
  it("matches minute, hour and month", () => {
    const fields = cron("30 3 * 6 *");
    expect(cronMatches(fields, at(2026, 6, 10, 3, 30))).toBe(true);
    expect(cronMatches(fields, at(2026, 6, 10, 3, 31))).toBe(false);
    expect(cronMatches(fields, at(2026, 7, 10, 3, 30))).toBe(false);
  });

  it("ORs day-of-month and day-of-week when both are restricted", () => {
    // "at midnight on the 1st, and on every Monday" - standard cron semantics.
    const fields = cron("0 0 1 * MON");
    expect(cronMatches(fields, at(2026, 9, 1, 0, 0))).toBe(true); // the 1st (a Tuesday)
    expect(cronMatches(fields, at(2026, 9, 7, 0, 0))).toBe(true); // a Monday
    expect(cronMatches(fields, at(2026, 9, 8, 0, 0))).toBe(false); // neither
  });

  it("ANDs them when only one is restricted", () => {
    const fields = cron("0 0 * * MON");
    expect(cronMatches(fields, at(2026, 9, 7, 0, 0))).toBe(true);
    expect(cronMatches(fields, at(2026, 9, 1, 0, 0))).toBe(false);
  });

  it("evaluates in the requested timezone", () => {
    const fields = cron("0 9 * * *");
    const nineInTokyo = new Date("2026-03-10T00:00:00Z"); // 09:00 JST
    expect(cronMatches(fields, nineInTokyo, "Asia/Tokyo")).toBe(true);
    expect(cronMatches(fields, nineInTokyo, "UTC")).toBe(false);
  });
});

describe("defineJob", () => {
  it("rejects an invalid schedule when the job is defined", () => {
    try {
      defineJob({ name: "broken", schedule: "every tuesday", run: () => undefined });
      expect.unreachable();
    } catch (error) {
      expect(isBotError(error)).toBe(true);
      expect((error as { code: string }).code).toBe("DJSBOT_E080");
      expect(String(error)).toContain("broken");
    }
  });

  it("defaults to running on every shard, without overlap", () => {
    const job = defineJob({ name: "ok", schedule: "@daily", run: () => undefined });
    expect(job).toMatchObject({ shard: "all", concurrency: 1, runOnStart: false });
  });
});

describe("Scheduler", () => {
  afterEach(() => vi.useRealTimers());
  const logger = createLogger({ level: "silent" });
  const ctx = (_job: unknown, signal: AbortSignal, correlationId: string) =>
    ({ client: {}, services: {}, logger, signal, correlationId }) as never;

  it("fires a cron job at the minute boundary, once per minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 10, 59, 30));
    const runs: number[] = [];
    const job = defineJob({ name: "tick", schedule: "* * * * *", run: () => void runs.push(Date.now()) });
    const scheduler = new Scheduler([job], ctx, logger);
    scheduler.start();

    await vi.advanceTimersByTimeAsync(29_000); // 10:59:59 - not yet
    expect(runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2_000); // crossed 11:00:00
    expect(runs).toHaveLength(1);
    expect(new Date(runs[0]!).getSeconds()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runs).toHaveLength(2);
    await scheduler.stop();
  });

  it("skips a run while the previous one is still going, and reports failures", async () => {
    vi.useFakeTimers();
    const failures: unknown[] = [];
    let started = 0;
    const job = defineJob({
      name: "slow",
      schedule: "1s",
      run: async () => {
        started++;
        await new Promise((resolve) => setTimeout(resolve, 2_500));
        throw new Error("nope");
      },
    });
    const scheduler = new Scheduler([job], ctx, logger, { onError: (error) => failures.push(error) });
    scheduler.start();

    await vi.advanceTimersByTimeAsync(3_000); // ticks at 1s, 2s, 3s - only the first may start
    expect(started).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000); // first run ended at 3.5s and threw
    expect(failures).toHaveLength(1);
    vi.useRealTimers(); // the grace period below is a real timer
    await scheduler.stop(0);
  });

  it("waits for running jobs when stopping, but not forever", async () => {
    let finished = false;
    const job = defineJob({
      name: "drain",
      schedule: "1h",
      runOnStart: true,
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        finished = true;
      },
    });
    const scheduler = new Scheduler([job], ctx, logger);
    scheduler.start();
    await scheduler.stop(1_000);
    expect(finished).toBe(true);
  });
});
