import { defineButton, p, ButtonStyle } from "@ix-xs/djs-bot";

export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, ownerId: p.string },
  label: "Close ticket",
  emoji: "🔒",
  style: ButtonStyle.Danger,
  run: async (ctx) => {
    if (ctx.user.id !== ctx.params.ownerId) {
      return ctx.reply.error("Not your ticket.");
    }
    await ctx.update.disable();
  },
});
