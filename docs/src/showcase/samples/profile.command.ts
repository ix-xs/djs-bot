import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  description: "Show a player profile",
  options: {
    user: s.user({ description: "Whose profile", required: true }),
  },
  run: (ctx) => ctx.reply.success(`Profile of ${ctx.options.user}`),
});
