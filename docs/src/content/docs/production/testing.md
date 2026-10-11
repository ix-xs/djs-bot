---
title: "Testing"
description: "Run your commands, components, modals, autocomplete handlers and jobs in a normal test runner, with no token, no network and no test server. The harness calls a handler, records everything it sent and tells you whether the guards let it through."
sidebar:
  order: 7
---

Handlers are plain functions, so testing one does not need Discord. The harness
lives on its own entry point, `@ix-xs/djs-bot/testing`, and works with any test
runner. The examples on this page use Vitest.

## A first test

Take a command:

```ts title="src/features/echo/echo.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "echo",
  description: "Repeat a message",
  options: { text: s.string({ description: "What to repeat", required: true }) },
  run: (ctx) => ctx.reply(ctx.options.text),
});
```

Create a harness, call the command with the options a user would give, and look
at what came back:

```ts title="test/echo.test.ts"
import { expect, it } from "vitest";
import { createHarness } from "@ix-xs/djs-bot/testing";
import Echo from "../src/features/echo/echo.command.js";

const harness = createHarness();

it("repeats the text", async () => {
  const { replies, passedGuards } = await harness.command(Echo, { options: { text: "hello" } });

  expect(passedGuards).toBe(true);
  expect(replies).toEqual([{ type: "reply", content: "hello" }]);
});
```

`replies` lists every call the handler made on `ctx.reply`, `ctx.update` and
`ctx.showModal`, in order. Each entry has a `type` (which method) and the
`content` that was passed.

The harness runs the guards and the handler, nothing more. Three things the
real bot does are left out, on purpose:

- **No error boundary.** A handler that throws rejects the promise, so
  `await expect(harness.command(Broken)).rejects.toThrow()` works.
- **No plugins.** Middleware and hooks do not run, and neither does
  [automatic deferral](/basics/automatic-deferral/).
- **No validation of the input.** `options`, `params` and `fields` reach the
  handler exactly as you pass them.

## Guards and permissions

By default a test runs as the user `test-user`, in a DM, holding every
permission. The shared inputs change that, one guard at a time. Take a ban
command guarded like this:

```ts
guards: [
  inGuild(),
  hasPermission(PermissionFlagsBits.BanMembers),
  botHasPermission(PermissionFlagsBits.BanMembers),
],
```

```ts title="test/ban.test.ts"
import { expect, it } from "vitest";
import { createHarness } from "@ix-xs/djs-bot/testing";
import Ban from "../src/features/moderation/ban.command.js";

const harness = createHarness();
const target = { id: "42" };

it("refuses outside a server", async () => {
  const result = await harness.command(Ban, { options: { target } });

  expect(result.passedGuards).toBe(false);
  expect(result.rejectionReason).toMatch(/server/i);
  expect(result.replies).toHaveLength(0);   // the handler never ran
});

it("requires the Ban Members permission", async () => {
  const result = await harness.command(Ban, { guildId: "g1", permissions: [], options: { target } });
  expect(result.rejectionReason).toBe("You need: Ban Members.");
});

it("says what the bot is missing", async () => {
  const result = await harness.command(Ban, { guildId: "g1", botPermissions: [], options: { target } });
  expect(result.rejectionReason).toBe("I need: Ban Members.");
});
```

| To exercise | Pass |
| --- | --- |
| `inGuild()`, `dmOnly()` | `guildId`, or nothing for a DM |
| `hasPermission()` | `guildId` and `permissions` |
| `botHasPermission()` | `botPermissions` |
| `hasRole()` | `guildId` and `roles` |
| `inChannel()` | `channelId` |
| `ownerOnly()` | `owners` and `userId` |
| `cooldown()`, `rateLimit()` | the same `userId` twice |

```ts
it("refuses on cooldown", async () => {
  await harness.command(Daily, { userId: "u1", guildId: "g1" });
  const second = await harness.command(Daily, { userId: "u1", guildId: "g1" });
  expect(second.passedGuards).toBe(false);
});
```

A cooldown or a rate limit keeps its counters inside the definition, which the
tests of one file share. Use a different `userId` in each test to keep them
independent.

:::note[A refusal sends nothing]
When a guard refuses, the real bot answers with the reason as an error message.
The harness reports it in `rejectionReason` and leaves `replies` empty, so you
can tell a refusal from an error the handler sent itself.
:::

