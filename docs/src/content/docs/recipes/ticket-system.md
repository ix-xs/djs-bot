---
title: "A ticket system"
description: "A panel button, a modal, private channels, a close button and a transcript."
sidebar:
  order: 2
---

The classic support-ticket flow, end to end. It is the best demonstration of
typed buttons, modals and customId params, because every step has to remember
which ticket it is acting on across bot restarts.

## The flow

1. A staff member posts a **panel** with `/ticket panel`.
2. A user clicks **Open a ticket** and fills a **modal**.
3. The bot creates a **private channel** and posts a **Close** button.
4. Anyone with access clicks Close, confirms, and the channel is archived.

## The service

Everything about storage in one place, in its own namespace.

```ts title="features/tickets/tickets.service.ts"
import { defineService, type KVStore } from "@ix-xs/djs-bot";

export interface Ticket {
  id: string;
  guildId: string;
  channelId: string;
  ownerId: string;
  subject: string;
  openedAt: number;
  closedAt?: number;
}

export class Tickets {
  private readonly ns: KVStore<Ticket>;

  constructor(store: KVStore) {
    this.ns = store.namespace<Ticket>("tickets");
  }

  async create(data: Omit<Ticket, "id" | "openedAt">): Promise<Ticket> {
    const ticket: Ticket = { ...data, id: crypto.randomUUID().slice(0, 8), openedAt: Date.now() };
    await this.ns.set(ticket.id, ticket);
    return ticket;
  }

  get(id: string): Promise<Ticket | undefined> {
    return this.ns.get(id);
  }

  async close(id: string): Promise<void> {
    const ticket = await this.ns.get(id);
    if (ticket) await this.ns.set(id, { ...ticket, closedAt: Date.now() });
  }

  async openFor(guildId: string, ownerId: string): Promise<Ticket[]> {
    const keys = await this.ns.keys();
    const all = await Promise.all(keys.map((key) => this.ns.get(key)));
    return all.filter(
      (t): t is Ticket => Boolean(t) && t!.guildId === guildId && t!.ownerId === ownerId && !t!.closedAt,
    );
  }
}

export default defineService("tickets", {
  deps: ["store"],
  factory: ({ store }) => new Tickets(store as KVStore),
});
```

```ts title="src/types.d.ts"
import type { Tickets } from "./features/tickets/tickets.service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap { tickets: Tickets }
}
```

## The modal

```ts title="features/tickets/open.modal.ts"
import { defineModal, field } from "@ix-xs/djs-bot";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { CloseButton } from "./close.button.js";
import { ui } from "@ix-xs/djs-bot";

const MAX_OPEN_PER_USER = 3;

export const OpenModal = defineModal({
  id: "ticket:open",
  title: "Open a ticket",
  fields: {
    subject: field.short({ label: "Subject", required: true, maxLength: 80 }),
    details: field.paragraph({
      label: "What do you need help with?",
      required: true,
      maxLength: 1000,
      placeholder: "Describe your problem",
    }),
  },

  async run(ctx) {
    await ctx.reply.defer({ ephemeral: true });

    const open = await ctx.services.tickets.openFor(ctx.guildId!, ctx.user.id);
    if (open.length >= MAX_OPEN_PER_USER) {
      return ctx.reply.editReply(`You already have ${open.length} open tickets. Close one first.`);
    }

    const channel = await ctx.guild!.channels.create({
      name: `ticket-${ctx.user.username}`.slice(0, 90),
      type: ChannelType.GuildText,
      topic: ctx.fields.subject,
      permissionOverwrites: [
        { id: ctx.guild!.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: ctx.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        { id: ctx.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
      ],
    });

    const ticket = await ctx.services.tickets.create({
      guildId: ctx.guildId!,
      channelId: channel.id,
      ownerId: ctx.user.id,
      subject: ctx.fields.subject,
    });

    await channel.send({
      content: `<@${ctx.user.id}> **${ctx.fields.subject}**\n\n${ctx.fields.details}`,
      components: [ui.row(CloseButton.build({ ticketId: ticket.id }))],
    });

    await ctx.audit("ticket.open", { metadata: { ticketId: ticket.id, subject: ctx.fields.subject } });

    return ctx.reply.editReply(`Your ticket is open: <#${channel.id}>`);
  },
});
```

:::caution
A modal must be the **first** response to an interaction, so the button that
opens it cannot defer. Deferring inside the modal handler, as above, is fine.
:::

## The panel button

It only shows the modal, so it needs no params.

```ts title="features/tickets/panel.button.ts"
import { defineButton, ButtonStyle } from "@ix-xs/djs-bot";
import { OpenModal } from "./open.modal.js";

