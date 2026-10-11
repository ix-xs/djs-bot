import { defineMessageCommand } from "@ix-xs/djs-bot";

export default defineMessageCommand({
  name: "Report message",
  nameLocalizations: { fr: "Signaler le message" },
  run: async (ctx) => {
    ctx.logger.warn({ id: ctx.targetMessage.id }, "message reported");
    await ctx.reply.success(ctx.t("report.done"), { ephemeral: true });
  },
});
