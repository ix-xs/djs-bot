---
title: "Events and intents"
description: "Listen to anything Discord sends over the gateway with defineEvent. The framework reads your listeners and requests the gateway intents and partials they need, so an event never stays silent because an intent was forgotten."
sidebar:
  order: 1
---

Slash commands, buttons and modals reach your bot as interactions, and the
framework routes those for you. Everything else (a member joining, a reaction, a
voice channel change) arrives as a gateway event. `defineEvent` registers a
listener for one of them.

## A first event

```ts title="src/features/welcome/welcome.event.ts"
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("guildMemberAdd", async (member, ctx) => {
  ctx.logger.info({ id: member.id }, "member joined");
  const channel = member.guild.systemChannel;
  if (channel) await channel.send(`Welcome ${member}.`);
});
```

The first argument is a discord.js event name. It is typed, so the editor
completes the name and knows the type of every argument of the handler.

The handler receives the event's own arguments, in the order discord.js gives
them, and then a `ctx` as the **last** argument. `ctx` holds the connected
`client`, your `services` and a `logger` tagged with the event name. There is no
`ctx.reply` here: an event is not an interaction, so you answer through the
objects the event gives you (`channel.send`, `member.send`...).

Because `ctx` comes after all of the event's arguments, list every one of them,
even those you do not use. Skipping one shifts `ctx` into its place:

```ts
defineEvent("voiceStateUpdate", (oldState, newState, ctx) => {
  /* ... */
});

// messageReactionAdd has three arguments of its own
defineEvent("messageReactionAdd", (reaction, user, _details, ctx) => {
  /* ... */
});
```

The loader picks up any file whose name ends with `.event` (see
[Project layout](/basics/project-layout/)). Several listeners can be registered
for the same event: they all run.

## Run a listener once

Pass `{ once: true }` as the third argument. The listener is removed after its
first call.

```ts title="src/features/core/boot.event.ts"
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent(
  "clientReady",
  (client, ctx) => {
    ctx.logger.info({ tag: client.user.tag }, "online");
  },
  { once: true },
);
```

:::note
discord.js renamed the `ready` event to `clientReady`. The old name still works
in v14 but prints a deprecation warning.
:::

## How intents are chosen

An intent is a subscription. When the bot connects, it tells Discord which
groups of events it wants, and Discord sends only those. Forgetting one is the
classic reason for "my event never fires".

With `intents: "auto"`, which is the default, you never write that list. The
framework derives it from the events and [triggers](/events/triggers/) you
registered:

| You listen to | Intent requested |
| --- | --- |
| `guildMemberAdd`, `guildMemberRemove` | `GuildMembers` (privileged) |
| `messageCreate` | `GuildMessages` and `MessageContent` (privileged) |
| `messageReactionAdd` | `GuildMessageReactions` |
| `voiceStateUpdate` | `GuildVoiceStates` |
| `presenceUpdate` | `GuildPresences` (privileged) |

