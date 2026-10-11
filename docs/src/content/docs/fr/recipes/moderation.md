---
title: "Un bot de modération"
description: "Bannir, expulser, mettre en sourdine, avertir, et un historique des avertissements, avec gardes, audit et confirmation."
sidebar:
  order: 1
---

Une fonctionnalité de modération complète que vous pouvez copier dans `features/moderation/`.
Elle montre comment les gardes, la superposition des permissions, la piste d'audit, une boîte
de dialogue de confirmation et un espace de noms du store fonctionnent ensemble.

## Ce qu'elle fait

| Commande | Comportement |
| --- | --- |
| `/ban` | Bannit un membre après une boîte de dialogue de confirmation, enregistre une entrée d'audit |
| `/kick` | Expulse un membre |
| `/timeout` | Met un membre en sourdine pour une durée donnée |
| `/warn` | Enregistre un avertissement et l'envoie en message privé au membre |
| `/warnings` | Liste les avertissements d'un membre, paginés |

## Gardes partagées

Chaque commande ici a besoin des trois mêmes choses : un serveur, la permission du
modérateur et la permission propre au bot. Déclarez cela une seule fois.

```ts title="features/moderation/guards.ts"
import { inGuild, hasPermission, botHasPermission, PermissionFlagsBits } from "@ix-xs/djs-bot";

export const canBan = [
  inGuild(),
  hasPermission(PermissionFlagsBits.BanMembers),
  botHasPermission(PermissionFlagsBits.BanMembers),
];

export const canKick = [
  inGuild(),
  hasPermission(PermissionFlagsBits.KickMembers),
  botHasPermission(PermissionFlagsBits.KickMembers),
];

export const canModerate = [
  inGuild(),
  hasPermission(PermissionFlagsBits.ModerateMembers),
  botHasPermission(PermissionFlagsBits.ModerateMembers),
];
```

`botHasPermission` est celle que l'on oublie. Sans elle, une permission manquante au bot
donne l'impression que la commande est cassée, au lieu de s'expliquer d'elle-même.

## Une vérification de sécurité partagée

Ne laissez jamais un modérateur agir sur quelqu'un au-dessus de lui, sur lui-même, ni sur le bot.

```ts title="features/moderation/checks.ts"
import type { CommandContext } from "@ix-xs/djs-bot";
import type { GuildMember } from "discord.js";

/** Renvoie un message de refus, ou null quand l'action est autorisée. */
export function refuse(ctx: CommandContext<unknown>, target: GuildMember | null): string | null {
  if (!target) return "That user is not in this server.";
  if (target.id === ctx.user.id) return "You cannot do that to yourself.";
  if (target.id === ctx.client.user.id) return "I am not doing that to myself.";
  if (target.id === ctx.guild!.ownerId) return "I cannot act on the server owner.";

  const me = ctx.guild!.members.me!;
  if (target.roles.highest.position >= me.roles.highest.position) {
    return "My highest role is not above theirs, so I cannot act on them.";
  }
  if (
    ctx.member!.roles.highest.position <= target.roles.highest.position &&
    ctx.user.id !== ctx.guild!.ownerId
  ) {
    return "You cannot act on someone with a role equal to or above yours.";
  }
  return null;
}
```

## `/ban`

```ts title="features/moderation/ban.command.ts"
import { defineCommand, s, confirm, PermissionFlagsBits } from "@ix-xs/djs-bot";
import { canBan } from "./guards.js";
import { refuse } from "./checks.js";

export default defineCommand({
  name: "ban",
  description: "Ban a member from the server",
  guards: canBan,
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  options: {
    member: s.member({ description: "Who to ban", required: true }),
    reason: s.string({ description: "Why", maxLength: 400 }),
    days: s.integer({ description: "Days of messages to delete", min: 0, max: 7 }),
  },

  async run(ctx) {
    const { member, reason, days } = ctx.options;

    const problem = refuse(ctx, member);
    if (problem) return ctx.reply.error(problem);

    const ok = await confirm(ctx, {
      content: `Ban **${member.user.tag}**?${reason ? `\nReason: ${reason}` : ""}`,
      confirmLabel: "Ban",
    });
    if (!ok) return;

    // Prévenir avant le bannissement, car ensuite nous ne partageons plus aucun serveur avec lui.
    await member.send(`You were banned from **${ctx.guild!.name}**.${reason ? ` Reason: ${reason}` : ""}`)
      .catch(() => undefined);

    await ctx.guild!.members.ban(member, {
      reason: `${ctx.user.tag}: ${reason ?? "no reason given"}`,
      deleteMessageSeconds: (days ?? 0) * 86_400,
    });

    await ctx.audit("member.ban", { targetId: member.id, metadata: { reason } });

    return ctx.reply.success(`Banned **${member.user.tag}**.`, { ephemeral: false });
  },
});
```

