---
title: "UI, components & the customId codec"
description: "ui builders, Components V2, paginate, confirm, and how customIds are encoded."
sidebar:
  order: 17
---

## `ui` - component builders

Terse factories that return **real discord.js builders**, so anything you know
about `ButtonBuilder` still applies.

### Rows and buttons

| Helper | Returns | Description |
| --- | --- | --- |
| `ui.row(...components)` | `ActionRowBuilder` | A row of buttons, or a single select menu. |
| `ui.linkButton(label, url, emoji?)` | `ButtonBuilder` | A URL button - no handler, no customId. |

```ts
const row = ui.row(
  Close.build({ ticketId: "42" }),
  ui.linkButton("Docs", "https://ix-xs.github.io/djs-bot/", "📘"),
);

await ctx.reply({ content: "Ticket #42", components: [row] });
```

A message allows at most **5 rows**, each holding 5 buttons or 1 select menu.

Routed buttons come from [`defineButton`](/djs-bot/api/definitions/#definebutton)
and its typed `build(params?, visual?)`, where `visual` overrides the defaults
declared on the definition:

| Visual option | Type |
| --- | --- |
| `label` | `string` |
| `emoji` | `string` |
| `style` | `ButtonStyle` |
| `disabled` | `boolean` |

```ts
Close.build({ ticketId: "42" }, { label: "Close now", style: ButtonStyle.Danger, disabled: locked });
```

### Components V2

A newer message format: no embeds, just composable display components. Opt in
per message with the `IsComponentsV2` flag.

| Helper | Returns | Description |
| --- | --- | --- |
| `ui.container(...children)` | `ContainerBuilder` | Groups display components into one visual block. |
| `ui.text(content)` | `TextDisplayBuilder` | A markdown text block. |
| `ui.separator(options?)` | `SeparatorBuilder` | A gap, optionally with a divider line. `{ divider?, spacing?: "small" \| "large" }`. |
| `ui.section(options)` | `SectionBuilder` | `{ text: string \| string[]; accessory: ButtonBuilder \| ThumbnailBuilder }` - text on the left, a button or thumbnail on the right. |
| `ui.thumbnail(url, description?)` | `ThumbnailBuilder` | A thumbnail accessory for a section. |
| `ui.gallery(...urls)` | `MediaGalleryBuilder` | An image or video gallery. Accepts `attachment://name`. |
| `ui.file(attachmentUrl)` | `FileBuilder` | A file display component. |

```ts
import { ui, MessageFlags } from "@ix-xs/djs-bot";

await ctx.reply({
  flags: MessageFlags.IsComponentsV2,
  components: [
    ui.container(
      ui.text("## Ticket #42\nOpened by <@123>"),
      ui.separator({ divider: true }),
      ui.section({
        text: "Close this ticket when you are done.",
        accessory: Close.build({ ticketId: "42" }),
      }),
      ui.gallery("attachment://screenshot.png"),
    ),
  ],
});
```

:::caution[V2 rules]
A message using `IsComponentsV2` **cannot** carry `content` or `embeds` - every
piece of text has to be a `ui.text` or a `ui.section`. Attachments must be
referenced as `attachment://filename`.
:::

## `paginate()`

A multi-page message with prev/next controls that manages its own buttons and
collector - nothing to register, nothing to route.

```ts
await paginate(ctx, { pages: [embed1, embed2, embed3], timeout: "5m" });
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `pages` | `Page[] \| (index) => Page \| Promise<Page>` | - | **Required.** An array, or a builder called per page. |
| `count` | `number` | - | Total pages. **Required** when `pages` is a function. |
| `startPage` | `number` | `0` | Page to open on. |
| `timeout` | `string \| number` | `"2m"` | How long the controls stay active. |
| `ephemeral` | `boolean` | `false` | Send as an only-you message. |
| `showFirstLast` | `boolean` | `true` | Show ⏮ / ⏭ buttons. |
| `showCounter` | `boolean` | `true` | Show the `page x / y` indicator. |
| `allowedUsers` | `string[]` | the invoker | Who may use the controls. |

A `Page` is an `EmbedBuilder`, or a payload with `content`, `embeds`,
`components`, `files` and `flags` - so Components V2 pages work too:

```ts
await paginate(ctx, {
  pages: cards.map((card) => ({ flags: MessageFlags.IsComponentsV2, components: [card] })),
});
```

Lazy pages avoid building everything up front:

```ts
await paginate(ctx, {
  count: totalPages,
  pages: async (index) => buildEmbed(await fetchPage(index)),
});
```

When the timeout elapses the controls are disabled in place, leaving the message
readable.

:::note[Why the buttons keep working]
`paginate` uses a private nonce plus its own collector, and the framework router
deliberately ignores customIds it does not own - so pagination controls are never
intercepted, and never expire early with an "interaction failed" error.
:::

## `confirm()`

A yes/no dialog that resolves to a boolean:

```ts
if (await confirm(ctx, { content: "Delete every message in this channel?" })) {
  await purge();
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `content` | `string` | - | The question. |
| `embed` | `EmbedBuilder` | - | An embed instead of, or alongside, the text. |
| `confirmLabel` | `string` | `"Confirm"` | Confirm button label. |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `timeout` | `string \| number` | `"1m"` | How long to wait. |
| `ephemeral` | `boolean` | `true` | Only the invoker sees it. |

Returns `false` on cancel **and** on timeout, so the safe path is the default.

## The customId codec

Discord round-trips exactly one piece of state for a component: its `customId`,
capped at 100 characters. The framework encodes a routing **key** plus a typed
payload, and decodes it back with the types you declared.

Wire format - the key alone, or `key$<base64url(json-array)>`:

```
ticket:close
ticket:close$WyI0MiIsIjEiXQ
```

The `$` separator never appears in a routing key or in base64url output, so
parsing is unambiguous. That is why component ids may not contain `$`
([`DJSBOT_E013`](/djs-bot/api/errors/#djsbot_e013)).

You normally never call these - `Button.build()` and `ctx.params` do - but they
are exported:

| Function | Description |
| --- | --- |
| `encodeCustomId(key, schema, values)` | Builds a customId. Throws [`DJSBOT_E020`](/djs-bot/api/errors/#djsbot_e020) past 100 chars. |
| `decodeCustomId(raw, schema)` | Returns `{ key, params }`. Throws [`DJSBOT_E021`](/djs-bot/api/errors/#djsbot_e021) on a bad payload. |
| `customIdKey(raw)` | Just the routing key, without decoding params. |
| `CUSTOM_ID_MAX_LENGTH` | `100`. |

```ts
import { encodeCustomId, decodeCustomId, p } from "@ix-xs/djs-bot";

const schema = { ticketId: p.string, notify: p.boolean };
const id = encodeCustomId("ticket:close", schema, { ticketId: "42", notify: true });
decodeCustomId(id, schema);   // { key: "ticket:close", params: { ticketId: "42", notify: true } }
```

### When 100 characters is not enough

Store the payload and keep a short key:

```ts
const key = crypto.randomUUID().slice(0, 8);
await ctx.services.store.set(`draft:${key}`, bigObject, "15m");

const row = ui.row(Publish.build({ key }));
```

## Embeds

`EmbedBuilder` is re-exported for convenience, so a simple bot needs one import:

```ts
import { EmbedBuilder, Colors } from "@ix-xs/djs-bot";

const embed = new EmbedBuilder()
  .setTitle("Profile")
  .setColor(Colors.Blurple)
  .setThumbnail(assets.avatar(ctx.user))
  .addFields({ name: "Joined", value: timestamp(ctx.member!.joinedAt!), inline: true })
  .setFooter({ text: `Requested by ${ctx.user.username}` })
  .setTimestamp();
```

For the built-in coloured embeds, `ctx.reply.success/error/info` already do this
- see [the ctx object](/djs-bot/api/context/#ctxreply--answering-the-user).
