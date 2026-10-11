---
title: "Embeds and attachments"
description: "Build rich embeds with EmbedBuilder, send files with AttachmentBuilder, show an uploaded image inside an embed, and read the files people send to your bot."
sidebar:
  order: 1
---

An embed is the framed card Discord shows under a message: a title, a coloured
edge, fields, images. An attachment is a file sent with a message. Both come
straight from discord.js: the framework re-exports `EmbedBuilder`,
`AttachmentBuilder` and `Colors`, so a small bot needs one import line.

## A first embed

Build the embed, then pass it in the `embeds` array of a reply.

```ts title="features/profile/profile.command.ts"
import { defineCommand, inGuild, assets, timestamp, EmbedBuilder, Colors } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  description: "Show your profile",
  guards: [inGuild()],
  run: async (ctx) => {
    const joined = ctx.member?.joinedAt;

    const embed = new EmbedBuilder()
      .setTitle("Profile")
      .setColor(Colors.Blurple)
      .setThumbnail(assets.avatar(ctx.member ?? ctx.user))
      .addFields({ name: "Joined", value: joined ? timestamp(joined) : "Unknown", inline: true })
      .setFooter({ text: `Requested by ${ctx.user.username}` })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] });
  },
});
```

`assets.avatar` is described in [Assets and voice](/messages/assets-and-voice/)
and `timestamp` in [Mentions, timestamps and safe pings](/messages/formatting/).

For a one-line coloured message you do not need a builder at all:
`ctx.reply.success`, `ctx.reply.info`, `ctx.reply.warn` and `ctx.reply.error`
build a small embed for you. They are covered in
[The ctx object](/basics/context/), and their colours in
[Wording and theme](/basics/wording-and-theme/). Reach for `EmbedBuilder` when
you want full control.

## Every part of an embed

Every setter returns the builder, so calls chain. All parts are optional, but an
embed needs at least one visible part (a title, a description, a field, an image
and so on).

```ts
import { EmbedBuilder } from "@ix-xs/djs-bot"; // or from "discord.js", it is the same class

const embed = new EmbedBuilder()
  .setColor(0x5865f2)
  .setTitle("Title")
  .setURL("https://example.com")
  .setDescription("A **markdown** description.")
  .setAuthor({ name: ctx.user.username, iconURL: ctx.user.displayAvatarURL() })
  .setThumbnail("https://example.com/thumb.png")
  .addFields(
    { name: "Field 1", value: "value", inline: true },
    { name: "Field 2", value: "value", inline: true },
  )
  .setImage("https://example.com/image.png")
  .setFooter({ text: "Footer" })
  .setTimestamp();

await ctx.reply({ embeds: [embed] });
```

The description and field values accept Discord markdown, mentions and
timestamps. A mention inside an embed renders as a mention but never notifies
anyone, which makes embeds a safe place to show user names.

