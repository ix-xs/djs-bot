---
title: "Feature flags"
description: "createFeatureFlags, per-guild toggles, the featureEnabled() guard and resolution order."
sidebar:
  order: 11
---

Feature flags turn parts of your bot on and off **at runtime**, globally or per
server, without a redeploy. Backed by a [`KVStore`](/djs-bot/api/store/), so
toggles survive restarts.

```ts title="src/index.ts"
const store = sqliteStore("data/bot.sqlite");

export default defineBot({
  store,
  flags: {
    store,
    defaults: { economy: true, betaCommands: false },
  },
});
```

### `FeatureFlagsOptions`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `store` | `KVStore` | in-memory | Where overrides are persisted. Pass a durable store to keep toggles across restarts. |
| `defaults` | `Record<string, boolean>` | `{}` | The state used when no override exists. |

Configuring `flags` registers the `flags` service and enables the
`featureEnabled()` guard.

## Resolution order

For `isEnabled(name, { guildId })`:

1. **guild override** - set by `enable/disable(name, { guildId })`
2. **global override** - set by `enable/disable(name)`
3. **declared default** - from `defaults`
4. **`false`**

So an unknown flag is off, a default can be overridden globally, and any single
server can override that.

## `featureEnabled()`

A guard that blocks a command or component when the flag is off **for that
guild**:

```ts
import { defineCommand, featureEnabled } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "daily",
  description: "Claim your daily reward",
  guards: [featureEnabled("economy")],
  run: (ctx) => ctx.reply.success("+100 coins"),
});
```

Users in a server where `economy` is off are told the feature is disabled there;
everywhere else it works normally.

:::note[Fail-open by design]
If `flags` is not configured at all, the guard **passes**. Forgetting to wire
flags disables nothing - it just removes the switch.
:::

## The `flags` service

| Method | Signature | Description |
| --- | --- | --- |
| `isEnabled` | `(name, scope?) => Promise<boolean>` | Resolve a flag. `scope` is `{ guildId?, userId? }`. |
| `enable` | `(name, scope?) => Promise<void>` | Turn on globally, or for one guild. |
| `disable` | `(name, scope?) => Promise<void>` | Turn off globally, or for one guild. |
| `clear` | `(name, scope?) => Promise<void>` | Remove an override so it falls back to the next level. |
| `setDefault` | `(name, enabled) => void` | Change the in-memory default. Not persisted. |
| `list` | `(guildId?) => Promise<Record<string, boolean>>` | Effective flags - defaults merged with overrides. |

## An admin command

A complete flag manager, usable in production:

```ts title="features/admin/flags.command.ts"
import { defineCommand, subcommand, s, ownerOnly } from "@ix-xs/djs-bot";

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
          .map(([name, on]) => `${on ? "🟢" : "🔴"} \`${name}\``)
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
        const scope = { guildId: ctx.guildId! };
        await (enabled ? ctx.services.flags.enable(name, scope) : ctx.services.flags.disable(name, scope));
        await ctx.audit("flag.set", { metadata: { name, enabled } });
        return ctx.reply.success(`\`${name}\` is now ${enabled ? "enabled" : "disabled"} here.`);
      },
    }),

    reset: subcommand({
      description: "Remove this server override",
      options: { name: s.string({ description: "Flag name", required: true }) },
      run: async (ctx) => {
        await ctx.services.flags.clear(ctx.options.name, { guildId: ctx.guildId! });
        return ctx.reply.success(`\`${ctx.options.name}\` now follows the global setting.`);
      },
    }),
  },
});
```

## Using flags outside guards

The service is available anywhere, so flags can gate a branch rather than a
whole command:

```ts
run: async (ctx) => {
  if (await ctx.services.flags.isEnabled("newEmbedStyle", { guildId: ctx.guildId })) {
    return ctx.reply({ embeds: [newStyle()] });
  }
  return ctx.reply({ embeds: [oldStyle()] });
}
```

## Standalone

`createFeatureFlags` works without a bot - handy in tests:

```ts
import { createFeatureFlags, memoryStore } from "@ix-xs/djs-bot";

const flags = createFeatureFlags({ store: memoryStore(), defaults: { economy: true } });
await flags.disable("economy", { guildId: "123" });

await flags.isEnabled("economy", { guildId: "123" });   // false
await flags.isEnabled("economy", { guildId: "456" });   // true
```

## Kill switch vs maintenance mode

| Need | Reach for |
| --- | --- |
| Disable **one** feature, maybe in one server | A feature flag |
| Disable the **whole bot** during a migration | The [`maintenance`](/djs-bot/api/plugins/#maintenanceoptions) plugin |

They compose: `maintenance({ enabled: () => downForMigration })`.
