import { defineCommand, s, inGuild, hasPermission, PermissionFlagsBits, ButtonStyle } from "../../../../src/index.js";
import { ActionRowBuilder, type ButtonBuilder } from "discord.js";
import { CloseTicket } from "./close.button.js";

/**
 * Opens a ticket and posts a "Close" button whose customId encodes the ticket
 * id and owner - no manual string juggling, no global `switch`.
 */
export default defineCommand({
  name: "open-ticket",
  description: "Open a support ticket",
  options: {
    subject: s.string({ description: "What do you need help with?", required: true, maxLength: 100 }),
  },
  guards: [inGuild(), hasPermission(PermissionFlagsBits.SendMessages)],
  run: async (ctx) => {
    const id = `${ctx.user.id}-${Date.now()}`;
    ctx.services.tickets.open(id);

    const button = CloseTicket.build(
      { ticketId: id, ownerId: ctx.user.id },
      { label: "Close ticket", style: ButtonStyle.Danger, emoji: "🔒" },
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await ctx.reply({
      content: `🎫 Ticket opened: **${ctx.options.subject}**`,
      components: [row],
    });
  },
});
