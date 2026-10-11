---
title: "Assets and voice"
description: "Get the URL of an avatar, a banner, a server icon or an emoji image with assets, and inspect, move, mute or disconnect members in voice channels with voice."
sidebar:
  order: 3
---

Two small helper groups, both thin layers over discord.js. `assets` returns
image URLs you can put in an embed or a gallery. `voice` reads who is in which
voice channel and moves, mutes or disconnects members. It plays no audio and
does not depend on `@discordjs/voice`.

## A first avatar

```ts title="features/avatar/avatar.command.ts"
import { defineCommand, s, assets, EmbedBuilder } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "avatar",
  description: "Show an avatar and banner",
  options: {
    user: s.user({ description: "Whose avatar (yours by default)" }),
  },
  run: async (ctx) => {
    const user = ctx.options.user ?? ctx.user;

    const embed = new EmbedBuilder()
      .setTitle(user.username)
      .setThumbnail(assets.avatar(user, { size: 256 }));

    const banner = await assets.banner(user, { size: 1024 });
    if (banner) embed.setImage(banner);

    await ctx.reply({ embeds: [embed] });
  },
});
```

## Avatars and banners

```ts
import { assets } from "@ix-xs/djs-bot";

assets.avatar(ctx.user, { size: 256 });           // the user's avatar
assets.avatar(ctx.member, { extension: "png" });  // the member's server avatar, if they set one
await assets.banner(ctx.user, { size: 1024 });    // string | null
```

`assets.avatar` accepts a user or a guild member and always returns a URL. With
a member, the avatar they chose for that server wins over their global one.
Someone with no avatar at all gets Discord's default image. Pass
`ctx.member ?? ctx.user` to show the server avatar when there is one.

`assets.banner` is asynchronous and takes a user, not a member. discord.js does
not cache banners, so the helper fetches the user from Discord the first time,
then builds the URL. It resolves to `null` when the user has no banner, so test
the result before giving it to `setImage`.