Trois détails à copier : envoyer le message privé **avant** le bannissement, passer une
raison que Discord affichera lui-même dans son journal d'audit, et enregistrer votre propre
entrée d'audit pour que `/warnings` et les tableaux de bord puissent la relire.

## `/kick`

```ts title="features/moderation/kick.command.ts"
import { defineCommand, s, PermissionFlagsBits } from "@ix-xs/djs-bot";
import { canKick } from "./guards.js";
import { refuse } from "./checks.js";

export default defineCommand({
  name: "kick",
  description: "Kick a member from the server",
  guards: canKick,
  defaultMemberPermissions: PermissionFlagsBits.KickMembers,
  options: {
    member: s.member({ description: "Who to kick", required: true }),
    reason: s.string({ description: "Why", maxLength: 400 }),
  },

  async run(ctx) {
    const problem = refuse(ctx, ctx.options.member);
    if (problem) return ctx.reply.error(problem);

    await ctx.options.member.kick(`${ctx.user.tag}: ${ctx.options.reason ?? "no reason given"}`);
    await ctx.audit("member.kick", { targetId: ctx.options.member.id });

    return ctx.reply.success(`Kicked **${ctx.options.member.user.tag}**.`, { ephemeral: false });
  },
});
```

## `/timeout`

Discord limite une mise en sourdine à 28 jours.

```ts title="features/moderation/timeout.command.ts"
import { defineCommand, s, timestamp, TimestampStyles, PermissionFlagsBits } from "@ix-xs/djs-bot";
import { canModerate } from "./guards.js";
import { refuse } from "./checks.js";

const MAX_MINUTES = 28 * 24 * 60;

export default defineCommand({
  name: "timeout",
  description: "Temporarily mute a member",
  guards: canModerate,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  options: {
    member: s.member({ description: "Who to time out", required: true }),
    minutes: s.integer({ description: "For how long", required: true, min: 1, max: MAX_MINUTES }),
    reason: s.string({ description: "Why", maxLength: 400 }),
  },

  async run(ctx) {
    const { member, minutes, reason } = ctx.options;

    const problem = refuse(ctx, member);
    if (problem) return ctx.reply.error(problem);

    const until = Date.now() + minutes * 60_000;
    await member.timeout(minutes * 60_000, `${ctx.user.tag}: ${reason ?? "no reason given"}`);
    await ctx.audit("member.timeout", { targetId: member.id, metadata: { minutes, reason } });

    return ctx.reply.success(
      `**${member.user.tag}** is muted until ${timestamp(until, TimestampStyles.RelativeTime)}.`,
      { ephemeral: false },
    );
  },
});
```

Passez `0` à `member.timeout()` pour en lever une avant son terme.

## `/warn` et le stockage des avertissements

Les avertissements vivent dans leur propre espace de noms du store : rien d'autre ne peut
entrer en collision avec eux ni les effacer.

```ts title="features/moderation/warnings.service.ts"
import { defineService, type KVStore } from "@ix-xs/djs-bot";

export interface Warning {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  at: number;
}

export class Warnings {
  private readonly ns: KVStore<Warning[]>;

  constructor(store: KVStore) {
    this.ns = store.namespace<Warning[]>("warnings");
  }

  private key(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
  }

  async add(warning: Omit<Warning, "id" | "at">): Promise<Warning> {
    const entry: Warning = { ...warning, id: crypto.randomUUID().slice(0, 8), at: Date.now() };
    // update() met les écritures en file par clé : deux modérateurs qui avertissent
    // le même membre en même temps ne peuvent pas perdre un des avertissements.
    await this.ns.update(this.key(warning.guildId, warning.userId), (all = []) => [...all, entry]);
    return entry;
  }

  async list(guildId: string, userId: string): Promise<Warning[]> {
    return (await this.ns.get(this.key(guildId, userId))) ?? [];
  }

  async clear(guildId: string, userId: string): Promise<void> {
    await this.ns.delete(this.key(guildId, userId));
  }
}

export default defineService("warnings", {
  deps: ["store"],
  factory: ({ store }) => new Warnings(store),   // typé, aucun cast nécessaire
});
```

Ajoutez le token à votre table des services (`ServiceMap`) pour qu'il soit typé partout :

