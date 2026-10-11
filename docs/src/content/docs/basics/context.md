---
title: "The ctx object"
description: "Every handler receives one argument, ctx. It carries the raw discord.js interaction, who triggered it and where, your services, a logger, and reply helpers that pick the right Discord call for you."
sidebar:
  order: 3
---

Commands, context menus, buttons, select menus and modals all receive a single
`ctx`. The shared part is the same everywhere (`BaseContext`); each kind of
handler adds what is specific to it, such as `ctx.options` for a command or
`ctx.params` for a button.

## A first handler

```ts title="src/features/moderation/warn.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "warn",
  description: "Warn a member",
  options: {
    target: s.user({ description: "Who to warn", required: true }),
    reason: s.string({ description: "Why" }),
  },
  run: async (ctx) => {
    const { target, reason } = ctx.options;   // typed: User, string | undefined

    ctx.logger.info({ target: target.id, by: ctx.user.id }, "warning issued");

    await ctx.reply.success(`${target} was warned: ${reason ?? "no reason given"}`, {
      title: "Warning",
    });
  },
});
```

`ctx.interaction` is the raw discord.js interaction and is never hidden from
you. Anything the framework does not wrap, you can still do there or through
`ctx.client`.

## Replying

`ctx.reply` is a function that also has methods.

```ts
await ctx.reply("Plain text");
await ctx.reply({ embeds: [embed], components: [row] });   // full InteractionReplyOptions

await ctx.reply.success("Saved.");                         // green embed
await ctx.reply.info("FYI", { ephemeral: true });          // blue embed
await ctx.reply.warn("Careful.", { title: "Heads up" });   // amber embed
await ctx.reply.error("Not allowed.");                     // red embed, ephemeral by default

await ctx.reply.ephemeral("Only you can see this.");       // any content, only-you
await ctx.reply.followUp("Another message");
await ctx.reply.editReply("Updated");
const message = await ctx.reply.fetch();                   // the Message that was sent
await ctx.reply.delete();
```

Discord has three different calls depending on what already happened to the
interaction, and using the wrong one throws. `ctx.reply(...)` and the four
semantic helpers look at the state and pick for you:

| The interaction is | They call |
| --- | --- |
| not answered yet | `interaction.reply()` |
| deferred, not answered yet | `interaction.editReply()` |
| already answered | `interaction.followUp()` |

So a second `ctx.reply()` in the same handler sends a second message instead of
failing with `InteractionAlreadyReplied`.

Discord drops an interaction that is not answered within 3 seconds. A handler
that needs longer shows a loading state first, then replies when it is ready:

```ts
await ctx.reply.defer({ ephemeral: true });   // the 3 second clock is stopped
const data = await slowApiCall();             // take as long as you need
await ctx.reply.success(`Found ${data.length} results`, { title: "Search" });
```

`ctx.reply.defer()` does nothing when the interaction was already acknowledged.
A reply is public or ephemeral from the moment it is deferred: the `ephemeral`
choice of a later reply is ignored. Rather than deferring by hand in every slow
handler, let the framework do it: see
[Automatic deferral](/basics/automatic-deferral/).

Use `ctx.reply.error()` for refusals you expect ("You cannot ban members."), and
let unexpected failures throw. The framework catches what a handler throws, logs
it with the correlation id and answers with a generic ephemeral error: see
[Errors](/api/errors/).

## Editing the source message

Buttons and select menus live on a message. Their handlers get `ctx.update`,
which edits that message instead of sending a new one.

```ts title="src/features/tickets/close.button.ts"
import { ButtonStyle, defineButton, p } from "@ix-xs/djs-bot";

export default defineButton({
  id: "ticket:close",
  params: { ticketId: p.string },
  label: "Close",
  style: ButtonStyle.Danger,
  run: async (ctx) => {
    await ctx.update.defer();                  // acknowledge, nothing changes on screen
    await closeTicket(ctx.params.ticketId);    // slow work
    await ctx.update({ content: "Ticket closed.", components: [] });
  },
});
```

