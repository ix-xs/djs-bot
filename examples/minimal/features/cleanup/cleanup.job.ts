import { defineJob } from "../../../../src/index.js";

/** Runs every night at 03:00. Cron and duration syntaxes are both supported. */
export default defineJob({
  name: "nightly-cleanup",
  schedule: "0 3 * * *",
  concurrency: 1,
  run: async (ctx) => {
    ctx.logger.info({}, "running nightly cleanup");
    // e.g. await ctx.services.db.purgeExpired();
  },
});
