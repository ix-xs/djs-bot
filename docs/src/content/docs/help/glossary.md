---
title: "Glossary"
description: "Every Discord and framework term you will meet, in plain language."
sidebar:
  order: 3
---

If a word in the docs is unfamiliar, it is defined here.

## Discord terms

**Application**
: What you create in the Developer Portal. It owns your bot user, your commands
  and your credentials. One application, one bot.

**Bot user**
: The account people see in a server. It belongs to an application and logs in
  with a **token**.

**Token**
: The secret that authenticates your bot. Anyone holding it controls your bot,
  so it lives in `.env`, never in git. Regenerate it in the Developer Portal if
  it leaks.

**Client id (application id)**
: The public numeric id of your application. Needed to deploy commands and to
  build invite links. Not a secret.

**Guild**
: What the Discord API calls a **server**. The docs use both words for the same
  thing because the API does.

**Snowflake**
: A Discord id: a long numeric string like `123456789012345678`. Users, guilds,
  channels, roles and messages all have one. Get them by enabling Developer Mode
  in Discord and right-clicking anything.

**Intent**
: A subscription to a category of gateway events. You declare what you want to
  receive and Discord sends only that. Three of them are **privileged** and must
  be enabled in the Developer Portal: Server Members, Message Content, Presence.

**Gateway**
: The persistent WebSocket connection over which Discord pushes events. "The bot
  is connected" means the gateway is up.

**REST API**
: The HTTP side of Discord, used to send messages, ban members and register
  commands. Deployment happens here, not over the gateway.

**Interaction**
: Anything a user does that your bot must answer: a slash command, a button
  click, a select choice, a modal submit, an autocomplete keystroke. Every
  interaction carries a **token** valid for **3 seconds** to acknowledge, then
  15 minutes to keep editing.

**Slash command**
: A command invoked by typing `/name`. Also called an application command.

**Context menu command**
: A command in the right-click **Apps** menu, on a user or on a message.

**Ephemeral**
: A reply only the invoking user can see. Nobody else in the channel sees it.

**Defer**
: Telling Discord "I am working on it", which stops the 3 second clock and shows
  a loading state. Use it whenever a handler might be slow.

**customId**
: The string attached to a button, select or modal. It is the only state Discord
  round-trips for you, and it is capped at **100 characters**.

**Component**
: An interactive element on a message: button, select menu, or a Components V2
  display element.

**Components V2**
: A newer message format made of composable display components instead of
  embeds. Opt in per message with the `IsComponentsV2` flag.

**Modal**
: A pop-up form with up to 5 text inputs.

**Permission**
: What a member or bot is allowed to do. Server roles grant them, and **channel
  overwrites** can grant or deny them per channel. Overwrites win.

**Sharding**
: Splitting the gateway connection across processes. Discord requires it at
  **2500 servers**.

**Rate limit**
: Discord capping how often you may call the API. Exceed it and you get 429
  responses.

## Framework terms

**Definition**
: A plain object created by a `define*()` function and tagged with a `kind`.
  Commands, events, buttons, services, jobs, plugins and features are all
  definitions.

**Feature**
: A self-contained bundle of definitions, created with `defineFeature`. The unit
  you would publish or copy between bots.

**Feature source**
: What you pass to `defineBot({ features })`: a directory to auto-discover,
  explicit definitions, or both.

**Loader**
: The part that walks your features directory, reads each file exports and
  routes every definition by its `kind`. Importing a file never registers
  anything by itself.

**ctx**
: The single object every handler receives. It carries the raw interaction, the
  user, the guild, your services, a logger and the reply helpers.

**Guard**
: A precondition that runs before a handler. It passes, or it fails with a
  message the user sees.

**Service**
: A shared object registered under a string token and injected into every
  `ctx.services`. Your database client, your business logic.

**Container**
: The dependency injection registry that resolves services in topological order
  at boot, once each.

**Service map**
: The TypeScript interface you augment so `ctx.services.db` is typed rather than
  `unknown`.

**Plugin**
: Cross-cutting behaviour registered through hooks: logging, rate limiting,
  error reporting, maintenance mode.

**Hook**
: A point where a plugin attaches: `beforeInteraction`, `afterInteraction`,
  `onError`, `onReady`, `onShutdown`.

**Middleware**
: A `beforeInteraction` hook that wraps the handler. Call `next()` to continue,
  or skip it to stop the interaction.

**Capability contract**
: `requires` and `provides` on a feature or plugin, verified at boot so a
  missing dependency fails immediately instead of on the first interaction.

**Intent autopilot**
: Deriving the minimum intent set from the events, triggers and guards you
  registered. Enabled with `intents: "auto"`.

**Deployment diff**
: Comparing your local command tree with what Discord already has, and pushing
  only the additions, updates and removals.

**Dev guild**
: A test server that mirrors every command so changes appear instantly instead
  of propagating globally for up to an hour.

**Introspection mode**
: How `deploy`, `clear`, `doctor` and `explain` import your entry file:
  `DJSBOT_CLI=introspect` is set and the bot never connects to the gateway.

**Correlation id**
: A unique id attached to every log line of a single interaction, so you can
  follow one request end to end.

**Error boundary**
: The framework catch-all around handlers. It logs, runs your `onError`, and
  answers the user rather than letting an exception hang the interaction.

**Error code**
: A stable `DJSBOT_Exxx` identifier on every framework error, with a hint and a
  docs link. See [the catalogue](/djs-bot/api/errors/).

**Trigger**
: A message auto-responder, matched on `messageCreate` by keyword, regex or
  predicate.

**Job**
: A scheduled task, defined with a cron expression or an interval.

**Store**
: The async key-value abstraction (`KVStore`) the framework speaks instead of
  imposing a database.

**Namespace**
: A prefixed view of a store, so a feature can list and clear its own keys
  without touching anyone else.

**Feature flag**
: A runtime on/off switch, globally or per server, persisted in a store.

**Audit trail**
: A structured record of who did what, written to one or more sinks.

**Sink**
: A destination for audit entries: memory, a store, the logger, or your own.

**Harness**
: The test helper that runs a handler with no Discord connection and captures
  everything it sent.
