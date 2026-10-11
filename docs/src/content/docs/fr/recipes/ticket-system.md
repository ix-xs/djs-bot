---
title: "Un système de tickets"
description: "Un bouton de panneau, une modale, des salons privés, un bouton de fermeture et une transcription."
sidebar:
  order: 2
---

Le parcours classique d'un ticket de support, de bout en bout. C'est la meilleure
démonstration des boutons typés, des modales et des paramètres de customId, car
chaque étape doit retenir sur quel ticket elle agit, même après des redémarrages du bot.

## Le parcours

1. Un membre de l'équipe publie un **panneau** avec `/ticket panel`.
2. Un utilisateur clique sur **Open a ticket** et remplit une **modale**.
3. Le bot crée un **salon privé** et y publie un bouton **Close**.
4. Quiconque y a accès clique sur Close, confirme, et le salon est archivé.

## Le service

Tout ce qui touche au stockage au même endroit, dans son propre espace de noms.

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
    if (await this.ns.has(id)) {
      await this.ns.update(id, (ticket) => ({ ...ticket!, closedAt: Date.now() }));
    }
  }

  async openFor(guildId: string, ownerId: string): Promise<Ticket[]> {
    const all = await this.ns.entries();          // tous les tickets, en une seule lecture
    return all
      .map(([, ticket]) => ticket)
      .filter((t) => t.guildId === guildId && t.ownerId === ownerId && !t.closedAt);
  }
}

export default defineService("tickets", {
  deps: ["store"],
  factory: ({ store }) => new Tickets(store),   // typé, aucun cast nécessaire
});
```

```ts title="src/types.d.ts"
import type { Tickets } from "./features/tickets/tickets.service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap { tickets: Tickets }
}
```

## La modale

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
Une modale doit être la **première** réponse à une interaction : le bouton qui
l'ouvre ne peut donc pas différer. Différer dans le gestionnaire de la modale, comme
ci-dessus, ne pose pas de problème.
:::

## Le bouton du panneau

Il se contente d'afficher la modale, donc il n'a besoin d'aucun paramètre.

```ts title="features/tickets/panel.button.ts"
import { defineButton, ButtonStyle } from "@ix-xs/djs-bot";
import { OpenModal } from "./open.modal.js";

export const PanelButton = defineButton({
  id: "ticket:panel",
  label: "Open a ticket",
  emoji: "🎫",
  style: ButtonStyle.Primary,
  run: (ctx) => ctx.showModal(OpenModal),
});
```

## Le bouton de fermeture

Celui-ci porte l'identifiant du ticket dans son customId, ce qui lui permet de survivre
aux redémarrages : l'état vit sur le message, pas en mémoire.

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

`ctx.update.disable()` grise le bouton pour que personne ne clique dessus deux fois pendant
le compte à rebours.

## La commande du panneau

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
        const channel = ctx.channel;
        if (!channel?.isSendable()) return ctx.reply.error("I cannot post in this channel.");

        await channel.send({
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

## Les regrouper en une fonctionnalité

Déclarer `requires: ["store"]` signifie que le bot refuse de démarrer avec une erreur claire,
[`DJSBOT_E040`](/api/errors/#djsbot_e040), si vous oubliez de configurer un
store, plutôt que de planter au premier clic.

```ts title="features/tickets/tickets.feature.ts"
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

## Pourquoi le customId porte l'identifiant

L'alternative est une `Map<channelId, ticket>` en mémoire. Elle fonctionne jusqu'au premier
redémarrage, après lequel chaque bouton Close de chaque ticket ouvert est mort. Le customId
voyage avec le message : un ticket ouvert il y a des mois se ferme donc correctement après
n'importe quel nombre de déploiements.

Le budget de 100 caractères est largement suffisant pour un identifiant court. Si vous avez
un jour besoin de plus, gardez une clé courte et placez les données dans le store.

## Aller plus loin

- Publiez une transcription avant la suppression : récupérez les messages du salon et
  envoyez-les sous forme d'`AttachmentBuilder`.
- Ajoutez un bouton **Claim** avec `params: { ticketId: p.string }` qui assigne un
  membre de l'équipe.
- Ajoutez un `defineJob` qui ferme les tickets sans activité depuis 7 jours.
- Ajoutez un identifiant de catégorie à votre configuration et créez les salons dedans avec `parent`.
