import {
  defineCommand,
  subcommand,
  s,
  inGuild,
  featureEnabled,
  rateLimit,
  paginate,
} from "@ix-xs/djs-bot";
import { EmbedBuilder } from "discord.js";
import type { KVStore } from "@ix-xs/djs-bot";

/** Balances live in their own namespace, away from flags and audit entries. */
const coins = (store: KVStore): KVStore<number> => store.namespace<number>("coins");

/**
 * A feature that combines everything: a per-guild feature flag, a rate limit,
 * a persistent store with an atomic counter, i18n replies, an audit entry, and
 * pagination.
 *
 *   /economy balance
 *   /economy daily
 *   /economy leaderboard
 */
export default defineCommand({
  name: "economy",
  description: "Coins & rewards",
  guards: [inGuild(), featureEnabled("economy")],
  subcommands: {
    balance: subcommand({
      description: "Check your balance",
      run: async (ctx) => {
        const n = (await coins(ctx.services.store).get(ctx.user.id)) ?? 0;
        await ctx.reply.info(ctx.t("economy.balance", { n }));
      },
    }),
    daily: subcommand({
      description: "Claim your daily coins",
      guards: [rateLimit({ limit: 1, window: "24h" })],
      run: async (ctx) => {
        // increment() cannot lose an update, even if two claims race.
        const balance = await coins(ctx.services.store).increment(ctx.user.id, 100);
        await ctx.audit("economy.daily", { metadata: { balance } });
        await ctx.reply.success(ctx.t("economy.claimed", { n: 100 }));
      },
    }),
    leaderboard: subcommand({
      description: "Top balances",
      run: async (ctx) => {
        // entries() reads the whole namespace at once.
        const rows = (await coins(ctx.services.store).entries())
          .map(([id, n]) => ({ id, n }))
          .sort((a, b) => b.n - a.n);
        const pageSize = 10;
        const pages: EmbedBuilder[] = [];
        for (let i = 0; i < Math.max(rows.length, 1); i += pageSize) {
          const slice = rows.slice(i, i + pageSize);
          pages.push(
            new EmbedBuilder()
              .setTitle("🏆 Leaderboard")
              .setDescription(slice.map((r, j) => `**${i + j + 1}.** <@${r.id}> - ${r.n}`).join("\n") || "No data yet"),
          );
        }
        await paginate(ctx, { pages, timeout: "3m" });
      },
    }),
  },
});
