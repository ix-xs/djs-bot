---
title: "Guards"
description: "Built-in guards, writing your own, and how failures are reported."
sidebar:
  order: 6
---

A **guard** is a precondition. Attach guards to any command, subcommand, button,
select or modal; they run in order before the handler, and the first failure
short-circuits with an ephemeral message explaining why.

```ts
import { defineCommand, inGuild, hasPermission, cooldown, PermissionFlagsBits } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "kick",
  description: "Kick a member",
  guards: [inGuild(), hasPermission(PermissionFlagsBits.KickMembers), cooldown("5s")],
  run: (ctx) => ctx.reply.success("Kicked."),
});
```

Guards on a parent command run **before** the guards of the subcommand being
invoked.

## Built-in guards

| Guard | Passes when | Message key |
| --- | --- | --- |
| `inGuild()` | Used inside a server | `guildOnly` |
| `dmOnly()` | Used in DMs | `dmOnly` |
| `hasPermission(...perms)` | The **member** has every permission, in this channel | `missingPermissions` |
| `botHasPermission(...perms)` | The **bot** has every permission, in this channel | `botMissingPermissions` |
| `hasRole(...roleIds)` | The member holds at least one of the roles | `missingRole` |
| `inChannel(...ids)` | Used in one of the listed channels | `wrongChannel` |
| `ownerOnly(...ids?)` | The user is a bot owner | `ownerOnly` |
| `guildOwnerOnly()` | The user owns the server | `guildOwnerOnly` |
| `cooldown(duration, opts?)` | The cooldown has elapsed | `cooldown` |
| `rateLimit(opts)` | Under the limit. See [Resilience](/api/resilience/#ratelimit---as-a-guard) | `rateLimited` |
| `featureEnabled(name)` | The flag is on for this guild. See [Flags](/api/flags/#featureenabled) | `featureDisabled` |

The message keys are what you override in
[`defineBot({ messages })`](/api/configuration/#messages) to reword or translate
a refusal.

### `hasPermission` / `botHasPermission`

Accept any `PermissionResolvable` - an enum member, a string, or several:

```ts
guards: [hasPermission(PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads)]
```

Both check the permissions **as Discord computed them for the channel the
interaction happened in**, channel overwrites included. A member who is a
moderator server-wide but denied in one channel is refused there, and so is a
bot whose role lost a permission through an overwrite.

The refusal names only what is missing, readably: `You need: Ban Members.`

`botHasPermission` is the one people forget: it catches "the command silently
did nothing" bugs before they reach production.

### `hasRole`

```ts
guards: [hasRole(MOD_ROLE_ID, ADMIN_ROLE_ID)]   // either role is enough
```

### `ownerOnly` / `guildOwnerOnly`

```ts
ownerOnly()                 // uses defineBot({ owners: [...] })
ownerOnly("123", "456")     // explicit ids, ignoring the config
guildOwnerOnly()            // the owner of the server the command runs in
```

### `cooldown`

```ts
cooldown(duration: string | number, options?: { scope?: CooldownScope }): Guard
```

| Scope | Rate-limits per |
| --- | --- |
| `"user"` (default) | Individual user |
| `"guild"` | Whole server |
| `"channel"` | Channel |
| `"global"` | The entire bot |

Each `cooldown()` call owns its own timer map, so the limit naturally applies
per command or component it is attached to. Durations accept `"5s"`, `"2m"`,
`"1h"` or raw milliseconds. Expired entries are swept as the guard runs, so a
long-lived bot does not accumulate one entry per user forever.

```ts
guards: [cooldown("10s"), cooldown("1m", { scope: "guild" })]
```

## Combining guards

```ts
import { anyOf, not } from "@ix-xs/djs-bot";

guards: [
  // Passes when at least one passes. Shows the last reason when all fail.
  anyOf(ownerOnly(), hasPermission(PermissionFlagsBits.ManageGuild)),
  // Passes when the inner guard fails; the string is the refusal.
  not(inChannel(SPAM_CHANNEL_ID), "Not in this channel, please."),
]
```

Listing guards in the array is already "all of them", in order.

## Writing your own

```ts
guard(name: string, run: (ctx: BaseContext) => GuardResult | Promise<GuardResult>): Guard
pass(): GuardResult
fail(reason: string): GuardResult
```

The `reason` you pass to `fail()` is what the user sees, so write it for them,
not for you. To reuse the framework's wording (and its translations), call
`ctx.say("guildOnly")`:

```ts
import { guard, pass, fail } from "@ix-xs/djs-bot";

export const isPremium = guard("isPremium", async (ctx) => {
  const sub = await ctx.services.db.subscription(ctx.guildId!);
  return sub?.active ? pass() : fail("This command requires a premium server.");
});
```

Guards are `async`-friendly, receive the full `ctx` (services, logger, store),
and are just values - so they compose:

```ts
export const modOnly = [inGuild(), hasPermission(PermissionFlagsBits.ModerateMembers)];

export default defineCommand({ name: "warn", description: "…", guards: [...modOnly, cooldown("3s")], run });
```

## Guards and middleware

Plugin middleware (`beforeInteraction`) runs **before** the guards. A
maintenance-mode plugin can therefore stop an interaction ahead of any guard,
and a logging plugin times guards and handler together. See
[Plugins](/api/plugins/#middleware).

## Guards vs `defaultMemberPermissions`

They solve different problems and are best used together:

| | `defaultMemberPermissions` | `hasPermission()` guard |
| --- | --- | --- |
| Enforced by | Discord, in the UI | Your bot, at runtime |
| Effect | The command is hidden from members who lack it | The command replies with a clear refusal |
| Can server admins override it? | **Yes**, in Server Settings → Integrations | No |

Declare `defaultMemberPermissions` so the command is not even visible, and keep
the guard so an admin override cannot bypass your own rules.