```ts title="src/types.d.ts"
import type { Warnings } from "./features/moderation/warnings.service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap { warnings: Warnings }
}
```

```ts title="features/moderation/warn.command.ts"
import { defineCommand, s, PermissionFlagsBits } from "@ix-xs/djs-bot";
import { canModerate } from "./guards.js";
import { refuse } from "./checks.js";

export default defineCommand({
  name: "warn",
  description: "Warn a member",
  guards: canModerate,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  options: {
    member: s.member({ description: "Who to warn", required: true }),
    reason: s.string({ description: "Why", required: true, maxLength: 400 }),
  },

  async run(ctx) {
    const { member, reason } = ctx.options;

    const problem = refuse(ctx, member);
    if (problem) return ctx.reply.error(problem);

    const warning = await ctx.services.warnings.add({
      guildId: ctx.guildId!,
      userId: member.id,
      moderatorId: ctx.user.id,
      reason,
    });

    const total = (await ctx.services.warnings.list(ctx.guildId!, member.id)).length;

    await member.send(`You were warned in **${ctx.guild!.name}**: ${reason}`).catch(() => undefined);
    await ctx.audit("member.warn", { targetId: member.id, metadata: { reason, warningId: warning.id } });

    return ctx.reply.success(
      `Warned **${member.user.tag}**. They now have ${total} warning${total === 1 ? "" : "s"}.`,
      { ephemeral: false },
    );
  },
});
```

## `/warnings`, paginé

```ts title="features/moderation/warnings.command.ts"
import {
  defineCommand, s, paginate, EmbedBuilder, Colors,
  timestamp, TimestampStyles, PermissionFlagsBits,
} from "@ix-xs/djs-bot";
import { canModerate } from "./guards.js";

const PER_PAGE = 5;

export default defineCommand({
  name: "warnings",
  description: "Show a member warnings",
  guards: canModerate,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  options: {
    user: s.user({ description: "Whose warnings", required: true }),
  },

  async run(ctx) {
    const all = await ctx.services.warnings.list(ctx.guildId!, ctx.options.user.id);
    if (all.length === 0) return ctx.reply.info(`**${ctx.options.user.tag}** has no warnings.`);

    const newestFirst = [...all].sort((a, b) => b.at - a.at);
    const pageCount = Math.ceil(newestFirst.length / PER_PAGE);

    await paginate(ctx, {
      count: pageCount,
      ephemeral: true,
      pages: (index) => {
        const slice = newestFirst.slice(index * PER_PAGE, index * PER_PAGE + PER_PAGE);
        return new EmbedBuilder()
          .setTitle(`Warnings for ${ctx.options.user.tag}`)
          .setColor(Colors.Yellow)
          .setDescription(
            slice
              .map((w) =>
                `\`${w.id}\` ${timestamp(w.at, TimestampStyles.RelativeTime)} by <@${w.moderatorId}>\n${w.reason}`,
              )
              .join("\n\n"),
          )
          .setFooter({ text: `${newestFirst.length} total` });
      },
    });
  },
});
```

## Tout assembler

```ts title="src/index.ts"
import { defineBot, env, sqliteStore, loggerAuditSink } from "@ix-xs/djs-bot";

const store = sqliteStore("data/bot.sqlite");

export default defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env("DISCORD_CLIENT_ID"),
  features: "./features",
  intents: "auto",
  store,
  audit: { sinks: [loggerAuditSink()], autoRecordCommands: true },
});
```

Aucun intent privilégié n'est nécessaire ici : Discord transmet le membre choisi dans une
option `s.member` avec l'interaction, et bannir, expulser ou mettre en sourdine passe par
l'API REST. `intents: "auto"` ne demande donc que `Guilds`.

Pour que les refus des gardes ci-dessus s'expriment en français (ou dans toute autre langue),
définissez une fois [`messages`](/basics/wording-and-theme/) :

```ts
messages: {
  missingPermissions: "Il te manque : {permissions}.",
  botMissingPermissions: "Il me manque : {permissions}.",
  guildOnly: "Cette commande s'utilise sur un serveur.",
}
```

## Aller plus loin

- Ajoutez `cooldown("3s")` à chaque commande pour qu'un modérateur ne puisse pas enchaîner les bannissements.
- Ajoutez un `/unban` avec une option `autocomplete` qui liste les bannis.
- Journalisez les actions dans un salon en ajoutant un [sink d'audit](/data/audit/#choosing-sinks) personnalisé.
- Conditionnez toute la fonctionnalité par un [feature flag](/data/flags/) pour qu'un serveur
  puisse la désactiver.
