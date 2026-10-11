/**
 * A production-shaped bot wiring the full stack together:
 * sharding, health checks, a durable store, audit trail, per-guild feature
 * flags, i18n, and a rotating presence.
 *
 *   Build & run:  npm run build && node dist/bot.js
 *   Deploy once:  npx djs-bot deploy --global
 */
import { defineBot, env, sqliteStore, storeAuditSink, loggerAuditSink, createLogger, ActivityType } from "@ix-xs/djs-bot";

const store = sqliteStore("data/bot.sqlite");
const logger = createLogger({ level: "info", pretty: process.env.NODE_ENV !== "production" });

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env.optional("DISCORD_CLIENT_ID"),
  features: `${import.meta.dirname}/features`,
  owners: env.list("OWNER_IDS"),
  intents: "auto",

  // Never miss Discord's 3 second window, and never let the bot mass-ping.
  defaults: { defer: true },
  client: { allowedMentions: { parse: ["users"], repliedUser: true } },

  // Scale out across shards in production.
  sharding: env.boolean("SHARDING") ? "auto" : undefined,

  // Durable persistence, reused by flags + audit.
  store,
  flags: { defaults: { economy: true } },
  audit: { sinks: [loggerAuditSink(logger), storeAuditSink(store, { ttl: "90d" })], autoRecordCommands: true },

  // Translate replies per user locale.
  i18n: {
    defaultLocale: "en",
    resources: {
      en: { economy: { balance: "You have {n} coins.", claimed: "Claimed {n} coins!" } },
      fr: { economy: { balance: "Vous avez {n} pièces.", claimed: "Vous avez reçu {n} pièces !" } },
    },
  },

  // What the framework itself says, in the user's language when we have it.
  messages: {
    cooldown: ({ seconds }, ctx) =>
      ctx?.locale.startsWith("fr") ? `Patiente ${seconds}s.` : `Please wait ${seconds}s.`,
  },

  // Ops: /healthz, /readyz, /metrics (JSON or ?format=prometheus).
  health: env.number("HEALTH_PORT", 3000),
  presenceRotation: {
    interval: "1m",
    items: [
      { activities: [{ name: "/balance", type: ActivityType.Listening }] },
      { activities: [{ name: "the economy", type: ActivityType.Watching }] },
    ],
  },

  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
  onError: (err, ctx) => {
    logger.error({ err }, "unhandled interaction error");
    return ctx?.reply.error("Something went wrong - we're on it.");
  },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