To test a handler without its guards, pass `runGuards: false`. To check a
reworded refusal, pass the same `messages` object you give to `defineBot`. The
guards themselves are described on the [Guards](/commands/guards/) page.

## Subcommands and autocomplete

Name the subcommand to run, and its group when it has one. The guards of the
parent command run first, then those of the subcommand, as in production.

```ts
it("sets a config key", async () => {
  const result = await harness.command(Config, {
    subcommand: "set",              // add group: "role" for a grouped subcommand
    guildId: "g1",
    options: { key: "prefix", value: "!" },
  });
  expect(result.replies[0]?.type).toBe("success");
});
```

`harness.autocomplete` runs the autocomplete handler of one option and resolves
with the suggestions, exactly as the bot would send them: mapped to
`{ name, value }`, made valid for Discord and capped at 25. `value` is what the
user has typed so far, `options` what the other options already hold.

```ts
it("suggests matching songs", async () => {
  const choices = await harness.autocomplete(Play, {
    option: "song",
    value: "bo",
    services: { music: fakeMusic },
  });
  expect(choices).toEqual([{ name: "Bohemian Rhapsody", value: "s1" }]);
});

it("suggests the items of the chosen category", async () => {
  const choices = await harness.autocomplete(Buy, {
    option: "item",
    value: "sw",
    options: { category: "weapons" },
  });
  expect(choices.map((choice) => choice.value)).toEqual(["sword", "switchblade"]);
});
```

Both calls throw a plain `Error` when the target does not exist: an unknown
subcommand, or an option without an autocomplete handler.

## Components and modals

A component receives its `params` already decoded, so pass them as the object
the handler reads. Nothing is encoded into a customId along the way.

```ts
it("only lets the owner close the ticket", async () => {
  const result = await harness.button(CloseTicket, {
    userId: "someone-else",
    params: { ticketId: "t1", ownerId: "owner" },
  });
  expect(result.replies[0]?.type).toBe("error");
});

it("reads the picked values", async () => {
  const result = await harness.select(ColourMenu, { values: ["red", "blue"] });
  expect(result.replies[0]).toEqual({ type: "update", content: "Picked 2 colours" });
});
```

A command that opens a modal records a `modal` entry, whose `content` is the
built `ModalBuilder`. The modal handler is tested on its own, with the submitted
values:

```ts
it("opens the feedback form", async () => {
  const result = await harness.command(FeedbackCommand);
  expect(result.replies[0]?.type).toBe("modal");
});

it("reads the submitted fields", async () => {
  const result = await harness.modal(Feedback, {
    fields: { subject: "Bug", kind: ["bug"], body: "It broke", shots: new Collection() },
  });
  expect(result.replies[0]?.type).toBe("success");
});
```

Give each field the shape the handler will read: a string for a text input, an
array for a select, a `Collection` for a picker or an upload, a boolean for a
checkbox. The field types are listed on the [Modals](/components/modals/) page.

## Jobs and fake services

`harness.job` runs a job once, right away, whatever its schedule.

```ts
it("purges old rows", async () => {
  await harness.job(NightlyCleanup, { services: { db: fakeDb } });
  expect(fakeDb.purged).toBe(true);
});
```

Services are injected, so a fake is an ordinary object with the methods the
handler calls:

```ts
const fakeDb = {
  users: new Map<string, { xp: number }>(),
  async addXp(id: string, amount: number) {
    const user = this.users.get(id) ?? { xp: 0 };
    user.xp += amount;
    this.users.set(id, user);
  },
};

await harness.command(Rank, { services: { db: fakeDb } });
```

For anything shaped like a store, the real implementations are already fit for
tests:

```ts
import { memoryStore, sqliteStore } from "@ix-xs/djs-bot";

const store = memoryStore();               // fast, isolated per test
const durable = sqliteStore(":memory:");   // the same code path as production
```

`ctx.client` is an empty object in the harness and cannot be replaced. A handler
that talks to Discord directly is hard to test. One that goes through a
[service](/architecture/services/) is not: you hand it a fake.

## Checking the whole bot

`bot.load()` discovers the features, builds the services and validates the
contracts, without connecting to Discord. One test therefore catches duplicate
names, missing services, invalid schedules and broken contracts. Passing the
loaded bot to `createHarness` then runs handlers against its real services,
owners and message overrides.

