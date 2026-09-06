---
title: "CLI reference"
description: "Every djs-bot command and flag: dev, start, deploy, clear, doctor, explain, generate, init."
sidebar:
  order: 21
---

```bash
npx djs-bot <command> [entry] [flags]
```

`entry` defaults to your entry file (`src/index.ts`, then `src/index.js`, …).
Every command imports it and reads its **default export**.

| Command | What it does |
| --- | --- |
| `dev [entry]` | Watch mode with instant guild deployment. |
| `start [entry]` | Production mode. |
| `deploy [entry]` | Diff and deploy commands. |
| `clear [entry]` | Remove all commands from a scope. |
| `doctor [entry]` | Diagnose config, intents and permissions. |
| `explain [entry]` | Print everything that is loaded. |
| `generate <type> <name>` | Scaffold a definition file. |
| `init` | Create a minimal starter project. |
| `help`, `version` | |

:::note[Introspection mode]
`deploy`, `clear`, `doctor` and `explain` import your entry with
`DJSBOT_CLI=introspect` and **never connect to the gateway**. That is why they
are fast, safe to run in CI, and why your entry file must not do work at import
time beyond `defineBot()`.
:::

## `dev`

```bash
npx djs-bot dev
```

Runs your bot in development: mirrors **every** command to your dev guild so
changes appear instantly, sets `autoDeploy` on, and uses pretty logs. If `tsx` is
installed it runs your TypeScript directly - no build step.

Set the dev guild once:

```bash
DISCORD_DEV_GUILD=123456789012345678
```

or in code: `deploy: { devGuildId: "…" }`.

## `start`

```bash
npx djs-bot start
```

Production mode: the real deployment plan (global commands go global, commands
with `guilds` go to those guilds) and JSON logs when `NODE_ENV=production`.

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
field by field (including nested subcommand options) and pushes only what
changed - adding, updating and pruning commands you deleted.

```
✓ deploy complete
  global   +2  ~1  -0
  guild 123456789012345678   +0  ~1  -3
```

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

Pre-flight checks before you deploy or ship:

- token and client id present and well-formed;
- required **privileged intents** vs what your events actually need;
- duplicate command names and component ids;
- unsatisfied `requires` contracts;
- unresolvable services;
- command names and option names against Discord rules.

Exits non-zero on failure, so it works as a CI gate.

## `explain`

```bash
npx djs-bot explain
```

Prints what is loaded: commands (with their options and guards), events,
triggers, components, services and their dependency graph, jobs, plugins - and
the deployment plan, showing which commands go global and which go to which
guild.

The fastest answer to "why is my command missing?" and "is my service actually
registered?".

## `generate`

```bash
npx djs-bot generate command warn
npx djs-bot generate trigger welcome
npx djs-bot generate user "User info"
```

Scaffolds a definition file in the right place with the right naming.

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
| `feature` | A feature bundle |

```
npx djs-bot generate command warn   → features/warn/warn.command.ts
```

## `init`

```bash
npx djs-bot init
```

Creates a minimal starter: an entry file, a `features/` directory with one
example command, a `.env.example` and the scripts you need. Run it in an empty
directory, then:

```bash
npm install
npx djs-bot dev
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | A failure - a `BotError` with its code and hint, or a usage error |

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
