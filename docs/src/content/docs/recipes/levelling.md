---
title: "Levelling and a leaderboard"
description: "XP from messages with a cooldown, a rank card, a paginated leaderboard and a nightly job."
sidebar:
  order: 4
---

A levelling system touches almost every part of the framework: an event, a
service, the store, a cache, pagination and a scheduled job. It is the best
single example of how the pieces fit.

## The service

```ts title="features/levels/levels.service.ts"
import { defineService, createCache, type KVStore } from "@ix-xs/djs-bot";

export interface Profile {
  xp: number;
  level: number;
  messages: number;
}

const EMPTY: Profile = { xp: 0, level: 0, messages: 0 };

/** Total XP needed to reach a level. Quadratic, so levels slow down sensibly. */
export const xpForLevel = (level: number): number => 5 * level * level + 50 * level + 100;

export class Levels {
  private readonly ns: KVStore<Profile>;
  /** The leaderboard is expensive to build, so it is cached briefly. */
  private readonly board = createCache<string, Array<{ userId: string; profile: Profile }>>({
    ttl: "60s",
    staleWhileRevalidate: true,
  });

  constructor(store: KVStore) {
    this.ns = store.namespace<Profile>("levels");
  }

  private key(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
  }

  async get(guildId: string, userId: string): Promise<Profile> {
    return (await this.ns.get(this.key(guildId, userId))) ?? EMPTY;
  }

  /** Adds XP and returns the new profile plus whether the member levelled up. */
  async addXp(guildId: string, userId: string, amount: number): Promise<{ profile: Profile; levelledUp: boolean }> {
    const current = await this.get(guildId, userId);
    const xp = current.xp + amount;

    let level = current.level;
    while (xp >= xpForLevel(level + 1)) level += 1;

    const profile: Profile = { xp, level, messages: current.messages + 1 };
    await this.ns.set(this.key(guildId, userId), profile);

    return { profile, levelledUp: level > current.level };
  }

  async top(guildId: string, limit = 100): Promise<Array<{ userId: string; profile: Profile }>> {
    return this.board.getOrFetch(guildId, async () => {
      const keys = (await this.ns.keys()).filter((key) => key.startsWith(`${guildId}:`));
      const rows = await Promise.all(
        keys.map(async (key) => ({
          userId: key.slice(guildId.length + 1),
          profile: (await this.ns.get(key)) ?? EMPTY,
        })),
      );
      return rows.sort((a, b) => b.profile.xp - a.profile.xp).slice(0, limit);
    });
  }

  async rank(guildId: string, userId: string): Promise<number> {
    const board = await this.top(guildId, 1000);
    const index = board.findIndex((row) => row.userId === userId);
    return index === -1 ? board.length + 1 : index + 1;
  }
}

export default defineService("levels", {
  deps: ["store"],
  factory: ({ store }) => new Levels(store as KVStore),
});
```

```ts title="src/types.d.ts"
import type { Levels } from "./features/levels/levels.service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap { levels: Levels }
}
```

The `staleWhileRevalidate` cache is the important trick: rebuilding a
leaderboard reads every key, so serving a value up to a minute old costs
nothing and keeps `/leaderboard` instant.

## Earning XP

A per-user cooldown stops someone farming XP by spamming.

```ts title="features/levels/message.event.ts"
import { defineEvent, createRateLimiter } from "@ix-xs/djs-bot";

/** One XP grant per user per minute. */
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

:::caution[Privileged intent]
`messageCreate` with readable content needs the **Message Content Intent**,
enabled in the Developer Portal under **Bot -> Privileged Gateway Intents**.
With `intents: "auto"` the framework requests it for you, but Discord still has
to allow it.
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

Pages are built **lazily** by index, so a 100-member board never builds 10
embeds up front.

## A weekly reset job

```ts title="features/levels/reset.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "levels:weekly-summary",
  schedule: "0 12 * * 1",        // every Monday at noon
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

## Bundling it

```ts title="features/levels/index.ts"
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

## Scaling notes

- **Keys grow.** `top()` reads every key in the namespace. Past a few thousand
  members, move to a real database with an index on `xp` and keep the same
  service interface, so nothing else changes.
- **Sharding.** The in-process cache is per shard, so each shard keeps its own
  copy of the board. That is fine for a 60 second TTL. Shared state must live in
  the store, not in the cache.
- **A store is not a transaction.** Two messages arriving in the same
  millisecond can race on `addXp`. The per-user rate limiter makes that
  essentially impossible here, but a busier counter deserves a real database.