```ts
await ctx.update("New content");   // edit the message the component is on
await ctx.update.disable();        // disable every component on that message
await ctx.update.defer();          // acknowledge without changing anything
```

All three work before and after `ctx.update.defer()`. Once the interaction was
acknowledged, they edit the message instead of calling Discord's `update()` a
second time, which would be refused. `ctx.update.disable()` is the usual way to
close a menu that should not be used twice.

After a `ctx.reply.defer()`, which opens a new reply, `ctx.update()` edits that
reply and not the source message. On a component, defer with
`ctx.update.defer()`.

`ctx.reply` is still available on components, for a new message in response to
the click.

## Opening a modal

Commands, context menus, buttons and select menus can answer with a modal (a
form in a dialog). `ctx.showModal` takes a `defineModal()` definition, followed
by its params if it has any:

```ts title="src/features/feedback/feedback.command.ts"
import { defineCommand, defineModal, field } from "@ix-xs/djs-bot";

export const FeedbackModal = defineModal({
  id: "feedback",
  title: "Send feedback",
  fields: { message: field.paragraph({ label: "Your message", required: true }) },
  run: (ctx) => ctx.reply.success(`Received: ${ctx.fields.message}`),
});

export default defineCommand({
  name: "feedback",
  description: "Send feedback to the team",
  run: (ctx) => ctx.showModal(FeedbackModal),
});
```

```ts
await ctx.showModal(EditModal, { ticketId: "42" });   // the params are type-checked
```

It takes the same arguments as the modal's `build()`, so a missing or mistyped
param is a compile error. Any object with a `build()` method that returns a
discord.js `ModalBuilder` is accepted.

:::caution[A modal must be the first response]
Discord only accepts a modal as the first answer to an interaction. Call
`ctx.showModal()` before any reply or defer. This is also why modal handlers
have no `showModal`: a submitted modal cannot open another one.
:::

Declaring fields and reading them back is covered in
[Modals](/components/modals/).

## The rest of ctx

Beyond replies, `ctx` gives a handler everything it needs without importing
anything global.

```ts
run: async (ctx) => {
  // Where and who. guild and member are null outside a server the bot is in.
  if (!ctx.guild) return ctx.reply.error(ctx.say("guildOnly"));

  // Your services, typed through ServiceMap.
  const balance = await ctx.services.store.get(`coins:${ctx.user.id}`);

  // A logger bound to this interaction: every line carries the same correlationId.
  ctx.logger.info({ balance }, "balance read");

  // Your translations, in the user's Discord language.
  await ctx.reply(ctx.t("balance.current", { balance }));

  // The audit trail. actorId and guildId are filled in for you.
  await ctx.audit("balance:read", { targetId: ctx.user.id });
}
```

- `ctx.t(key, vars?)` translates your own messages for `ctx.locale`. Without an
  `i18n` configuration it returns the key unchanged. See
  [Internationalisation](/data/i18n/).
- `ctx.say(key, vars?)` renders one of the framework's own sentences, the ones
  guards and the error boundary show. See
  [Wording and theme](/basics/wording-and-theme/).
- `ctx.audit(action, details?)` records an entry, and does nothing when `audit`
  is not configured. See [Audit trail](/data/audit/).
- `ctx.services` holds what you registered, plus `store`, `audit` and `flags`
  when they are configured. See [Services](/architecture/services/).

For logs and metrics of your own, `describeInteraction` turns any interaction
into a kind and a readable name:

```ts title="src/plugins/request-logger.plugin.ts"
import { definePlugin, describeInteraction } from "@ix-xs/djs-bot";

export default definePlugin({
  name: "request-logger",
  setup(app) {
    app.hooks.afterInteraction((ctx, { durationMs }) => {
      const { kind, name } = describeInteraction(ctx.interaction);
      // { kind: "command", name: "config set" }
      // { kind: "button",  name: "ticket:close" }
      ctx.logger.info({ kind, name, durationMs }, "handled");
    });
  },
});
```

## What each handler adds

