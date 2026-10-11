import { defineBot, env } from "../../src/index.js";
import { requestLogger } from "./plugins/request-logger.js";

/**
 * The whole bot. `features` is auto-discovered, intents are derived from your
 * events, and commands are deployed to your dev guild on start.
 *
 *   npx djs-bot dev examples/minimal/bot.ts
 */
const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  intents: "auto",
  plugins: [requestLogger],
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
  // A handler that has not answered after 2 s is acknowledged for you.
  defaults: { defer: true },
  logger: { level: "debug" },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
