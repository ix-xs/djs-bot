---
title: "Installation"
description: "djs-bot is a TypeScript framework on top of discord.js: one file per command, button, event or job, typed options and params, intents and deployment worked out for you."
---

```bash
npm install @ix-xs/djs-bot discord.js
npm install -D tsx typescript @types/node
```

| Requirement | |
| --- | --- |
| Node.js | 22.23.4 or later on 22, 24.22.1 or later on 24, 26.12.1 or later. Node.js 23 and 25 are not supported |
| discord.js | 14.27 or later on 14, installed by you (peer dependency) |
| Modules | ES modules and CommonJS. Three entry points: `@ix-xs/djs-bot`, `@ix-xs/djs-bot/plugins`, `@ix-xs/djs-bot/testing` |
| TypeScript | Declarations included. `tsx` runs `.ts` files without a build step; it is optional |
| Dependencies | One: `@ix-xs/node-comfort` 3.0 |

Older versions of Node.js have a flaw in `fetch()` that lets a remote server stop the process.

| Package | Role |
| --- | --- |
| `@ix-xs/djs-bot` | The framework and the `djs-bot` command |
| `discord.js` | The Discord client the framework drives |
| `tsx` | Runs the TypeScript entry under `dev` and `start` (development only) |
| `typescript`, `@types/node` | Type checking (development only) |

## Starter project

```bash
npx djs-bot init     # src/index.ts, a /ping command, tsconfig.json, .env, scripts
npx djs-bot doctor   # checks the environment and the bot, once .env is filled in
npx djs-bot dev      # runs the bot, restarts on save, deploys to the test server
```

`init` never overwrites a file. What it creates and how it edits `package.json`: [CLI](/api/cli/#init).

```ts title="src/features/ping/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply.success(`Pong! ${Math.round(ctx.client.ws.ping)} ms`),
});
```

The file is found by its suffix, registered with Discord and routed: there is no list of commands to maintain. In JavaScript, drop the type annotations; the rest is identical.

## Discord application

Created once, in the [Developer Portal](https://discord.com/developers/applications).

| Value or setting | Where | Goes to |
| --- | --- | --- |
| Token | Bot > Reset Token. Shown once; anyone who has it controls the bot | `DISCORD_TOKEN` |
| Application ID | General Information. Public | `DISCORD_CLIENT_ID` |
| Test server ID | Discord: User Settings > Advanced > Developer Mode, then right-click the server > Copy Server ID | `DISCORD_DEV_GUILD` |
| Privileged intents | Bot > Privileged Gateway Intents: Server Members, Message Content, Presence. Only the ones your code needs: `doctor` and the startup log name them | [Events and intents](/events/events-and-intents/#privileged-intents) |
| Invite URL | OAuth2 > URL Generator: scopes `bot` **and** `applications.commands`, then the permissions the bot uses | Without `applications.commands`, no command ever shows |

The three variables go in `.env`, which the framework reads at startup: [Configuration](/basics/configuration/#environment-variables).

## What it covers

| Area | Pages |
| --- | --- |
| Configuration | [`defineBot()` and the environment](/basics/configuration/) |
| Basics | [Project layout](/basics/project-layout/), [lifecycle](/basics/lifecycle/), [`ctx`](/basics/context/), [deferral](/basics/automatic-deferral/), [wording](/basics/wording-and-theme/), [errors](/api/errors/) |
| Commands | [Slash commands](/commands/slash-commands/), [options](/commands/options/), [subcommands](/commands/subcommands/), [context menus](/commands/context-menus/), [guards](/commands/guards/), [install contexts](/commands/install-contexts/) |
| Components | [Buttons](/components/buttons/), [select menus](/components/select-menus/), [modals](/components/modals/), [Components V2](/components/components-v2/), [pagination](/components/pagination/) |
| Messages | [Embeds and attachments](/messages/embeds-and-attachments/), [formatting](/messages/formatting/), [assets and voice](/messages/assets-and-voice/) |
| Events | [Events and intents](/events/events-and-intents/), [triggers](/events/triggers/), [jobs](/events/jobs/) |
| Architecture | [Services](/architecture/services/), [plugins](/architecture/plugins/), [features](/architecture/features/) |
| Data | [Store](/data/store/), [cache](/data/cache/), [i18n](/data/i18n/), [flags](/data/flags/), [audit](/data/audit/) |
| Production | [Deploying](/production/deploying/), [hosting](/production/hosting/), [logging](/production/logging/), [health](/production/health/), [presence](/production/presence/), [resilience](/production/resilience/), [sharding](/production/sharding/) |
| Tooling | [CLI](/api/cli/), [testing](/production/testing/) |

Every export is listed in [All exports](/api/exports/) and has its own page in the [reference](/reference/).
