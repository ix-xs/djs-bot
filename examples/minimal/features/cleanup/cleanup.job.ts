import { defineJob } from "../../../../src/index.js";

/**
 * Runs every night at 03:00. A schedule is a cron expression, a duration
 * ("30m") or a macro ("@daily").
 */
export default defineJob({
  name: "nightly-cleanup",
  schedule: "0 3 * * *",
  concurrency: 1,
  shard: "first", // on a sharded bot, once is enough
  run: async (ctx) => {
    if (ctx.signal.aborted) return;
    ctx.logger.info({}, "running nightly cleanup");
    // e.g. await ctx.services.db.purgeExpired();
  },
});
