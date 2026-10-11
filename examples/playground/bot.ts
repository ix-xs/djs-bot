/**
 * The playground: one bot that exercises every part of the framework, and
 * checks itself as you click.
 *
 *   npm run playground          (same as: npx djs-bot dev examples/playground/bot.ts)
 *
 * Then, in your test server, run `/selftest` and follow the buttons. Each step
 * verifies what it received and answers with a checklist, and the terminal logs
 * one `selftest` line per step.
 *
 * It needs DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_DEV_GUILD (in `.env`).
 */
import { defineBot, env, loggerAuditSink, memoryStore } from "../../src/index.js";
import { commandLogger } from "../../src/plugins/index.js";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env.optional("DISCORD_CLIENT_ID"),
  owners: env.list("OWNER_IDS"),
  features: `${import.meta.dirname}/features`,
  intents: "auto",
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },

  // A handler still working after 2 s is acknowledged for you.
  defaults: { defer: true },

  // What the framework itself says, reworded: try /selftest cooldown twice.
  messages: {
    cooldown: "⏳ Patiente encore {seconds}s (message personnalisé via `messages`).",
    confirm: "Oui",
    cancel: "Non",
  },
  theme: { success: 0x57f287, error: 0xed4245, info: 0x5865f2, warn: 0xfee75c },

  store: memoryStore(),
  audit: { sinks: [loggerAuditSink()] },
  plugins: [commandLogger()],
  logger: { level: "info" },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
