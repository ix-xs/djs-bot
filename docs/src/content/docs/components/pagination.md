---
title: "Pagination and confirmation"
description: "paginate() sends a multi-page message with its own navigation buttons, and confirm() asks a yes or no question and resolves to a boolean. Both manage their buttons themselves: nothing to define, nothing to register."
sidebar:
  order: 5
---

Both helpers take the `ctx` of any interaction handler (a command, a context
menu, a button, a select menu or a modal), send a message, and listen for clicks
on that message with a private collector.

## A first paginated message

```ts title="features/levels/leaderboard.command.ts"
import { defineCommand, paginate, EmbedBuilder } from "@ix-xs/djs-bot";

const players = Array.from({ length: 45 }, (_, i) => `Player ${i + 1}`);

export default defineCommand({
  name: "leaderboard",
  description: "Top players",
  run: async (ctx) => {
    const pages: EmbedBuilder[] = [];
    for (let i = 0; i < players.length; i += 10) {
      pages.push(
        new EmbedBuilder()
          .setTitle(`Leaderboard - page ${pages.length + 1}`)
          .setDescription(players.slice(i, i + 10).join("\n")),
      );
    }
    await paginate(ctx, { pages, timeout: "5m" });
  },
});
```

The message shows the first page and a row of five buttons: first, previous, a
`1 / 5` counter, next and last. Each click edits the message in place. When the
timeout elapses the buttons are disabled and the message stays readable.

`paginate` resolves as soon as the first page is sent, not when the user is done
browsing. With a single page it sends the message without any buttons.

## Lazy pages

Building every page up front is wasteful when each one needs a query. Pass a
function and the number of pages instead:

```ts
await paginate(ctx, {
  count: totalPages,
  pages: async (index) => buildEmbed(await fetchPage(index)),
  timeout: "2m",
});
```

The function receives the page index, starting at `0`, and may be async. It is
called every time a page is shown, including when the user comes back to one and
once more when the controls are disabled, so cache the result yourself if it is
expensive. `count` is required in this form.

## Full payloads and V2

A page is not limited to an embed. It can be a whole message payload, which is
how you paginate [Components V2](/components/components-v2/) layouts. The
navigation row is appended to the page's `components` for you.

