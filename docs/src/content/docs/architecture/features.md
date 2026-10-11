---
title: "Features"
description: "A feature bundles commands, components, events, services and jobs into one closed unit with a declared contract. Use it to share a whole capability, such as tickets or levelling, between bots or to publish it as an npm package."
sidebar:
  order: 3
---

Inside your own bot, a folder of files is enough: the loader finds each
definition by its file name. `defineFeature` is for the moment you want an
explicit list instead, for one of three reasons: the code lives outside your
features folder, it needs something from the host bot and should say so, or you
want to publish it.

## A first feature

```ts title="src/features/tickets/tickets.feature.ts"
import { defineFeature } from "@ix-xs/djs-bot";
import Open from "./open.command.js";
import { CloseTicket } from "./close.button.js";
import { Tickets } from "./tickets.service.js";

export default defineFeature({
  name: "tickets",
  requires: ["db"], // the host bot must provide a "db" service
  commands: [Open],
  buttons: [CloseTicket],
  services: [Tickets],
});
```

A feature is a list of definitions you already know how to write, plus a name
and a contract. Besides `commands`, `buttons` and `services`, it accepts
`userCommands`, `messageCommands`, `events`, `triggers`, `selectMenus`, `modals`,
`jobs` and `plugins`. Registering the feature registers everything it lists.

## Load a feature

There are three ways to hand a feature to the bot.

**Let the loader find it.** Inside your features folder, name the file with the
`.feature` suffix, as above (see [Project layout](/basics/project-layout/)).

**Pass it explicitly.** `features` accepts folders and definitions side by side,
which is how a feature that comes from a package is loaded:

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";
import tickets from "./features/tickets/tickets.feature.js";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: [`${import.meta.dirname}/features`, tickets],
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

**Add it in code.** `bot.use(tickets)` registers it on top of `features`, before
the bot starts.

In this example the feature and its files are found twice: once by the loader,
once through the explicit entry. That is fine. The same object is only ever
registered once, so a command can live in its own `.command` file **and** be
listed in a feature.

## Declare what it needs

A feature that reads `ctx.services.db` only works in a bot that has a `db`
service. `requires` states that dependency, and the framework checks it at
startup, before the bot connects:

```ts
defineFeature({
  name: "tickets",
  requires: ["db", "store"],
  commands: [Open],
});
```

If nothing provides `db`, the bot refuses to start with
[`DJSBOT_E040`](/api/errors/#djsbot_e040) and names what is missing:

```text
BotError [DJSBOT_E040]: Feature contract not satisfied: feature "tickets" requires "db"
```

Without `requires`, the same mistake would only show up later, as an unknown
service on the first interaction that uses it.

A requirement is satisfied by a `defineService` with that token (wherever it is
registered, including in another feature), by a plugin or a feature that lists
it in `provides`, or by the matching option of `defineBot` for the built-in
`store`, `audit` and `flags`.

`provides` is the other side of the contract. The services a feature lists
already count under their own token, so you only need `provides` for a
capability that is not a `defineService`, for example a value registered by a
plugin the feature bundles.

The exact rules, and the `conflicts` field of plugins, are under
[Capability contracts](/architecture/services/#capability-contracts).

## Publish a feature

A feature is a plain object, so a published feature is an ordinary npm package
whose entry file exports it. The bot that installs it adds it to `features` and
provides what the feature requires:

```ts title="src/index.ts"
import { defineBot, env, memoryStore } from "@ix-xs/djs-bot";
import tickets from "djs-bot-tickets"; // a package that exports a defineFeature() result

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  store: memoryStore(), // satisfies requires: ["store"]
  features: [`${import.meta.dirname}/features`, tickets],
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

A feature can bundle a plugin in `plugins` when it also needs hooks or a shared
resource. The packaging guidelines are the same as for a plugin: see
[Publish a plugin](/architecture/plugins/#publish-a-plugin).

## Reference

### `defineFeature(input)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | The name of the feature, used in logs, in error messages and by `djs-bot explain`. |
| `requires` | `string[]` | `[]` | Capabilities the host bot, or another feature, must provide. Startup fails with [`DJSBOT_E040`](/api/errors/#djsbot_e040) otherwise. |
| `provides` | `string[]` | `[]` | Capabilities this feature offers, which others can list in `requires`. |
| `config` | `Record<string, unknown>` | `{}` | Free-form default configuration of the feature. It is stored on the definition as `config`; the framework does not read it. |
| `commands` | `CommandDefinition[]` | `[]` | Slash commands to register. |
| `userCommands` | `UserCommandDefinition[]` | `[]` | User context-menu commands to register. |
| `messageCommands` | `MessageCommandDefinition[]` | `[]` | Message context-menu commands to register. |
| `events` | `EventDefinition[]` | `[]` | Event listeners to register. |
| `triggers` | `TriggerDefinition[]` | `[]` | Message triggers to register. |
| `buttons` | `ButtonDefinition[]` | `[]` | Buttons to register. |
| `selectMenus` | `AnySelectDefinition[]` | `[]` | Select menus to register, of any kind (string, user, role, channel, mentionable). |
| `modals` | `ModalDefinition[]` | `[]` | Modals to register. |
| `services` | `ServiceDefinition[]` | `[]` | Services to register. |
| `jobs` | `JobDefinition[]` | `[]` | Scheduled jobs to register. |
| `plugins` | `PluginDefinition[]` | `[]` | Plugins to register. |

Returns a `FeatureDefinition` (`kind: "feature"`) in which every list is filled,
empty when you left it out.

Each kind of definition has its own page:
[slash commands](/commands/slash-commands/),
[context menus](/commands/context-menus/),
[events](/events/events-and-intents/), [triggers](/events/triggers/),
[buttons](/components/buttons/), [select menus](/components/select-menus/),
[modals](/components/modals/), [services](/architecture/services/),
[jobs](/events/jobs/) and [plugins](/architecture/plugins/).

## Limits and errors

- **Registering twice is harmless only for the same object.** Two different
  definitions that share a command name or a component id still stop the
  startup ([`DJSBOT_E010`](/api/errors/#djsbot_e010),
  [`DJSBOT_E011`](/api/errors/#djsbot_e011)).
- **An unmet `requires` stops the startup** with
  [`DJSBOT_E040`](/api/errors/#djsbot_e040). Nothing is connected or deployed
  before the check.
- **A feature cannot contain other features.** List several features next to
  each other in `features`.
- **Bundled definitions behave like any other.** The events and triggers of a
  feature count for the automatic intents, its commands are deployed with the
  rest, and its plugins are set up with the others.
- **What is loaded?** `npx djs-bot explain` lists the features by name, along
  with every definition they registered. See [CLI](/api/cli/).

## See also

- [Project layout](/basics/project-layout/): how the loader finds files, and when a folder is enough.
- [Services](/architecture/services/): the services a feature bundles or requires, and capability contracts.
- [Plugins and hooks](/architecture/plugins/): behaviour for every interaction, which a feature can bundle.
- [Configuration](/basics/configuration/): the `features` field of `defineBot` and `bot.use()`.
