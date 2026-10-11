---
title: "CLI reference"
description: "Every djs-bot command and flag: dev, start, deploy, clear, doctor, explain, generate, init."
sidebar:
  order: 21
---

```bash
npx djs-bot <command> [entry] [flags]
```

`entry` is your entry file. When omitted, the CLI looks for `src/index.ts`,
`src/bot.ts`, `src/main.ts`, `bot.ts`, `index.ts`, then the compiled
`dist/index.js` and friends. Every command imports it and reads its **default
export**.

| Command | What it does |
| --- | --- |
| `dev [entry]` | Watch mode with instant guild deployment. |
| `start [entry]` | Production mode. |
| `deploy [entry]` | Diff and deploy commands. |
| `clear [entry]` | Remove all commands from a scope. |
| `doctor [entry]` | Check the environment and the bot before running. |
| `explain [entry]` | Print everything that is loaded. |
| `generate <type> <name>` | Scaffold a definition file. Alias: `g`. |
| `init` | Create a ready-to-run starter project. |
| `help`, `version` | |

:::note[Introspection mode]
`deploy`, `clear`, `doctor` and `explain` import your entry with
`DJSBOT_CLI=introspect` and **never connect to the gateway**. That is why they
are fast and safe to run in CI, and why the entry file ends with
`if (!process.env.DJSBOT_CLI) void bot.start();`.
:::

## `init`

```bash
npx djs-bot init
```

Creates a project you can run straight away. Existing files are never
overwritten, with one exception that only adds to it: a `package.json` that is
already there (you ran `npm init` first) gets the scripts it is missing, and is
switched to `"type": "module"` when the project has no code yet. Scripts you
already have are kept, and a package with existing CommonJS code is left as it
is, with a note telling you so.

| File | Contents |
| --- | --- |
| `src/index.ts` | The entry: `defineBot()` with auto intents, the dev guild and automatic deferral |
| `src/features/ping/ping.command.ts` | A first command |
| `src/types.d.ts` | Where you declare your services for `ctx.services` typing |
| `tsconfig.json` | Strict, `NodeNext` |
| `.env`, `.env.example` | The three variables to fill in, each explained |
| `.gitignore` | `node_modules`, `dist`, `data`, `.env` |
| `package.json` | `"type": "module"` and the `dev`, `start`, `deploy`, `doctor`, `explain`, `typecheck` scripts |

Then:

```bash
npm i @ix-xs/djs-bot discord.js
npm i -D tsx typescript @types/node
npx djs-bot doctor
npx djs-bot dev
```

## `dev`

```bash
npx djs-bot dev
```

Runs your bot in development: restarts on every file change, mirrors **every**
command to your dev guild so changes appear instantly, and uses pretty logs. If
`tsx` is installed it runs your TypeScript directly - no build step.

Set the dev guild once:

```bash
DISCORD_DEV_GUILD=123456789012345678
```

or in code: `deploy: { devGuildId: "…" }`.

## `start`

```bash
npx djs-bot start
```

Production mode: sets `NODE_ENV=production`, which switches the logger to JSON
and turns automatic deployment off. Deploy explicitly instead, from CI.

## `deploy`

```bash
npx djs-bot deploy
npx djs-bot deploy --dry-run
npx djs-bot deploy --guild 123456789012345678
```

| Flag | Effect |
| --- | --- |
| `--dry-run` | Compute and print the diff without pushing anything. |
| `--guild <id>` | Force **every** command onto one guild, ignoring per-command scoping. |

Deployment is a **diff**: the framework fetches what is registered, compares it
with your definitions and pushes only the scopes that changed - adding, updating
and pruning commands you deleted.

```
✓ global
  + stats
  ~ config
✓ guild 123456789012345678
  no changes
```

The comparison is normalised on both sides, so Discord's own defaults and
bookkeeping fields never show up as a change. Running `deploy` twice in a row
prints `no changes` the second time, including for localized commands.

Run `--dry-run` in CI on every pull request to see exactly what a merge would
change.

## `clear`

```bash
npx djs-bot clear --global
npx djs-bot clear --guild 123456789012345678
npx djs-bot clear --guild 123456789012345678 --dry-run
```

Removes **all** commands from one scope. You must name the scope - there is no
default, on purpose.

The usual reason to reach for it: your dev guild shows every command twice
because it holds both the dev mirror and the global set. Clearing the guild
scope leaves the global commands in place.

## `doctor`

```bash
npx djs-bot doctor
```

Pre-flight checks before you run or ship:

| Check | Catches |
| --- | --- |
| Node version | Anything below 22.13 |
| discord.js version | Anything below 14.27 |
| `DISCORD_TOKEN` present and token-shaped | A missing token, or the client secret pasted by mistake (the value is never printed) |
| `DISCORD_CLIENT_ID`, `DISCORD_DEV_GUILD` are ids | A typo or the wrong field |
| `.env` is in `.gitignore` | A token about to be committed |
| The bot loads | Import errors, duplicate names, invalid modals and schedules, unsatisfied contracts, unresolvable services |
| Privileged intents | Lists the ones to enable in the Developer Portal |

```
✓ Node 24.14.0
✓ discord.js 14.27.0
✓ DISCORD_TOKEN is set
✓ DISCORD_CLIENT_ID is set
! DISCORD_DEV_GUILD is not set - commands will take up to an hour to appear while you develop
✓ Loaded 12 command(s), 7 component(s), 3 event(s), 2 job(s), 4 service(s)
! Enable these privileged intents in the Developer Portal: GuildMembers
```

Exits non-zero when a check fails, so it works as a CI gate. Warnings (`!`) do
not fail it.

## `explain`

```bash
npx djs-bot explain
npx djs-bot explain --json
```

Prints what is loaded: intents and partials, commands, context menus,
components, events, triggers, jobs with their schedule, services, plugins,
features - and the deployment plan, showing which commands go global and which
go to which guild.

The fastest answer to "why is my command missing?" and "is my service actually
registered?".

`--json` prints the same as a JSON object, for scripts and CI assertions:

```bash
npx djs-bot explain --json | jq '.commands | length'
```

## `generate`

```bash
npx djs-bot generate command warn
npx djs-bot g modal feedback
npx djs-bot generate user "User info"
```

Scaffolds a definition file in the right place with the right suffix.

| Type | Creates |
| --- | --- |
| `command` | A slash command |
| `user` | A user context-menu command |
| `message` | A message context-menu command |
| `event` | A gateway event listener |
| `trigger` | A message auto-responder |
| `button` | A routed button |
| `modal` | A modal form |
| `select` | A select menu |
| `service` | An injectable service |
| `job` | A scheduled job |
| `plugin` | A plugin with a middleware |
| `feature` | A feature bundle |

```
npx djs-bot generate command warn   → src/features/warn/warn.command.ts
```

Files go under `src/features` when it exists, `features` otherwise.

## `version`

```bash
npx djs-bot version
# djs-bot 1.1.0  (discord.js 14.27.0, node 24.14.0)
```

The three versions a bug report needs, in one line.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | A failure - a `BotError` with its code and hint, a failed doctor check, or a usage error |

## In CI

```yaml
- run: npm ci
- run: npx djs-bot doctor
- run: npx djs-bot deploy --dry-run
```

and on a release:

```yaml
- run: npx djs-bot deploy
  env:
    DISCORD_TOKEN: ${{ secrets.DISCORD_TOKEN }}
    DISCORD_CLIENT_ID: ${{ secrets.DISCORD_CLIENT_ID }}
```
