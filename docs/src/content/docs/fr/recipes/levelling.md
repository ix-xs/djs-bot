---
title: "Niveaux et classement"
description: "De l'XP gagnée avec les messages et un délai de récupération, des mises à jour atomiques, une carte de rang, un classement paginé et une tâche hebdomadaire."
sidebar:
  order: 4
---

Un système de niveaux touche presque toutes les parties du framework : un événement, un
service, le store, un cache, la pagination et une tâche planifiée. C'est le meilleur
exemple unique de la façon dont les pièces s'assemblent.

## Le service

```ts title="features/levels/levels.service.ts"
import { defineService, createCache, type KVStore } from "@ix-xs/djs-bot";

export interface Profile {
  xp: number;
  level: number;
  messages: number;
}

const EMPTY: Profile = { xp: 0, level: 0, messages: 0 };

/** XP totale nécessaire pour atteindre un niveau. Quadratique, pour que les niveaux ralentissent raisonnablement. */
export const xpForLevel = (level: number): number => 5 * level * level + 50 * level + 100;

export class Levels {
  private readonly ns: KVStore<Profile>;
  /** Le classement coûte cher à construire, donc il est mis en cache brièvement. */
  private readonly board = createCache<string, Array<{ userId: string; profile: Profile }>>({
    ttl: "60s",
    staleWhileRevalidate: true,
  });

  constructor(store: KVStore) {
    this.ns = store.namespace<Profile>("levels");
  }

  /** Un espace de noms par serveur : lister un classement ne lit jamais un autre serveur. */
  private guild(guildId: string): KVStore<Profile> {
    return this.ns.namespace<Profile>(guildId);
  }

  async get(guildId: string, userId: string): Promise<Profile> {
    return (await this.guild(guildId).get(userId)) ?? EMPTY;
  }

  /** Ajoute de l'XP et renvoie le nouveau profil, ainsi que l'information de passage de niveau du membre. */
  async addXp(guildId: string, userId: string, amount: number): Promise<{ profile: Profile; levelledUp: boolean }> {
    let levelledUp = false;
    // update() met les écritures en file par clé : deux messages qui arrivent ensemble ne peuvent pas
    // lire tous les deux l'ancienne XP et s'écraser mutuellement.
    const profile = await this.guild(guildId).update(userId, (current = EMPTY) => {
      const xp = current.xp + amount;
      let level = current.level;
      while (xp >= xpForLevel(level + 1)) level += 1;
      levelledUp = level > current.level;
      return { xp, level, messages: current.messages + 1 };
    });
    return { profile, levelledUp };
  }

  async top(guildId: string, limit = 100): Promise<Array<{ userId: string; profile: Profile }>> {
    const board = await this.board.getOrFetch(guildId, async () => {
      const rows = await this.guild(guildId).entries();     // une seule lecture, ce serveur uniquement
      return rows
        .map(([userId, profile]) => ({ userId, profile }))
        .sort((a, b) => b.profile.xp - a.profile.xp);
    });
    return board.slice(0, limit);
  }

  async rank(guildId: string, userId: string): Promise<number> {
    const board = await this.top(guildId, Number.POSITIVE_INFINITY);
    const index = board.findIndex((row) => row.userId === userId);
    return index === -1 ? board.length + 1 : index + 1;
  }
}

export default defineService("levels", {
  deps: ["store"],
  factory: ({ store }) => new Levels(store),   // `store` est typé, aucun cast nécessaire
});
```

```ts title="src/types.d.ts"
import type { Levels } from "./features/levels/levels.service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap { levels: Levels }
}
```

Le cache `staleWhileRevalidate` est l'astuce importante : reconstruire un classement lit
chaque clé, donc servir une valeur vieille d'une minute au plus ne coûte rien et garde
`/leaderboard` instantané.

## Gagner de l'XP

Un délai de récupération par utilisateur empêche de farmer de l'XP en spammant.

```ts title="features/levels/message.event.ts"
import { defineEvent, createRateLimiter } from "@ix-xs/djs-bot";

/** Un gain d'XP par utilisateur et par minute. */
const limiter = createRateLimiter({ limit: 1, window: "60s" });

const MIN_XP = 15;
const MAX_XP = 25;

export default defineEvent("messageCreate", async (message, ctx) => {
  if (message.author.bot || !message.inGuild()) return;
  if (message.content.length < 5) return;
  if (!limiter.consume(`${message.guildId}:${message.author.id}`).allowed) return;

  const amount = MIN_XP + Math.floor(Math.random() * (MAX_XP - MIN_XP + 1));
  const { profile, levelledUp } = await ctx.services.levels.addXp(
    message.guildId,
    message.author.id,
    amount,
  );

  if (levelledUp) {
    await message.channel
      .send(`🎉 ${message.author} reached **level ${profile.level}**!`)
      .catch(() => undefined);
  }
});
```

:::caution[Intent privilégié]
`messageCreate` avec un contenu lisible a besoin du **Message Content Intent**,
activé dans le Developer Portal sous **Bot -> Privileged Gateway Intents**.
Avec `intents: "auto"`, le framework le demande pour vous, mais Discord doit encore
l'autoriser.
:::

## `/rank`

