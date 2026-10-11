---
title: "The ctx object"
description: "Every property and method on ctx: reply, update, showModal, options, params, fields, services, logger, t, say, audit."
sidebar:
  order: 3
---

Every handler receives exactly one argument: `ctx`. It bundles the raw
discord.js interaction (never hidden from you), the resolved user and guild,
your injected services, a correlation-scoped logger, and reply helpers that
always do the right thing.

```ts
run(ctx) {
  ctx.user;                 // who ran it
  ctx.options.target;       // typed command options
  ctx.services.db;          // your services
  ctx.logger.info("hi");    // correlated logs
  return ctx.reply.success("Done!");
}
```

## `BaseContext` - shared by every handler

| Property | Type | Description |
| --- | --- | --- |
| `client` | `Client<true>` | The connected discord.js client. |
| `interaction` | the raw interaction | Always available. Anything the framework does not wrap, you can still do here. |
| `user` | `User` | Who triggered the interaction. |
| `guild` | `Guild \| null` | The guild, or `null` in DMs. |
| `guildId` | `string \| null` | The guild id. Set even when the bot is not a member (user-installed apps). |
| `channel` | `TextBasedChannel \| null` | The originating channel, when resolvable. |
| `channelId` | `string \| null` | The originating channel id. |
| `member` | `GuildMember \| null` | The member, in a server the bot is in. `null` in DMs and for user-installed apps used elsewhere. |
| `services` | `ServiceMap` | Injected services. `store`, `audit` and `flags` are typed already; see [Services](/api/services/#typing-ctxservices) for yours. |
| `logger` | `Logger` | A child logger already bound to `correlationId`. |
| `correlationId` | `string` | Unique per interaction. Every log line from this handler carries it. |
| `locale` | `string` | The user's Discord client locale, e.g. `"fr"` or `"en-US"`. |
| `owners` | `readonly string[]` | The ids from `defineBot({ owners })`. |

| Method | Signature | Description |
| --- | --- | --- |
| `t` | `(key, vars?) => string` | Translates **your** messages for `ctx.locale`. Returns the key unchanged when i18n is not configured. See [i18n](/api/i18n/). |
| `say` | `(key, vars?) => string` | Renders one of the **framework's** messages, honouring `defineBot({ messages })`. See [Wording](/api/configuration/#messages). |
| `audit` | `(action, details?) => Promise<void>` | Records an audit entry. No-op when audit is not configured. `actorId` and `guildId` are filled in for you. See [Audit](/api/audit/). |
| `reply` | see below | The reply helper. |

## `ctx.reply` - answering the user

`ctx.reply` is **callable and has methods**. It always picks the correct
underlying call - `reply`, `editReply` or `followUp` - depending on whether the
interaction was already deferred or answered, so you never hit
`InteractionAlreadyReplied` again.

```ts
await ctx.reply("Plain text");
await ctx.reply({ embeds: [embed], components: [row] });
```

| Method | Behaviour |
| --- | --- |
| `ctx.reply(content)` | Replies, or edits/follows up if already answered. `content` is a string or full reply options. |
| `ctx.reply.success(msg, opts?)` | Green embed. Public by default. |
| `ctx.reply.info(msg, opts?)` | Blue embed. Public by default. |
| `ctx.reply.warn(msg, opts?)` | Amber embed. Public by default. |
| `ctx.reply.error(msg, opts?)` | Red embed. **Ephemeral by default**; pass `{ ephemeral: false }` to make it public. |
| `ctx.reply.ephemeral(content)` | Any content, visible only to the invoking user. |
| `ctx.reply.defer(opts?)` | Shows the loading state. `{ ephemeral?: boolean }`. Does nothing if already acknowledged. |
| `ctx.reply.followUp(content)` | Sends an additional message. |
| `ctx.reply.editReply(content)` | Edits the current (deferred or sent) reply. |
| `ctx.reply.fetch()` | Resolves to the `Message` that was sent. |
| `ctx.reply.delete()` | Deletes the reply. |

`SemanticReplyOptions` (accepted by `success`, `error`, `info`, `warn`):

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ephemeral` | `boolean` | `false` (`true` for `error`) | Only the invoking user sees it. |
| `title` | `string` | - | Title shown above the message. |

The embed colours come from [`theme`](/api/configuration/#theme).

```ts
await ctx.reply.defer();                     // 3-second clock stopped
const data = await slowApiCall();            // take as long as you need
await ctx.reply.success(`Found ${data.length} results`, { title: "Search" });
```

:::tip[The 3-second rule]
Discord invalidates an interaction that has not been answered within **3
seconds**. Rather than deferring by hand, turn on
[automatic deferral](#automatic-deferral) and forget about it.
:::

## `ctx.update` - editing the source message

Available on **button** and **select menu** contexts only. It edits the message
the component lives on, rather than sending a new one.

| Method | Description |
| --- | --- |
| `ctx.update(content)` | Replaces the message content/embeds/components. |
| `ctx.update.defer()` | Acknowledges silently, changing nothing visible. |
| `ctx.update.disable()` | Disables every component on the source message - the standard "this menu is closed" ending. |

All three work before **and** after a defer: once the interaction was
acknowledged, they edit the message instead of calling `update()` a second time.

```ts
run: async (ctx) => {
  await ctx.update.defer();
  await slowWork();
  await ctx.update({ content: "Ticket closed.", components: [] });
}
```

## `ctx.showModal` - opening a form

Available on command, context-menu, button and select contexts.

```ts
await ctx.showModal(FeedbackModal);                   // a defineModal() definition
await ctx.showModal(EditModal, { ticketId: "42" });   // its params, type-checked
```

It takes the same arguments as the modal's `build()`, so a missing or mistyped
param is a compile error.

:::caution
A modal has to be the **first** response to an interaction: call `showModal`
before any reply or defer. That is also why modal contexts have no `showModal`.
:::

## Automatic deferral

Set `defer` on a definition, or once for the whole bot with
`defineBot({ defaults: { defer: true } })`, and the framework acknowledges slow
handlers for you.

| Value | Behaviour |
| --- | --- |
| `true` | Defer publicly, **only if** the handler has not answered after 2 s. |
| `"ephemeral"` | The same, with an only-you loading state. |
| `"update"` | For components: acknowledge with no loading message, then use `ctx.update`. |
| `{ after, ephemeral?, update? }` | Pick the delay (`0`, `1500`, `"1s"`) and the mode. |
| `false` | Never defer this definition, even when a default is set. |

```ts
export default defineCommand({
  name: "report",
  description: "Build a report",
  defer: "ephemeral",
  async run(ctx) {
    const report = await buildSlowReport();     // 8 seconds
    return ctx.reply.success(report.summary);   // edits the deferred reply
  },
});
```

A fast handler is never deferred, so enabling it globally costs nothing.

What to keep in mind:

- **Visibility is fixed at deferral.** After a public deferral, a later
  `ctx.reply.error()` is public too. Use `"ephemeral"` where that matters.
- **Modals come first.** `showModal` cancels a pending deferral, but cannot undo
  one that already fired. Open the modal before any slow work, or set
  `defer: false` on that definition.
- **Stay on `ctx.reply` / `ctx.update`.** They share a queue with the deferral,
  which is what guarantees the two never collide. A direct
  `ctx.interaction.reply()` bypasses it.

## Per-handler additions

### `CommandContext<Options>`

| Property | Description |
| --- | --- |
| `options` | Fully typed, resolved options - inferred from the `options` map you declared. Required options are non-nullable; optional ones are `T \| undefined`. |
| `showModal` | See [above](#ctxshowmodal---opening-a-form). |

```ts
options: { target: s.user({ required: true }), reason: s.string() },
run(ctx) {
  ctx.options.target;   // User
  ctx.options.reason;   // string | undefined
}
```

### `ButtonContext<Params>`

| Property | Description |
| --- | --- |
| `params` | Typed values decoded from the customId. |
| `update` | The [update helper](#ctxupdate---editing-the-source-message). |
| `showModal` | Open a modal in response to the click. |

### `SelectMenuContext<Params>`

| Property | Type | Present for |
| --- | --- | --- |
| `params` | your param types | all selects |
| `values` | `string[]` | all selects - option values, or ids for native selects |
| `users` | `Collection<string, User>` | user & mentionable selects |
| `members` | `Collection<string, GuildMember>` | user & mentionable selects, in a guild |
| `roles` | `Collection<string, Role>` | role & mentionable selects |
| `channels` | `Collection<string, GuildBasedChannel>` | channel selects |
| `update` | `UpdateFn` | all selects |
| `showModal` | `ShowModalFn` | all selects |

### `ModalContext<Fields>`

| Property | Description |
| --- | --- |
| `fields` | The submitted values, keyed by field name and typed by field kind: a string for text inputs, an array for selects and checkbox groups, a collection for pickers and uploads, a boolean for a checkbox. See [modal fields](/api/options/#field---modal-components). |
| `params` | The params decoded from the modal's customId. |

### `UserCommandContext`

| Property | Description |
| --- | --- |
| `targetUser` | The user the context-menu command was used on. |
| `targetMember` | The same as a `GuildMember`, or `null` outside a guild the bot is in. |
| `showModal` | Open a modal. |

### `MessageCommandContext`

| Property | Description |
| --- | --- |
| `targetMessage` | The message the command was used on. |
| `showModal` | Open a modal. |

### `AutocompleteContext`

Passed to an option `autocomplete` handler. It is **not** repliable - return up
to 25 choices instead.

| Property | Description |
| --- | --- |
| `interaction` | The raw `AutocompleteInteraction`. |
| `client`, `user`, `guild`, `services`, `logger` | As on `BaseContext`. |
| `focused` | The name of the option being typed into. |
| `value` | The partial text typed so far, as a string. |
| `locale`, `t` | The user's language and your translator, for localized suggestions. |

```ts
query: s.string({
  autocomplete: async (ac) => {
    const rows = await ac.services.db.search(ac.value);
    return rows.slice(0, 25).map((r) => ({ name: r.title, value: r.id }));
  },
}),
```

A handler may return `AutocompleteChoice[]`, `string[]` or `number[]` - plain
arrays are mapped to choices automatically.

### Events, triggers and jobs

They are not interactions, so they carry no `reply`:

| Context | Contains |
| --- | --- |
| `EventContext` | `client`, `services`, `logger`, passed **after** the raw discord.js event arguments. |
| `TriggerContext` | `message`, `author`, `member`, `guild`, `channel`, `client`, `services`, `logger`, `correlationId`, `match`, plus `reply(content)` and `send(content)`. |
| `JobContext` | `client`, `services`, `logger`, `correlationId`, `signal` (aborted on shutdown). |

```ts
export default defineJob({
  name: "purge",
  schedule: "@daily",
  run: (ctx) => ctx.services.db.purgeOldRows({ signal: ctx.signal }),
});
```

## `describeInteraction`

A small helper for logging and metrics: the kind of an interaction and a
readable name for it.

```ts
import { describeInteraction } from "@ix-xs/djs-bot";

describeInteraction(ctx.interaction);
// { kind: "command", name: "config set" }
// { kind: "button",  name: "ticket:close" }   (routing id, without the encoded params)
```

## Error handling inside a handler

Anything a handler throws is caught by the framework error boundary, which:

1. logs it with the interaction `correlationId`,
2. calls every plugin `onError` hook,
3. calls your `defineBot({ onError })`, and
4. sends the user a friendly ephemeral message - unless your `onError` returned a
   value, which marks the error handled.

So you can simply `throw` for exceptional cases, and use `ctx.reply.error(...)`
for expected ones:

```ts
run: async (ctx) => {
  if (!ctx.interaction.memberPermissions?.has("BanMembers")) {
    return ctx.reply.error("You cannot ban members.");   // expected: a normal answer
  }
  const user = await api.fetchUser(ctx.options.id);      // unexpected: let it throw
  return ctx.reply.success(user.name);
}
```

See [Errors](/api/errors/) for the full catalogue of coded framework errors.
