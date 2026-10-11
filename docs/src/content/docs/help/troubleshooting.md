---
title: "Troubleshooting"
description: "The symptoms you will actually hit, what causes them, and how to fix each one."
sidebar:
  order: 1
---

Find your symptom, apply the fix. Every entry here is a real failure mode, not a
hypothetical one.

:::tip[Start with the doctor]
```bash
npx djs-bot doctor
```
It checks your token, client id, intents, duplicate names, unsatisfied contracts
and unresolvable services in one pass, without connecting to Discord. Most of
this page is what it would have told you.
:::

## Commands

### My slash commands do not appear in Discord

In order of likelihood:

1. **You never deployed them.** Run `npx djs-bot deploy`, or use `npx djs-bot dev`
   which deploys to your dev guild automatically.
2. **They are global and still propagating.** Global commands can take up to an
   hour to appear. Set a dev guild so they appear instantly:
   ```bash
   DISCORD_DEV_GUILD=your_test_server_id
   ```
3. **The loader never found the file.** Run `npx djs-bot explain` and look for
   your command in the list. If it is missing, check that the file lives inside
   your `features` directory and exports the definition.
4. **The bot was invited without the `applications.commands` scope.** Re-invite
   it with both `bot` and `applications.commands` ticked in the Developer
   Portal URL generator.
5. **`defaultMemberPermissions` hides them from you.** Discord hides a command
   from anyone lacking the permission. Check with an admin account.

### I see every command twice

Your dev guild holds both the dev mirror **and** the global commands. That is
expected while `devGuildId` is set. Remove the mirror when you no longer want it:

```bash
npx djs-bot clear --guild your_test_server_id
```

### I renamed a command but Discord shows the old name

Deployment is a diff, so a rename is a delete plus an add. Run
`npx djs-bot deploy` again and check the output. If the old one persists, your
Discord client is caching: press `Ctrl+R` in the app.

### My subcommand changes are not deploying

Fixed in 1.0.0: the diff compares nested options recursively. If you are on an
older version, upgrade.

### Every start redeploys commands that did not change

Fixed in 1.1: the diff no longer mistakes Discord's defaults, or a localized
name, for a change. `npx djs-bot deploy` twice in a row now prints
`no changes` the second time.

### Deploy fails with "cannot remove this app's Entry Point command"

Your app has Activities enabled, which gives it a command Discord manages
itself. Fixed in 1.1: that command is carried over untouched.

## Interactions

### "This interaction failed"

The single most common Discord error. Causes, in order:

1. **You took longer than 3 seconds.** Discord invalidates an unanswered
   interaction after 3 seconds. Let the framework acknowledge slow handlers for
   you, once and for all:
   ```ts
   defineBot({ defaults: { defer: true } });
   ```
   or defer by hand in one handler with `await ctx.reply.defer()`.
2. **Your handler threw before replying.** Check the logs: the error boundary
   logs it with a `correlationId`.
3. **You replied twice.** Use `ctx.reply(...)` rather than
   `ctx.interaction.reply(...)`; the helper picks `reply`, `editReply` or
   `followUp` correctly on its own.

### "Unknown interaction" (error 10062)

The interaction token expired before you answered. Same fix as above: defer
within 3 seconds. A deferred interaction then gives you 15 minutes.

### My modal will not open

A modal must be the **first** response to an interaction. If the handler
replied or deferred before `ctx.showModal(...)`, or if
[automatic deferral](/basics/automatic-deferral/) fired first because the
handler did slow work before opening it, Discord refuses. Open the modal first,
or set `defer: false` on that definition.

### `ctx.update` throws after `ctx.update.defer()`

Fixed in 1.1: `ctx.update` and `ctx.update.disable` now edit the message when
the interaction was already acknowledged. Upgrade.

### My button does nothing

1. Is the button **registered**? A `defineButton` in a file the loader never
   read is inert. Check `npx djs-bot explain`.
2. Does its `id` match what `build()` produced? Always build the button from
   the definition (`Close.build({...})`), never with a hand-written customId.
3. Is the message older than your last id change? Old messages carry old
   customIds and will not route. Send a fresh one.

### `DJSBOT_E020` when building a button

