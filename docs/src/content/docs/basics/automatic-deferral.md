---
title: "Automatic deferral"
description: "Discord drops an interaction that is not answered within 3 seconds. The defer option lets the framework acknowledge slow handlers for you, so you stop calling ctx.reply.defer() by hand."
sidebar:
  order: 4
---

An interaction has to be answered, or at least acknowledged, within 3 seconds.
After that Discord shows "The application did not respond" and the reply you
send later is rejected. The usual fix is to call `ctx.reply.defer()` at the top
of every handler that might be slow. With `defer`, the framework does it, and
only when it is needed.

## Turn it on

One line in the entry file covers every handler of the bot:

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  defaults: { defer: true },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

With `true`, a handler that has not answered after 2 seconds is deferred behind
the scenes. The reply it sends afterwards edits that deferred response. A
handler that answers quickly is never deferred, so nothing changes for it and
turning the option on for the whole bot costs nothing.

## Choose per definition

Each definition can set its own `defer`, which wins over the default:

```ts title="src/features/reports/report.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "report",
  description: "Build a report",
  defer: "ephemeral",
  run: async (ctx) => {
    const report = await buildSlowReport();     // 8 seconds: no problem
    await ctx.reply.success(report.summary);    // edits the deferred reply
  },
});
```

| Value | Behaviour |
| --- | --- |
| `true` | Defer publicly, only if there is no answer after 2 s. |
| `"ephemeral"` | The same, with an only-you loading state. |
| `"update"` | For buttons and selects: acknowledge with no loading message, then use `ctx.update(...)`. |
| `{ after: 0 }` | Defer immediately. |
| `{ after: "1s", ephemeral: true }` | Choose the delay and the visibility. |
| `false` | Never defer this one, even when a default is set. |

`defer` is accepted by `defineCommand`, `subcommand`, `defineUserCommand`,
`defineMessageCommand`, `defineButton`, every select menu definition and
`defineModal`. A subcommand without its own `defer` uses the one of its parent
command, then the default of the bot.

:::caution[Visibility is fixed at deferral]
A reply is public or ephemeral from the moment it is deferred. After a public
deferral, a later `ctx.reply.error()` or `ctx.reply.ephemeral()` is public too.
Use `"ephemeral"` on the definitions where that matters.
:::

## Buttons and select menus

A component usually edits the message it sits on, and a "thinking..." reply
under that message is not what you want. `"update"` acknowledges the click
silently instead:

```ts title="src/features/shop/refresh.button.ts"
import { defineButton } from "@ix-xs/djs-bot";

export default defineButton({
  id: "shop:refresh",
  label: "Refresh",
  defer: "update",
  run: async (ctx) => {
    const stock = await fetchStock();                       // may take a while
    await ctx.update({ content: `In stock: ${stock}` });    // edits the source message
  },
});
```

With a plain `true`, a slow component is deferred with a new loading reply, and
`ctx.update()` then edits that reply rather than the message the component is
on. Set `"update"` on the components that call `ctx.update`, also when
`defaults.defer` is `true`.

On anything that is not a button or a select menu, `"update"` behaves like
`true`.

## Handlers that open a modal

A modal has to be the first response to an interaction. `ctx.showModal()`
cancels the pending deferral, so a handler that opens its modal straight away
needs nothing special. It cannot undo a deferral that already fired: if slow
work comes first, the modal is refused.

Open the modal before any slow work, or switch deferral off for that handler:

```ts title="src/features/tickets/edit.button.ts"
import { defineButton, p } from "@ix-xs/djs-bot";
import { EditModal } from "./edit.modal.js";

export default defineButton({
  id: "ticket:edit",
  params: { ticketId: p.string },
  defer: false,                                   // this handler answers with a modal
  run: async (ctx) => {
    const ticket = await loadTicket(ctx.params.ticketId);
    await ctx.showModal(EditModal, { ticketId: ticket.id });
  },
});
```

`defer: false` only removes the automatic acknowledgement. Discord's 3 second
limit still applies to the modal itself, so keep what runs before it short.

## How it works

1. When an interaction reaches the bot, a timer is armed for the delay (2
   seconds unless you chose another one). Time spent in plugins and guards
   counts, because they run inside the same window.
2. Any answer from the handler cancels the timer: `ctx.reply` and all its
   methods, `ctx.update` and its methods, `ctx.showModal`. So does the end of
   the handler.
3. If the timer fires first, the framework defers on the handler's behalf.
4. The handler's next `ctx.reply()` sees that the interaction is deferred and
   edits the deferred response instead of replying.

Every response of one interaction goes through a single queue. The deferral and
the handler's own reply can therefore never collide: whichever comes second
sees that the interaction was already acknowledged.

:::caution[Stay on ctx.reply and ctx.update]
A direct `ctx.interaction.reply()` bypasses that queue. If the deferral fired a
moment earlier, discord.js throws because the interaction was already
acknowledged. Use `ctx.reply` and `ctx.update`, which handle both cases.
:::

Deferring by hand still works: `ctx.reply.defer()` and `ctx.update.defer()`
cancel the pending automatic deferral like any other answer.

## Reference

### `DeferOption`

The type of `defer` on a definition and of `defaults.defer` in
[`defineBot`](/basics/configuration/#botconfig).

| Value | Acknowledges with | After |
| --- | --- | --- |
| `true` | A public loading state. | 2 s |
| `"ephemeral"` | An only-you loading state. | 2 s |
| `"update"` | No loading message, on components. A public loading state elsewhere. | 2 s |
| `{ after?, ephemeral?, update? }` | What the fields say. | `after` |
| `false` | Nothing: never deferred. | - |
| not set | The `defer` of the parent command, then `defaults.defer`, then nothing. | - |

The object form:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `after` | `number \| string` | `2000` | How long the handler may run before the deferral is sent: milliseconds, or a duration string such as `"1s"`. `0` defers immediately. A string that cannot be parsed falls back to the default. |
| `ephemeral` | `boolean` | `false` | Make the loading state, and with it the eventual reply, visible to the invoking user only. |
| `update` | `boolean` | `false` | On a button or select menu, acknowledge without a loading message, to edit the source message. Takes precedence over `ephemeral` there. |

## Limits and errors

| Situation | What happens |
| --- | --- |
| The handler returns without answering | Nothing is deferred once the handler has finished. Discord shows "The application did not respond": a handler still has to reply. |
| The handler throws after a deferral | The generic error message edits the deferred response, with the visibility chosen at deferral. See [Errors](/api/errors/). |
| `ctx.showModal()` after the deferral fired | Discord refuses the modal. Open it first, or set `defer: false`. |
| The interaction is gone when the timer fires | The failed deferral is ignored. |
| Autocomplete | Cannot be deferred: Discord waits 3 seconds at most. See [Options and autocomplete](/commands/options/). |

## See also

- [The ctx object](/basics/context/): `ctx.reply`, `ctx.update` and `ctx.showModal`.
- [Configuration](/basics/configuration/): where `defaults` is set.
- [Buttons](/components/buttons/) and [Modals](/components/modals/): the definitions that most often need `"update"` or `false`.
