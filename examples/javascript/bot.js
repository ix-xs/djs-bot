// A complete bot in plain CommonJS JavaScript — no build step, no TypeScript.
// You still get full editor autocomplete & type hints from the shipped types.
//
//   node bot.js            (or)  npx djs-bot dev bot.js
const { defineBot, env } = require("@ix-xs/djs-bot");

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${__dirname}/features`, // CommonJS __dirname
  intents: "auto",
  deploy: { mode: "guild", devGuildId: env.optional("DISCORD_DEV_GUILD") },
});

module.exports = bot;

// Start only when run directly (the CLI imports this file for tooling).
if (!process.env.DJSBOT_CLI) bot.start();