Your encoded customId exceeded 100 characters. Store the payload and keep a
short key. See [the customId codec](/components/buttons/#when-100-characters-is-not-enough).

## Startup

### The bot starts but stays offline

Check the logs for a login error. Usually:

- The token is wrong or was regenerated. Copy it again from **Bot** in the
  Developer Portal.
- You copied the **client secret** or the **public key** instead of the token.

### `DJSBOT_E001` / `DJSBOT_E002`

Missing token or client id. Both fall back to environment variables:

```bash
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
```

An empty value counts as missing, so watch for a stray `DISCORD_TOKEN=` line.

### `DJSBOT_E060` on startup

A discovered file could not be imported, or exported no valid definitions. The
error names the file. Import that file directly in a scratch script to see the
real underlying error, and check for a stale `dist/` build sitting next to your
source.

### `DJSBOT_E070`, or events that never fire

An event needs a **privileged intent** you have not enabled. Turn it on under
**Bot -> Privileged Gateway Intents** in the Developer Portal:

| Intent | Needed for |
| --- | --- |
| `Server Members Intent` | `guildMemberAdd`, `guildMemberRemove`, member caching |
| `Message Content Intent` | reading message text, so **every** `defineTrigger` |
| `Presence Intent` | presence updates |

An app with fewer than 10,000 users can toggle them freely; beyond that, Discord
requires an application, reconfirmed every year.

### `DJSBOT_E080`: invalid job schedule

A `defineJob` schedule is not a duration, a 5-field cron expression or a macro.
The error names the job and the part that is wrong.

### `DJSBOT_E015`: invalid command

A command breaks a limit Discord enforces at deploy time: a description that is
empty or over 100 characters, more than 25 options or choices, `choices`
together with `autocomplete`. The error names the command and the field.

### `DJSBOT_E014`: invalid modal

A modal has no component, more than five, or a choice field with too few or too
many options (a radio group needs 2 to 10).

### `DJSBOT_E040`: contract not satisfied

A feature or plugin declares `requires: ["x"]` and nothing provides `x`. Either
register a service under that token, or drop the requirement. Note that
configuration counts: `defineBot({ store })` satisfies `requires: ["store"]`.

### `DJSBOT_E030`: dependency cycle

Two services depend on each other. The error metadata contains the chain.
Extract the shared part into a third service.

### `EADDRINUSE` in the logs

Something else is on the health port. It does **not** stop the bot, by design.
Change the port, or drop `health` from your config.

## Permissions

### The command runs but nothing happens in Discord

The bot lacks a permission in that channel. Add a guard so the failure is
visible instead of silent:

```ts
guards: [botHasPermission(PermissionFlagsBits.ManageMessages)]
```

Remember that **channel overwrites** beat server roles: a bot with Manage
Messages server-wide can still be denied in one channel.

### `Missing Access` / `Missing Permissions`

Check, in this order: the bot role position (it must be **above** the roles it
manages), the channel overwrites, and whether the target is the server owner
(nobody can moderate the owner).

### A channel is called `___hidden___`

From November 16, 2026, Discord no longer sends bots the details of channels
they cannot view: the name is replaced and the channel is flagged. Filter them
out before listing or counting channels:

```ts
import { isHiddenChannel } from "@ix-xs/djs-bot";

const visible = guild.channels.cache.filter((channel) => !isHiddenChannel(channel));
```

Channels a user passes to a command are unaffected: interaction payloads are
never obfuscated.

## Data

### My store is empty after a restart

`memoryStore()` is not durable. Switch to `sqliteStore("data/bot.sqlite")`.

### `node:sqlite` is not available

The framework requires **Node 22.13 or newer**. Check with `node -v` and
upgrade.

### A counter loses updates under load

Reading a value, changing it and writing it back in three steps races when two
interactions arrive together. Use the atomic helpers:

```ts
await store.increment(`xp:${id}`, 25);
await store.update(`profile:${id}`, (p = { wins: 0 }) => ({ ...p, wins: p.wins + 1 }));
```

### One feature wiped another feature keys

Use namespaces, so `clear()` only touches your own data:

```ts
const tickets = ctx.services.store.namespace("tickets");
await tickets.clear();   // only tickets keys
```

## Development

### Changes do not take effect

`npx djs-bot dev` watches your files. If it is not reloading, check that `tsx`
is installed for raw TypeScript, and that you are editing files inside the
directory you passed to `features`.

### Types are wrong or missing on `ctx.services`

Augment the service map once:

```ts
declare module "@ix-xs/djs-bot" {
  interface ServiceMap { db: Db }
}
```

See [typing ctx.services](C:/Program Files/Git/architecture/services/#type-your-services).

### `ctx.options.x` is possibly undefined

That is correct: the option is not `required: true`. Either mark it required, or
handle the `undefined` case. The type mirrors what Discord will actually send.

## Still stuck?

1. `npx djs-bot explain` shows exactly what loaded and what will deploy.
2. `npx djs-bot doctor` runs every pre-flight check.
3. Raise the log level: `logger: { level: "debug" }`.
4. Grep your logs by `correlationId` to see one interaction end to end.
5. Open a [discussion](https://github.com/ix-xs/djs-bot/discussions) with the
   error code, the relevant definition and what `explain` printed.
