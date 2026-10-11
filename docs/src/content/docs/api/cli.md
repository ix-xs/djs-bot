---
title: "CLI"
description: "Every djs-bot command and flag: create a project, run it, deploy its commands, and check or inspect it without connecting to Discord."
sidebar:
  order: 2
---

The package installs one binary, `djs-bot`. Run it through `npx` from the root
of your project, or through the scripts that `init` adds to `package.json`.

```bash
npx djs-bot <command> [entry] [flags]
```

| Command | What it does |
| --- | --- |
| [`init`](#init) | Creates a starter project in the current folder. |
| [`generate <type> <name>`](#generate-type-name) | Creates one definition file. Alias: `g`. |
| [`dev [entry]`](#dev-entry) | Runs the bot in watch mode, with instant deployment to your test server. |
| [`start [entry]`](#start-entry) | Runs the bot in production mode. |
| [`deploy [entry]`](#deploy-entry) | Compares your commands with Discord and pushes the difference. |
| [`clear [entry]`](#clear-entry) | Removes every command from one scope. |
| [`doctor [entry]`](#doctor-entry) | Checks the environment and the bot before you run or ship. |
| [`explain [entry]`](#explain-entry) | Prints everything that is loaded, and the deployment plan. |
| [`help`, `version`](#help-and-version) | Prints the usage, or the versions in use. |

## A first run

Install the package first: `npx djs-bot` runs the copy in your project's
`node_modules`.

```bash
npm install @ix-xs/djs-bot discord.js
npm install -D tsx typescript @types/node
npx djs-bot init      # creates the starter
npx djs-bot doctor    # checks it, once .env is filled in
npx djs-bot dev       # runs it
```

[Quick start](/quick-start/) walks through these steps.

## The entry file

Every command except `init`, `generate`, `help` and `version` works on your
entry file: the one that calls `defineBot` and exports the result as its
default export (a named export called `bot` is accepted as a fallback). Pass
its path, or let the CLI find it. Without a path, the first of these that
exists is used:

`src/index.ts`, `src/bot.ts`, `src/main.ts`, `bot.ts`, `index.ts`,
`dist/index.js`, `dist/bot.js`, `src/index.js`, `index.js`.

The CLI then uses the entry in one of two ways.

- `dev` and `start` **run** it, in a child process with source maps enabled, so
  stack traces point at your own lines. If `tsx` is installed in the project it
  is loaded, and a `.ts` entry runs with no build step.
- `deploy`, `clear`, `doctor` and `explain` **import** it and read its default
  export. They set `DJSBOT_CLI=introspect` first, then load the bot: your
  feature files are imported, plugin `setup` functions run and services are
  built. They never connect to the gateway. That is why they are fast and safe
  to run in CI, and why an entry file ends with
  `if (!process.env.DJSBOT_CLI) void bot.start();`.

Before either, the CLI reads the `.env` file of the current folder into the
environment. Variables that are already set are kept, so your shell and your
host win over the file.

:::caution[Put the entry before `--guild`]
The first argument that does not start with `--` is read as the entry, and that
includes the id after `--guild`. `npx djs-bot deploy --guild 123456789012345678`
looks for a file named `123456789012345678` and stops with
`Could not find a bot entry file`. Whenever you use `--guild`, name the entry
first: `npx djs-bot deploy src/index.ts --guild 123456789012345678`.
:::

## Create files

### `init`

```bash
npx djs-bot init
```

Creates a project you can run straight away, in the current folder. It takes
no argument. A file that already exists is skipped with a notice, never
overwritten.

| File | Contents |
| --- | --- |
| `src/index.ts` | The entry: `defineBot()` with the token, the client id, the features folder, `intents: "auto"`, the dev guild and `defaults: { defer: true }`. |
| `src/features/ping/ping.command.ts` | A first command, `/ping`, that answers with the gateway latency. |
| `src/types.d.ts` | Where you declare your services so that `ctx.services` is typed. |
| `tsconfig.json` | `strict`, `skipLibCheck`, `module` and `moduleResolution` `NodeNext`, target `ES2023`, `src` compiled to `dist`. |
| `.env`, `.env.example` | `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and `DISCORD_DEV_GUILD`, empty, each with a comment saying where to find the value. |
| `.gitignore` | `node_modules/`, `dist/`, `data/`, `.env`, `.djs-bot/`. |
| `package.json` | Private, version `0.1.0`, `"type": "module"`, `engines.node` set to `>=22.13.0`, and the scripts below. The name is the folder name in kebab-case. |

The scripts are `dev`, `start`, `deploy`, `doctor` and `explain` (each runs the
`djs-bot` command of the same name) and `typecheck` (`tsc --noEmit`).

`package.json` is the one file `init` edits when it is already there, which is
the usual case after `npm install` or `npm init`. It only adds to it:

- A script that is missing is added. A script you already have is kept, even
  under one of the names above.
- `"type": "module"` is set when the package is not an ES module yet and the
  file named by `main` (`index.js` by default) does not exist, that is, when
  the project has no code that the change could break.
- A package that stays CommonJS because it has existing code is left as it is.
  `init` tells you so, and suggests `npm pkg set type=module` for when your code
  is ready: the starter uses ES modules.
- A `package.json` that is not valid JSON is skipped.

`init` installs nothing. It ends by printing what is left to do: fill in
`.env`, install the dependencies if you have not, run `doctor`, run `dev`.

### `generate <type> <name>`

```bash
npx djs-bot generate command warn
npx djs-bot g modal feedback
npx djs-bot generate user "User info"
```

Creates one definition file, in the right place and with the right suffix, so
that the loader picks it up. `g` is an alias.

The file goes to `<features>/<name>/<name>.<suffix>.ts`, where `<features>` is
`src/features` when that folder exists and `features` otherwise, and `<name>`
is your name in kebab-case. `generate command warn` creates
`src/features/warn/warn.command.ts`, and `generate user "User info"` creates
`src/features/user-info/user-info.user.ts`.

| Type | File suffix | Creates |
| --- | --- | --- |
| `command` | `.command.ts` | A slash command with an empty `options` block. |
| `user` | `.user.ts` | A user context-menu command. |
| `message` | `.message.ts` | A message context-menu command. |
| `event` | `.event.ts` | A gateway event listener, on `guildMemberAdd` to start from. |
| `trigger` | `.trigger.ts` | A message auto-responder that matches the name as a keyword. |
| `button` | `.button.ts` | A routed button with one typed param. |
| `select` | `.select.ts` | A select menu. |
| `modal` | `.modal.ts` | A modal form with one paragraph field. |
| `service` | `.service.ts` | An injectable service. |
| `job` | `.job.ts` | A scheduled job that runs every hour. |
| `plugin` | `.plugin.ts` | A plugin with a `beforeInteraction` middleware. |
| `feature` | `.feature.ts` | An empty feature bundle. |

Inside the file, the `name` or `id` is the kebab-case name. Exported constants
and context-menu names use PascalCase: `g button close-ticket` exports
`CloseTicketButton` with the id `close-ticket`, and `generate user "User info"`
names the command `UserInfo`. Rename freely afterwards.

`generate` refuses to overwrite an existing file, and stops on an unknown type
or a missing name. It does not read the entry file.

## Run the bot

### `dev [entry]`

```bash
npx djs-bot dev
```

Runs the bot for development, with `NODE_ENV=development`:

- The process restarts whenever a file it imported changes (Node's watch mode).
- Commands are deployed at each start, by default. With a dev guild, **every**
  command is mirrored to that server, where changes appear at once. Without
  one, the normal plan is deployed, and global commands can take up to an hour
  to show.
- Logs are human-readable and coloured.

Set the dev guild once, in `.env`:

```bash title=".env"
DISCORD_DEV_GUILD=123456789012345678
```

or in the entry file, with `deploy: { devGuildId: "..." }`. See
[Deploying commands](/production/deploying/) for what the mirror is and how it
relates to a real deployment.

### `start [entry]`

```bash
npx djs-bot start
```

Runs the bot once, with `NODE_ENV=production` and no watcher. In production
the logger writes JSON and commands are no longer deployed at startup: deploy
them explicitly, with `djs-bot deploy`, from your machine or from CI.

`start` uses the same entry lookup as `dev`, so it runs `src/index.ts` through
`tsx` when both are there. To run a compiled build, pass it:
`npx djs-bot start dist/index.js`.

When `dev` or `start` find no entry, they print `No entry file found.` and
start nothing.

## Deploy and clear

### `deploy [entry]`

```bash
npx djs-bot deploy
npx djs-bot deploy --dry-run
npx djs-bot deploy src/index.ts --guild 123456789012345678
```

| Flag | Effect |
| --- | --- |
| `--dry-run` | Computes and prints the difference without writing anything to Discord. |
| `--guild <id>` | Puts **every** command on that one guild, ignoring the scope of each command. Name the entry before it. |

A deployment is a difference, not a blind overwrite. The command fetches what
Discord holds, compares it with your definitions, and writes only the scopes
that changed: new commands are added, modified ones updated, and commands you
deleted from the code removed.

```text
✓ global
  + stats
  ~ config
  - old-command
✓ guild 123456789012345678
  no changes
```

`+` is added, `~` is changed, `-` is removed. With `--dry-run`, each scope is
marked `(dry run)` and nothing is written. Both sides are normalised before
they are compared, so the defaults and bookkeeping fields that Discord adds
never count as a change: a second `deploy` in a row prints `no changes`
everywhere, localized commands included.

If your configuration has a dev guild and you deploy global commands, `deploy`
ends with a warning: that guild still holds the mirror left by `dev`, so each
command would show twice there. It prints the `clear` command that removes the
mirror (add the entry before `--guild` when you run it).

Scopes, per-guild commands and the pruning of guilds you stop targeting are
explained in [Deploying commands](/production/deploying/).

### `clear [entry]`

```bash
npx djs-bot clear --global
npx djs-bot clear src/index.ts --guild 123456789012345678
npx djs-bot clear src/index.ts --guild 123456789012345678 --dry-run
```

Removes **all** the commands of one scope and lists what it removed.

| Flag | Effect |
| --- | --- |
| `--global` | Clears the global commands. |
| `--guild <id>` | Clears the commands of that guild. Name the entry before it. |
| `--dry-run` | Lists what would be removed without removing it. |

You must name the scope: without `--global` or `--guild` the command stops, on
purpose. With both, `--global` wins.

The usual reason to reach for it: your test server shows every command twice,
because it holds both the dev mirror and the global set. Clearing the guild
scope leaves the global commands in place.

## Inspect and diagnose

### `doctor [entry]`

```bash
npx djs-bot doctor
```

Checks everything that commonly goes wrong, before you run or ship.

| Check | Result |
| --- | --- |
| Node version | Fails below 22.13. |
| discord.js version | Fails below 14.27. |
| `DISCORD_TOKEN` | Fails when it is missing, or when it does not have the three dot-separated parts of a bot token (the client secret pasted by mistake). The value is never printed. |
| `DISCORD_CLIENT_ID` | Warns when it is missing (it is only needed to deploy). Fails when it is not a 17-20 digit id. |
| `DISCORD_DEV_GUILD` | Warns when it is missing. Fails when it is not a 17-20 digit id. |
| `.env` and git | Fails when the folder is a git repository, has a `.env`, and `.gitignore` does not list it: the token would be committed. |
| The bot loads | Fails on anything that stops the load: an import error, a duplicate name, an invalid definition, an unsatisfied contract, an unresolvable service. The error is printed with its code and hint. |
| Privileged intents | Warns with the list of the ones to enable in the Developer Portal. |
| Commands | Warns when none is registered, which usually means `features` points at the wrong folder. |

```text
djs-bot doctor v1.1.0

✓ Node 24.14.0
✓ discord.js 14.27.0
✓ DISCORD_TOKEN is set
✓ DISCORD_CLIENT_ID is set
! DISCORD_DEV_GUILD is not set - commands will take up to an hour to appear while you develop
✓ .env is git-ignored
✓ Loaded 12 command(s), 7 component(s), 3 event(s), 2 job(s), 4 service(s)
! Enable these privileged intents in the Developer Portal: GuildMembers

✓ Doctor finished - everything looks good
```

A failed check (`✗`) makes `doctor` exit with code 1, so it works as a CI
gate. A warning (`!`) does not.

The three credentials are checked in the environment (`.env` included), not in
what you pass to `defineBot`. A token written in the code, or read from a
variable with another name, shows as missing here.

### `explain [entry]`

```bash
npx djs-bot explain
npx djs-bot explain --json
```

Prints what the bot loaded, one titled list per kind with its count: intents (with a
warning when some are privileged), partials, commands, user commands, message
commands, buttons, select menus, modals, events, triggers, jobs with their
schedule, services, plugins with their version, and features. It ends with the
deployment plan: which commands go global, and which go to which guild.

It is the fastest answer to "why is my command missing?" and "is my service
registered?".

`--json` prints the same data as one JSON object, for scripts and CI
assertions:

```bash
npx djs-bot explain --json | jq '.commands | length'
```

| Key | Content |
| --- | --- |
| `version` | The framework version. |
| `intents`, `partials` | Names of the gateway intents and partials the client will use. |
| `privilegedIntents` | The intents among them to switch on in the Developer Portal. |
| `commands`, `userCommands`, `messageCommands` | Command names. |
| `buttons`, `selectMenus`, `modals` | Component ids. |
| `events` | The event of each listener. |
| `triggers` | Trigger names. |
| `jobs` | Jobs, as `name (schedule)`. |
| `services` | Service tokens. |
| `plugins` | Plugins, as `name@version`. |
| `features` | Feature names. |
| `deployment` | `{ global: string[], guilds: { [guildId]: string[] } }`, by command name. |

### `help` and `version`

```bash
npx djs-bot help
npx djs-bot version
# djs-bot 1.1.0  (discord.js 14.27.0, node 24.14.0)
```

`help` prints the list of commands. `--help`, `-h` and running `djs-bot` with
no command do the same. `version` (also `--version` and `-v`) prints the three
versions a bug report needs, on one line.

## Failures and CI

| Exit code | When |
| --- | --- |
| `0` | The command succeeded. `doctor` with warnings only is a success. |
| `1` | A usage error (unknown command, missing argument, no scope for `clear`), an entry that cannot be found or does not export a bot, a failed `doctor` check, or any error raised while loading or deploying. |

`dev` and `start` exit with the code of the bot process they started.

An error raised by the framework is printed with its code, its hint and a link
to its entry in [Errors](/api/errors/). When Discord rejects a request, the CLI
adds the likely cause:

| Discord answered | Meaning |
| --- | --- |
| `401` | The token was rejected. Copy it again from the Developer Portal into `DISCORD_TOKEN`. |
| `403`, or code `50001` | Missing access: the bot is not in that server, or it was invited without the `applications.commands` scope. |
| Code `10002` | Unknown application: `DISCORD_CLIENT_ID` does not belong to the token's application. |
| Code `30034` | Daily limit reached: Discord allows 200 command creations per day and per server. |
| `429` | Rate limited. Wait a moment and run the command again. |

In CI, check every pull request without touching Discord's state:

```yaml
- run: npm ci
- run: npx djs-bot doctor
- run: npx djs-bot deploy --dry-run
```

and deploy on a release:

```yaml
- run: npx djs-bot deploy
  env:
    DISCORD_TOKEN: ${{ secrets.DISCORD_TOKEN }}
    DISCORD_CLIENT_ID: ${{ secrets.DISCORD_CLIENT_ID }}
```

`doctor` and `deploy --dry-run` both need the token, and the dry run also needs
the client id, because it reads the commands Discord currently holds.

## See also

- [Quick start](/quick-start/) for the first run, step by step.
- [Project layout](/basics/project-layout/) for the file suffixes `generate` relies on.
- [Deploying commands](/production/deploying/) for scopes, the dev mirror and deployment from code.
- [Errors](/api/errors/) for every code the CLI can print.
- [Troubleshooting](/help/troubleshooting/) when a command does not show up.
