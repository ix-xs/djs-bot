---
title: "Message triggers"
description: "A trigger answers ordinary messages that match a keyword, a regular expression or a test of your own. Use it for auto-responders, without writing a messageCreate listener or a cooldown map."
sidebar:
  order: 2
---

A trigger is a small auto-responder: when a new message matches its pattern, its
handler runs. The framework does the listening, the matching, the per-author
cooldown and the error handling.

## A first trigger

```ts title="src/features/fun/ping.trigger.ts"
import { defineTrigger } from "@ix-xs/djs-bot";

export default defineTrigger({
  name: "ping-pong",
  pattern: "ping",
  cooldown: "5s",
  run: (ctx) => ctx.reply("pong 🏓"),
});
```

Any message that contains "ping", in any case, gets a reply. The same author is
answered at most once every five seconds. The loader picks up any file whose
name ends with `.trigger` (see [Project layout](/basics/project-layout/)).

:::caution[Privileged intent]
Registering a trigger makes the bot request `MessageContent`, which is a
privileged intent. Enable it in the Developer Portal, under **Bot > Privileged
Gateway Intents**, or the bot cannot connect. See
[Events and intents](/events/events-and-intents/#privileged-intents).
:::

## Match a keyword

A string pattern is compared with the text of the message. `mode` chooses how,
and `caseInsensitive` (on by default) ignores the case.

```ts title="src/features/fun/keywords.trigger.ts"
import { defineTrigger } from "@ix-xs/djs-bot";

// The whole message must be "hello", in any case
export const hello = defineTrigger({
  name: "hello",
  pattern: "hello",
  mode: "equals",
  run: (ctx) => ctx.reply("Hello."),
});

// An old prefix command
export const legacyHelp = defineTrigger({
  name: "legacy-help",
  pattern: "!help",
  mode: "startsWith",
  run: (ctx) => ctx.reply("Commands are slash commands now. Type / to see them."),
});

// Exact case only
export const urgent = defineTrigger({
  name: "urgent",
  pattern: "URGENT",
  caseInsensitive: false,
  run: (ctx) => ctx.send("A moderator has been notified."),
});
```

| `mode` | Matches when the message |
| --- | --- |
| `"includes"` (default) | contains the pattern anywhere |
| `"equals"` | is exactly the pattern |
| `"startsWith"` | begins with the pattern |
| `"endsWith"` | ends with the pattern |

A string pattern knows nothing about words: with `"includes"`, `"ping"` also
matches "shipping". To match a whole word, use a regular expression such as
`/\bping\b/i`.

## Regular expressions and predicates

A `RegExp` gives you word boundaries, alternatives and capture groups. The
result of the match is available as `ctx.match`. A function gives you full
control: it receives the discord.js `Message` and returns `true` to run the
trigger.

```ts title="src/features/fun/smart.trigger.ts"
import { defineTrigger } from "@ix-xs/djs-bot";

// RegExp: the capture groups are on ctx.match
export const greet = defineTrigger({
  name: "greet",
  pattern: /\bgood (morning|night)\b/i,
  run: (ctx) =>
    ctx.reply(ctx.match?.[1]?.toLowerCase() === "morning" ? "☀️ Morning." : "🌙 Night."),
});

// Predicate: anything you can read on the message
export const wallOfText = defineTrigger({
  name: "wall-of-text",
  pattern: (message) => message.content.length > 500,
  run: (ctx) => ctx.reply("That is a lot of text. A thread may be easier to read."),
});
```

Three things to know:

- `mode` and `caseInsensitive` only apply to string patterns. A `RegExp` uses
  its own flags (`i` for the case).
- `ctx.match` is `null` for a string pattern and for a predicate.
- The `g` flag changes nothing: `ctx.match` is still the first match, with its
  capture groups.

A predicate runs for every message the bot sees, so keep it cheap. It must
answer synchronously: a promise always counts as a match.

## Reply or send

The handler receives a `ctx` built around the message:

- `ctx.reply(content)` replies to the triggering message;
- `ctx.send(content)` posts a new message in the same channel.

Both take a string or a discord.js options object, and resolve to the message
that was sent.

```ts title="src/features/support/invite.trigger.ts"
import { defineTrigger } from "@ix-xs/djs-bot";

export default defineTrigger({
  name: "faq-invite",
  pattern: /\bhow do i invite\b/i,
  cooldown: "1m",
  run: async (ctx) => {
    if (!ctx.guild) return; // ignore direct messages
    await ctx.reply({
      content: "Use the **Add App** button on my profile.",
      allowedMentions: { repliedUser: false }, // answer without pinging the author
    });
    ctx.logger.info({ authorId: ctx.author.id }, "faq answered");
  },
});
```

Triggers also receive direct messages. There, `ctx.guild` and `ctx.member` are
`null`, so test `ctx.guild` first when a trigger only makes sense in a server.

A trigger is not an interaction. `ctx.reply` is a plain function here: it has no
`ctx.reply.success` or `ctx.reply.error` variant, nothing is ephemeral, and
guards, plugin middleware and automatic deferral do not apply.

## Cooldowns and bots

`cooldown` is counted per author and per trigger. It takes a duration string
(`"5s"`, `"1m"`) or a number of milliseconds. It starts when the trigger matches,
and a matching message that arrives during the cooldown is ignored without a
reply.

Messages written by bots, including your own bot, are skipped by default. Pass
`ignoreBots: false` to answer them too.

:::caution[Loops]
With `ignoreBots: false`, the bot also sees its own replies. If a reply matches
the pattern, the trigger answers itself. Test `ctx.author.id` against
`ctx.client.user.id` in the handler, or give it a cooldown.
:::

## Reference

### `defineTrigger(input)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | A unique name, used in logs and by `djs-bot explain`. |
| `pattern` | `string \| RegExp \| (message) => boolean` | - | What to match: a keyword, a regular expression, or a predicate on the `Message`. |
| `mode` | `"includes" \| "equals" \| "startsWith" \| "endsWith"` | `"includes"` | How a string pattern is compared with the content. |
| `caseInsensitive` | `boolean` | `true` | Ignore the case of a string pattern. |
| `ignoreBots` | `boolean` | `true` | Skip messages sent by bots, including this one. |
| `cooldown` | `string \| number` | none | Minimum delay between two runs for the same author: a duration (`"5s"`) or milliseconds. A string that is not a duration means no cooldown. |
| `run` | `(ctx: TriggerContext) => unknown` | - | The handler. May be async. |

Returns a `TriggerDefinition` (`kind: "trigger"`), to export from a `.trigger`
file or to list in a [feature](/architecture/features/). The pattern types are
exported as `TriggerPattern` and `TriggerMode`.

### `TriggerContext`

| Property | Type | Description |
| --- | --- | --- |
| `message` | `Message` | The message that matched. |
| `client` | `Client<true>` | The connected client. |
| `author` | `User` | Who sent the message. |
| `member` | `GuildMember \| null` | The author as a guild member. `null` in direct messages or when not cached. |
| `guild` | `Guild \| null` | The server the message was sent in. `null` in direct messages. |
| `channel` | `Message["channel"]` | The channel the message was sent in. |
| `services` | `ServiceMap` | Your [services](/architecture/services/), typed. |
| `logger` | `Logger` | A logger tagged with the trigger name and the `correlationId` of this run. |
| `correlationId` | `string` | A unique id for this run. Every line logged through `logger` carries it. |
| `match` | `RegExpMatchArray \| null` | The result of the match when the pattern is a `RegExp`, otherwise `null`. |
| `reply(content)` | `(content: string \| MessageReplyOptions) => Promise<Message>` | Replies to the triggering message. |
| `send(content)` | `(content: string \| MessageCreateOptions) => Promise<Message>` | Sends a new message to the same channel. |

## Limits and errors

- **Intents.** With automatic intents, registering at least one trigger requests
  `GuildMessages`, `MessageContent` (privileged) and `DirectMessages`, and
  enables the `Channel` and `Message` partials. If you pass an `intents` array,
  nothing is added: list them yourself. Details are in
  [Events and intents](/events/events-and-intents/).
- **New messages only.** Triggers run on `messageCreate`. An edited message is
  not tested again.
- **Every trigger is tested on every message.** When several match the same
  message, they all run, one after the other, in the order they were
  registered.
- **Empty content never matches a keyword.** A message with only an attachment
  or a sticker has no text. Use a predicate for those.
- **A handler that throws does not stop the bot.** The error is logged with the
  trigger name, then passed to every plugin `onError` hook and to the `onError`
  of `defineBot`, without a `ctx`. The other triggers still run. See
  [Errors](/api/errors/).
- **Cooldowns live in memory.** They are reset when the bot restarts, and on a
  sharded bot each shard keeps its own.

## See also

- [Events and intents](/events/events-and-intents/): listen to `messageCreate` yourself, and manage the intents.
- [Slash commands](/commands/slash-commands/): the better choice when the user asks for something on purpose.
- [Mentions, timestamps and safe pings](/messages/formatting/): control who a reply pings.
- [Embeds and attachments](/messages/embeds-and-attachments/): send more than text.
- [Scheduled jobs](/events/jobs/): act on a schedule instead of on a message.