```ts title="test/bot.test.ts"
import { beforeAll, expect, it } from "vitest";
import type { Bot } from "@ix-xs/djs-bot";
import { createHarness } from "@ix-xs/djs-bot/testing";
import Ping from "../src/features/ping/ping.command.js";

let bot: Bot;

beforeAll(async () => {
  // The entry file calls bot.start() unless this is set: set it before the import.
  process.env.DJSBOT_CLI = "introspect";
  bot = (await import("../src/index.js")).default;
  await bot.load();
});

it("loads cleanly", async () => {
  const description = await bot.describe();
  expect(description.commands).toContain("ping");
});

it("answers with the real services", async () => {
  const result = await createHarness(bot).command(Ping);
  expect(result.passedGuards).toBe(true);
});
```

:::caution[Importing the entry file runs it]
The entry file is evaluated like in production: the variables it reads with
`env()` must exist (any value will do for the token, nothing connects), and
`bot.load()` runs your real service factories, so a service that opens a
database opens it in the test too.
:::

The same validation runs outside the test suite with `npx djs-bot doctor`,
described on the [CLI](/api/cli/) page.

## Reference

### `createHarness(bot)`

Returns a `Harness`. `bot` is optional: pass a `Bot` on which `bot.load()` has
completed to use its services, its `owners` and its `messages` as defaults.
Without it, inject what each call needs.

