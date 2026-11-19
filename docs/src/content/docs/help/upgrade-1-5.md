---
title: "Upgrading to 1.5"
description: "1.5 renames five exports and options. The 1.4 names keep working until 2.0 and warn once each. Every old name, its replacement, and the move to node-comfort 3.0."
---

| | |
| --- | --- |
| Old names | Work as in 1.4, print one `DeprecationWarning` each, removed in 2.0 |
| Node.js | The same versions as 1.4: 22.23.4, 24.22.1, 26.12.1 or later |
| discord.js | The same: 14.27 or later on 14 |
| node-comfort | 3.0 or later, installed with the package |

```bash
npm install @ix-xs/djs-bot@1.5
```

## Finding the old names

The first use of an old name prints one `DeprecationWarning` with its code, for example `DJS_BOT_DEP_ONEOF`, and the name to use instead.

```bash
# where each old name is used
node --trace-deprecation dist/index.js

# make the tests fail on the first old name
NODE_OPTIONS=--throw-deprecation npm test
```

```ts
// collect them in a running bot
process.on("warning", (warning) => {
  if ((warning as { code?: string }).code?.startsWith("DJS_BOT_DEP_")) console.warn(warning.message);
});
```

A warning only appears for code that runs. To find every use, search the code for the names below.

## Renamed

| 1.4 | 1.5 | Warning code |
| --- | --- | --- |
| `oneOf("a", "b")`, imported from the root | `p.oneOf("a", "b")` | `DJS_BOT_DEP_ONEOF` |
| `audit: { sink: x }` | `audit: { sinks: [x] }` | `DJS_BOT_DEP_AUDIT_SINK` |
| `emoji.custom(name, id, animated)` | `emoji.format({ name, id, animated })` | `DJS_BOT_DEP_EMOJI_CUSTOM` |
| `defineSelectMenu({ ... })` | `defineStringSelect({ ... })`, same options | `DJS_BOT_DEP_DEFINE_SELECT_MENU` |
| `normalizeSharding()`, `launchShardManager()` | None: internal now. Use the `sharding` option of `defineBot()` | `DJS_BOT_DEP_SHARDING_INTERNALS` |

```ts
// 1.4
import { defineSelectMenu, emoji, oneOf, p } from "@ix-xs/djs-bot";
const params = { action: oneOf("approve", "reject"), id: p.string };
emoji.custom("blob", "1234567890", true);
```

```ts
// 1.5
import { defineStringSelect, emoji, p } from "@ix-xs/djs-bot";
const params = { action: p.oneOf("approve", "reject"), id: p.string };
emoji.format({ name: "blob", id: "1234567890", animated: true });
```

## New exports

| Export | For |
| --- | --- |
| `CronField` | The type of one parsed field of a cron schedule. See [Scheduled jobs](/events/jobs/) |

## node-comfort 3.0

djs-bot 1.5 depends on `@ix-xs/node-comfort` 3.0. npm installs it with the package: nothing to do for a bot that does not import node-comfort itself.

| Your bot | What to do |
| --- | --- |
| Does not import `@ix-xs/node-comfort` | Nothing |
| Imports it, at 2.x | It gets its own copy, as before. Upgrading it to 3.0 shares one copy with djs-bot |
| Imports it, at 3.x | Nothing |

node-comfort 3.0 keeps the 2.x names until 4.0, with a warning each: see [its upgrade page](https://ix-xs.github.io/node-comfort/help/upgrade-3-0/). The `.env` file is still read at import, with the same rules ([Configuration](/basics/configuration/#environment-variables)).
