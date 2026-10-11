import { defineButton, defineCommand, p, ui, ButtonStyle } from "@ix-xs/djs-bot";

export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, ownerId: p.string },
  emoji: "🔒",
  style: ButtonStyle.Danger,
  run: async (ctx) => {
    if (ctx.user.id !== ctx.params.ownerId) {
      return ctx.reply.error(ctx.t("ticket.notYours"));
    }
    await ctx.update({
      content: ctx.t("ticket.closed", { id: ctx.params.ticketId }),
      components: [],
    });
  },
});

export default defineCommand({
  name: "ticket",
  description: "Open a ticket",
  run: (ctx) => {
    const close = CloseTicket.build(
      { ticketId: "T-1042", ownerId: ctx.user.id },
      { label: ctx.t("ticket.close") },
    );
    return ctx.reply({
      content: ctx.t("ticket.opened", { id: "T-1042" }),
      components: [ui.row(close)],
    });
  },
});