Every helper accepts the same image options: a `size`, an `extension` and
`forceStatic`. They are listed under [`ImageOptions`](/messages/assets-and-voice/#imageoptions).

## Server and emoji images

```ts
assets.guildIcon(guild, { size: 512 });   // string | null
assets.guildBanner(guild);                // string | null
assets.guildSplash(guild);                // string | null, the invite background
assets.emoji("1234567890", { animated: true, size: 128 });
```

The three guild helpers return `null` when the server has not set that image.
In a handler, `ctx.guild` is `null` outside a server, so check it first or add
the `inGuild()` [guard](/commands/guards/).

`assets.emoji` builds the image URL of a custom emoji from its id alone, without
any lookup: a PNG, or a GIF when `animated` is `true`. To write an emoji in a
message rather than show its image, use the `emoji` helpers in
[Mentions, timestamps and safe pings](/messages/formatting/).

## Reading voice state

```ts
import { voice } from "@ix-xs/djs-bot";

voice.channelOf(member);    // VoiceBasedChannel | null
voice.isConnected(member);  // boolean
voice.membersIn(channel);   // Collection<string, GuildMember>
```

These read what discord.js already knows. They make no request and return at
once.

:::caution[They need the GuildVoiceStates intent]
Discord only tells the bot who is in voice when the `GuildVoiceStates` intent
is on. Without it, `voice.channelOf` returns `null` for everyone and
`voice.membersIn` is empty. With `intents: "auto"` the intent is added only when
you register a `voiceStateUpdate` event. If you use the helpers from commands
alone, add it yourself: `intents: { add: [GatewayIntentBits.GuildVoiceStates] }`.
See [Events and intents](/events/events-and-intents/).
:::

To react when someone joins, leaves or switches channel, listen to
`voiceStateUpdate`. Registering it also turns the intent on.

```ts title="features/voice/voice-log.event.ts"
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("voiceStateUpdate", (oldState, newState, ctx) => {
  if (!oldState.channel && newState.channel) {
    ctx.logger.info({ user: newState.id, channel: newState.channel.id }, "joined voice");
  } else if (oldState.channel && !newState.channel) {
    ctx.logger.info({ user: newState.id }, "left voice");
  }
});
```

## Moving and muting members

```ts
await voice.move(member, channel);              // move to another voice channel
await voice.move(member, null);                 // null disconnects
await voice.disconnect(member);                 // remove from voice
await voice.mute(member, true, "Too loud");     // server mute, with an audit log reason
await voice.mute(member, false);                // unmute
await voice.deafen(member);                     // server deafen (true by default)
```

Each call is one request to Discord and resolves to the updated member. The bot
needs the matching permission in the server, and the member has to be connected
to voice: otherwise Discord refuses and the promise rejects.

This command moves everyone from the caller's voice channel to another one. The
guards check the permissions before anything runs.

```ts title="features/voice/vcmove.command.ts"
import {
  defineCommand,
  s,
  voice,
  inGuild,
  hasPermission,
  botHasPermission,
  ChannelType,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";
import type { VoiceBasedChannel } from "discord.js";

export default defineCommand({
  name: "vcmove",
  description: "Move everyone in your voice channel to another one",
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.MoveMembers),
    botHasPermission(PermissionFlagsBits.MoveMembers),
  ],
  options: {
    to: s.channel({ description: "Destination", required: true, channelTypes: [ChannelType.GuildVoice] }),
  },
  run: async (ctx) => {
    const from = ctx.member ? voice.channelOf(ctx.member) : null;
    if (!from) return ctx.reply.error("You are not in a voice channel.");

    const members = voice.membersIn(from);
    for (const member of members.values()) await voice.move(member, ctx.options.to as VoiceBasedChannel);

    return ctx.reply.success(`Moved ${members.size} members.`);
  },
});
```

The option is limited to voice channels with `channelTypes`, which is why the
cast to `VoiceBasedChannel` is safe.

## Reference

### `assets`

| Helper | Returns | Description |
| --- | --- | --- |
| `assets.avatar(userOrMember, options?)` | `string` | Best avatar: the server avatar for a member, else the global one, else the default image. |
| `assets.banner(user, options?)` | `Promise<string \| null>` | The user's profile banner. Fetches the user when the banner is not known yet. |
| `assets.guildIcon(guild, options?)` | `string \| null` | The server icon. |
| `assets.guildBanner(guild, options?)` | `string \| null` | The server banner. |
| `assets.guildSplash(guild, options?)` | `string \| null` | The invite splash image. |
| `assets.emoji(id, options?)` | `string` | The image of a custom emoji. Options: `{ animated?: boolean; size?: ImageSize }`. |

`options` is an [`ImageOptions`](/messages/assets-and-voice/#imageoptions) object everywhere except
`assets.emoji`, which only takes `animated` and `size`.

### `ImageOptions`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `size` | `ImageSize` | Discord's default | A power of two from 16 to 4096: `16`, `32`, `64`, `128`, `256`, `512`, `1024`, `2048`, `4096`. |
| `extension` | `"webp" \| "png" \| "jpg" \| "jpeg" \| "gif"` | `"webp"` | Image format. |
| `forceStatic` | `boolean` | `false` | Return a still image even when the asset is animated. |

### `voice`

| Helper | Returns | Permission | Description |
| --- | --- | --- | --- |
| `voice.channelOf(member)` | `VoiceBasedChannel \| null` | none | The voice channel the member is in. |
| `voice.isConnected(member)` | `boolean` | none | Whether they are in any voice channel. |
| `voice.membersIn(channel)` | `Collection<string, GuildMember>` | none | The members currently in a channel, by id. |
| `voice.move(member, channel)` | `Promise<GuildMember>` | Move Members | Moves them. `null` disconnects them. |
| `voice.disconnect(member)` | `Promise<GuildMember>` | Move Members | Removes them from voice. |
| `voice.mute(member, muted?, reason?)` | `Promise<GuildMember>` | Mute Members | Server mute. `muted` defaults to `true`; pass `false` to unmute. |
| `voice.deafen(member, deafened?, reason?)` | `Promise<GuildMember>` | Deafen Members | Server deafen. `deafened` defaults to `true`; pass `false` to undo. |

`reason` is recorded in the server's audit log. `voice.move` and
`voice.disconnect` take no reason.

All helpers take a `GuildMember`. In a handler that is `ctx.member`, which is
`null` outside a server.

## See also

- [Embeds and attachments](/messages/embeds-and-attachments/) for where image URLs are used.
- [Events and intents](/events/events-and-intents/) for `voiceStateUpdate` and the intent autopilot.
- [Guards](/commands/guards/) for `inGuild`, `hasPermission` and `botHasPermission`.
- [Cache and entity resolution](/data/cache/) for fetching members and channels by id.
