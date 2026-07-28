/**
 * A production-shaped bot wiring the full stack together:
 * sharding, health checks, a durable store, audit trail, per-guild feature
 * flags, i18n, and a rotating presence.
 *
 *   Build & run:  npm run build && node dist/bot.js
 *   Deploy once:  npx djs-bot deploy --global
 */
import { defineBot, env, sqliteStore, memoryAuditSink, loggerAuditSink, createLogger, ActivityType } from "@ix-xs/djs-bot";

const store = sqliteStore("data/bot.sqlite");
const logger = createLogger({ level: "info", pretty: process.env.NODE_ENV !== "production" });

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env.optional("DISCORD_CLIENT_ID"),
  features: `${import.meta.dirname}/features`,
  intents: "auto",

  // Scale out across shards in production.
  sharding: env.optional("SHARDING") === "true" ? "auto" : undefined,

  // Durable persistence, reused by flags + audit.
  store,
  flags: { store, defaults: { economy: true } },
  audit: { sinks: [loggerAuditSink(logger), { record: (e) => void store.namespace("audit").set(e.id, e) }], autoRecordCommands: true },

  // Translate replies per user locale.
  i18n: {
    defaultLocale: "en",
    resources: {
      en: { economy: { balance: "You have {n} coins.", claimed: "Claimed {n} coins!" } },
      fr: { economy: { balance: "Vous avez {n} pièces.", claimed: "Vous avez reçu {n} pièces !" } },
    },
  },

  // Ops.
  health: Number(env.optional("HEALTH_PORT") ?? 3000),
  presenceRotation: {
    interval: "1m",
    items: [
      { activities: [{ name: "/balance", type: ActivityType.Listening }] },
      { activities: [{ name: "the economy", type: ActivityType.Watching }] },
    ],
  },

  deploy: { mode: env.optional("NODE_ENV") === "production" ? "global" : "guild", devGuildId: env.optional("DISCORD_DEV_GUILD") },
  onError: (err, ctx) => {
    logger.error({ err }, "unhandled interaction error");
    return ctx?.reply.error("Something went wrong — we're on it.");
  },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
