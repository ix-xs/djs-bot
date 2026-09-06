---
title: Quick start
description: Install djs-bot and run your first command in a few minutes.
sidebar:
  order: 0
---

A working bot in five steps. If you have never created a Discord application
before, take the [tutorial](/djs-bot/tutorial/what-you-need/) instead: it covers
the Discord side too, with screenshots and no assumed knowledge.

## Requirements

| | |
| --- | --- |
| Node | **22 or newer** (`node -v`) |
| A Discord application | Created at [discord.com/developers](https://discord.com/developers/applications) |
| Your token and client id | From the **Bot** and **General Information** pages |

## 1. Install

```bash
npm install @ix-xs/djs-bot discord.js
```

Optional, to run raw TypeScript in development with no build step:

```bash
npm install -D tsx typescript
```

Or let the CLI create everything for you in an empty directory:

```bash
npx djs-bot init
```

It works the same in **TypeScript** and **plain JavaScript**, CommonJS or ESM.
The package ships full `.d.ts` declarations, so JavaScript editors get
autocomplete too.

## 2. Add your credentials

Create a `.env` file next to your `package.json`:

```bash title=".env"
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-id
DISCORD_DEV_GUILD=your-test-server-id
```

`DISCORD_DEV_GUILD` is what makes commands appear **instantly** while you build,
instead of taking up to an hour to propagate globally.

:::danger
Add `.env` to `.gitignore`. Anyone holding your token controls your bot.
:::

## 3. The entry file

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env("DISCORD_CLIENT_ID"),
  features: `${import.meta.dirname}/features`,
  intents: "auto",
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
});

export default bot;
if (!process.env.DJSBOT_CLI) void bot.start();
```

Three things are happening:

- `env()` throws a readable error if a variable is missing, instead of handing
  you `undefined`.
- `features` points at a directory the loader walks, so you never register
  anything by hand.
- `intents: "auto"` computes the minimum gateway intents from what you actually
  registered.

The `DJSBOT_CLI` line lets `deploy`, `doctor` and `explain` import the file
without connecting to Discord.

## 4. Your first command

```ts title="src/features/ping/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply.success("Pong! 🏓"),
});
```

One with a typed option, to show the point of the whole thing:

```ts title="src/features/greet/greet.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "greet",
  description: "Say hello to someone",
  options: {
    user: s.user({ description: "Who to greet", required: true }),
    loudly: s.boolean({ description: "Shout it" }),
  },
  run(ctx) {
    const message = `Hello ${ctx.options.user}!`;
    //    ctx.options.user   is a User, never undefined, because required: true
    //    ctx.options.loudly is boolean | undefined
    return ctx.reply(ctx.options.loudly ? message.toUpperCase() : message);
  },
});
```

## 5. Run it

```bash
npx djs-bot dev
```

Your commands deploy to your dev guild and the bot comes online. Edit a file and
it reloads.

Three more commands worth knowing on day one:

```bash
npx djs-bot explain           # everything loaded, and the deployment plan
npx djs-bot doctor            # token, intents, permissions, contracts
npx djs-bot deploy --dry-run  # what a real deploy would change
```

:::tip[Command not showing up?]
Invite the bot with **both** the `bot` and `applications.commands` scopes, and
check [Troubleshooting](/djs-bot/help/troubleshooting/#commands) for the other
four common causes.
:::

## Where to go next

| You want | Go to |
| --- | --- |
| A guided path from zero to a deployed bot | [Tutorial](/djs-bot/tutorial/what-you-need/) |
| To learn one topic properly | [Guides](/djs-bot/guide/basics/install-project-layout/) |
| Exact signatures and every option | [API reference](/djs-bot/api/overview/) |
| A finished feature to copy | [Recipes](/djs-bot/recipes/moderation/) |
| To fix something that is broken | [Troubleshooting](/djs-bot/help/troubleshooting/) |
| A word you do not recognise | [Glossary](/djs-bot/help/glossary/) |
