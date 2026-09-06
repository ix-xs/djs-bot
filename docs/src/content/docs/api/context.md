---
title: "The ctx object"
description: "Every property and method on ctx: reply, update, options, params, fields, services, logger, t, audit."
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
| `guildId` | `string \| null` | Shortcut for `ctx.guild?.id`. |
| `channel` | `TextBasedChannel \| null` | The originating channel, when resolvable. |
| `member` | `GuildMember \| null` | The guild member, when in a guild. |
| `services` | `ServiceMap` | Injected services. Augment `ServiceMap` for full typing - see [Services](/djs-bot/api/services/#typing-ctxservices). |
| `logger` | `Logger` | A child logger already bound to `correlationId`. |
| `correlationId` | `string` | Unique per interaction. Every log line from this handler carries it. |
| `locale` | `string` | The user Discord client locale, e.g. `"fr"` or `"en-US"`. |
| `owners` | `readonly string[]` | The ids from `defineBot({ owners })`. |

| Method | Signature | Description |
| --- | --- | --- |
| `t` | `(key, vars?) => string` | Translates for `ctx.locale`. Returns the key unchanged when i18n is not configured. See [i18n](/djs-bot/api/i18n/). |
| `audit` | `(action, details?) => Promise<void>` | Records an audit entry. No-op when audit is not configured. `actorId` and `guildId` are filled in for you. See [Audit](/djs-bot/api/audit/). |
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

| Method | Signature | Behaviour |
| --- | --- | --- |
| `ctx.reply(content)` | `string \| InteractionReplyOptions` | Replies, or edits/follows up if already answered. |
| `ctx.reply.success(msg, opts?)` | | Green embed. `ephemeral` defaults to `false`. |
| `ctx.reply.info(msg, opts?)` | | Blue embed. `ephemeral` defaults to `false`. |
| `ctx.reply.error(msg, opts?)` | | Red embed. `ephemeral` defaults to **`true`** - pass `{ ephemeral: false }` to make it public. |
| `ctx.reply.defer(opts?)` | `{ ephemeral?: boolean }` | Shows the loading state. Call it within 3 seconds for slow work. |
| `ctx.reply.followUp(content)` | | Sends an additional message. |
| `ctx.reply.editReply(content)` | | Edits the current (deferred or sent) reply. |

`SemanticReplyOptions` (accepted by `success`, `error`, `info`):

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ephemeral` | `boolean` | `false` (`true` for `error`) | Only the invoking user sees it. |
| `title` | `string` | - | Title shown above the message. |

```ts
await ctx.reply.defer();                     // 3-second clock stopped
const data = await slowApiCall();            // take as long as you need
await ctx.reply.success(`Found ${data.length} results`, { title: "Search" });
```

:::tip[The 3-second rule]
Discord invalidates an interaction that has not been answered within **3
seconds**. If a handler can ever take longer, `await ctx.reply.defer()` first.
:::

## `ctx.update` - editing the source message

Available on **button** and **select menu** contexts only. It edits the message
the component lives on, rather than sending a new one.

| Method | Description |
| --- | --- |
| `ctx.update(content)` | Replaces the message content/embeds/components. |
| `ctx.update.defer()` | Acknowledges silently, changing nothing visible. |
| `ctx.update.disable()` | Disables every component on the source message - the standard "this menu is closed" ending. |

```ts
run(ctx) {
  return ctx.update({ content: "Ticket closed.", components: [] });
}
```

## Per-handler additions

### `CommandContext<Options>`

| Property | Description |
| --- | --- |
| `options` | Fully typed, resolved options - inferred from the `options` map you declared. Required options are non-nullable; optional ones are `T \| undefined`. |

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
| `update` | The [update helper](#ctxupdate--editing-the-source-message). |

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

### `ModalContext<Fields>`

| Property | Description |
| --- | --- |
| `fields` | Typed submitted values, keyed by field name. Required fields are `string`; optional ones are `string \| undefined`. |

### `UserCommandContext`

| Property | Description |
| --- | --- |
| `targetUser` | The user the context-menu command was used on. |
| `targetMember` | The same as a `GuildMember`, or `null` outside a guild. |

### `MessageCommandContext`

| Property | Description |
| --- | --- |
| `targetMessage` | The message the command was used on. |

### `AutocompleteContext`

Passed to an option `autocomplete` handler. It is **not** repliable - return up
to 25 choices instead.

| Property | Description |
| --- | --- |
| `interaction` | The raw `AutocompleteInteraction`. |
| `client`, `user`, `guild`, `services`, `logger` | As on `BaseContext`. |
| `focused` | The name of the option being typed into. |
| `value` | The partial text typed so far, as a string. |

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

### `EventContext` and `JobContext`

Events and jobs are not interactions, so they carry no `reply`:

| Context | Contains |
| --- | --- |
| `EventContext` | `client`, `services`, `logger` - plus the raw discord.js event arguments. |
| `JobContext` | `client`, `services`, `logger`, `correlationId`. |

```ts
export default defineJob({
  name: "purge",
  schedule: "0 3 * * *",
  run: (ctx) => ctx.services.db.purgeOldRows(),
});
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
run(ctx) {
  if (!ctx.member?.permissions.has("BanMembers")) {
    return ctx.reply.error("You cannot ban members.");   // expected: a normal answer
  }
  const user = await api.fetchUser(ctx.options.id);      // unexpected: let it throw
  return ctx.reply.success(user.name);
}
```

See [Errors](/djs-bot/api/errors/) for the full catalogue of coded framework errors.
