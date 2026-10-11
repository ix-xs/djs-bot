---
title: "Definitions"
description: "Every define*() factory and every field it accepts."
sidebar:
  order: 4
---

Everything your bot does is a **definition**: a plain object created by a
`define*()` factory and tagged with a `kind`. The loader discovers them from
your features directory, or you pass them explicitly to `defineBot({ features })`.

Definitions have **no import side effects** - importing a file never registers
anything. The loader reads the exports and routes them by `kind`, so a file can
export one definition, several, a default, or a `defineFeature()` bundle.

## `defineCommand`

A slash command, with typed options **or** subcommands.

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Lowercase name users type after `/`. 1-32 chars, letters/digits/`-`/`_`. |
| `description` | `string` | Shown in the command picker. |
| `options` | `OptionMap` | Typed options. Drives `ctx.options`. Omit when using subcommands. |
| `guards` | `Guard[]` | Preconditions checked before `run` - and before any subcommand. |
| `run` | `(ctx) => unknown` | The handler. Optional when using subcommands. |
| `subcommands` | `Record<string, SubcommandDefinition>` | Subcommands keyed by name. |
| `groups` | `Record<string, SubcommandGroupDefinition>` | Subcommand groups keyed by name. |
| `nsfw` | `boolean` | Mark the command NSFW. |
| `defer` | `DeferOption` | Acknowledge the interaction for you. See [automatic deferral](/api/context/#automatic-deferral). |
| `dmPermission` | `boolean` | **Deprecated** by Discord in favour of `contexts`. Use `contexts: ["guild"]` to keep a command out of DMs. |
| `defaultMemberPermissions` | `PermissionResolvable` | Permissions a member needs to even see the command. |
| `integrationTypes` | `("guild" \| "user")[]` | Where it can be **installed**: on servers, on a user account, or both. |
| `contexts` | `("guild" \| "botDm" \| "privateChannel")[]` | Where it can be **used**. |
| `nameLocalizations` | `LocalizationMap` | Per-locale command names, e.g. `{ fr: "aide" }`. |
| `descriptionLocalizations` | `LocalizationMap` | Per-locale descriptions. |
| `guilds` | `string[]` | Deploy only to these guild ids. Omit for a global command. |

```ts title="features/moderation/ban.command.ts"
import { defineCommand, s, hasPermission, PermissionFlagsBits } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ban",
  description: "Ban a member",
  guards: [hasPermission(PermissionFlagsBits.BanMembers)],
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  options: {
    target: s.user({ description: "Who to ban", required: true }),
    reason: s.string({ description: "Why", maxLength: 200 }),
  },
  async run(ctx) {
    await ctx.guild!.members.ban(ctx.options.target, { reason: ctx.options.reason });
    await ctx.audit("member.ban", { targetId: ctx.options.target.id });
    return ctx.reply.success(`Banned ${ctx.options.target.tag}`);
  },
});
```

:::note[Localization vs translation]
`nameLocalizations` changes what the **command picker** shows. `ctx.t()` changes
what your **replies** say. They are independent - see [i18n](/api/i18n/).
:::

## `subcommand`

One leaf of a subcommand tree, with its own options so each handler stays
precisely typed.

| Field | Type | Description |
| --- | --- | --- |
| `description` | `string` | Required. |
| `options` | `OptionMap` | Options for this leaf only. |
| `guards` | `Guard[]` | Runs after the parent guards. |
| `nameLocalizations`, `descriptionLocalizations` | `LocalizationMap` | Per-locale text. |
| `defer` | `DeferOption` | Overrides the parent command's `defer`. |
| `run` | `(ctx) => unknown` | The handler. |

```ts
export default defineCommand({
  name: "config",
  description: "Server configuration",
  subcommands: {
    view: subcommand({ description: "Show the config", run: (ctx) => ctx.reply("…") }),
    set: subcommand({
      description: "Set a key",
      options: { key: s.string({ required: true }), value: s.string({ required: true }) },
      run: (ctx) => ctx.reply.success(`${ctx.options.key} = ${ctx.options.value}`),
    }),
  },
  groups: {
    role: {
      description: "Role settings",
      subcommands: {
        add: subcommand({ description: "Add a role", options: { role: s.role({ required: true }) }, run: (ctx) => ctx.reply("added") }),
      },
    },
  },
});
```

Discord allows two levels: `/command subcommand` and `/command group subcommand`.

## `defineUserCommand`

A right-click → **Apps** entry on a user.

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | The label in the Apps menu. Spaces and capitals allowed. |
| `guards` | `Guard[]` | Preconditions. |
| `dmPermission`, `defaultMemberPermissions`, `integrationTypes`, `contexts`, `nameLocalizations`, `guilds` | | As for `defineCommand`. |
| `run` | `(ctx: UserCommandContext) => unknown` | `ctx.targetUser` / `ctx.targetMember` are the clicked user. |

```ts
export default defineUserCommand({
  name: "User info",
  integrationTypes: ["guild", "user"],
  run: (ctx) => ctx.reply.info(`Joined: ${ctx.targetMember?.joinedAt?.toDateString()}`),
});
```

## `defineMessageCommand`

The same, on a message. `ctx.targetMessage` is the clicked message.

```ts
export default defineMessageCommand({
  name: "Report",
  run: (ctx) => ctx.reply.success(`Reported message ${ctx.targetMessage.id}`),
});
```

## `defineEvent`

```ts
defineEvent(event, run, options?)
```

| Argument | Type | Description |
| --- | --- | --- |
| `event` | `keyof ClientEvents` | Any discord.js event name. |
| `run` | `(...args, ctx: EventContext) => unknown` | The raw event arguments, **plus** a context appended last. |
| `options.once` | `boolean` | Run only the first time. Default `false`. |

```ts
export default defineEvent("guildMemberAdd", (member, ctx) => {
  ctx.logger.info({ id: member.id }, "member joined");
});

export const boot = defineEvent("clientReady", (client, ctx) => {
  ctx.logger.info({ tag: client.user.tag }, "online");
}, { once: true });
```

The required gateway intent is derived automatically when `intents: "auto"`.
A listener that throws is logged and reported to `onError`; it never takes the
process down.

:::note
discord.js renamed the `ready` event to `clientReady`. The old name still
works in v14 but prints a deprecation warning.
:::

## `defineTrigger`

An auto-responder on `messageCreate`.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | Unique, used in logs and diagnostics. |
| `pattern` | `string \| RegExp \| (message) => boolean` | - | What to match. |
| `mode` | `"includes" \| "equals" \| "startsWith" \| "endsWith"` | `"includes"` | How a string pattern is compared. |
| `caseInsensitive` | `boolean` | `true` | For string patterns. |
| `ignoreBots` | `boolean` | `true` | Ignore other bots and itself. |
| `cooldown` | `string \| number` | - | Per-author cooldown, e.g. `"5s"`. |
| `run` | `(ctx: TriggerContext) => unknown` | - | The handler. |

`TriggerContext`: `message`, `client`, `author`, `member`, `guild`, `channel`,
`services`, `logger`, `match` (the `RegExpMatchArray` when the pattern was a
RegExp, else `null`), plus `reply(content)` and `send(content)`.

```ts
export default defineTrigger({
  name: "ping-pong",
  pattern: "ping",
  cooldown: "5s",
  run: (ctx) => ctx.reply("pong 🏓"),
});
```

:::caution[Privileged intent]
Any trigger enables `GuildMessages` **and** `MessageContent`. `MessageContent`
is privileged - turn it on in the Developer Portal, or the bot cannot read
message text.
:::

## `defineButton`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable routing key, e.g. `"ticket:close"`. Must not contain `$`. |
| `params` | `ParamMap` | Typed values encoded into the customId. |
| `guards` | `Guard[]` | Preconditions. |
| `style` | `ButtonStyle` | Default visual used by `build()`. |
| `label` | `string` | Default label. |
| `emoji` | `string` | Default emoji. |
| `defer` | `DeferOption` | Acknowledge the click for you. `"update"` suits a button that edits its message. |
| `run` | `(ctx: ButtonContext) => unknown` | `ctx.params` is decoded and typed. |

The definition exposes `build(params?, visual?)`, which returns a
`ButtonBuilder` with the customId already encoded:

```ts
export const Close = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string },
  label: "Close",
  style: ButtonStyle.Danger,
  run: (ctx) => ctx.reply.success(`Closing ${ctx.params.ticketId}`),
});

// elsewhere
const row = ui.row(Close.build({ ticketId: "42" }));
```

## `defineSelectMenu`

A string select menu. Same `id` / `params` / `guards` / `run` shape as a button.
`build(params, visual)` takes `SelectVisualOptions`:

| Visual option | Type | Description |
| --- | --- | --- |
| `options` | `APISelectMenuOption[]` | **Required.** The choices. |
| `placeholder` | `string` | Text before a selection is made. |
| `minValues`, `maxValues` | `number` | Selection bounds. |
| `disabled` | `boolean` | Render greyed out. |

```ts
export const Pick = defineSelectMenu({
  id: "colour:pick",
  run: (ctx) => ctx.update({ content: `You chose ${ctx.values[0]}` }),
});

Pick.build(undefined, {
  placeholder: "Pick a colour",
  options: [
    { label: "Red", value: "red" },
    { label: "Blue", value: "blue" },
  ],
});
```

### Native select menus

`defineUserSelect`, `defineRoleSelect`, `defineChannelSelect` and
`defineMentionableSelect` let Discord render the picker. Their `build()` takes
`NativeSelectVisualOptions`:

| Visual option | Type | Description |
| --- | --- | --- |
| `placeholder` | `string` | Placeholder text. |
| `minValues`, `maxValues` | `number` | Selection bounds. |
| `disabled` | `boolean` | Render greyed out. |
| `defaultValues` | `string[]` | Pre-selected ids. |
| `channelTypes` | `ChannelType[]` | Channel selects only. |

In the handler, use the resolved collections rather than raw ids:

```ts
export const Assign = defineRoleSelect({
  id: "roles:assign",
  run: async (ctx) => {
    for (const role of ctx.roles!.values()) await ctx.member!.roles.add(role);
    return ctx.update({ content: "Roles updated." });
  },
});
```

## `defineModal`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Routing key. |
| `title` | `string` | The modal window title. |
| `fields` | `FieldMap` | 1 to 5 components: text inputs, selects, pickers, file uploads, radio groups, checkboxes, text blocks. See [`field`](/api/options/#field---modal-components). |
| `params` | `ParamMap` | Params round-tripped through the customId. |
| `guards` | `Guard[]` | Preconditions. |
| `defer` | `DeferOption` | Acknowledge the submission for you. |
| `run` | `(ctx: ModalContext) => unknown` | `ctx.fields` holds typed values; `ctx.params` the decoded params. |

```ts
export const Feedback = defineModal({
  id: "feedback:submit",
  title: "Send feedback",
  fields: {
    subject: field.short({ label: "Subject", required: true, maxLength: 80 }),
    kind: field.select({
      label: "Kind",
      required: true,
      options: [
        { label: "Bug", value: "bug" },
        { label: "Idea", value: "idea" },
      ],
    }),
    body: field.paragraph({ label: "Your feedback", required: true }),
    shots: field.files({ label: "Screenshots", maxValues: 3 }),
  },
  run: (ctx) => ctx.reply.success(`Thanks! (${ctx.fields.kind[0]}: ${ctx.fields.subject})`),
});

// open it from a command, a context menu, a button or a select
await ctx.showModal(Feedback);
```

A modal with no component, more than five, or a choice field with the wrong
number of options fails when it is defined
([`DJSBOT_E014`](/api/errors/#djsbot_e014)), not the first time a user opens it.

:::caution
A modal must be the **first** response to an interaction - you cannot `defer()`
and then show one.
:::

## `defineJob`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | Unique name, used in logs. |
| `schedule` | `string` | - | A duration, a cron expression or a macro (see below). |
| `timezone` | `string` | system | IANA zone a cron expression is evaluated in, e.g. `"Europe/Paris"`. |
| `concurrency` | `number` | `1` | Max simultaneous runs. A run is skipped while that many are active. |
| `runOnStart` | `boolean` | `false` | Also run immediately at boot. |
| `shard` | `"all" \| "first"` | `"all"` | On a sharded bot: every shard, or shard 0 only. |
| `run` | `(ctx: JobContext) => unknown` | - | The handler. |

```ts
export default defineJob({
  name: "daily-digest",
  schedule: "0 9 * * MON-FRI",
  timezone: "Europe/Paris",
  shard: "first",                       // one digest, not one per shard
  run: async (ctx) => {
    if (ctx.signal.aborted) return;
    await ctx.services.digest.send();
  },
});
```

### Schedule syntax

| Syntax | Examples |
| --- | --- |
| Duration | `"30s"`, `"5m"`, `"1h"`, `"1d"` |
| Cron, 5 fields | `"0 3 * * *"`, `"*/15 * * * *"`, `"0 9 * * MON-FRI"`, `"0 0 1 JAN,JUL *"` |
| Macro | `"@hourly"`, `"@daily"`, `"@weekly"`, `"@monthly"`, `"@yearly"` |

Cron fields are minute, hour, day of month, month, day of week. Each accepts
`*`, a value, a list (`1,15`), a range (`1-5`), a step (`*/10`, `5/15`) and,
for months and weekdays, three-letter names. Sunday is `0` or `7`.

As in standard cron, when **both** the day of month and the day of week are
restricted, the job runs when either matches: `"0 0 1 * MON"` means "the 1st of
the month, and every Monday".

An invalid schedule throws [`DJSBOT_E080`](/api/errors/#djsbot_e080) when the
job is defined. Cron jobs fire at the top of the minute.

### Which shard?

On a sharded bot, every shard process runs your code. `"all"` suits a job that
walks `client.guilds.cache` (each shard handles its own guilds); `"first"` is
for work that must happen once, such as a daily announcement.

### Failures

A job that throws is logged with its `correlationId`, reported to `onError` and
to every plugin `onError` hook, and the schedule carries on. On shutdown,
running jobs get `ctx.signal` aborted and up to 10 seconds to finish.

## `defineService`

See [Services & dependency injection](/api/services/).

## `definePlugin`

See [Plugins](/api/plugins/).

## `defineFeature`

Bundles definitions into one reusable, publishable unit - the right shape for
sharing a "tickets" or "levelling" pack between bots.

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Feature name. |
| `requires` | `string[]` | Capabilities that must exist, or startup fails with [`DJSBOT_E040`](/api/errors/#djsbot_e040). |
| `provides` | `string[]` | Capabilities this feature offers. |
| `config` | `Record<string, unknown>` | Arbitrary feature configuration. |
| `commands`, `userCommands`, `messageCommands`, `events`, `triggers`, `buttons`, `selectMenus`, `modals`, `services`, `jobs`, `plugins` | arrays | The definitions to register. |

```ts title="features/tickets/index.ts"
export default defineFeature({
  name: "tickets",
  requires: ["store"],
  commands: [Open, Close],
  buttons: [CloseButton],
  services: [TicketService],
});
```

## File naming

When you point `features` at a directory, the loader imports the files whose
name carries one of these suffixes, and nothing else:

`.command` `.user` `.message` `.event` `.trigger` `.button` `.select`
`.modal` `.service` `.job` `.plugin` `.feature`

```
features/
  tickets/
    open.command.ts
    close.button.ts
    tickets.service.ts
    tickets.feature.ts   <- optional defineFeature() bundle
    helpers.ts           <- no suffix: never imported by the loader
```

The suffix decides **whether** a file is loaded, never **what** it registers:
routing follows the `kind` of each exported definition. A file may therefore
export several definitions of different kinds.

Files are imported concurrently and registered in alphabetical order, so startup
is fast and still deterministic. A matched file that exports no definition is
treated as a mistake and fails with [`DJSBOT_E060`](/api/errors/#djsbot_e060).

Registering the same definition twice is harmless: a command can live in its
own `*.command.ts` **and** be listed in a `*.feature.ts` bundle.
