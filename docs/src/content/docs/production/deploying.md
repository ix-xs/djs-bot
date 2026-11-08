---
title: "Deploying commands"
description: "How your slash commands and context menus reach Discord: the global and guild scopes, the deploy that only writes what changed, the development mirror, and how commands are removed."
sidebar:
  order: 1
---

Discord only shows a command once it has been registered through its HTTP API.
That step is called deploying. The framework builds the list from your
definitions, compares it with what Discord already holds, and writes only when
something differs. Your code is the source of truth: you never register or
delete a command by hand.

## A first deploy

Give the bot a test server, and it deploys there by itself each time it starts
in development.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env.optional("DISCORD_CLIENT_ID"),
  features: `${import.meta.dirname}/features`,
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

```bash
npx djs-bot dev      # development: every command appears in the dev guild at once
npx djs-bot deploy   # release: registers the commands for real
```

`devGuildId` falls back to the `DISCORD_DEV_GUILD` variable, so the `deploy`
line can be left out when that variable is set.

## Global and guild scopes

A command lives in one of two scopes, and the scope decides who sees it and how
fast a change shows up.

| Scope | Visible in | A change shows up |
| --- | --- | --- |
| Global | Every server the bot is in (and DMs, depending on its contexts) | Within about an hour |
| Guild | One server | At once |

A command is global by default. Add `guilds` to deploy it only to the servers
you list: an admin command for your support server, a feature sold to a few
communities.

```ts title="src/features/admin/announce.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "announce",
  description: "Post an announcement",
  // Only these two servers get the command.
  guilds: ["123456789012345678", "234567890123456789"],
  run: (ctx) => ctx.reply.success("Announced."),
});
```

`guilds` exists on `defineCommand`, `defineUserCommand` and
`defineMessageCommand`. You can mix global and scoped commands freely. An empty
array counts as no `guilds`: the command is global.

`npx djs-bot explain` prints the resulting plan without touching Discord:

```
Deployment plan
  global: help, ping
  guild 123456789012345678: announce
  guild 234567890123456789: announce
```

## What a deploy changes

A deploy handles each scope on its own: the global scope first, then every
guild named by a command. For each one it fetches the commands Discord holds,
compares them with your definitions, and sorts every command into one of four
lists.

| Mark | Result field | Meaning |
| --- | --- | --- |
| `+` | `added` | In your code, not on Discord yet |
| `~` | `changed` | On both sides, with a different definition |
| `-` | `removed` | On Discord, no longer in your code |
| | `unchanged` | Identical on both sides |

If the first three lists are empty, the scope is left alone: no request is
sent, so no rate limit is spent. Otherwise the whole command list of that scope
is replaced in one request. Running a deploy twice in a row writes nothing the
second time.

A few details make the comparison reliable:

- Discord adds bookkeeping fields and fills in defaults. Both sides are
  normalised first (empty values dropped, lists and localisation maps ordered),
  so those never count as a change.
- Options are compared in depth: subcommands, groups, choices, value ranges,
  channel types, file types and autocomplete are all part of it. So are
  localisations, `defaultMemberPermissions` and `nsfw`.
- `dmPermission`, `integrationTypes` and `contexts` are compared only when your
  definition sets them, because Discord picks a default that depends on how the
  app is installed. In a guild scope they are ignored: Discord accepts them on a
  guild command and then drops them.
- A command is identified by its type and its name. A slash command and a
  context menu may share a name, and renaming a command is one removal plus one
  addition.

To see the lists without writing anything, ask for a dry run:

```bash
npx djs-bot deploy --dry-run
```

`npx djs-bot deploy --guild <id>` ignores the plan and puts every command on
that one guild, which is the fastest way to try a release on a server you
control. Both flags are described on the [CLI](/api/cli/) page.

## Development and production

When the bot becomes ready it can deploy by itself. `deploy.autoDeploy`
decides, and defaults to `true` unless `NODE_ENV` is `production`.
`djs-bot dev` sets `NODE_ENV=development` and `djs-bot start` sets
`NODE_ENV=production`.

| `NODE_ENV` | Dev guild set | At startup |
| --- | --- | --- |
| not `production` | yes | Every command goes to the dev guild, whatever its `guilds` |
| not `production` | no | The real plan is deployed: global commands globally, scoped ones to their guilds |
| `production` | either | Nothing, unless `autoDeploy: true`, which deploys the real plan |

The first row is the development mirror. It exists because a global command can
take an hour to show up, and nobody wants to wait that long to test a renamed
option. The mirror goes through the same comparison, so restarting without
touching a command writes nothing.

The automatic deploy is forgiving: a failure is logged as `Auto-deploy failed`
and the bot keeps running, and when no client id is configured it uses the id of
the application it is logged in as. On a [sharded](/production/sharding/) bot
only shard 0 does it.

:::caution[Every command twice in your dev guild?]
The mirror creates guild commands. If you also deployed globally, your dev
guild holds both copies and shows each command twice. That is expected. Remove
the mirror with `npx djs-bot clear --guild <id>`. `djs-bot deploy` reminds you
of it when a dev guild is configured.
:::

In production, deploy once per release instead of at every start:

```bash
npx djs-bot deploy
```

