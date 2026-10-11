---
title: "Errors"
description: "What happens when a handler throws, what the user sees, how to handle and report errors yourself, and what every DJSBOT_Exxx code means with its fix."
sidebar:
  order: 3
---

There are two kinds of errors in a bot. The ones your handlers throw while the
bot runs are caught by the error boundary: they are logged, reported, and the
user gets an answer. The ones the framework raises itself, mostly at startup,
are `BotError`s: each carries a stable code, a hint and a link to this page.

```text
BotError [DJSBOT_E020]: customId too long: key "ticket:close" produced 128 chars
  ↳ Shorten params or move large state into a store keyed by a short id. Limit is 100.
  ↳ https://ix-xs.github.io/djs-bot/api/errors/#djsbot_e020
```

## The error boundary

Every handler runs inside a `try`/`catch` owned by the framework. You do not
wrap your own code: answer the user for the outcomes you expect, and let
everything else throw.

```ts title="src/features/tickets/close.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "close",
  description: "Close a ticket",
  options: {
    id: s.string({ description: "The ticket id", required: true }),
  },
  run: async (ctx) => {
    const ticket = await ctx.services.tickets.find(ctx.options.id);
    // Expected: a normal answer. Nothing is logged.
    if (!ticket) return ctx.reply.error("No ticket with that id.");

    // Unexpected: if this throws, the boundary takes over.
    await ctx.services.tickets.close(ticket);
    return ctx.reply.success("Closed.");
  },
});
```

When an interaction handler throws (or one of its guards, or a middleware
around it), the framework does four things, in this order:

1. It logs the error at level `error` with the message
   `Interaction handler failed`. The line carries the `correlationId` of the
   interaction and the user id, so you can find every other line of the same
   interaction.
2. It calls every plugin `onError` hook, with the error and the `ctx`.
3. It calls your `defineBot({ onError })`, with the error and the `ctx`.
4. It sends the user an error message, unless your `onError` returned a value.

Nothing a handler throws can stop the process or leave the user in front of
"The application did not respond". Code that runs outside an interaction is
protected too, with one difference: there is nobody to answer.

| What threw | Log message | Hooks and `onError` | The user sees |
| --- | --- | --- | --- |
| An interaction handler, a guard, a middleware | `Interaction handler failed` | Called with `ctx` | The error message |
| An event listener | `Event handler failed` | Called without `ctx` | Nothing |
| A message trigger | `Trigger handler failed` | Called without `ctx` | Nothing |
| A scheduled job | `Job failed` | Called without `ctx` | Nothing |
| An `onReady` or `afterInteraction` hook | `onReady hook failed`, `afterInteraction hook failed` | Called without `ctx` | Nothing |
| An uncaught exception or unhandled rejection, once the bot has started | `Uncaught error (kept alive)` | Called without `ctx` | Nothing |
| An autocomplete handler | `Autocomplete handler failed` | Not called | An empty list of suggestions |
| Routing, before the handler starts | `Interaction routing failed` | Not called | Discord's own "This interaction failed" |

The last row is rare. It covers what goes wrong while the framework prepares
the `ctx`, in practice a customId it cannot decode
([`DJSBOT_E021`](#djsbot_e021)).

A failing `afterInteraction` hook is reported but never turns into an error
message: the handler had already succeeded and answered. Failures during
shutdown (an `onShutdown` hook, a plugin `teardown`, a service `dispose`) are
logged and the shutdown carries on.

Startup is the exception to all of this. An error raised while the bot loads
(a file that does not import, a duplicate name, a missing token) rejects
`bot.start()`: a bot that cannot load should not run half-configured.

## What the user sees

The default answer is the `error` message of the framework, sent with
`ctx.reply.error()`: a red embed, visible only to the user, that says
"Something went wrong. The team has been notified."

- To reword or translate it, set `messages.error` in `defineBot`. See
  [Wording and theme](/basics/wording-and-theme/).
- If the handler had already replied, the message is sent as a follow-up.
- If the interaction was deferred, the message replaces the loading state, so it
  is as public as the deferral was. After an `update` deferral on a component,
  it edits the message the component is attached to. See
  [Automatic deferral](/basics/automatic-deferral/).
- If the interaction has expired, sending fails silently. The error is still
  logged and reported.

A guard that refuses an interaction is not an error: the user gets the reason,
nothing is logged above `debug`, and no hook runs. See
[Guards](/commands/guards/).

## Handling errors globally

`onError` in `defineBot` is the single place that sees every error the
framework catches. Use it to report to your monitoring, and optionally to take
over the answer.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";
import * as Sentry from "@sentry/node";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  onError(error, ctx) {
    // ctx is set for an interaction, absent for an event, a trigger or a job.
    Sentry.captureException(error, {
      tags: { source: ctx ? "interaction" : "background", guild: ctx?.guildId },
    });
    // Nothing is returned: the user still gets the default error message.
  },
});