```ts title="features/levels/rank.command.ts"
import { defineCommand, s, inGuild, assets, EmbedBuilder, Colors } from "@ix-xs/djs-bot";
import { xpForLevel } from "./levels.service.js";

const BAR_WIDTH = 20;

export default defineCommand({
  name: "rank",
  description: "Show your level and XP",
  guards: [inGuild()],
  options: {
    user: s.user({ description: "Someone else" }),
  },

  async run(ctx) {
    const target = ctx.options.user ?? ctx.user;
    const profile = await ctx.services.levels.get(ctx.guildId!, target.id);
    const position = await ctx.services.levels.rank(ctx.guildId!, target.id);

    const floor = xpForLevel(profile.level);
    const ceiling = xpForLevel(profile.level + 1);
    const progress = (profile.xp - floor) / (ceiling - floor);
    const filled = Math.round(progress * BAR_WIDTH);
    const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);

    return ctx.reply({
      embeds: [
        new EmbedBuilder()
          .setAuthor({ name: target.tag, iconURL: assets.avatar(target, { size: 128 }) })
          .setColor(Colors.Blurple)
          .setDescription(`\`${bar}\` ${Math.round(progress * 100)}%`)
          .addFields(
            { name: "Level", value: `${profile.level}`, inline: true },
            { name: "XP", value: `${profile.xp - floor} / ${ceiling - floor}`, inline: true },
            { name: "Rank", value: `#${position}`, inline: true },
          ),
      ],
    });
  },
});
```

## `/leaderboard`

```ts title="features/levels/leaderboard.command.ts"
import { defineCommand, inGuild, paginate, EmbedBuilder, Colors } from "@ix-xs/djs-bot";

const PER_PAGE = 10;
const MEDALS = ["🥇", "🥈", "🥉"];

export default defineCommand({
  name: "leaderboard",
  description: "The most active members",
  guards: [inGuild()],

  async run(ctx) {
    const board = await ctx.services.levels.top(ctx.guildId!, 100);
    if (board.length === 0) return ctx.reply.info("Nobody has earned XP yet.");

    const pageCount = Math.ceil(board.length / PER_PAGE);

    await paginate(ctx, {
      count: pageCount,
      timeout: "3m",
      pages: (index) => {
        const slice = board.slice(index * PER_PAGE, index * PER_PAGE + PER_PAGE);
        return new EmbedBuilder()
          .setTitle(`Leaderboard - ${ctx.guild!.name}`)
          .setColor(Colors.Gold)
          .setDescription(
            slice
              .map((row, i) => {
                const rank = index * PER_PAGE + i + 1;
                const badge = MEDALS[rank - 1] ?? `**${rank}.**`;
                return `${badge} <@${row.userId}> - level ${row.profile.level} (${row.profile.xp} XP)`;
              })
              .join("\n"),
          )
          .setFooter({ text: `${board.length} ranked members` });
      },
    });
  },
});
```

Les pages sont construites **à la demande** à partir de leur index : un classement de
100 membres ne construit donc jamais 10 embeds d'avance.

## Une tâche de réinitialisation hebdomadaire

```ts title="features/levels/reset.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "levels:weekly-summary",
  schedule: "0 12 * * 1",        // tous les lundis à midi
  timezone: "Europe/Paris",

  async run(ctx) {
    for (const guild of ctx.client.guilds.cache.values()) {
      const board = await ctx.services.levels.top(guild.id, 3);
      if (board.length === 0) continue;

      ctx.logger.info(
        { guildId: guild.id, top: board.map((row) => row.userId) },
        "weekly levelling summary",
      );
    }
  },
});
```

## Les regrouper

```ts title="features/levels/levels.feature.ts"
import { defineFeature } from "@ix-xs/djs-bot";
import LevelsService from "./levels.service.js";
import MessageEvent from "./message.event.js";
import RankCommand from "./rank.command.js";
import LeaderboardCommand from "./leaderboard.command.js";
import ResetJob from "./reset.job.js";

export default defineFeature({
  name: "levels",
  requires: ["store"],
  services: [LevelsService],
  events: [MessageEvent],
  commands: [RankCommand, LeaderboardCommand],
  jobs: [ResetJob],
});
```

Le lot est facultatif : chaque fichier ci-dessus porte déjà un suffixe que le chargeur
découvre. Ce qu'il ajoute, c'est le contrat `requires: ["store"]`, vérifié au démarrage.
Lister une définition ici alors que son fichier est aussi découvert ne pose pas de
problème : le même objet n'est enregistré qu'une fois.

## Notes sur le passage à l'échelle

- **Les clés se multiplient.** `top()` lit chaque profil d'un serveur. Au-delà de quelques
  milliers de membres par serveur, passez à une vraie base de données avec un index sur
  `xp` et gardez la même interface de service, pour que rien d'autre ne change.
- **Sharding.** Le cache en processus est propre à chaque shard : chaque shard garde donc sa
  propre copie du classement. C'est acceptable pour un TTL de 60 secondes. L'état partagé
  doit vivre dans le store, pas dans le cache.
- **Atomique au sein d'un processus.** `update()` sérialise les écritures par clé à
  l'intérieur d'un seul processus. Des shards qui partagent un backend ont besoin de
  l'opération atomique propre à ce backend ; ici, chaque membre ne parle jamais qu'à un seul
  shard, donc cela tient.
