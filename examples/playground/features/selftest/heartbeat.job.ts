import { defineJob } from "../../../../src/index.js";

/** Proves the scheduler runs: one log line a minute, with its own correlation id. */
export default defineJob({
  name: "selftest:heartbeat",
  schedule: "1m",
  run: (ctx) => {
    ctx.logger.info({ selftest: "job", guilds: ctx.client.guilds.cache.size }, "heartbeat job ran");
  },
});