export default bot;
if (!process.env.DJSBOT_CLI) void bot.start();
```

To answer the user yourself, send your message and return a value. Any value
other than `undefined` marks the error as handled and cancels the default
message.

```ts
async onError(error, ctx) {
  if (!ctx) return;
  await ctx.reply.error("That did not work. Try again in a minute.");
  return true; // handled: no default message
}
```

:::caution[Return an explicit value]
`return ctx.reply.error("...")` does not mark the error as handled:
`ctx.reply.error()` resolves to `undefined`, so the default message is sent as
well. Await your reply, then `return true`.
:::

The return value only matters for an interaction. For an event, a trigger or a
job it is ignored. If `onError` itself throws, the exception is swallowed and
the default message is sent.

A plugin registers the same kind of handler with `app.hooks.onError`. Hooks run
before `onError`, in the order the plugins were registered. They are meant for
reporting: their return value is ignored and they cannot cancel the default
message.

```ts title="src/features/monitoring/monitoring.plugin.ts"
import { definePlugin } from "@ix-xs/djs-bot";

export default definePlugin({
  name: "monitoring",
  setup(app) {
    app.hooks.onError((error, ctx) => {
      app.logger.warn({ err: error, guildId: ctx?.guildId }, "forwarded to monitoring");
    });
  },
});
```

The official `errorReporter` plugin is this hook, ready to use. See
[Plugins and hooks](/architecture/plugins/).

## Throwing your own

Decide between two cases each time something goes wrong in a handler:

- **An outcome you expect** (no such ticket, not your turn, nothing to undo):
  answer with `ctx.reply.error()` and return. Nothing is logged, which keeps
  ordinary refusals out of your logs.
- **A genuine failure** (the database is down, an API answered 500): throw, or
  let the exception through. The boundary logs it and tells the user.

Deep inside a service, far from the `ctx`, returning a message is awkward. A
small error class of your own solves it: throw it anywhere, and let `onError`
turn it into an answer.

```ts title="src/user-error.ts"
/** A failure whose message is safe to show to the user. */
export class UserError extends Error {}
```

```ts
async onError(error, ctx) {
  if (error instanceof UserError && ctx) {
    await ctx.reply.error(error.message);
    return true;
  }
  // Anything else falls through to the default message.
}
```

The boundary logs every error it catches before `onError` runs, so a
`UserError` still appears in the logs.

`BotError` is reserved for the framework's own catalogue: its constructor only
accepts a code from the [list below](#error-codes). Use your own classes for
your own failures.

## Catching framework errors

`isBotError()` tells a framework error from any other, and `error.code` says
which one. Compare codes, never messages: the code is stable across versions,
the wording is not.

```ts
import { isBotError } from "@ix-xs/djs-bot";

