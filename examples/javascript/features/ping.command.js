const { defineCommand, s, cooldown } = require("@ix-xs/djs-bot");

// JSDoc + the shipped .d.ts give you autocomplete on `ctx` in plain JS too.
module.exports = defineCommand({
  name: "ping",
  description: "Check latency",
  options: {
    ephemeral: s.boolean({ description: "Only show the result to you" }),
  },
  guards: [cooldown("5s")],
  run: async (ctx) => {
    await ctx.reply.info(`🏓 Pong! WS ${ctx.client.ws.ping}ms`, {
      ephemeral: ctx.options.ephemeral ?? false,
    });
  },
});
