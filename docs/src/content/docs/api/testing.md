---
title: "Testing"
description: "createHarness: run handlers with no Discord connection, assert replies and guards."
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

Pass a loaded `Bot` to reuse its real services, or omit it and inject fakes per
call:

```ts
import { describe, it, expect } from "vitest";
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

| Method | Extra input |
| --- | --- |
| `harness.command(def, input?)` | `options` — matching the command schema |
| `harness.button(def, input?)` | `params` |
| `harness.select(def, input?)` | `params`, `values` |
| `harness.modal(def, input?)` | `fields`, `params` |

### Shared input

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `userId` | `string` | `"test-user"` | The invoking user id. |
| `guildId` | `string` | none (DM) | Fake guild id — needed to test `inGuild()`. |
| `services` | `Partial<ServiceMap>` | the bot services | Injected services. Overrides the bot ones. |
| `locale` | `string` | `"en"` | For `ctx.locale` and `ctx.t()`. |
| `owners` | `string[]` | `[]` | For `ctx.owners`, so `ownerOnly()` is testable. |
| `runGuards` | `boolean` | `true` | Set `false` to test a handler in isolation. |

## `HarnessResult`

| Field | Type | Description |
| --- | --- | --- |
| `replies` | `CapturedReply[]` | Everything the handler sent, in order. |
| `passedGuards` | `boolean` | Whether every guard passed. The handler only runs when it did. |
| `rejectionReason` | `string?` | The message from the guard that rejected. |

A `CapturedReply` has a `type` — `reply`, `success`, `error`, `info`, `defer`,
`followUp`, `editReply`, `update`, `update:disable` — and the `content` that was
passed.

## Testing guards

```ts
it("refuses outside a guild", async () => {
  const result = await harness.command(Ban, { options: { target: fakeUser } });

  expect(result.passedGuards).toBe(false);
  expect(result.rejectionReason).toMatch(/server/i);
  expect(result.replies).toHaveLength(0);      // the handler never ran
});

it("refuses on cooldown", async () => {
  await harness.command(Daily, { userId: "u1", guildId: "g1" });
  const second = await harness.command(Daily, { userId: "u1", guildId: "g1" });

  expect(second.passedGuards).toBe(false);
});
```

## Testing components

```ts
it("closes the right ticket", async () => {
  const result = await harness.button(CloseButton, {
    params: { ticketId: "42" },
    services: { tickets: fakeTickets },
  });

  expect(fakeTickets.closed).toContain("42");
  expect(result.replies[0]?.type).toBe("success");
});

it("reads submitted modal fields", async () => {
  const result = await harness.modal(Feedback, {
    fields: { subject: "Bug", body: "It broke" },
  });

  expect(result.replies[0]?.content).toMatchObject({ embeds: expect.anything() });
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

## Testing services and jobs directly

They are ordinary values — no harness required:

```ts
const service = new TicketService(fakeDb);
await service.open("user-1");
expect(await service.count()).toBe(1);

await MyJob.run({ client: fakeClient, services: { db: fakeDb }, logger, correlationId: "t" } as never);
```

## Integration checks without a connection

`bot.load()` performs discovery, service resolution and contract validation
**without** connecting to Discord — so a single test catches duplicate names,
missing services and broken contracts:

```ts
import bot from "../src/index.js";

it("loads cleanly", async () => {
  await expect(bot.load()).resolves.not.toThrow();

  const description = await bot.describe();
  expect(description.commands.map((c) => c.name)).toContain("ban");
});
```

The same validation runs in CI through `npx djs-bot doctor`.
