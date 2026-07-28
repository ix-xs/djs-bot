import { defineCommand, s, cooldown } from "../../../src/index.js";

/** A minimal slash command with a typed, optional option and a cooldown guard. */
export default defineCommand({
  name: "ping",
  description: "Check latency",
  options: {
    ephemeral: s.boolean({ description: "Only show the result to you" }),
  },
  guards: [cooldown("5s")],
  run: async (ctx) => {
    // ctx.options.ephemeral is `boolean | undefined`, fully typed.
    await ctx.reply.info(`🏓 Pong! WS ${ctx.client.ws.ping}ms`, {
      ephemeral: ctx.options.ephemeral ?? false,
    });
  },
});