It needs `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` (or `token` and `clientId` in
`defineBot`), and it never connects to the gateway, so it is safe to run from a
CI job. Running `npx djs-bot deploy --dry-run` on each pull request shows what
a merge would change. The [Hosting](/recipes/hosting/) recipe has a complete
pipeline.

The same thing from your own script:

```ts title="scripts/deploy.ts"
// Keep the entry file from starting the bot when it is imported.
process.env.DJSBOT_CLI = "introspect";
const { default: bot } = await import("../src/index.js");

const result = await bot.deploy({ dryRun: process.argv.includes("--dry-run") });

for (const target of result.targets) {
  const where = target.scope === "global" ? "global" : `guild ${target.guildId}`;
  console.log(where, { added: target.added, changed: target.changed, removed: target.removed });
}
```

## Removing commands

Delete the file (or the definition) and deploy again: the command ends up in
`removed` and disappears from Discord. Editing works the same way. There is
nothing to delete by hand.

One case needs memory: a guild that no command targets any more. It is absent
from the plan, so nothing would visit it. `bot.deploy()` and `djs-bot deploy`
therefore write the guilds they deployed to in `.djs-bot/deploy-state.json`, and
on the next deploy they empty the guilds that left the plan.

:::caution[The state file is local]
`.djs-bot/` is ignored by git in a project created with `djs-bot init`, and it
is read from the directory the deploy runs in. A CI runner that starts from a
clean checkout has no state file, so it cannot know which guilds to empty.
Either keep the file between runs, or clear such a guild yourself. The automatic
deploy at startup does not read or write this file at all.
:::

To wipe a scope entirely, for instance the development mirror or a server you
no longer serve:

```bash
npx djs-bot clear --guild 123456789012345678
npx djs-bot clear --global
```

```ts
await bot.clear({ guildId: "123456789012345678" });   // one guild
await bot.clear();                                     // the global commands
```

You must name the scope on the command line: there is no default, on purpose.
Clearing a guild leaves the global commands in place, and the other way round.

An Entry Point command is the one exception. Discord creates it for apps that
have Activities and refuses a write that leaves it out, so a deploy never lists
it as removed, sends it back untouched, and `clear` keeps it too.

## Reference

Every option, property and type, with what it accepts and returns, is in the API reference:

- `defineBot()`: Creates a `Bot`.
- `DeployConfig`: Deployment configuration.
- `DeployResult`: The outcome of a deploy across all targets.
- `DeployCallOptions`: Options for `Bot.deploy`.
- `DeployTargetResult`: What changed for one deploy target (global, or a specific guild).
- `deployCommands()`: Deploys commands, honouring per-command scoping: - commands with no `guilds` go **global**, - commands with `guilds` go to **those guilds**.
- `Registry`: Holds every definition and exposes typed lookups.
- `DeployOptions`: Options for `deployCommands`.
- `Logger`: Structured logger with level filtering and child bindings.
- `clearCommands()`: Removes **all** of the app's commands from one scope (a guild, or global).
- `ClearOptions`: Options for `clearCommands`.
- `planDeployment()`: Partitions the registry's commands into a global set and per-guild sets based on each command's `guilds` field.
- `DeploymentPlan`: A resolved deployment plan: which commands go global, and which go to which guild.
- `buildCommandTree()`: Builds the full desired command tree (ignoring per-command scoping).

## Limits and errors

Discord caps the number of commands in each scope. The whole plan is checked
before the first request, so a deploy over the limit is refused with
[`DJSBOT_E015`](/api/errors/#djsbot_e015) instead of being half applied.

| Limit | Value |
| --- | --- |
| Slash commands per scope | 100 |
| User context-menu commands per scope | 15 |
| Message context-menu commands per scope | 15 |
| Command creations per guild and per day | 200 |
| Global command propagation | up to about an hour |

A scope is the global list, or the list of one guild: a guild can hold 100
global slash commands plus 100 of its own. When one guild receives everything
(`--guild`, or the development mirror) all your commands count against that
guild. To stay under the limit, group related commands as
[subcommands](/commands/subcommands/) of one command.

| Failure | Cause |
| --- | --- |
| [`DJSBOT_E001`](/api/errors/#djsbot_e001) | No token: set `token` or `DISCORD_TOKEN`. |
| [`DJSBOT_E002`](/api/errors/#djsbot_e002) | No client id: set `clientId` or `DISCORD_CLIENT_ID`. |
| [`DJSBOT_E015`](/api/errors/#djsbot_e015) | Too many commands in a scope. |
| HTTP 401 | Discord rejected the token. |
| HTTP 403, or code 50001 | The bot is not in that guild, or was invited without the `applications.commands` scope. |
| Code 10002 | The client id does not belong to the token's application. |
| Code 30034 | The daily creation limit of that guild is reached. |
| HTTP 429 | Rate limited. Wait, then deploy again. |

## See also

- [CLI](/api/cli/): every flag of `deploy`, `clear` and `explain`.
- [Slash commands](/commands/slash-commands/): the definitions being deployed.
- [Install contexts](/commands/install-contexts/): where a global command can be used.
- [Hosting](/recipes/hosting/): deploying from a release pipeline.
- [Sharding](/production/sharding/): which process deploys on a sharded bot.
