---
title: "Error handling & codes"
description: "Every DJSBOT_Exxx code, what causes it, how to fix it — plus the error boundary and BotError."
sidebar:
  order: 19
---

Every framework error carries a stable code, an actionable hint and a docs link.
No anonymous `throw new Error("something went wrong")`.

```
BotError [DJSBOT_E020]: customId too long: key "ticket:close" produced 128 chars
  ↳ Shorten params or move large state into a store keyed by a short id. Limit is 100.
  ↳ https://ix-xs.github.io/djs-bot/#djsbot_e020
```

## The error boundary

When a handler throws, the framework:

1. **logs** it with the interaction `correlationId`,
2. runs every plugin `onError` hook,
3. calls your `defineBot({ onError })`,
4. replies to the user with a friendly ephemeral message — unless your `onError`
   returned a value, which marks the error handled.

```ts
export default defineBot({
  onError(error, ctx) {
    ctx?.logger.error({ err: error }, "interaction failed");
    Sentry.captureException(error);
    // returning nothing → the framework still sends the default reply
  },
});
```

Return something to take over the reply entirely:

```ts
async onError(error, ctx) {
  await ctx?.reply.error("Something broke. The team has been notified.");
  return true;   // handled — no default reply
}
```

The boundary means an exception can never take the process down or leave an
interaction hanging with "the application did not respond".

## `BotError`

```ts
new BotError(code, options?)
```

| Option | Type | Description |
| --- | --- | --- |
| `detail` | `string` | Extra context appended to the catalogue title. |
| `hint` | `string` | Overrides the catalogue hint for this occurrence. |
| `cause` | `unknown` | The underlying error, preserved as `cause`. |
| `meta` | `Record<string, unknown>` | Structured metadata for logging. |

| Property | Description |
| --- | --- |
| `code` | The stable `DJSBOT_Exxx` code. |
| `hint` | An actionable suggestion. |
| `docs` | Deep link to this page anchor. |
| `meta` | Whatever you attached. |

```ts
import { BotError, isBotError } from "@ix-xs/djs-bot";

try {
  await risky();
} catch (error) {
  if (isBotError(error) && error.code === "DJSBOT_E020") {
    return ctx.reply.error("That selection is too large to encode.");
  }
  throw error;
}
```

`ERROR_CATALOGUE` is exported too, so you can look up a title or hint at runtime.

## The catalogue

### Configuration

#### `DJSBOT_E001`

**Missing bot token.** Set `token` in `defineBot()`, or the `DISCORD_TOKEN`
environment variable. Remember that an *empty* value counts as missing — check
for a stray `DISCORD_TOKEN=` in your `.env`.

#### `DJSBOT_E002`

**Missing application client id.** Set `clientId` in `defineBot()`, or
`DISCORD_CLIENT_ID`. It is required to deploy commands (the bot can connect
without it, but `deploy` cannot run). Find it under **General Information** in
the Developer Portal.

### Registration

#### `DJSBOT_E010`

**Duplicate command name.** Two commands registered under the same name — often
the same file discovered twice (exported *and* listed in a
`defineFeature`), or a copy-pasted definition. Run `npx djs-bot explain` to see
everything that loaded.

#### `DJSBOT_E011`

**Duplicate component id.** Two buttons, selects or modals share an id. Ids must
be unique per type. Namespace them: `ticket:close`, `poll:vote`.

#### `DJSBOT_E012`

**Invalid command or option name.** Slash command, subcommand, group and option
names must be **1–32 characters, lowercase**, letters/digits/`-`/`_`, no spaces.

```ts
name: "My Command"   // ✗
name: "my-command"   // ✓
```

Context-menu commands (`defineUserCommand`, `defineMessageCommand`) are exempt —
they may use spaces and capitals.

#### `DJSBOT_E013`

**Invalid component id.** Ids must be non-empty and must not contain `$`, which
is reserved as the customId separator. Use `:` or `-`.

### Components

#### `DJSBOT_E020`

**customId too long.** The encoded customId exceeded Discord 100-character
limit. Shorten your params, or store the payload and keep only a short key:

```ts
const key = crypto.randomUUID().slice(0, 8);
await ctx.services.store.set(`draft:${key}`, bigObject, "10m");
Publish.build({ key });
```

#### `DJSBOT_E021`

**Invalid customId payload.** A payload could not be decoded — almost always an
old message whose buttons were built by a previous version with a different
`params` schema. Handle it gracefully:

```ts
onError(error, ctx) {
  if (isBotError(error) && error.code === "DJSBOT_E021") {
    return ctx.reply.error("This message is out of date — please run the command again.");
  }
}
```

### Services

#### `DJSBOT_E030`

**Service resolution failed.** A dependency is missing or the graph has a cycle.
The `meta.chain` field shows the offending chain. Break the cycle by extracting
the shared part into a third service, or by injecting lazily.

#### `DJSBOT_E031`

**Unknown service.** You asked for a token that was never registered — a typo in
`deps`, or a `defineService` file that is not inside your features directory.
`npx djs-bot explain` lists every registered token.

### Contracts

#### `DJSBOT_E040`

**Feature contract not satisfied.** A feature or plugin `requires` a capability
nothing `provides`. Either register the service, or drop the requirement.
Built-in configuration counts: `defineBot({ store })` satisfies
`requires: ["store"]`.

#### `DJSBOT_E041`

**Capability conflict.** Two plugins provide the same capability without an
explicit override. Remove one, or rename what it provides.

### Runtime

#### `DJSBOT_E050`

**Invalid option value.** An option failed validation at the Discord boundary —
usually a `choices` value that no longer matches, or an out-of-range number.

#### `DJSBOT_E060`

**Loader error.** A discovered file could not be imported, or exported no valid
definitions. The detail names the file. Common causes:

- a syntax or import error in that file — import it directly to see the real error;
- the file exports something that is not a `define*()` result;
- a stale build in `dist/` alongside the source.

#### `DJSBOT_E070`

**Privileged intent required.** An event needs a privileged intent that is not
enabled. Turn it on under **Bot → Privileged Gateway Intents** in the Developer
Portal:

| Intent | Needed for |
| --- | --- |
| `GuildMembers` | `guildMemberAdd`, `guildMemberRemove`, member caching |
| `MessageContent` | Reading message text — **every** `defineTrigger` |
| `GuildPresences` | Presence updates |

Bots in 100+ servers must be verified to use these.

## Handling errors in your own code

Use `ctx.reply.error()` for expected outcomes and `throw` for genuine failures:

```ts
run: async (ctx) => {
  const ticket = await ctx.services.tickets.find(ctx.options.id);
  if (!ticket) return ctx.reply.error("No ticket with that id.");   // expected

  await ctx.services.tickets.close(ticket);                          // may throw → boundary
  return ctx.reply.success("Closed.");
}
```

That keeps ordinary refusals quiet in the logs, and makes real errors loud.
