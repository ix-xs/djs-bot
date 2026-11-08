---
title: "Feature flags"
description: "Turn a feature or a command on and off while the bot runs, for everyone or for a single server, without a redeploy. Toggles are kept in a store, so they survive restarts."
sidebar:
  order: 4
---

A feature flag is a named switch. You declare its default state, gate a command
with a guard, and flip it later from an admin command. Use flags for a beta
feature enabled in a few servers, or to switch off something that misbehaves
without taking the bot down.

## A first flag

Declare the defaults in `defineBot`. Overrides are saved in the bot's
[store](/data/store/) automatically: there is no need to pass it twice.

```ts title="src/index.ts"
import { defineBot, env, sqliteStore } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./features",
  store: sqliteStore("data/bot.sqlite"),
  flags: { defaults: { economy: true, beta: false } },
});
```

Then gate a command with the `featureEnabled` guard:

```ts title="features/economy/shop.command.ts"
import { defineCommand, featureEnabled } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "shop",
  description: "Open the shop",
  guards: [featureEnabled("economy")],
  run: (ctx) => ctx.reply.info("The shop is open."),
});
```

In a server where `economy` is off, the user is told that the feature is
disabled there and the handler does not run. Everywhere else the command works
as usual. The guard also works on buttons, select menus and modals.

Configuring `flags` registers the `flags` service (`ctx.services.flags`) and
gives the guard something to read.

:::caution[Without a store, toggles are lost]
If neither `store` nor `flags.store` is set, overrides are kept in memory and
disappear at the next restart. The defaults still apply.
:::

## How a flag resolves

`isEnabled(name, { guildId })` returns the first value it finds, in this order:

1. the guild override, set by `enable` or `disable` with a `guildId`
2. the global override, set by `enable` or `disable` without a scope
3. the declared default, from `defaults` or `setDefault`
4. `false`

So an unknown flag is off, a default can be overridden for everyone, and any
single server can override that. In a DM there is no guild, so the global
value applies.

Flags resolve per guild, then globally, and nothing else. The `FlagScope` type
has a `userId` field, but it is reserved: the resolution ignores it, so a flag
cannot be turned on for one user.

## Toggling at runtime

The `flags` service changes overrides while the bot runs. It is already typed,
so no cast is needed.

```ts
const flags = ctx.services.flags;

await flags.disable("economy", { guildId: ctx.guildId! });   // off in this guild
await flags.enable("beta");                                  // on globally
await flags.clear("economy", { guildId: ctx.guildId! });     // back to the global value
const effective = await flags.list(ctx.guildId!);            // { economy: true, beta: true }
```

A complete flag manager, reserved to the bot owners:

```ts title="features/admin/flags.command.ts"
import { defineCommand, ownerOnly, s, subcommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "flags",
  description: "Manage feature flags",
  guards: [ownerOnly()],
  subcommands: {
    list: subcommand({
      description: "Show the effective flags here",
      run: async (ctx) => {
        const all = await ctx.services.flags.list(ctx.guildId ?? undefined);
        const body = Object.entries(all)
          .map(([name, on]) => `\`${name}\`: ${on ? "on" : "off"}`)
          .join("\n");
        return ctx.reply.info(body || "No flags declared.");
      },
    }),

    set: subcommand({
      description: "Toggle a flag in this server",
      options: {
        name: s.string({ description: "Flag name", required: true }),
        enabled: s.boolean({ description: "On or off", required: true }),
      },
      run: async (ctx) => {
        const { name, enabled } = ctx.options;
        const scope = { guildId: ctx.guildId ?? undefined };
        await (enabled ? ctx.services.flags.enable(name, scope) : ctx.services.flags.disable(name, scope));
        await ctx.audit("flag.set", { metadata: { name, enabled } });
        return ctx.reply.success(`\`${name}\` is now ${enabled ? "enabled" : "disabled"} here.`);
      },
    }),

    reset: subcommand({
      description: "Remove this server's override",
      options: { name: s.string({ description: "Flag name", required: true }) },
      run: async (ctx) => {
        await ctx.services.flags.clear(ctx.options.name, { guildId: ctx.guildId ?? undefined });
        return ctx.reply.success(`\`${ctx.options.name}\` now follows the global setting.`);
      },
    }),
  },
});
```

`ownerOnly()` reads the owners from `defineBot({ owners })`, and `ctx.audit`
does nothing unless the [audit trail](/data/audit/) is configured. Used in a
DM, `set` and `reset` have no guild, so they change the global override.

## Checking inside a handler

The service is available anywhere `ctx.services` is, so a flag can gate a
branch and not a whole command:

```ts
run: async (ctx) => {
  if (await ctx.services.flags.isEnabled("newEmbedStyle", { guildId: ctx.guildId })) {
    return ctx.reply({ embeds: [newStyle()] });
  }
  return ctx.reply({ embeds: [oldStyle()] });
}
```

`isEnabled` accepts a `null` guild id, so `ctx.guildId` can be passed as is.
`enable`, `disable` and `clear` want a string or nothing.

Reading `ctx.services.flags` when `flags` is not configured throws
[`DJSBOT_E031`](/api/errors/#djsbot_e031). The `featureEnabled` guard is more
forgiving: without `flags`, it passes. Forgetting to configure flags disables
nothing, it only removes the switch.

## Flags without a bot

`createFeatureFlags` is a standalone function. It is handy in tests, or when
you do not want the service on the bot:

```ts title="tests/flags.test.ts"
import { createFeatureFlags, memoryStore } from "@ix-xs/djs-bot";

const flags = createFeatureFlags({ store: memoryStore(), defaults: { economy: true } });
await flags.disable("economy", { guildId: "123" });

await flags.isEnabled("economy", { guildId: "123" });   // false
await flags.isEnabled("economy", { guildId: "456" });   // true
await flags.isEnabled("unknown");                       // false
```

## Flag or maintenance mode

| Need | Reach for |
| --- | --- |
| Disable one feature, maybe in one server | A feature flag |
| Disable the whole bot during a migration | The `maintenance` plugin, see [Plugins and hooks](/architecture/plugins/) |

The plugin blocks every interaction except for an allow-list of users. Its
`enabled` option takes a boolean or a synchronous function, so it cannot await
a flag directly: keep a plain variable that an admin command flips, as in
`maintenance({ enabled: () => downForMigration })`.

## Reference

Every option, property and type, with what it accepts and returns, is in the API reference:

- `FeatureFlagsOptions`: Options for `createFeatureFlags`.
- `defineBot()`: Creates a `Bot`.
- `createFeatureFlags()`: Creates a `FeatureFlags` service.
- `KVStore`: An async key-value store.
- `featureEnabled()`: A guard that blocks a command/component when a feature flag is off for the guild.
- `FeatureFlags`: A runtime feature-flag service.
- `FlagScope`: A scope for reading/writing a flag.

## See also

- [Guards](/commands/guards/): the other guards, and how to combine them.
- [Store](/data/store/): where overrides are kept.
- [Plugins and hooks](/architecture/plugins/): the `maintenance` plugin.
- [Audit trail](/data/audit/): record who toggled what.
