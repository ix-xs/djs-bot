import { defineButton, p } from "../../../../src/index.js";

/**
 * A button with typed customId params. `ctx.params` is decoded and typed;
 * `CloseTicket.build({ ... })` is type-checked at the call site.
 */
export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, ownerId: p.string },
  run: async (ctx) => {
    if (ctx.user.id !== ctx.params.ownerId) {
      return void ctx.reply.error("Only the ticket owner can close it.");
    }
    const closed = ctx.services.tickets.close(ctx.params.ticketId);
    if (!closed) return void ctx.reply.error("That ticket is already closed.");
    await ctx.update.disable();
    await ctx.reply.success("Ticket closed. 🔒", { ephemeral: true });
  },
});