let button;
try {
  button = Publish.build({ draft: ctx.options.text });
} catch (error) {
  if (isBotError(error) && error.code === "DJSBOT_E020") {
    return ctx.reply.error("That text is too long to attach to a button.");
  }
  throw error;
}
```

Most codes are raised when a definition is created or when the bot loads, so
you meet them in the terminal, not in a `catch`. The CLI prints the three-line
form shown at the top of this page. In the logs, the `err` field of the entry
holds `name`, `message`, `stack`, `code`, `hint`, `docs` and `meta`.

## Reference

### `BotError`

```ts
new BotError(code, options?)
```

A subclass of `Error`. `code` must be one of the [error codes](#error-codes).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `detail` | `string` | none | Context appended to the catalogue title: the message becomes `"<title>: <detail>"`. |
| `hint` | `string` | the catalogue hint | Replaces the hint for this occurrence. |
| `cause` | `unknown` | none | The underlying error, kept as `error.cause`. |
| `meta` | `Record<string, unknown>` | none | Structured data for the logs. |

| Property | Type | Description |
| --- | --- | --- |
| `name` | `"BotError"` | Always `"BotError"`. |
| `code` | `ErrorCode` | The stable code, for example `DJSBOT_E020`. |
| `message` | `string` | The catalogue title, followed by the detail when there is one. |
| `hint` | `string` | A short suggestion for fixing the problem. |
| `docs` | `string` | The URL of the code's entry on this page. |
| `meta` | `Record<string, unknown> \| undefined` | What the framework attached, for example the chain of a dependency cycle. |
| `cause` | `unknown` | The underlying error, when there is one. |

`toString()` returns the three-line form: `BotError [code]: message`, then the
hint, then the docs link.

The types `ErrorCode` (the union of every code) and `BotErrorOptions` (the
options above) are exported too.

### `isBotError(value)`

A type guard: `true` when `value` is a `BotError`. Inside the `if`, `value.code`
and `value.hint` are typed.

### `ERROR_CATALOGUE`

The table behind the codes: an object keyed by code, each entry holding a
`title` and a default `hint`. Read it to print or translate an explanation at
run time.

```ts
import { ERROR_CATALOGUE, isBotError } from "@ix-xs/djs-bot";

