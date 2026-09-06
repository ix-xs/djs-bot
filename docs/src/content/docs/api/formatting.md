---
title: "Formatting, assets & voice"
description: "mention, emoji, timestamp, allowedMentions, asset URLs and voice-state helpers."
sidebar:
  order: 18
---

## `mention`

Returns the exact markup Discord renders as a mention.

| Helper | Produces | Renders as |
| --- | --- | --- |
| `mention.user(id)` | `<@id>` | @username |
| `mention.channel(id)` | `<#id>` | #channel |
| `mention.role(id)` | `<@&id>` | @role |
| `mention.everyone` | `@everyone` | |
| `mention.here` | `@here` | |
| `mention.command(name, id, sub?)` | `</name:id>` | A clickable `/command` |

```ts
ctx.reply(`${mention.user(id)} please read ${mention.channel(rulesId)}`);
ctx.reply(`Try ${mention.command("config", commandId, "set")}`);
```

The command id comes from a deployed command - `bot.deploy()` returns them, and
`djs-bot explain` prints them.

## `timestamp`

```ts
timestamp(date: Date | number, style?: TimestampStylesString): string
```

Renders a Discord timestamp, which every user sees **in their own timezone and
locale** - far better than formatting a date yourself.

```ts
import { timestamp, TimestampStyles } from "@ix-xs/djs-bot";

timestamp(new Date());                                        // 1 January 2026 12:00
timestamp(Date.now() + 3600_000, TimestampStyles.RelativeTime); // in an hour
timestamp(member.joinedAt!, TimestampStyles.LongDate);          // 1 January 2026
```

Accepts a `Date`, Unix milliseconds or Unix seconds - it detects which.

| Style | Example |
| --- | --- |
| `ShortTime` | 12:00 |
| `LongTime` | 12:00:00 |
| `ShortDate` | 01/01/2026 |
| `LongDate` | 1 January 2026 |
| `ShortDateTime` | 1 January 2026 12:00 |
| `LongDateTime` | Thursday, 1 January 2026 12:00 |
| `RelativeTime` | in an hour / 3 days ago |

`RelativeTime` is the one to use for cooldowns, bans and reminders - it keeps
counting down live in the client.

## `emoji`

| Helper | Description |
| --- | --- |
| `emoji.custom(name, id, animated?)` | Builds `<:name:id>` or `<a:name:id>`. |
| `emoji.format(e)` | The same from a partial `{ name, id, animated? }`. |
| `emoji.parse(input)` | Parses markup back into `{ animated, name, id }`, or `null`. |
| `emoji.find(guild, name)` | Finds a guild custom emoji by name, from cache. |

```ts
const check = emoji.custom("check", "1234567890123456789");
await ctx.reply(`${check} Done!`);

const found = emoji.find(ctx.guild!, "check");
if (found) await ctx.reply(`${found} Done!`);
```

:::tip[Where do I find an emoji id?]
Type `\:emojiname:` in Discord and send it - the raw markup appears, ids
included. The bot must share a server with the emoji to use it.
:::

## `allowedMentions`

Controls who a message may actually ping - the difference between rendering
`@everyone` and *notifying* everyone.

| Helper | Effect |
| --- | --- |
| `allowedMentions.none()` | Ping nobody. |
| `allowedMentions.all()` | Ping everyone, users and roles. |
| `allowedMentions.users(...ids)` | Ping only these users. |
| `allowedMentions.roles(...ids)` | Ping only these roles. |
| `allowedMentions.repliedUser(bool)` | Whether replying pings the original author. |

```ts
await ctx.reply({
  content: userSuppliedText,
  allowedMentions: allowedMentions.none(),      // renders mentions, pings nobody
});

await ctx.reply({
  content: `${mention.user(target)} you were warned`,
  allowedMentions: allowedMentions.users(target),
});
```

:::danger[Always set this on user-supplied text]
Echoing user input without `allowedMentions` is how a bot ends up mass-pinging a
server. Default to `none()` and opt in explicitly.
:::

## `assets`

URL helpers for avatars, banners and guild images.

| Helper | Returns | Notes |
| --- | --- | --- |
| `assets.avatar(userOrMember, options?)` | `string` | The best avatar - a member server avatar wins over their global one. |
| `assets.banner(user, options?)` | `Promise<string \| null>` | **Async**: banners are not cached, so the user is fetched. |
| `assets.guildIcon(guild, options?)` | `string \| null` | |
| `assets.guildBanner(guild, options?)` | `string \| null` | |
| `assets.guildSplash(guild, options?)` | `string \| null` | |
| `assets.emoji(id, options?)` | `string` | `{ animated?, size? }`. |

`ImageOptions`:

| Option | Type | Description |
| --- | --- | --- |
| `size` | `ImageSize` | Power of two, 16-4096. |
| `extension` | `"webp" \| "png" \| "jpg" \| "jpeg" \| "gif"` | Output format. |
| `forceStatic` | `boolean` | Force a still image even for animated assets. |

```ts
const embed = new EmbedBuilder()
  .setThumbnail(assets.avatar(ctx.member ?? ctx.user, { size: 256 }))
  .setImage(await assets.banner(ctx.user, { size: 1024 }) ?? "");
```

## `voice`

Voice-state helpers for moderation and utility commands. They use the gateway
and REST only - **no** `@discordjs/voice`, no audio dependencies.

| Helper | Returns | Description |
| --- | --- | --- |
| `voice.channelOf(member)` | `VoiceBasedChannel \| null` | The channel they are in. |
| `voice.isConnected(member)` | `boolean` | Whether they are in any voice channel. |
| `voice.membersIn(channel)` | `Collection<string, GuildMember>` | Who is in a channel. |
| `voice.move(member, channel)` | `Promise<GuildMember>` | Move them, or `null` to disconnect. |
| `voice.disconnect(member)` | `Promise<GuildMember>` | Disconnect them. |
| `voice.mute(member, muted?, reason?)` | `Promise<GuildMember>` | Server-mute. Default `true`. |
| `voice.deafen(member, deafened?, reason?)` | `Promise<GuildMember>` | Server-deafen. Default `true`. |

```ts
export default defineCommand({
  name: "vcmove",
  description: "Move everyone to another voice channel",
  guards: [inGuild(), botHasPermission(PermissionFlagsBits.MoveMembers)],
  options: {
    to: s.channel({ description: "Destination", required: true, channelTypes: [ChannelType.GuildVoice] }),
  },
  run: async (ctx) => {
    const from = voice.channelOf(ctx.member!);
    if (!from) return ctx.reply.error("You are not in a voice channel.");

    const members = voice.membersIn(from);
    for (const member of members.values()) await voice.move(member, ctx.options.to as VoiceBasedChannel);

    return ctx.reply.success(`Moved ${members.size} members.`);
  },
});
```

These need the `GuildVoiceStates` intent - supplied automatically under
`intents: "auto"` when you register a `voiceStateUpdate` event.