| Handler | Context type | Added to `BaseContext` |
| --- | --- | --- |
| `defineCommand`, `subcommand` | `CommandContext<Options>` | `options`, `showModal` |
| `defineUserCommand` | `UserCommandContext` | `targetUser`, `targetMember`, `showModal` |
| `defineMessageCommand` | `MessageCommandContext` | `targetMessage`, `showModal` |
| `defineButton` | `ButtonContext<Params>` | `params`, `update`, `showModal` |
| `defineSelectMenu` and the native selects | `SelectMenuContext<Params>` | `params`, `values`, `users`, `members`, `roles`, `channels`, `update`, `showModal` |
| `defineModal` | `ModalContext<Fields>` | `fields`, `params` |

The type parameters are inferred from the definition: you never write them.

```ts
options: { target: s.user({ required: true }), reason: s.string() },
run(ctx) {
  ctx.options.target;   // User
  ctx.options.reason;   // string | undefined
}
```

An option's `autocomplete` handler receives an `AutocompleteContext`, which
cannot reply: it returns the suggestions. See
[Options and autocomplete](/commands/options/).

Events, triggers and jobs are not interactions, so their context has no
`reply` helper and no `interaction`:

| Context | Contains | Page |
| --- | --- | --- |
| `EventContext` | `client`, `services`, `logger`. Passed after the raw discord.js event arguments. | [Events and intents](/events/events-and-intents/) |
| `TriggerContext` | `message`, `author`, `member`, `guild`, `channel`, `client`, `services`, `logger`, `correlationId`, `match`, plus `reply(content)` and `send(content)`. | [Message triggers](/events/triggers/) |
| `JobContext` | `client`, `services`, `logger`, `correlationId`, `signal` (aborted on shutdown). | [Scheduled jobs](/events/jobs/) |

## Reference

### `BaseContext`

Shared by every interaction handler.

| Property | Type | Description |
| --- | --- | --- |
| `interaction` | the raw interaction | The discord.js interaction, typed for the handler (a `ButtonInteraction` in a button, and so on). |
| `client` | `Client<true>` | The connected discord.js client. |
| `user` | `User` | Who triggered the interaction. |
| `guild` | `Guild \| null` | The guild, or `null` in DMs and in servers the bot is not in. |
| `guildId` | `string \| null` | The guild id. Set even when the bot is not a member (user-installed apps). |
| `channel` | `TextBasedChannel \| null` | The originating channel, when resolvable. |
| `channelId` | `string \| null` | The originating channel id. |
| `member` | `GuildMember \| null` | The member, in a server the bot is in. `null` in DMs and for user-installed apps used elsewhere. |
| `services` | `ServiceMap` | Injected services. |
| `logger` | `Logger` | A child logger bound to `correlationId` and to the user id. |
| `correlationId` | `string` | Unique per interaction. Every log line from this handler carries it. |
| `locale` | `string` | The user's Discord client language, for example `"fr"` or `"en-US"`. |
| `owners` | `readonly string[]` | The ids from `defineBot({ owners })`. |
| `reply` | `ReplyFn` | The reply helper. |

| Method | Returns | Description |
| --- | --- | --- |
| `t(key, vars?)` | `string` | Translates one of your messages for `locale`. Returns the key when i18n is not configured. |
| `say(key, vars?)` | `string` | Renders one of the framework's messages, honouring `defineBot({ messages })`. The key and its variables are type-checked. |
| `audit(action, details?)` | `Promise<void>` | Records an audit entry. `details` is `{ targetId?: string; metadata?: Record<string, unknown> }`. |

### `ReplyFn`

The type of `ctx.reply`. `content` is a `ReplyContent`: a string, or the full
discord.js `InteractionReplyOptions`.

