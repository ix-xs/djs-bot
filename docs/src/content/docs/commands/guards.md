---
title: "Guards"
description: "A guard is a precondition checked before a handler runs: a permission, a cooldown, a channel, or any rule of your own. When one fails, the user is told why and the handler never starts."
sidebar:
  order: 5
---

## A first guard

```ts title="features/moderation/kick.command.ts"
import {
  defineCommand,
  s,
  inGuild,
  hasPermission,
  botHasPermission,
  cooldown,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";

export default defineCommand({
  name: "kick",
  description: "Kick a member",
  options: { target: s.member({ description: "Member", required: true }) },
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.KickMembers),      // the member who ran the command
    botHasPermission(PermissionFlagsBits.KickMembers),   // the bot itself
    cooldown("10s"),                                     // per user
  ],
  run: async (ctx) => {
    await ctx.options.target.kick();
    await ctx.reply.success(`Kicked ${ctx.options.target}.`);
  },
});
```

`guards` is an array, accepted by every interaction handler: slash commands,
[subcommands](/commands/subcommands/), [context menus](/commands/context-menus/),
buttons, select menus and modals.

- Guards run in the order of the array. The array already means "all of them".
- The first one that fails stops everything: its reason is sent to the user as
  an ephemeral error reply, and the handler is not called.
- On a subcommand, the parent command's guards run first, then its own.

Because handlers only run when their preconditions hold, `run` stays free of
permission checks and early returns.

A refusal is logged at `debug` level with the name of the guard, and counted as
`guardRejections` in the bot's stats: see
[Health and metrics](/production/health/). Plugin middleware
(`beforeInteraction`) runs before the guards, so a maintenance-mode plugin can
stop an interaction ahead of any guard, and a logging plugin times guards and
handler together: see [Plugins and hooks](/architecture/plugins/).

## Built-in guards

| Guard | Passes when | Message key |
| --- | --- | --- |
| `inGuild()` | Used inside a server | `guildOnly` |
| `dmOnly()` | Used outside a server | `dmOnly` |
| `hasPermission(...perms)` | The member has every permission, in this channel | `missingPermissions` |
| `botHasPermission(...perms)` | The bot has every permission, in this channel | `botMissingPermissions` |
| `hasRole(...roleIds)` | The member holds at least one of the roles | `missingRole` |
| `inChannel(...channelIds)` | Used in one of the listed channels | `wrongChannel` |
| `ownerOnly(...userIds?)` | The user is a bot owner | `ownerOnly` |
| `guildOwnerOnly()` | The user owns the server | `guildOwnerOnly` |
| `cooldown(duration, options?)` | The cooldown has elapsed | `cooldown` |
| `rateLimit({ limit, window, scope? })` | The user is under the limit. See [Resilience](/production/resilience/) | `rateLimited` |
| `featureEnabled(name)` | The flag is on for this server. See [Feature flags](/data/flags/) | `featureDisabled` |

The message key names the sentence shown when the guard refuses. Every one of
them can be reworded or translated in `defineBot({ messages })`: see
[Wording and theme](/basics/wording-and-theme/).

**Permissions.** `hasPermission` and `botHasPermission` accept any
`PermissionResolvable`: a `PermissionFlagsBits` member, a string such as
`"KickMembers"`, or several of them. All must be held.

```ts
guards: [hasPermission(PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads)]
```

Both check the permissions as Discord computed them for the channel the
interaction happened in, channel overwrites included. A member who is a
moderator server-wide but denied in one channel is refused there, and so is a
bot whose role lost a permission through an overwrite. The refusal names only
what is missing, readably: `You need: Ban Members.`

`botHasPermission` is the one people forget. It turns "the command did nothing"
into a clear message before the handler even starts.

**Roles and channels.** `hasRole` and `inChannel` take ids. One match is
enough:

```ts
guards: [hasRole(MOD_ROLE_ID, ADMIN_ROLE_ID), inChannel(STAFF_CHANNEL_ID)]
```

**Owners.**

```ts
ownerOnly()                 // the ids from defineBot({ owners: [...] })
ownerOnly("123", "456")     // these ids, ignoring the config
guildOwnerOnly()            // the owner of the server the command runs in
```

## Cooldowns

`cooldown` lets one use through, then refuses until the duration has elapsed.
The refusal tells the user how many seconds remain.

```ts
guards: [cooldown("10s"), cooldown("1m", { scope: "guild" })]
```

| Scope | One cooldown shared by |
| --- | --- |
| `"user"` (default) | Each user |
| `"guild"` | Each server |
| `"channel"` | Each channel |
| `"global"` | Everyone, across the whole bot |

- The duration is a string such as `"5s"`, `"2m"`, `"1h"` or `"1h30m"`, or a
  number of milliseconds.
- Each `cooldown()` call owns its timers, so the limit applies to the command
  or component it is attached to. Two commands never share a cooldown unless
  you give them the same guard instance.
- The cooldown starts when this guard passes. List it after the guards that may
  refuse, as in the first example, so a refused user does not also start a
  cooldown.
- Timers live in memory. They are reset by a restart and are not shared between
  shards.
- Expired entries are swept as the guard runs, so a long-lived bot does not
  keep one entry per user forever.

For "5 uses per minute" rather than "one use every 10 seconds", use
`rateLimit` from [Resilience](/production/resilience/).

## Combining guards

