---
title: "Components V2"
description: "Components V2 is Discord's newer message format: instead of content and embeds, a message is a tree of containers, text, sections, galleries and rows. The ui helpers build that tree, and classic rows and polls, in a few short calls."
sidebar:
  order: 4
---

Every `ui` helper returns a real discord.js builder (`ContainerBuilder`,
`ActionRowBuilder`, `ButtonBuilder` and so on). Anything you know about those
classes still applies, and you can keep calling their methods on the result.

## A first V2 message

```ts title="features/profile/card.command.ts"
import { defineCommand, ui, MessageFlags } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "card",
  description: "Show your profile card",
  run: async (ctx) => {
    const card = ui.container(
      ui.text("# Profile card\nA **Components V2** message."),
      ui.separator({ divider: true, spacing: "large" }),
      ui.section({
        text: [`User: ${ctx.user}`, "Status: online"],
        accessory: ui.thumbnail(ctx.user.displayAvatarURL()),
      }),
    );

    await ctx.reply({ flags: MessageFlags.IsComponentsV2, components: [card] });
  },
});
```

The message opts in with the `IsComponentsV2` flag, and its whole body goes in
`components`.

:::caution[V2 rules]
A message that uses `IsComponentsV2` cannot also carry `content` or `embeds`.
Every piece of text has to be a `ui.text` or a `ui.section`, and an uploaded
file has to be referenced as `attachment://filename`. Send it with a raw
`ctx.reply({ ... })`: `ctx.reply.success`, `error`, `info` and `warn` build an
embed, so they cannot produce a V2 message.
:::

## Layout blocks

A container groups display components into one visual block. Inside it you
stack text, separators, sections, galleries, files and rows, in the order they
should appear.

```ts title="features/tickets/summary.command.ts"
import { defineCommand, ui, AttachmentBuilder, Colors, MessageFlags } from "@ix-xs/djs-bot";
import { CloseTicket } from "./close.button.js";

export default defineCommand({
  name: "summary",
  description: "Show the ticket summary",
  run: async (ctx) => {
    const transcript = new AttachmentBuilder(Buffer.from("12:00 Hello\n12:01 Hi"), { name: "transcript.txt" });

    await ctx.reply({
      flags: MessageFlags.IsComponentsV2,
      files: [transcript],
      components: [
        ui.container(
          { accent: Colors.Blurple },
          ui.text(`## Ticket #42\nOpened by ${ctx.user}`),
          ui.separator(),
          ui.section({
            text: "Close this ticket when you are done.",
            accessory: CloseTicket.build({ ticketId: "42", ownerId: ctx.user.id }),
          }),
          ui.gallery("https://example.com/a.png", "https://example.com/b.png"),
          ui.file("attachment://transcript.txt"),
          ui.row(ui.linkButton("Docs", "https://example.com/docs", "📘")),
        ),
      ],
    });
  },
});
```

- **`ui.container`** takes its children as arguments. Pass an options object
  first, `{ accent, spoiler }`, to give it a coloured left edge or to hide it
  behind a spoiler.
- **`ui.text`** is a block of markdown, headings included.
- **`ui.separator`** is a gap between two blocks, with a line unless you pass
  `divider: false`.
- **`ui.section`** puts text on the left and an accessory on the right: a
  `ui.thumbnail(url)` or a button. `text` is one block of markdown, or an array
  of up to three.
- **`ui.gallery`** shows images or videos by URL. It accepts
  `attachment://name` for a file sent with the same message.
- **`ui.file`** displays a file sent with the same message.
- **`ui.row`** holds buttons or a select menu, exactly as in a classic message.

`CloseTicket` is the button from [Buttons](/components/buttons/). Uploading
files is covered in [Embeds and attachments](/messages/embeds-and-attachments/).

## Rows and link buttons

`ui.row` is not specific to V2. Every button and select menu, in any message,
sits in a row:

```ts
const row = ui.row(
  CloseTicket.build({ ticketId: "42", ownerId: ctx.user.id }),
  ui.linkButton("Docs", "https://example.com/docs", "📘"),
);

await ctx.reply({ content: "Ticket #42", components: [row] });
```

A row holds up to 5 buttons, or 1 select menu. A message holds up to 5 rows.

Two kinds of button have no handler and no customId, so they are built here and
not with `defineButton`:

- `ui.linkButton(label, url, emoji?)` opens a URL.
- `ui.premiumButton(skuId)` opens the purchase flow of one of your app's SKUs.
  Discord supplies the label.

Buttons that run your code come from
[`defineButton`](/components/buttons/), and select menus from
[`defineSelectMenu`](/components/select-menus/) and its native variants.

## Polls

`ui.poll` builds a native Discord poll. A poll is not a component: it goes in
the `poll` field of a message.

```ts title="features/events/vote.command.ts"
import { defineCommand, ui } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "vote",
  description: "Vote for the next event",
  run: (ctx) =>
    ctx.reply({
      poll: ui.poll("Next event?", ["Game night", { text: "Movie", emoji: "🎬" }], { hours: 48 }),
    }),
});
```

An answer is a string, or `{ text, emoji? }`. The poll stays open for 24 hours
unless you pass `hours`, and accepts one answer per person unless you pass
`multiple: true`.

To react to votes, listen to the `messagePollVoteAdd` and
`messagePollVoteRemove` events. With `intents: "auto"` the `GuildMessagePolls`
intent is added for you, see [Events and intents](/events/events-and-intents/).

## Reference

Every option, property and type, with what it accepts and returns, is in the API reference:

- `ui`: Terse component factories.
- `ContainerOptions`: Appearance options for a `ui.container`.
- `ContainerChild`: A display component that can live inside a `ui.container`: a text block, separator, section, media gallery, file, or an action row of buttons/selects.
- `PollOptions`: Options for `ui.poll`.

## Limits and errors

| Limit | Value |
| --- | --- |
| Rows in a message | 5 |
| Buttons in a row | 5 |
| Select menus in a row | 1 |
| Text blocks in a section | 3 |
| Poll duration | 1 to 768 hours |

The `ui` helpers add no checks of their own. A message that breaks a rule, such
as `content` next to the `IsComponentsV2` flag, is rejected when it is sent, and
the error reaches the [error boundary](/api/errors/) like any other failure in a
handler.

## See also

- [Buttons](/components/buttons/) and [Select menus](/components/select-menus/) for the components a row holds
- [Pagination and confirmation](/components/pagination/), whose pages can be V2 messages
- [Embeds and attachments](/messages/embeds-and-attachments/) for the classic format and for uploading files
- [Events and intents](/events/events-and-intents/) for the poll vote events