| Call | Behaviour |
| --- | --- |
| `ctx.reply(content)` | Replies, edits the deferred reply, or follows up, depending on the state of the interaction. |
| `ctx.reply.success(message, options?)` | Green embed. Public by default. |
| `ctx.reply.info(message, options?)` | Blue embed. Public by default. |
| `ctx.reply.warn(message, options?)` | Amber embed. Public by default. |
| `ctx.reply.error(message, options?)` | Red embed. Ephemeral by default. |
| `ctx.reply.ephemeral(content)` | Any content, visible only to the invoking user. |
| `ctx.reply.defer(options?)` | Shows the loading state. `options` is `{ ephemeral?: boolean }`. Does nothing if already acknowledged. |
| `ctx.reply.followUp(content)` | Always sends an additional message. |
| `ctx.reply.editReply(content)` | Always edits the current reply, deferred or sent. |
| `ctx.reply.fetch()` | Resolves to the `Message` that was sent as the reply. |
| `ctx.reply.delete()` | Deletes the reply. |

Every call returns a promise. All of them resolve to nothing, except `fetch()`.

### `SemanticReplyOptions`

Accepted by `success`, `info`, `warn` and `error`. The message becomes the
description of the embed. The colours come from the theme: see
[Wording and theme](/basics/wording-and-theme/).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ephemeral` | `boolean` | `false`, `true` for `error` | Only the invoking user sees the message. |
| `title` | `string` | none | A title shown above the message. |

### `UpdateFn`

The type of `ctx.update`, present on button and select menu contexts only.

| Call | Behaviour |
| --- | --- |
| `ctx.update(content)` | Replaces the content, embeds or components of the message the component is on. |
| `ctx.update.defer()` | Acknowledges silently. Does nothing if already acknowledged. |
| `ctx.update.disable()` | Disables every component on the source message. |

### `ShowModalFn`

The type of `ctx.showModal`, present on command, context menu, button and
select menu contexts.

```ts
type ShowModalFn = <Args extends unknown[]>(
  modal: { build(...args: Args): ModalBuilder },
  ...args: Args
) => Promise<void>;
```

### `CommandContext<Options>`

| Property | Type | Description |
| --- | --- | --- |
| `options` | `Options` | The resolved options, typed from the `options` map of the command. Required options are non-nullable, optional ones are `T \| undefined`. |
| `showModal` | `ShowModalFn` | Opens a modal as the response. |

### `ButtonContext<Params>`

| Property | Type | Description |
| --- | --- | --- |
| `params` | `Params` | The typed values decoded from the customId. See [Buttons](/components/buttons/). |
| `update` | `UpdateFn` | Edits the source message. |
| `showModal` | `ShowModalFn` | Opens a modal in response to the click. |

### `ModalContext<Fields>`

| Property | Type | Description |
| --- | --- | --- |
| `fields` | `Fields` | The submitted values, keyed by field name and typed by the kind of each field. See [Modals](/components/modals/). |
| `params` | typed from the modal | The params decoded from the modal's customId. |

The contexts of select menus and of context menus are described with their
definitions: [`SelectMenuContext`](/components/select-menus/),
[`UserCommandContext` and `MessageCommandContext`](/commands/context-menus/).

### `describeInteraction(interaction)`

```ts
function describeInteraction(interaction: RepliableInteraction): InteractionSummary
```

| Field | Type | Description |
| --- | --- | --- |
| `kind` | `"command" \| "userCommand" \| "messageCommand" \| "button" \| "select" \| "modal" \| "other"` | What kind of interaction it is. |
| `name` | `string` | The command name with its group and subcommand (`"config set"`), or the routing id of a component or modal, without its encoded params. |

It never throws: an interaction it does not recognise, including a hand-built
one in a test, gives `{ kind: "other", name: "unknown" }`.

## See also

- [Automatic deferral](/basics/automatic-deferral/): stop calling `ctx.reply.defer()` by hand.
- [Wording and theme](/basics/wording-and-theme/): `ctx.say` and the colours of the semantic replies.
- [Options and autocomplete](/commands/options/): what ends up in `ctx.options`.
- [Embeds and attachments](/messages/embeds-and-attachments/): richer content for `ctx.reply`.
- [Errors](/api/errors/): what happens when a handler throws.