`embeds` is an array: one message can carry several embeds (see
[Limits and errors](/messages/embeds-and-attachments/#limits-and-errors)).

## Sending files

Wrap the data in an `AttachmentBuilder` and pass it in the `files` array.

```ts title="features/export/export.command.ts"
import { defineCommand, AttachmentBuilder } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "export",
  description: "Export your notes as a text file",
  run: async (ctx) => {
    const file = new AttachmentBuilder(Buffer.from("hello"), { name: "note.txt" });
    await ctx.reply({ content: "Here you go:", files: [file] });
  },
});
```

The first argument is the content: a `Buffer`, a local path, a URL or a
readable stream. The second gives the file its name and, for images, an
optional description used as alt text.

```ts
new AttachmentBuilder("./chart.png", { name: "chart.png", description: "Sales this week" });
new AttachmentBuilder(createReadStream("./backup.zip"), { name: "backup.zip" });
new AttachmentBuilder(buffer, { name: "answer.png" }).setSpoiler(true); // hidden until clicked
```

Always give a `name` when the content is a buffer or a stream: Discord uses the
extension to decide whether to preview the file as an image, a video or a plain
download.

## Images inside embeds

An embed image is normally a public URL. To show a file you are uploading in the
same message, refer to it with the `attachment://` scheme followed by its name.

```ts
const chart = new AttachmentBuilder("./chart.png", { name: "chart.png" });
const embed = new EmbedBuilder().setTitle("This week").setImage("attachment://chart.png");

await ctx.reply({ embeds: [embed], files: [chart] });
```

The file then appears only inside the embed, not a second time below the
message. `setThumbnail`, the author `iconURL` and the footer `iconURL` accept the
same scheme.

:::caution[The name must match exactly]
`attachment://chart.png` only resolves if a file named `chart.png` is in the
`files` of the same message. Keep names to letters, digits, dots, hyphens and
underscores: Discord rewrites other characters, and the reference then points
at nothing.
:::

The scheme also works in a Components V2 gallery, described in
[Components V2](/components/components-v2/):

```ts
await ctx.reply({
  flags: MessageFlags.IsComponentsV2,
  files: [chart],
  components: [ui.container(ui.gallery("attachment://chart.png"))],
});
```

## Receiving files

A slash command receives a file through an `s.attachment` option. The value in
`ctx.options` is a discord.js `Attachment`.

```ts title="features/scan/scan.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "scan",
  description: "Scan an uploaded file",
  options: {
    file: s.attachment({ description: "File to scan", required: true, fileTypes: ["image", ".pdf"] }),
  },
  run: async (ctx) => {
    const file = ctx.options.file; // Attachment
    await ctx.reply.info(
      `Got **${file.name}** (${file.contentType ?? "unknown type"}, ${file.size} bytes)\n${file.url}`,
    );
  },
});
```

`fileTypes` restricts what the file picker accepts; it is explained with the
other option settings in [Options and autocomplete](/commands/options/). A modal
collects files with a `field.files` upload, described in
[Modals](/components/modals/); there the value is a collection of the same
`Attachment` objects.

Discord stores the file, not your bot. To read its content, download it from
`url`:

```ts
const response = await fetch(file.url);
const bytes = Buffer.from(await response.arrayBuffer());
```

The URL is a signed link that stops working after a while, so download what you
need to keep instead of saving the URL. To send a received file back, pass the
`Attachment` itself in `files`.

## Reference

### `EmbedBuilder`

The discord.js class, re-exported unchanged. `Colors` (named colour constants
such as `Colors.Blurple`) is re-exported too.

| Method | Argument | Description |
| --- | --- | --- |
| `setTitle(title)` | `string` | Bold heading. Becomes a link when a URL is set. |
| `setURL(url)` | `string` | Makes the title clickable. |
| `setDescription(text)` | `string` | Main text, markdown allowed. |
| `setColor(color)` | number, hex string, `Colors.*` | Colour of the left edge. |
| `setAuthor(author)` | `{ name, iconURL?, url? }` | Small line above the title. |
| `setThumbnail(url)` | `string` | Small image in the top right corner. |
| `setImage(url)` | `string` | Large image under the fields. |
| `addFields(...fields)` | `{ name, value, inline? }` | Appends fields. `inline` puts fields side by side. |
| `setFields(...fields)` | same | Replaces every field. |
| `spliceFields(index, deleteCount, ...fields)` | same | Removes or inserts fields at a position. |
| `setFooter(footer)` | `{ text, iconURL? }` | Small line at the bottom. |
| `setTimestamp(date?)` | `Date \| number` | Time shown next to the footer, in the reader's timezone. Now when omitted. |
| `EmbedBuilder.from(embed)` | an existing embed | Copies an embed so you can change it, for example `message.embeds[0]`. |

### `AttachmentBuilder`

The discord.js class, re-exported unchanged.

```ts
new AttachmentBuilder(content, data?)
```

| Argument | Type | Description |
| --- | --- | --- |
| `content` | `Buffer \| string \| Stream` | The bytes, a local path, a URL, or a readable stream. |
| `data.name` | `string` | File name with its extension. Used by `attachment://name`. |
| `data.description` | `string` | Alt text shown by screen readers. |

| Method | Description |
| --- | --- |
| `setName(name)` | Sets the file name. |
| `setDescription(text)` | Sets the alt text. |
| `setSpoiler(spoiler?)` | Hides the file behind a spoiler. Default `true`. |
| `setFile(content, name?)` | Replaces the content, and optionally the name. |

`files` also accepts a path, a URL or a `Buffer` directly. The builder is what
lets you choose the name, the alt text and the spoiler state.

### `Attachment`

What `s.attachment` and `field.files` hand you. The most useful properties:

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | The attachment id. |
| `name` | `string` | File name. |
| `contentType` | `string \| null` | MIME type, for example `image/png`. |
| `size` | `number` | Size in bytes. |
| `url` | `string` | Signed download link. |
| `proxyURL` | `string` | The same file through Discord's media proxy. |
| `width`, `height` | `number \| null` | Dimensions, for images and videos. |
| `description` | `string \| null` | Alt text, if the sender wrote one. |
| `spoiler` | `boolean` | Whether it was marked as a spoiler. |
| `ephemeral` | `boolean` | Whether Discord will remove the file after a while. |

## Limits and errors

Discord enforces these limits. Going over one makes the send fail, so truncate
user-supplied text before it goes into an embed.

| What | Limit |
| --- | --- |
| Embeds per message | 10 |
| Characters across all embeds of a message | 6000 |
| Title | 256 characters |
| Description | 4096 characters |
| Fields per embed | 25 |
| Field name | 256 characters |
| Field value | 1024 characters |
| Footer text | 2048 characters |
| Author name | 256 characters |
| Files per message | 10 |
| Size per file | 20 MiB by default |

The file size limit rises with the server's boost level. In a handler,
`ctx.interaction.attachmentSizeLimit` gives the exact limit in bytes for the
current user and server.

A message with the `IsComponentsV2` flag cannot carry `embeds` at all: see
[Components V2](/components/components-v2/).

## See also

- [The ctx object](/basics/context/) for `ctx.reply` and the coloured shortcuts.
- [Mentions, timestamps and safe pings](/messages/formatting/) for what goes inside embed text.
- [Assets and voice](/messages/assets-and-voice/) for avatar, banner and icon URLs.
- [Options and autocomplete](/commands/options/) for `s.attachment` and `fileTypes`.
- [Components V2](/components/components-v2/) for the embed-free message format.