export const PanelButton = defineButton({
  id: "ticket:panel",
  label: "Open a ticket",
  emoji: "🎫",
  style: ButtonStyle.Primary,
  run: (ctx) => ctx.interaction.showModal(OpenModal.build()),
});
```

## The close button

This one carries the ticket id in its customId, which is what makes it survive
restarts: the state lives on the message, not in memory.

```ts title="features/tickets/close.button.ts"
import { defineButton, p, confirm, ButtonStyle, PermissionFlagsBits } from "@ix-xs/djs-bot";

export const CloseButton = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string },
  label: "Close",
  emoji: "🔒",
  style: ButtonStyle.Danger,

  async run(ctx) {
    const ticket = await ctx.services.tickets.get(ctx.params.ticketId);
    if (!ticket) return ctx.reply.error("This ticket no longer exists.");
    if (ticket.closedAt) return ctx.reply.error("This ticket is already closed.");

    const isStaff = ctx.member?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
    if (ctx.user.id !== ticket.ownerId && !isStaff) {
      return ctx.reply.error("Only the ticket author or staff can close this.");
    }

    const ok = await confirm(ctx, { content: "Close this ticket?", confirmLabel: "Close" });
    if (!ok) return;

    await ctx.services.tickets.close(ticket.id);
    await ctx.audit("ticket.close", { metadata: { ticketId: ticket.id } });

    await ctx.update.disable();
    await ctx.reply.followUp("Ticket closed. This channel will be deleted in 10 seconds.");

    setTimeout(() => {
      void ctx.guild?.channels.delete(ticket.channelId, `Ticket ${ticket.id} closed`).catch(() => undefined);
    }, 10_000);
  },
});
```

`ctx.update.disable()` greys out the button so nobody clicks it twice while the
countdown runs.

## The panel command

```ts title="features/tickets/ticket.command.ts"
import { defineCommand, subcommand, ui, inGuild, hasPermission, PermissionFlagsBits, EmbedBuilder, Colors } from "@ix-xs/djs-bot";
import { PanelButton } from "./panel.button.js";

export default defineCommand({
  name: "ticket",
  description: "Ticket system",
  guards: [inGuild()],

  subcommands: {
    panel: subcommand({
      description: "Post the ticket panel in this channel",
      guards: [hasPermission(PermissionFlagsBits.ManageGuild)],
      async run(ctx) {
        await ctx.channel!.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("Need help?")
              .setDescription("Click the button below to open a private ticket with the staff team.")
              .setColor(Colors.Blurple),
          ],
          components: [ui.row(PanelButton.build())],
        });
        return ctx.reply.success("Panel posted.", { ephemeral: true });
      },
    }),

    close: subcommand({
      description: "Close the ticket in this channel",
      run: (ctx) =>
        ctx.reply.info("Use the **Close** button at the top of this ticket."),
    }),
  },
});
```

## Bundling it as a feature

Declaring `requires: ["store"]` means the bot refuses to start with a clear
[`DJSBOT_E040`](/djs-bot/api/errors/#djsbot_e040) if you forget to configure a
store, rather than crashing on the first click.

```ts title="features/tickets/index.ts"
import { defineFeature } from "@ix-xs/djs-bot";
import TicketCommand from "./ticket.command.js";
import TicketsService from "./tickets.service.js";
import { PanelButton } from "./panel.button.js";
import { CloseButton } from "./close.button.js";
import { OpenModal } from "./open.modal.js";

export default defineFeature({
  name: "tickets",
  requires: ["store"],
  commands: [TicketCommand],
  services: [TicketsService],
  buttons: [PanelButton, CloseButton],
  modals: [OpenModal],
});
```

## Why the customId carries the id

The alternative is a `Map<channelId, ticket>` in memory. It works until the
first restart, after which every Close button on every open ticket is dead. The
customId travels with the message, so a ticket opened months ago still closes
correctly after any number of deploys.

The 100 character budget is plenty for one short id. If you ever need more, keep
a short key and put the payload in the store.

## Going further

- Post a transcript before deleting: fetch the channel messages and upload them
  as an `AttachmentBuilder`.
- Add a **Claim** button with `params: { ticketId: p.string }` that assigns a
  staff member.
- Add a `defineJob` that closes tickets with no activity for 7 days.
- Add a category id to your config and create channels inside it with `parent`.