The complete list is in the [event to intent map](#event-to-intent-map).
`Guilds` is always included, so that guild interactions are delivered and
`ctx.guild` is filled.

The same goes for **partials**. discord.js drops an event about an object it
does not have in its cache, such as a reaction on a message sent before the bot
started, unless the matching partial is enabled. The framework enables the
partials your events need (see the
[event to partial map](#event-to-partial-map)). A partial object only carries
its id, so fetch it before reading anything else:

```ts title="src/features/stars/star.event.ts"
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("messageReactionAdd", async (reaction, user, _details, ctx) => {
  // A reaction on an uncached message arrives as a partial.
  if (reaction.partial) await reaction.fetch();
  if (reaction.emoji.name !== "⭐") return;
  ctx.logger.info({ messageId: reaction.message.id, userId: user.id }, "message starred");
});
```

To see what was derived without connecting, run `npx djs-bot explain`: it prints
the intents, the partials and the privileged intents in use (see
[CLI](/api/cli/)).

## Adjust the selection

The autopilot cannot guess everything. Keep it and correct its result with an
object: `add` for what it does not assume, `remove` for what you can do without.

```ts title="src/index.ts"
import { defineBot, GatewayIntentBits } from "@ix-xs/djs-bot";

export default defineBot({
  intents: {
    add: [GatewayIntentBits.DirectMessages],     // also receive direct messages
    remove: [GatewayIntentBits.MessageContent],  // this bot only reacts to mentions
  },
});
```

Two cases come up often:

- **Direct messages.** A `messageCreate` listener only requests the server
  intents. Add `DirectMessages` to receive private messages as well. The
  `Channel` partial they need is then enabled for you.
- **`MessageContent`.** A `messageCreate` listener requests it because most
  listeners read the text. Without it, Discord still sends the event, but the
  content is empty unless the message mentions the bot or is a direct message.
  If that is enough for you, remove it and avoid a privileged intent.

`add` is applied first, then `remove`.

To take full control, pass an array. It is used exactly as written:

```ts
intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
```

Extra partials go in `partials`. In automatic mode they are merged with the
derived ones:

```ts title="src/index.ts"
import { defineBot, Partials } from "@ix-xs/djs-bot";

export default defineBot({
  partials: [Partials.User],
});
```

## Privileged intents

Three intents give access to sensitive data, and Discord keeps them off until
you switch them on in the Developer Portal, under **Bot > Privileged Gateway
Intents**:

| Intent | Needed for |
| --- | --- |
| `GuildMembers` | Member joins, leaves and updates, `userUpdate` |
| `MessageContent` | Reading the text of messages, so every `messageCreate` listener and every trigger |
| `GuildPresences` | `presenceUpdate` |

When the derived list contains one of them, the bot logs a warning at startup
that names it, and `npx djs-bot doctor` reminds you too.

An app with fewer than 10,000 users can toggle them freely. From 10,000 users
on, Discord requires an application for each privileged intent, and the access
has to be reconfirmed every year. This is a good reason to remove one you do not
really use.

:::caution[The toggle must match]
If the bot requests a privileged intent that is not enabled in the portal,
Discord refuses the connection (`Used disallowed intents`). Enable it, or remove
it with `intents: { remove: [...] }`.
:::

:::note[Custom statuses and private profiles]
Since September 17, 2026, when a user's Profile Privacy Setting is
`Friends Only`, or `Friends & Small Servers Only` in a server of more than 200
members, the presence updates sent to that server leave their custom status
(activity type `4`, `ActivityType.Custom` in discord.js) out of `activities`.
Other activity types are not affected. A `presenceUpdate` listener that reads a
custom status has to expect it to be missing.
:::

## Event to intent map

Every event the autopilot knows, grouped by the intent it requests.

| Intent | Events |
| --- | --- |
| `Guilds` | `guildCreate`, `guildDelete`, `guildUpdate`, `guildAvailable`, `guildUnavailable`, `channelCreate`, `channelDelete`, `channelUpdate`, `channelPinsUpdate`, `roleCreate`, `roleDelete`, `roleUpdate`, `threadCreate`, `threadDelete`, `threadUpdate`, `threadListSync`, `threadMemberUpdate`, `threadMembersUpdate`, `stageInstanceCreate`, `stageInstanceDelete`, `stageInstanceUpdate` |
| `GuildMembers` (privileged) | `guildMemberAdd`, `guildMemberRemove`, `guildMemberUpdate`, `guildMemberAvailable`, `guildMembersChunk`, `userUpdate` |
| `GuildModeration` | `guildBanAdd`, `guildBanRemove`, `guildAuditLogEntryCreate` |
| `GuildExpressions` | `emojiCreate`, `emojiDelete`, `emojiUpdate`, `stickerCreate`, `stickerDelete`, `stickerUpdate`, `guildSoundboardSoundCreate`, `guildSoundboardSoundDelete`, `guildSoundboardSoundUpdate`, `guildSoundboardSoundsUpdate` |
| `GuildIntegrations` | `guildIntegrationsUpdate` |
| `GuildWebhooks` | `webhooksUpdate` |
| `GuildInvites` | `inviteCreate`, `inviteDelete` |
| `GuildVoiceStates` | `voiceStateUpdate`, `voiceChannelEffectSend` |
| `GuildPresences` (privileged) | `presenceUpdate` |
| `GuildMessages` and `MessageContent` (privileged) | `messageCreate` |
| `GuildMessages` | `messageUpdate`, `messageDelete`, `messageDeleteBulk` |
| `GuildMessageReactions` | `messageReactionAdd`, `messageReactionRemove`, `messageReactionRemoveAll`, `messageReactionRemoveEmoji` |
| `GuildMessagePolls` | `messagePollVoteAdd`, `messagePollVoteRemove` |
| `GuildMessageTyping` | `typingStart` |
| `GuildScheduledEvents` | `guildScheduledEventCreate`, `guildScheduledEventUpdate`, `guildScheduledEventDelete`, `guildScheduledEventUserAdd`, `guildScheduledEventUserRemove` |
| `AutoModerationConfiguration` | `autoModerationRuleCreate`, `autoModerationRuleDelete`, `autoModerationRuleUpdate` |
| `AutoModerationExecution` | `autoModerationActionExecution` |

Registering at least one [trigger](/events/triggers/) adds `GuildMessages`,
`MessageContent` and `DirectMessages`.

## Event to partial map

| Events | Partials enabled |
| --- | --- |
| `messageReactionAdd`, `messageReactionRemove`, `messageReactionRemoveEmoji` | `Message`, `Channel`, `Reaction` |
| `messageReactionRemoveAll`, `messagePollVoteAdd`, `messagePollVoteRemove` | `Message`, `Channel` |
| `messageDelete`, `messageUpdate` | `Message` |
| `guildMemberRemove` | `GuildMember` |
| `guildScheduledEventUserAdd`, `guildScheduledEventUserRemove` | `GuildScheduledEvent` |
| `typingStart` | `Channel` |

Two more rules apply after the events are read:

- registering at least one trigger enables `Channel` and `Message`;
- when the final list contains `DirectMessages` or `DirectMessageReactions`,
  `Channel` is enabled, because a direct message channel is never cached up
  front.

## Reference

Every option, property and type, with what it accepts and returns, is in the API reference:

- `defineEvent()`: Defines a gateway event listener.
- `EventDefinition`: A registered gateway event listener.
- `EventContext`: Context passed to gateway event handlers (after the event's own args).
- `ServiceMap`: Global service map.
- `Logger`: Structured logger with level filtering and child bindings.
- `defineBot()`: Creates a `Bot`.
- `IntentAdjustments`: Fine-tunes the automatic selection without giving it up.
- `computeIntents()`: Derives the minimal set of intents and partials for the given events.
- `ComputedIntents`: Result of `computeIntents`.

## Limits and errors

- **A listener that throws never stops the bot.** Whether it throws or returns a
  rejected promise, the error is logged with the event name, then passed to
  every plugin `onError` hook and to the `onError` of `defineBot`, without a
  `ctx`. See [Errors](/api/errors/).
- **Events outside the map add no intent.** Most of them need none
  (`clientReady`, `interactionCreate`, `debug`...). For the others, such as
  direct message events, use `intents: { add: [...] }`.
- **You do not need an `interactionCreate` listener.** The framework listens to
  it to route commands and components.
- **An `intents` array turns the autopilot off entirely.** Nothing is added for
  triggers either: list `GuildMessages`, `MessageContent` and the partials
  yourself.
- A privileged intent that is requested but not enabled makes the login fail.
  The fix is described under
  [`DJSBOT_E070`](/api/errors/#djsbot_e070).

## See also

- [Message triggers](/events/triggers/): answer messages without writing a `messageCreate` listener.
- [Scheduled jobs](/events/jobs/): run code on a schedule instead of on an event.
- [Configuration](/basics/configuration/): every field of `defineBot`.
- [Lifecycle](/basics/lifecycle/): when intents are computed and listeners attached.
- [Testing](/production/testing/): exercise handlers without connecting to Discord.