function explain(error: unknown): string {
  if (!isBotError(error)) return "Unexpected error";
  return `${ERROR_CATALOGUE[error.code].title} (${error.code})`;
}
```

### `onError(error, ctx?)`

The `onError` field of `defineBot`.

| Parameter | Type | Description |
| --- | --- | --- |
| `error` | `unknown` | What was thrown. Not always an `Error`: narrow it before reading properties. |
| `ctx` | `BaseContext \| undefined` | The context of the interaction. Absent when the error comes from an event, a trigger, a job, a hook or an uncaught exception. |

Return anything other than `undefined` (also through a promise) to cancel the
default error message of an interaction. For an interaction the framework
waits for the returned promise before deciding. For a background error it does
not wait, and a rejection is ignored.

### `app.hooks.onError(fn)`

Registers a plugin error hook. `fn` has the same parameters as `onError`. It
is called for the same errors, before `onError`. Its return value is ignored,
and an exception it throws is swallowed.

## Error codes

| Code | Title | Raised |
| --- | --- | --- |
| [`DJSBOT_E001`](#djsbot_e001) | Missing bot token | Startup, deploy |
| [`DJSBOT_E002`](#djsbot_e002) | Missing application client id | Deploy |
| [`DJSBOT_E010`](#djsbot_e010) | Duplicate command name | Startup |
| [`DJSBOT_E011`](#djsbot_e011) | Duplicate component id | Startup |
| [`DJSBOT_E012`](#djsbot_e012) | Invalid command or option name | Definition |
| [`DJSBOT_E013`](#djsbot_e013) | Invalid component id | Definition |
| [`DJSBOT_E014`](#djsbot_e014) | Invalid modal definition | Definition |
| [`DJSBOT_E015`](#djsbot_e015) | Invalid command definition | Definition, deploy |
| [`DJSBOT_E020`](#djsbot_e020) | customId too long | When a component is built |
| [`DJSBOT_E021`](#djsbot_e021) | Invalid customId payload | When a component is used |
| [`DJSBOT_E030`](#djsbot_e030) | Service resolution failed | Startup |
| [`DJSBOT_E031`](#djsbot_e031) | Unknown service | Startup, run time |
| [`DJSBOT_E040`](#djsbot_e040) | Feature contract not satisfied | Startup |
| [`DJSBOT_E041`](#djsbot_e041) | Capability conflict | Startup |
| [`DJSBOT_E050`](#djsbot_e050) | Invalid option value | Reserved |
| [`DJSBOT_E060`](#djsbot_e060) | Loader error | Startup |
| [`DJSBOT_E070`](#djsbot_e070) | Privileged intent required | Reserved |
| [`DJSBOT_E080`](#djsbot_e080) | Invalid job schedule | Definition |

"Definition" means the error is thrown by the `define*()` call itself, as soon
as the file is imported. When the loader is the one importing the file, it
reports the failure as [`DJSBOT_E060`](#djsbot_e060), with the original error
as its `cause` and the original title in its message.

"Startup" covers everything that loads the bot: `bot.start()`, and the CLI
commands that inspect it (`deploy`, `clear`, `doctor`, `explain`).

### `DJSBOT_E001`

**Missing bot token.** Hint: provide `token` in `defineBot()` or set the
`DISCORD_TOKEN` env var.

Raised by `bot.start()`, `bot.deploy()` and `bot.clear()` when there is
neither a `token` in the configuration nor a `DISCORD_TOKEN` variable. An empty
value counts as missing: look for a stray `DISCORD_TOKEN=` line in `.env`.

If your entry file reads the token with `env("DISCORD_TOKEN")`, as the starter
does, `env()` fails first with its own message
(`Missing required environment variable "DISCORD_TOKEN"`), which has no code.
The fix is the same.

### `DJSBOT_E002`

**Missing application client id.** Hint: set `clientId` in `defineBot()` or the
`DISCORD_CLIENT_ID` env var, required to deploy commands.

Raised by `bot.deploy()` and `bot.clear()`, so by `djs-bot deploy` and
`djs-bot clear`. The bot connects without a client id, and the automatic
deployment at startup reads the id from the connection. Only the explicit
deployment needs it. You find it under **General Information** in the Developer
Portal.

### `DJSBOT_E010`

**Duplicate command name.** Hint: two commands registered under the same name;
command names must be unique.

Two different slash command definitions share a name. The detail gives the
name. The usual causes are a copy-pasted file whose `name` was not changed, and
a stale copy of the same file loaded from a second place (a `dist/` folder next
to the sources, for example).

Registering the same object twice is harmless: a definition can be discovered
from its own file and also listed in a `defineFeature`. Run
`npx djs-bot explain` to see everything that loaded.

### `DJSBOT_E011`

**Duplicate component id.** Hint: two components share the same id;
button/select/modal ids must be unique per type.

Two buttons, two select menus or two modals share an `id`. Ids are unique per
type, so a button and a modal may use the same one. Namespace them to stay out
of trouble: `ticket:close`, `poll:vote`.

The same code is raised for two user context-menu commands, or two message
context-menu commands, with the same name. The detail says which kind collided.

### `DJSBOT_E012`

**Invalid command or option name.** Hint: slash command, subcommand, group and
option names must be 1-32 chars, lowercase, and use only letters, numbers, `-`
or `_` (no spaces).

Raised by `defineCommand` for the command, its subcommands, its groups and its
options. The detail names the offender.

```ts
name: "My Command" // refused: capitals and a space
name: "my-command" // accepted
```

Letters of any script are accepted, as long as they are lowercase.

Context-menu commands (`defineUserCommand`, `defineMessageCommand`) may use
spaces and capitals. They raise this code only when the name is empty or longer
than 32 characters.

### `DJSBOT_E013`

**Invalid component id.** Hint: button/select/modal ids must be non-empty and
must not contain `$` (reserved as the customId separator); use `:` or `-` to
namespace.

Raised by `defineButton`, the select menu definitions and `defineModal` when
the `id` is empty, contains `$`, or is longer than 100 characters.

### `DJSBOT_E014`

**Invalid modal definition.** Hint: a modal holds 1 to 5 components; a select
takes 1-25 options, a radio group 2-10, a checkbox group 1-10.

Raised by `defineModal`, so a mistake fails at startup and never reaches a
user. The detail names the modal and the field.

| Limit | Value |
| --- | --- |
| Components in a modal | 1-5 |
| Title | 1-45 characters |
| Label of a field | 1-45 characters |
| Description of a field | 100 characters |
| Placeholder | 100 characters on a text input, 150 on a select or picker |
| Pre-filled `value` of a text input | 4000 characters |
| `minLength` / `maxLength` of a text input | 0-4000 / 1-4000 |
| Options of `field.select` / `field.radio` / `field.checkboxes` | 1-25 / 2-10 / 1-10 |
| Label, value and description of an option | 100 characters each |
| `minValues` / `maxValues` | 0-25 / 1-25 (0-10 / 1-10 on `field.files`) |
| `fileTypes` of `field.files` | 10 entries |

A minimum above its maximum is refused, and so is a `fileTypes` entry that is
not `"image"`, `"video"`, `"audio"` or an extension such as `".pdf"`.

### `DJSBOT_E015`

**Invalid command definition.** Hint: Discord limits: descriptions of 1-100
characters, 25 options and 25 choices per command, 8000 characters in total,
and 100 slash commands (15 of each context-menu type) per scope.

A command breaks a limit that Discord enforces when it is deployed. Raised by
`defineCommand`, where the API would only have answered
`400 Invalid Form Body`. The detail names the exact field.

| Limit | Value |
| --- | --- |
| Description (command, subcommand, group, option), longest localization included | 1-100 characters |
| Options per command or subcommand | 25 |
| Subcommands and groups per command, subcommands per group | 25 |
| Choices per option | 25 |
| Name of a choice | 1-100 characters |
| String value of a choice | 100 characters |
| `minLength` / `maxLength` of a string option | 0-6000 / 1-6000 |
| `fileTypes` of an attachment option | 10 entries |
| Names, descriptions and choices of one command, added up | 8000 characters |
| Commands per scope (global, or one guild) | 100 slash, 15 user, 15 message |

It also refuses `choices` combined with `autocomplete`, a `min` above its
`max`, a `minLength` above its `maxLength`, and a `fileTypes` entry that is not
`"image"`, `"video"`, `"audio"` or an extension such as `".pdf"`.

The per-scope count is the one check made at deployment, because it depends on
the whole bot. Its hint suggests the two ways out: group related commands as
subcommands of one command, or scope some of them to specific guilds.

### `DJSBOT_E020`

**customId too long.** Hint: shorten params or move large state into a store
keyed by a short id; the limit is 100.

Raised by `.build()` on a button, a select menu or a modal when the encoded
customId (the `id` plus the encoded `params`) exceeds Discord's limit of 100
characters. The detail gives the id and the length produced.

Shorten the params, or store the payload and keep only a short key:

```ts
const key = crypto.randomUUID().slice(0, 8);
await ctx.services.store.set(`draft:${key}`, bigObject, "10m");
Publish.build({ key });
```

### `DJSBOT_E021`

**Invalid customId payload.** Hint: the component payload could not be decoded;
it may have been produced by an incompatible version.

Raised when a user clicks a component whose customId has the right `id` but a
params section that cannot be read. This happens with old messages whose
components were built by different code, or with a customId written by hand.
Always build components with `.build()`.

The error is raised before the handler's error boundary starts. It is logged
as `Interaction routing failed` with the `correlationId`, `onError` is not
called, and the user sees Discord's "This interaction failed". The fix is to
send a fresh message.

### `DJSBOT_E030`

**Service resolution failed.** Hint: a service dependency is missing or forms a
cycle; check the `deps` arrays.

Raised at startup when services depend on each other in a circle. The detail
prints the chain (`dependency cycle: a -> b -> a`) and `error.meta.chain` holds
it as an array. Break the cycle by moving the shared part into a third service
that both depend on.

A dependency that does not exist at all raises
[`DJSBOT_E031`](#djsbot_e031) instead.

### `DJSBOT_E031`

**Unknown service.** Hint: requested a service that was never registered,
followed by the list of the services that are.

Raised at startup when a `deps` array names a token nobody registered, and at
run time when a handler reads `ctx.services.something` that does not exist.
Check for a typo against the list in the hint, and check that the
`defineService` file sits inside your features folder with the `.service`
suffix. `npx djs-bot explain` lists every registered token.

### `DJSBOT_E040`

**Feature contract not satisfied.** Hint: a feature/plugin `requires` a
capability that nothing `provides`.

A feature or a plugin lists a capability in `requires` and nothing offers it.
A capability is offered by a service registered under that name, by the
`provides` of a plugin or a feature, or by the configuration:
`defineBot({ store })` satisfies `requires: ["store"]`, and the same goes for
`audit` and `flags`. Register what is missing, or drop the requirement.

### `DJSBOT_E041`

**Capability conflict.** Hint: two plugins provide the same capability without
an explicit override.

A plugin lists a capability in `conflicts`, and a service, a plugin or a
feature provides that capability. The detail names the plugin and the
capability. Remove one of the two, or rename what the other one provides.

### `DJSBOT_E050`

**Invalid option value.** Hint: a command option failed runtime validation at
the Discord boundary.

Reserved. The current version never raises it: Discord checks choices, ranges
and lengths itself before it sends the interaction to the bot. The code stays
in the catalogue so that its link keeps working.

### `DJSBOT_E060`

**Loader error.** Hint: a discovered file could not be imported or exported no
valid definitions.

Raised while the features folder is loaded. The detail names the file.

- **The file could not be imported.** The detail ends with the message of the
  real error, and `error.cause` is that error. It is often a syntax error or a
  bad import, and it is also how a definition-time error surfaces: a file whose
  `defineCommand` raises [`DJSBOT_E012`](#djsbot_e012) is reported under
  `DJSBOT_E060`, with the message
  `Loader error: failed to import <file>: Invalid command or option name: ...`.
- **The file exports no definition.** Its name carries a recognised suffix, but
  nothing it exports is the result of a `define*()` call. Export the
  definition, or rename the file if it is a helper.
- **A stale build sits next to the sources.** Delete `dist/` and rebuild.

To see the underlying error with its full stack, import the file directly in a
scratch script. See [Project layout](/basics/project-layout/) for the suffixes
the loader recognises.

### `DJSBOT_E070`

**Privileged intent required.** Hint: an event needs a privileged intent;
enable it in the Developer Portal, or set `intents: "auto"`.

Reserved. The current version never raises it. When the automatic selection
of intents includes a privileged one, the framework logs a warning at load, and
`djs-bot doctor` and `djs-bot explain` list the intents concerned. If one of
them is not switched on in the Developer Portal, the connection itself fails,
with the discord.js error `DisallowedIntents`.

Turn the intent on under **Bot**, **Privileged Gateway Intents**:

| Intent | Needed for |
| --- | --- |
| `GuildMembers` | Member events such as `guildMemberAdd` and `guildMemberRemove`, member caching |
| `MessageContent` | Reading message text: `messageCreate` listeners and every `defineTrigger` |
| `GuildPresences` | `presenceUpdate` |

An app with fewer than 10,000 users can toggle these freely. From 10,000 users
on, Discord requires an application for each privileged intent, and the access
has to be reconfirmed every year.

If a listener does not need the intent (a `messageCreate` handler that only
reacts to mentions, for example), drop it:

```ts
intents: { remove: [GatewayIntentBits.MessageContent] }
```

See [Events and intents](/events/events-and-intents/).

### `DJSBOT_E080`

**Invalid job schedule.** Hint: use a duration (`"30s"`, `"5m"`, `"1h"`), a
5-field cron expression (`"0 3 * * *"`) or a macro (`"@daily"`).

Raised by `defineJob`, at startup and not when the job was due. The detail
names the job and its schedule, and `error.cause` says which part is wrong
(`"61" is not a valid minute (expected 0-59)`). See
[Scheduled jobs](/events/jobs/).

## See also

- [The ctx object](/basics/context/) for `ctx.reply.error()` and the rest of the reply API.
- [Wording and theme](/basics/wording-and-theme/) to reword the default error message.
- [Plugins and hooks](/architecture/plugins/) for `errorReporter` and the other hooks.
- [Logging](/production/logging/) for the logger and the `correlationId`.
- [CLI](/api/cli/) for `doctor` and `explain`, which catch most startup errors before you run.
