import { defineMessageCommand } from "@ix-xs/djs-bot";

export default defineMessageCommand({
  name: "Report message",
  run: async (ctx) => {
    ctx.logger.warn({ id: ctx.targetMessage.id }, "message reported");
    await ctx.reply.success("Reported to moderators.", {
      ephemeral: true,
    });
  },
});