Every method below takes a definition and an optional input object, and (except
`autocomplete` and `job`) resolves with a
[`HarnessResult`](/production/testing/#harnessresult). The input accepts the
[shared fields](/production/testing/#shared-input) plus the ones listed for the
method.

### `harness.command(def, input)`

Runs a slash command, or one of its subcommands.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `options` | `Record<string, unknown>` | `{}` | The option values, by name: what `ctx.options` holds. |
| `subcommand` | `string` | none | The subcommand to run. |
| `group` | `string` | none | The group that subcommand belongs to. |

### `harness.userCommand(def, input)`

Runs a user context-menu command.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `targetUser` | `unknown` | `{ id: "target-user" }` | What `ctx.targetUser` holds. |
| `targetMember` | `unknown` | `null` | What `ctx.targetMember` holds. |

### `harness.messageCommand(def, input)`

Runs a message context-menu command.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `targetMessage` | `unknown` | `{ id: "target-message", content: "" }` | What `ctx.targetMessage` holds. |

### `harness.button(def, input)`

Runs a button handler.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `params` | `Record<string, unknown>` | `{}` | What `ctx.params` holds. |

### `harness.select(def, input)`

Runs a select-menu handler, string or native.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `params` | `Record<string, unknown>` | `{}` | What `ctx.params` holds. |
| `values` | `string[]` | `[]` | The picked values or ids: `ctx.values`. |
| `users` | `unknown` | none | `ctx.users`, for a user or mentionable select. |
| `members` | `unknown` | none | `ctx.members`, for a user or mentionable select. |
| `channels` | `unknown` | none | `ctx.channels`, for a channel select. |
| `roles` | `string[]` | none | `ctx.roles`, for a role or mentionable select. It is the same field as the shared `roles` input, so the value also becomes the role ids of the member. |

### `harness.modal(def, input)`

Runs a modal handler. There is no `ctx.update` and no `ctx.showModal` here, as
in a real modal submission.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `fields` | `Record<string, unknown>` | `{}` | The submitted values, by field name: `ctx.fields`. |
| `params` | `Record<string, unknown>` | `{}` | What `ctx.params` holds. |

### `harness.autocomplete(def, input)`

Runs the autocomplete handler of one option of a slash command. Resolves with
the `AutocompleteChoice[]` the bot would send. Guards do not run for
autocomplete. Of the shared fields, only `userId`, `guildId`, `channelId`,
`services` and `locale` apply.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `option` | `string` | required | The name of the option being typed. |
| `value` | `string` | `""` | What the user has typed so far: `ctx.value`. |
| `options` | `AutocompleteOptions` | `{}` | What the other options hold: `ctx.options`. The focused option is added to it. |
| `subcommand` | `string` | none | The subcommand the option belongs to. |
| `group` | `string` | none | The group of that subcommand. |

### `harness.job(def, input)`

Runs a job once and resolves with nothing. An error thrown by the job rejects
the promise.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `services` | `Partial<ServiceMap>` | the bot's, or `{}` | What `ctx.services` holds. |
| `signal` | `AbortSignal` | a signal that never aborts | What `ctx.signal` holds, to test how a job reacts to a shutdown. |

### Shared input

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `userId` | `string` | `"test-user"` | The id of the invoking user. |
| `guildId` | `string` | none (a DM) | A fake guild id. Without it `ctx.guild` and `ctx.member` are `null`. |
| `channelId` | `string` | none | A fake channel id. |
| `services` | `Partial<ServiceMap>` | the bot's, or `{}` | What `ctx.services` holds. It replaces the bot's services, it is not merged with them. |
| `locale` | `string` | `"en"` | `ctx.locale`. |
| `owners` | `string[]` | the bot's, or `[]` | `ctx.owners`, for `ownerOnly()`. |
| `permissions` | `PermissionResolvable[]` | every permission | What the member holds, for `hasPermission()`. Needs `guildId`. |
| `botPermissions` | `PermissionResolvable[]` | every permission | What the bot holds, for `botHasPermission()`. |
| `roles` | `string[]` | `[]` | Role ids the member holds, for `hasRole()`. Needs `guildId`. |
| `messages` | `FrameworkMessages` | the bot's | Message overrides, as in `defineBot({ messages })`. |
| `interaction` | `Record<string, unknown>` | `{}` | Extra fields merged into the fake `ctx.interaction`. |
| `runGuards` | `boolean` | `true` | Pass `false` to skip the guards and test the handler alone. |

### `HarnessResult`

| Field | Type | Description |
| --- | --- | --- |
| `replies` | `CapturedReply[]` | Everything the handler sent, in order. |
| `passedGuards` | `boolean` | Whether every guard passed. The handler runs only when it is `true`. |
| `rejectionReason` | `string?` | The reason given by the guard that refused, if it gave one. |

### `CapturedReply`

An object `{ type, content? }`. `content` is the first argument of the call.
The options of a semantic reply (`{ ephemeral: true }`, a title) are not
recorded.

| `type` | Recorded by |
| --- | --- |
| `reply` | `ctx.reply(...)` |
| `success`, `error`, `info`, `warn` | `ctx.reply.success(...)` and its siblings |
| `ephemeral` | `ctx.reply.ephemeral(...)` |
| `defer` | `ctx.reply.defer()` or `ctx.update.defer()` |
| `followUp` | `ctx.reply.followUp(...)` |
| `editReply` | `ctx.reply.editReply(...)` |
| `delete` | `ctx.reply.delete()` |
| `update` | `ctx.update(...)` |
| `update:disable` | `ctx.update.disable()` |
| `modal` | `ctx.showModal(...)`. `content` is the built `ModalBuilder`. |

`ctx.reply.fetch()` records nothing and resolves with `{ id: "test-reply" }`.

### The fake `ctx`

What a handler finds on its context under the harness. The real one is
described on [The ctx object](/basics/context/).

| Property | Value |
| --- | --- |
| `ctx.user` | `{ id, username, tag }` built from `userId`. Prints as a mention. |
| `ctx.guild`, `ctx.guildId` | `{ id }` and the id when `guildId` is given, `null` otherwise. The fake guild has no owner, so `guildOwnerOnly()` always refuses. |
| `ctx.member` | The id, the `permissions` and the `roles` when `guildId` is given, `null` otherwise. |
| `ctx.channel`, `ctx.channelId` | `{ id }` and the id when `channelId` is given, `null` otherwise. |
| `ctx.interaction` | The two permission sets, plus what you pass as `interaction`. |
| `ctx.client` | An empty object. |
| `ctx.services` | The `services` input, else the bot's services, else an empty object. |
| `ctx.logger` | A silent logger. |
| `ctx.correlationId` | `"test"` |
| `ctx.t(key)` | Returns the key, even when the bot has translations. |
| `ctx.say(key, vars)` | The framework's wording, with the `messages` overrides. |
| `ctx.audit(...)` | Does nothing. |

## See also

- [Guards](/commands/guards/): the preconditions the shared inputs exercise.
- [Services](/architecture/services/): the seam that makes a handler testable.
- [Store](/data/store/): `memoryStore()` and `sqliteStore(":memory:")` in tests.
- [The ctx object](/basics/context/): what the fake context stands in for.
- [CLI](/api/cli/): `djs-bot doctor`, the same checks from the command line.