```ts title="features/admin/purge.command.ts"
import {
  defineCommand,
  anyOf,
  not,
  ownerOnly,
  hasPermission,
  inChannel,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";

const SPAM_CHANNEL_ID = "123456789012345678";

export default defineCommand({
  name: "purge",
  description: "Delete recent messages",
  guards: [
    // Passes when at least one passes. Shows the last reason when all fail.
    anyOf(ownerOnly(), hasPermission(PermissionFlagsBits.ManageGuild)),
    // Passes when the inner guard fails. The string is the refusal.
    not(inChannel(SPAM_CHANNEL_ID), "Not in this channel, please."),
  ],
  run: (ctx) => ctx.reply.success("Done."),
});
```

Guards are plain values, so a set you use often can live in a constant:

```ts
export const modOnly = [inGuild(), hasPermission(PermissionFlagsBits.ModerateMembers)];

// in a command
guards: [...modOnly, cooldown("3s")]
```

## Writing your own

A guard is a name and a function that receives `ctx` and returns `pass()` or
`fail(reason)`. It may be `async`, and it has the full
[`ctx`](/basics/context/): services, logger, user, guild.

```ts title="features/billing/guards.ts"
import { guard, pass, fail } from "@ix-xs/djs-bot";

export const isPremium = guard("isPremium", async (ctx) => {
  if (!ctx.guildId) return fail(ctx.say("guildOnly"));
  const subscription = await ctx.services.billing.subscription(ctx.guildId);
  return subscription?.active ? pass() : fail("This command requires a premium server.");
});
```

Then use it like a built-in one: `guards: [inGuild(), isPremium]`.

- The `reason` passed to `fail()` is what the user reads, so write it for them.
- `ctx.say("guildOnly")` returns one of the framework's own sentences, with
  your rewording and translations applied. Use it to stay consistent with the
  built-in guards.
- The name appears in the logs and in test results. The harness described in
  [Testing](/production/testing/) reports whether the guards passed and the
  reason when they did not.

:::caution[Refusals after a public deferral]
A refusal is ephemeral unless the interaction was already deferred publicly.
That happens when a definition has a public `defer` and a guard is slow enough
for the deferral to fire first, or when `defer` uses `after: 0`. The refusal
then replaces the loading state and everyone sees it. Use `defer: "ephemeral"`
on such definitions: see [Automatic deferral](/basics/automatic-deferral/).
:::

## Guards and Discord permissions

`defaultMemberPermissions` on a command and the `hasPermission()` guard look
alike. They solve different problems and are best used together.

| | `defaultMemberPermissions` | `hasPermission()` guard |
| --- | --- | --- |
| Enforced by | Discord, in the interface | Your bot, at runtime |
| Effect | The command is hidden from members who lack it | The command replies with a clear refusal |
| Can server admins override it? | Yes, in Server Settings > Integrations | No |
| Available on | Commands and context menus | Every handler, components included |

Declare `defaultMemberPermissions` so the command is not even visible, and keep
the guard so an admin override cannot bypass your own rules.

## Reference

### `guard(name, run)`

Creates a `Guard`.

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | Shown in logs and in test results. |
| `run` | `(ctx: BaseContext) => GuardResult \| Promise<GuardResult>` | The check. Its type is exported as `GuardFn`. |

### `pass()`

Returns `{ ok: true }`: the handler may run. Also available as `guard.pass`.

### `fail(reason)`

Returns `{ ok: false, reason }`. `reason` is the text shown to the user. Also
available as `guard.fail`.

### `anyOf(...guards)`

Passes as soon as one of the guards passes, without running the ones after it.
When all fail, the reason of the last one is shown.

### `not(inner, reason?)`

Passes when `inner` fails. `reason` is shown when `inner` passes. Without it,
the user gets the generic `guardDenied` message.

### `inGuild()`

Passes when the interaction has a guild id. That includes a server the bot is
not a member of, which happens with commands installed on a user account.

### `dmOnly()`

Passes when the interaction has no guild id: the bot's DMs and other private
channels.

### `hasPermission(...permissions)`

Requires the invoking member to hold every permission in the current channel.
Where Discord gives no permissions for the member (a DM), it refuses with the
`guildOnly` message.

### `botHasPermission(...permissions)`

The same check for the bot, with the `botMissingPermissions` message.

### `hasRole(...roleIds)`

Passes when the member holds at least one of the roles. It fails when there is
no member: in DMs, and in a server the bot is not in.

### `inChannel(...channelIds)`

Passes when the interaction comes from one of the channels.

### `ownerOnly(...userIds)`

Passes when the user is in the list. With no arguments, the list is
`defineBot({ owners })`. With arguments, the config is ignored. With neither,
nobody passes.

### `guildOwnerOnly()`

Passes when the user owns the server. It fails outside a server, and in a
server the bot is not in.

### `cooldown(duration, options?)`

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `duration` | `string \| number` | required | A duration such as `"5s"`, or milliseconds. A string that cannot be read gives no cooldown at all. |
| `options.scope` | `CooldownScope` | `"user"` | What shares one cooldown: `"user"`, `"guild"`, `"channel"` or `"global"`. In DMs, `"guild"` falls back to the user. |

### Types

| Type | Description |
| --- | --- |
| `Guard` | `{ kind: "guard", name, run }`. What every function above returns. |
| `GuardFn` | The check function of a guard. |
| `GuardResult` | `{ ok: boolean, reason?: string }`. A failure without a reason shows the `guardDenied` message. |
| `CooldownScope` | `"user" \| "guild" \| "channel" \| "global"`. Also used by `rateLimit`. |

## See also

- [Slash commands](/commands/slash-commands/)
- [Wording and theme](/basics/wording-and-theme/)
- [Resilience](/production/resilience/)
- [Feature flags](/data/flags/)
- [Plugins and hooks](/architecture/plugins/)
