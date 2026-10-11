---
title: "Mentions, timestamps and safe pings"
description: "Helpers that produce the exact markup Discord turns into mentions, localised dates and custom emojis, and the allowedMentions builders that decide who a message is allowed to notify."
sidebar:
  order: 2
---

Discord renders special markup inside message text: `<@id>` becomes a user
mention, `<t:1767268800:R>` becomes "in 2 hours". The `mention`, `timestamp`
and `emoji` helpers write that markup for you, so you do not have to remember
it. They return plain strings and work anywhere text goes: message content,
embed descriptions, field values, Components V2 text.

## A first formatted message

This command pings one person about something that starts later. The mention
and the countdown are both generated, and `allowedMentions` makes sure only that
person is notified.

```ts title="features/remind/remind.command.ts"
import { defineCommand, s, mention, timestamp, allowedMentions, TimestampStyles } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "remind",
  description: "Tell someone when the event starts",
  options: {
    user: s.user({ description: "Who to remind", required: true }),
    minutes: s.integer({ description: "Minutes from now", required: true, min: 1 }),
  },
  run: async (ctx) => {
    const target = ctx.options.user.id;
    const when = Date.now() + ctx.options.minutes * 60_000;

    await ctx.reply({
      content: `${mention.user(target)} the event starts ${timestamp(when, TimestampStyles.RelativeTime)}.`,
      allowedMentions: allowedMentions.users(target),
    });
  },
});
```

## Mentions

Each helper takes an id and returns the markup Discord renders as a mention.

```ts
import { mention } from "@ix-xs/djs-bot";

mention.user("123");     // <@123>
mention.channel("456");  // <#456>
mention.role("789");     // <@&789>
mention.everyone;        // @everyone
mention.here;            // @here

await ctx.reply(`${mention.user(id)} please read ${mention.channel(rulesId)}`);
```

`mention.everyone` and `mention.here` are constants, not functions.

A command mention is a clickable `/command` that fills the user's input box when
they click it:

```ts
mention.command("config", commandId);              // </config:id>
mention.command("config", commandId, "set");       // </config set:id>
mention.command("config", commandId, "roles add"); // </config roles add:id>
```

The third argument is the subcommand. For a subcommand inside a group, pass the
group and the subcommand separated by a space.

The id is the one Discord gave the command when it was deployed. Inside a
command's own handler it is `ctx.interaction.commandId`. For another command,
fetch the deployed list:

```ts
const commands = await ctx.client.application.commands.fetch();
const config = commands.find((command) => command.name === "config");

if (config) await ctx.reply(`Try ${mention.command("config", config.id, "set")}`);
```

That call lists global commands. A command deployed to one guild (which is what
happens in development with a dev guild) has a different id from its global
version: fetch it with `ctx.guild.commands.fetch()` instead, and do not
hard-code an id copied from your test server. Deployment is covered in
[Deploying commands](/production/deploying/).

## Timestamps

`timestamp` renders a date that every reader sees in their own timezone and
language. That is better than formatting a date yourself, where you would have
to pick one timezone for everybody.

```ts
import { timestamp, TimestampStyles } from "@ix-xs/djs-bot";

timestamp(new Date());                                          // 20 April 2021 at 16:20
timestamp(Date.now() + 3_600_000, TimestampStyles.RelativeTime); // in an hour
timestamp(member.joinedAt, TimestampStyles.LongDate);           // 20 April 2021
```

Without a style, Discord shows the date with a short time
(`LongDateShortTime`).

| Style | Letter | Example |
| --- | --- | --- |
| `ShortTime` | `t` | 16:20 |
| `MediumTime` | `T` | 16:20:30 |
| `ShortDate` | `d` | 20/04/2021 |
| `LongDate` | `D` | 20 April 2021 |
| `LongDateShortTime` | `f` | 20 April 2021 at 16:20 |
| `FullDateShortTime` | `F` | Tuesday, 20 April 2021 at 16:20 |
| `ShortDateShortTime` | `s` | 20/04/2021, 16:20 |
| `ShortDateMediumTime` | `S` | 20/04/2021, 16:20:30 |
| `RelativeTime` | `R` | in an hour, 3 days ago |

The exact wording depends on the reader's language. `RelativeTime` is the one to
use for cooldowns, bans and reminders: it keeps counting in the client without
any edit from your bot.

The older names `LongTime`, `ShortDateTime` and `LongDateTime` still work. They
are deprecated aliases of `MediumTime`, `LongDateShortTime` and
`FullDateShortTime`. The style argument also accepts the letter itself:
`timestamp(date, "R")`.

The first argument can be a `Date`, Unix milliseconds or Unix seconds. A number
above 1 000 000 000 000 is read as milliseconds, anything else as seconds, so
`Date.now()` and a value stored in seconds both work.

:::note[Very old millisecond values]
Because of that threshold, a millisecond timestamp from before September 2001
would be read as seconds. For dates that old, pass a `Date` object.
:::

## Custom emojis

Unicode emojis are ordinary characters: type them in your strings. Custom
emojis (the ones uploaded to a server) need markup that contains their name and
id.

```ts
import { emoji } from "@ix-xs/djs-bot";

emoji.custom("check", "1234567890123456789");   // <:check:1234567890123456789>
emoji.custom("blob", "1234567890", true);       // <a:blob:1234567890> (animated)
emoji.format({ name: "blob", id: "123" });      // <:blob:123>
emoji.parse("<a:blob:123>");                    // { animated: true, name: "blob", id: "123" }
emoji.find(ctx.guild, "blob");                  // GuildEmoji | undefined
```

`emoji.find` looks in the guild's cached emojis by name and makes no request. A
`GuildEmoji` turns into its own markup when placed in a string, so you can use
the result directly:

```ts
const check = ctx.guild ? emoji.find(ctx.guild, "check") : undefined;
await ctx.reply(`${check ?? "✅"} Done`);
```

`emoji.parse` is the reverse of `emoji.custom`. The whole string has to be one
custom emoji (surrounding spaces are ignored); it returns `null` for anything
else, including a Unicode emoji or an emoji in the middle of a sentence.

:::tip[Where to find an emoji id]
In Discord, type a backslash before the emoji, like `\:check:`, and send the
message. The raw markup appears, id included. The bot has to share a server
with the emoji to use it.
:::

For the image URL of an emoji rather than its markup, see `assets.emoji` in
[Assets and voice](/messages/assets-and-voice/).

## Safe pings

Rendering a mention and notifying someone are two different things. By default
Discord notifies whoever is mentioned in a message's content, so a bot that
repeats user input can be made to ping people, roles or, when it has the
permission, `@everyone`. The `allowedMentions` option of a message limits who
may be notified. The mentions still render.

```ts
import { allowedMentions, mention } from "@ix-xs/djs-bot";

// Repeat user text, notify nobody.
await ctx.reply({ content: userText, allowedMentions: allowedMentions.none() });

// Notify one user.
await ctx.reply({
  content: `${mention.user(target)} you were warned`,
  allowedMentions: allowedMentions.users(target),
});

// Notify one role.
await ctx.reply({
  content: `${mention.role(roleId)} heads up`,
  allowedMentions: allowedMentions.roles(roleId),
});
```

:::danger[Always set this on user-supplied text]
Sending text that a user wrote without `allowedMentions` is how a bot ends up
pinging a whole server. Use `allowedMentions.none()` whenever the content is
not entirely yours, and opt in to specific ids when you do want a ping.
:::

Each helper returns a plain object holding only its own key, and whatever is not
listed is not notified: `allowedMentions.users(id)` pings that user and no role.
To allow several kinds at once, spread them together:

```ts
allowedMentions: { ...allowedMentions.users(target), ...allowedMentions.roles(roleId) }
```

`repliedUser` matters when the bot answers a message with Discord's reply
feature, as a [message trigger](/events/triggers/) does. It decides whether the
author of that message is notified by the reply:

```ts title="features/fun/thanks.trigger.ts"
import { defineTrigger, allowedMentions } from "@ix-xs/djs-bot";

export default defineTrigger({
  name: "thanks",
  pattern: "thank you",
  run: (ctx) =>
    ctx.reply({
      content: "You are welcome.",
      allowedMentions: allowedMentions.repliedUser(false), // reply without a ping
    }),
});
```

To set a default for every message the bot sends, pass it once through the
`client` option of `defineBot`, described in
[Configuration](/basics/configuration/). A message that sets its own
`allowedMentions` replaces that default entirely.

```ts
defineBot({
  client: { allowedMentions: allowedMentions.none() },
});
```

## Reference

### `mention`

| Member | Returns | Renders as |
| --- | --- | --- |
| `mention.user(id)` | `<@id>` | @username |
| `mention.channel(id)` | `<#id>` | #channel |
| `mention.role(id)` | `<@&id>` | @role |
| `mention.everyone` | `@everyone` | @everyone |
| `mention.here` | `@here` | @here |
| `mention.command(name, id, subcommand?)` | `</name:id>` or `</name subcommand:id>` | A clickable `/command` |

All ids are strings.

### `timestamp(date, style?)`

```ts
timestamp(date: Date | number, style?: TimestampStylesString): string
```

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `date` | `Date \| number` | required | A `Date`, Unix milliseconds or Unix seconds. |
| `style` | `TimestampStylesString` | none | A `TimestampStyles` value or its letter. Without it, Discord uses `f`. |

Returns `<t:seconds>` or `<t:seconds:style>`. Fractions of a second are dropped.

### `TimestampStyles`

The discord.js constant, re-exported. Its values are listed in
[Timestamps](/messages/formatting/#timestamps).

### `emoji`

| Member | Returns | Description |
| --- | --- | --- |
| `emoji.custom(name, id, animated?)` | `string` | `<:name:id>`, or `<a:name:id>` when `animated` is `true`. Default `false`. |
| `emoji.format(e)` | `string` | The same from an object `{ name, id, animated? }`. |
| `emoji.parse(input)` | `{ animated, name, id } \| null` | Reads custom emoji markup back into its parts. |
| `emoji.find(guild, name)` | `GuildEmoji \| undefined` | Finds a guild's custom emoji by name, from cache. |

### `allowedMentions`

| Member | Returns | Effect |
| --- | --- | --- |
| `allowedMentions.none()` | `{ parse: [] }` | Notify nobody. |
| `allowedMentions.all()` | `{ parse: ["everyone", "users", "roles"] }` | Notify everything mentioned: `@everyone`, `@here`, users and roles. |
| `allowedMentions.users(...ids)` | `{ users: ids }` | Notify only these users. |
| `allowedMentions.roles(...ids)` | `{ roles: ids }` | Notify only these roles. |
| `allowedMentions.repliedUser(ping)` | `{ repliedUser: ping }` | Whether a reply notifies the author of the message replied to. |

The result goes in the `allowedMentions` property of anything that sends a
message: `ctx.reply`, `ctx.update`, `channel.send`, `message.reply`.

## See also

- [Embeds and attachments](/messages/embeds-and-attachments/) for where formatted text usually ends up.
- [Assets and voice](/messages/assets-and-voice/) for avatar, banner and emoji image URLs.
- [The ctx object](/basics/context/) for `ctx.reply` and its options.
- [Configuration](/basics/configuration/) for the `client` option and bot-wide defaults.