```ts title="features/shop/catalogue.command.ts"
import { defineCommand, paginate, ui, MessageFlags } from "@ix-xs/djs-bot";

const cards = [
  { title: "Sword", image: "https://example.com/sword.png" },
  { title: "Shield", image: "https://example.com/shield.png" },
];

export default defineCommand({
  name: "catalogue",
  description: "Browse the shop",
  run: (ctx) =>
    paginate(ctx, {
      pages: cards.map((card) => ({
        flags: MessageFlags.IsComponentsV2,
        components: [ui.container(ui.text(`# ${card.title}`), ui.gallery(card.image))],
      })),
      timeout: "5m",
    }),
});
```

A page is either an `EmbedBuilder`, or an object with `content`, `embeds`,
`components`, `files` and `flags`. Keep every page of one message in the same
format: a message sent with `IsComponentsV2` cannot go back to `content` or
`embeds`. A classic page with its own rows can have four of them at most, since
the navigation takes the fifth.

## Controls and audience

By default only the user who ran the command can turn the pages, and the message
is public. The options change who sees it, who drives it and which buttons it
has:

```ts
await paginate(ctx, {
  pages,
  startPage: 2,                              // open on the third page
  ephemeral: true,                           // only the invoker sees the message
  allowedUsers: [ctx.user.id, moderatorId],  // who may click
  showFirstLast: false,                      // previous and next only
  showCounter: false,                        // no "3 / 5" button
});
```

A click from someone who is not in `allowedUsers` is not handled, and that
person sees Discord's "This interaction failed".

:::note[Why the buttons never reach your handlers]
The controls carry a random prefix that only this call knows, and the framework
router ignores every customId it has no definition for. A pagination or
confirmation button is therefore never intercepted by your own buttons, and
never answered twice.
:::

## Asking for confirmation

`confirm` shows a question with two buttons and resolves to `true` or `false`.

```ts title="features/admin/wipe.command.ts"
import { defineCommand, confirm } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "wipe",
  description: "Delete all data",
  run: async (ctx) => {
    const yes = await confirm(ctx, {
      content: "⚠️ Delete everything?",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });
    if (!yes) {
      await ctx.reply.info("Cancelled.", { ephemeral: true });
      return;
    }
    await ctx.services.store.clear();
    await ctx.reply.success("Done.", { ephemeral: true });
  },
});
```

It returns `false` on cancel and also on timeout, so doing nothing is the safe
path. Only the user who triggered the interaction can answer. Once they have, or
once the time is up, both buttons are disabled.

The question is ephemeral unless you pass `ephemeral: false`. It is sent with
`ctx.reply`, so the interaction is answered by the time `confirm` returns, and
the next `ctx.reply` is a follow-up message.

Without `confirmLabel` and `cancelLabel`, the buttons use the framework's
`confirm` and `cancel` messages ("Confirm" and "Cancel"), which you can reword or
translate once for the whole bot. See
[Wording and theme](/basics/wording-and-theme/).

## Reference

### `paginate(ctx, options)`

Returns a `Promise<void>` that resolves once the first page is sent. `options`
is a `PaginateOptions`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `pages` | `Page[] \| (index: number) => Page \| Promise<Page>` | required | The pages: an array, or a builder called with the page index. |
| `count` | `number` | - | Total number of pages. Required when `pages` is a function. |
| `startPage` | `number` | `0` | Page to open on. Brought back into range if it is outside it. |
| `timeout` | `string \| number` | `"2m"` | How long the controls stay active: a duration such as `"5m"`, or milliseconds. |
| `ephemeral` | `boolean` | `false` | Send as a message only the invoker sees. |
| `showFirstLast` | `boolean` | `true` | Show the first and last buttons. |
| `showCounter` | `boolean` | `true` | Show the `page / total` counter button. |
| `allowedUsers` | `string[]` | the invoking user | Ids of the users who may use the controls. |

### `Page`

`EmbedBuilder | PagePayload`. An `EmbedBuilder` is sent as `embeds: [page]`. A
`PagePayload` is:

| Property | Type | Description |
| --- | --- | --- |
| `content` | `string` | The text of the message. |
| `embeds` | embeds | As in any message. |
| `components` | rows or V2 builders | The navigation row is appended after them. |
| `files` | attachments | As in any message. |
| `flags` | `number` | Message flags, for example `MessageFlags.IsComponentsV2`. |

### `confirm(ctx, options?)`

Returns a `Promise<boolean>`: `true` if the user confirmed, `false` if they
cancelled or did not answer in time. `options` is a `ConfirmOptions`, and every
field is optional:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `content` | `string` | - | The question. |
| `embed` | `EmbedBuilder` | - | An embed to show instead of the text, or with it. |
| `confirmLabel` | `string` | the `confirm` message, `"Confirm"` | Label of the green confirm button. |
| `cancelLabel` | `string` | the `cancel` message, `"Cancel"` | Label of the red cancel button. |
| `timeout` | `string \| number` | `"1m"` | How long to wait: a duration such as `"30s"`, or milliseconds. |
| `ephemeral` | `boolean` | `true` | Only the invoker sees the question. |

## Limits and errors

- **At least one page.** `paginate` throws `paginate() needs at least one page.`
  for an empty array, and for a function without a `count`.
- **They work after a first reply.** When the interaction was already
  answered, the message of either helper goes out as a follow-up and its
  buttons listen on that follow-up. A `confirm` followed by a `paginate` in one
  handler works, and so does a deferral before them.
- **The collector lives in memory.** After a restart, or once the timeout has
  elapsed, the buttons of an older message do nothing. For controls that must
  survive a restart, write your own with
  [`defineButton`](/components/buttons/) and a page number in its params.
- **They need an interaction.** Events, triggers and jobs have no `ctx` to
  reply with, so neither helper works there.

## See also

- [Buttons](/components/buttons/) for navigation that survives a restart
- [Components V2](/components/components-v2/) for the layouts a page can hold
- [Embeds and attachments](/messages/embeds-and-attachments/) for building the embeds
- [Wording and theme](/basics/wording-and-theme/) for the default button labels
- [The ctx object](/basics/context/) for how `ctx.reply` behaves once the interaction is answered
