---
title: "Quick start"
description: "From an empty folder to a bot that answers a slash command, in about five minutes, for readers who already know Node."
sidebar:
  order: 2
---

This page is the short path. If you have never created a Discord application
or invited a bot, follow the [tutorial](/tutorial/what-you-need/) instead: it
covers the Discord side too and assumes nothing.

You need:

| | |
| --- | --- |
| Node | 22.13 or newer (`node -v`) |
| A Discord application | Created at [discord.com/developers](https://discord.com/developers/applications) |
| Its bot token and application id | From the **Bot** and **General Information** pages |
| A test server | With the bot invited using the `bot` and `applications.commands` scopes |

## Install

```bash
mkdir my-bot && cd my-bot
npm install @ix-xs/djs-bot discord.js
npm install -D tsx typescript @types/node
```

`tsx` lets the CLI run your TypeScript directly, with no build step while you
develop. The framework also works in plain JavaScript, CommonJS or ESM, and
ships its type declarations, so editors autocomplete either way. This page uses
TypeScript.

## Create the project

```bash
npx djs-bot init
```

This writes the entry file `src/index.ts`, a first command, `tsconfig.json`,
`.env` and `.gitignore`, and adds the run scripts and `"type": "module"` to
your `package.json`. Nothing you already have is overwritten. The full list is
in the [CLI reference](/api/cli/#init). How the files are organised is covered
in [Project layout](/basics/project-layout/), and what the entry file sets in
[Configuration](/basics/configuration/).

## Fill in `.env`

```bash title=".env"
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-id
DISCORD_DEV_GUILD=your-test-server-id
```

`DISCORD_DEV_GUILD` is what makes commands appear at once while you build.
Without it they are deployed globally and can take up to an hour to show.

:::caution[Keep the token out of git]
Anyone who holds the token controls your bot. The generated `.gitignore`
already lists `.env`. Keep it that way.
:::

## Run it

```bash
npx djs-bot dev
```

The bot comes online, its commands are deployed to your test server, and the
process restarts each time you save a file. Type `/ping` in the server.

If the command does not show up, run the checks, then see
[Troubleshooting](/help/troubleshooting/):

```bash
npx djs-bot doctor            # token, ids, .gitignore, intents, and whether the bot loads
npx djs-bot explain           # everything that is loaded, and the deployment plan
```

## Your first command

`init` created this one. A command is a file that ends in `.command.ts` and
exports a definition. There is no list to register it in.

```ts title="src/features/ping/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply.success(`Pong! 🏓 ${Math.round(ctx.client.ws.ping)} ms`),
});
```

Add a second one next to it, with options this time. Save the file: `dev`
restarts and `/greet` appears in the server.

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
    // ctx.options.user is a User, never undefined, because of required: true.
    // ctx.options.loudly is boolean | undefined.
    const message = `Hello ${ctx.options.user}!`;
    return ctx.reply(ctx.options.loudly ? message.toUpperCase() : message);
  },
});
```

The options you declare are the options you get: `ctx.options` is typed from
the definition, with no casts.

## What to read next

| You want | Go to |
| --- | --- |
| A guided path from zero to a deployed bot | [Tutorial](/tutorial/what-you-need/) |
| More about commands and their options | [Slash commands](/commands/slash-commands/), [Options and autocomplete](/commands/options/) |
| What `ctx` gives you in a handler | [The ctx object](/basics/context/) |
| Buttons, menus and forms | [Buttons](/components/buttons/) |
| To put the commands online for everyone | [Deploying commands](/production/deploying/) |
| A finished feature to copy | [Recipes](/recipes/moderation/) |
| To fix something that is broken | [Troubleshooting](/help/troubleshooting/) |
| A word you do not recognise | [Glossary](/help/glossary/) |
