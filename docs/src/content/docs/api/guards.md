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

| Guard | Passes when | Fails with |
| --- | --- | --- |
| `inGuild()` | Used inside a server | "This can only be used in a server." |
| `dmOnly()` | Used in DMs | "This can only be used in DMs." |
| `hasPermission(...perms)` | The **member** has every permission | Names the missing permission |
| `botHasPermission(...perms)` | The **bot** has every permission | Names what the bot is missing |
| `inChannel(...ids)` | Used in one of the listed channels | Points at the allowed channels |
| `ownerOnly(...ids?)` | The user is an owner | "You can't use this." |
| `cooldown(duration, opts?)` | The cooldown has elapsed | "Please wait Ns before doing that again." |
| `featureEnabled(name)` | The flag is on for this guild | "This feature is currently disabled here." |

`featureEnabled` lives in the [flags module](/djs-bot/api/flags/#featureenabled).

### `hasPermission` / `botHasPermission`

Accept any `PermissionResolvable` — an enum member, a string, or several:

```ts
guards: [hasPermission(PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads)]
```

`botHasPermission` is the one people forget: it catches "the command silently
did nothing" bugs before they reach production, by checking the bot own
permissions in the current channel.

### `ownerOnly`

```ts
ownerOnly()                 // uses defineBot({ owners: [...] })
ownerOnly("123", "456")     // explicit ids, ignoring the config
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
`"1h"` or raw milliseconds.

```ts
guards: [cooldown("10s"), cooldown("1m", { scope: "guild" })]
```

## Writing your own

```ts
guard(name: string, run: (ctx: BaseContext) => GuardResult | Promise<GuardResult>): Guard
pass(): GuardResult
fail(reason: string): GuardResult
```

The `reason` you pass to `fail()` is what the user sees, so write it for them,
not for you:

```ts
import { guard, pass, fail } from "@ix-xs/djs-bot";

export const isPremium = guard("isPremium", async (ctx) => {
  const sub = await ctx.services.db.subscription(ctx.guildId!);
  return sub?.active ? pass() : fail("This command requires a premium server.");
});
```

Guards are `async`-friendly, receive the full `ctx` (services, logger, store),
and are just values — so they compose:

```ts
export const modOnly = [inGuild(), hasPermission(PermissionFlagsBits.ModerateMembers)];

export default defineCommand({ name: "warn", description: "…", guards: [...modOnly, cooldown("3s")], run });
```

## Guards and intents

The intent autopilot inspects your guards too: `hasPermission` and
`botHasPermission` imply the `Guilds` intent, and member-related checks pull in
what they need. Nothing to configure when `intents: "auto"`.

## Guards vs `defaultMemberPermissions`

They solve different problems and are best used together:

| | `defaultMemberPermissions` | `hasPermission()` guard |
| --- | --- | --- |
| Enforced by | Discord, in the UI | Your bot, at runtime |
| Effect | The command is hidden from members who lack it | The command replies with a clear refusal |
| Can server admins override it? | **Yes**, in Server Settings → Integrations | No |

Declare `defaultMemberPermissions` so the command is not even visible, and keep
the guard so an admin override cannot bypass your own rules.
