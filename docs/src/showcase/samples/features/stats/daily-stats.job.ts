import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "daily-stats",
  schedule: "@daily",
  run: async (ctx) => {
    const guilds = ctx.client.guilds.cache.size;
    await ctx.services.store.set("stats:guilds", guilds);
    ctx.logger.info({ guilds }, "daily stats saved");
  },
});
