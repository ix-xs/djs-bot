---
title: "Testing"
description: "createHarness: run commands, components, modals, autocomplete and jobs with no Discord connection."
sidebar:
  order: 20
---

Handlers are plain functions, so they are testable without a token, a gateway
connection or a test server. The harness invokes one, captures everything it
sent and reports whether the guards passed.

```ts
import { createHarness } from "@ix-xs/djs-bot/testing";
```

## `createHarness(bot?)`

Pass a loaded `Bot` to reuse its real services, owners and message overrides, or
omit it and inject fakes per call:

```ts
import { it, expect } from "vitest";
import { createHarness } from "@ix-xs/djs-bot/testing";
import Ban from "../features/moderation/ban.command.js";

const harness = createHarness();

it("bans a member", async () => {
  const result = await harness.command(Ban, {
    guildId: "123",
    options: { target: fakeUser, reason: "spam" },
    services: { db: fakeDb },
  });

  expect(result.passedGuards).toBe(true);
  expect(result.replies[0]?.type).toBe("success");
});
```

## Invoking handlers

| Method | Specific input |
| --- | --- |
| `harness.command(def, input?)` | `options`; `subcommand` and `group` to target one leaf |
| `harness.userCommand(def, input?)` | `targetUser`, `targetMember` |
| `harness.messageCommand(def, input?)` | `targetMessage` |
| `harness.button(def, input?)` | `params` |
| `harness.select(def, input?)` | `params`, `values`, and `users` / `members` / `roles` / `channels` for native selects |
| `harness.modal(def, input?)` | `fields`, `params` |
| `harness.autocomplete(def, input)` | `option`, `value`, `options`, `subcommand`, `group`; resolves to the choices the bot would send |
| `harness.job(def, input?)` | `services`, `signal`; runs the job once |

### Shared input

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `userId` | `string` | `"test-user"` | The invoking user id. |
| `guildId` | `string` | none (DM) | Fake guild id - needed to test `inGuild()`. |
| `channelId` | `string` | none | Fake channel id - needed to test `inChannel()`. |
| `services` | `Partial<ServiceMap>` | the bot's | Injected services. Overrides the bot's. |
| `locale` | `string` | `"en"` | For `ctx.locale`. |
| `owners` | `string[]` | the bot's, or `[]` | For `ctx.owners`, so `ownerOnly()` is testable. |
| `permissions` | `PermissionResolvable[]` | every permission | What the member holds, for `hasPermission()`. |
| `botPermissions` | `PermissionResolvable[]` | every permission | What the bot holds, for `botHasPermission()`. |
| `roles` | `string[]` | `[]` | Role ids the member holds, for `hasRole()`. |
| `messages` | `FrameworkMessages` | the bot's | Message overrides, as in `defineBot({ messages })`. |
| `interaction` | `Record<string, unknown>` | `{}` | Extra fields merged into the fake `ctx.interaction`. |
| `runGuards` | `boolean` | `true` | Set `false` to test a handler in isolation. |

## `HarnessResult`

| Field | Type | Description |
| --- | --- | --- |
| `replies` | `CapturedReply[]` | Everything the handler sent, in order. |
| `passedGuards` | `boolean` | Whether every guard passed. The handler only runs when it did. |
| `rejectionReason` | `string?` | The message from the guard that rejected. |

A `CapturedReply` has a `type` and, when there is one, the `content` that was
passed:

`reply` `success` `error` `info` `warn` `ephemeral` `defer` `followUp`
`editReply` `delete` `update` `update:disable` `modal`

A `modal` entry holds the built `ModalBuilder`, so you can assert on its title
or components.

## Testing guards

```ts
it("refuses outside a guild", async () => {
  const result = await harness.command(Ban, { options: { target: fakeUser } });

  expect(result.passedGuards).toBe(false);
  expect(result.rejectionReason).toMatch(/server/i);
  expect(result.replies).toHaveLength(0);      // the handler never ran
});

it("requires the Ban Members permission", async () => {
  const result = await harness.command(Ban, { guildId: "g", permissions: [] });
  expect(result.rejectionReason).toBe("You need: Ban Members.");
});

it("explains what the bot is missing", async () => {
  const result = await harness.command(Purge, { guildId: "g", botPermissions: [] });
  expect(result.rejectionReason).toBe("I need: Manage Messages.");
});

it("refuses on cooldown", async () => {
  await harness.command(Daily, { userId: "u1", guildId: "g1" });
  const second = await harness.command(Daily, { userId: "u1", guildId: "g1" });
  expect(second.passedGuards).toBe(false);
});
```

## Testing subcommands

```ts
it("sets a config key", async () => {
  const result = await harness.command(Config, {
    subcommand: "set",              // add group: "role" for a grouped subcommand
    guildId: "g",
    options: { key: "prefix", value: "!" },
  });
  expect(result.replies[0]?.type).toBe("success");
});
```

The parent command's guards run first, then the subcommand's, as in production.

## Testing components and modals

```ts
it("closes the right ticket", async () => {
  const result = await harness.button(CloseButton, {
    params: { ticketId: "42" },
    services: { tickets: fakeTickets },
  });

  expect(fakeTickets.closed).toContain("42");
  expect(result.replies[0]?.type).toBe("success");
});

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

Pass each modal field in the shape the handler will read: a string for text, an
array for selects, a `Collection` for pickers and uploads, a boolean for a
checkbox.

## Testing autocomplete

`value` is what the user has typed, `options` what the other options hold.
The result is exactly what the bot would send: mapped to `{ name, value }`,
made valid for Discord and capped at 25.

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

## Testing jobs

```ts
it("purges old rows", async () => {
  await harness.job(NightlyCleanup, { services: { db: fakeDb } });
  expect(fakeDb.purged).toBe(true);
});
```

## Faking services

Services are injected, so a fake is just an object:

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

For anything store-shaped, the real implementation is already test-friendly:

```ts
import { memoryStore, sqliteStore } from "@ix-xs/djs-bot";

const store = memoryStore();               // fast, isolated per test
const durable = sqliteStore(":memory:");   // same code path as production
```

## Integration checks without a connection

`bot.load()` performs discovery, service resolution and contract validation
**without** connecting to Discord - so a single test catches duplicate names,
missing services, invalid schedules and broken contracts:

```ts
import bot from "../src/index.js";

it("loads cleanly", async () => {
  await expect(bot.load()).resolves.not.toThrow();

  const description = await bot.describe();
  expect(description.commands).toContain("ban");
});
```

The same validation runs in CI through `npx djs-bot doctor`.
