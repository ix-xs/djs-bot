---
title: Getting started
description: Install djs-bot and run your first command in minutes.
sidebar:
  order: 0
---

## Install

```bash
npm install @ix-xs/djs-bot discord.js
# optional, only to run raw .ts in dev:
npm install -D tsx typescript
```

Scaffold a starter:

```bash
npx djs-bot init
```

Works the same in **TypeScript** and **plain JavaScript** (CommonJS or ESM) - the
package ships full `.d.ts` declarations, so JS editors get autocomplete too.

## Your first bot

Create `.env` with your token (and a dev guild for instant deploys):

```bash
DISCORD_TOKEN=your-bot-token
DISCORD_DEV_GUILD=your-dev-guild-id
```

`src/index.ts`:

```ts
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  intents: "auto",
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
});

export default bot;
if (!process.env.DJSBOT_CLI) void bot.start();
```

`src/features/ping/ping.command.ts`:

```ts
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply.success("Pong! 🏓"),
});
```

## Run it

```bash
npx djs-bot dev        # watch + instant guild deploy
npx djs-bot explain    # see everything that's loaded
npx djs-bot doctor     # diagnose config, intents, permissions
```

Continue with the [Guide](/djs-bot/guide/basics/install-project-layout/) for the
full tour - commands, components, events, deployment, and production features.
