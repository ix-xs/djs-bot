import { defineMessageCommand } from "../../../../src/index.js";

/** Right-click a message → Apps → "Report message". `ctx.targetMessage` is typed. */
export default defineMessageCommand({
  name: "Report message",
  run: async (ctx) => {
    const msg = ctx.targetMessage;
    ctx.logger.warn(
      { messageId: msg.id, author: msg.author.id, reporter: ctx.user.id },
      "message reported",
    );
    await ctx.reply.success(
      `Reported ${msg.author}'s message. Thanks - a moderator will review it.`,
      { ephemeral: true },
    );
  },
});
