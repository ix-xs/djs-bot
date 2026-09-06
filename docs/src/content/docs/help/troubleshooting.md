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

## Interactions

### "This interaction failed"

The single most common Discord error. Causes, in order:

1. **You took longer than 3 seconds.** Discord invalidates an unanswered
   interaction after 3 seconds. Defer first:
   ```ts
   await ctx.reply.defer();
   const data = await slowWork();
   await ctx.reply.success("Done");
   ```
2. **Your handler threw before replying.** Check the logs: the error boundary
   logs it with a `correlationId`.
3. **You replied twice.** Use `ctx.reply(...)` rather than
   `ctx.interaction.reply(...)`; the helper picks `reply`, `editReply` or
   `followUp` correctly on its own.

### "Unknown interaction" (error 10062)

The interaction token expired before you answered. Same fix as above: defer
within 3 seconds. A deferred interaction then gives you 15 minutes.

### My button does nothing

1. Is the button **registered**? A `defineButton` in a file the loader never
   read is inert. Check `npx djs-bot explain`.
2. Does its `id` match what `build()` produced? Always build the button from
   the definition (`Close.build({...})`), never with a hand-written customId.
3. Is the message older than your last id change? Old messages carry old
   customIds and will not route. Send a fresh one.

### `DJSBOT_E020` when building a button

Your encoded customId exceeded 100 characters. Store the payload and keep a
short key. See [the customId codec](/djs-bot/api/ui/#when-100-characters-is-not-enough).

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

Bots in 100 or more servers must be verified to use these.

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

## Data

### My store is empty after a restart

`memoryStore()` is not durable. Switch to `sqliteStore("data/bot.sqlite")`.

### `node:sqlite` is not available

The framework requires **Node 22 or newer**. Check with `node -v` and upgrade.
`memoryStore()` has no such requirement if you cannot upgrade yet.

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

See [typing ctx.services](/djs-bot/api/services/#typing-ctxservices).

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
