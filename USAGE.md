# Complete usage guide - `@ix-xs/djs-bot`

Everything you need to build and run a real Discord bot end to end. The framework
never hides discord.js - `ctx.interaction` and `ctx.client` are always right
there - so anything not shown here still works the plain discord.js way.

> All examples are TypeScript and compile against **discord.js v14**.

## Table of contents

1. [Install & project layout](#1-install--project-layout)
2. [The entry file (`defineBot`)](#2-the-entry-file-definebot)
3. [Lifecycle: what happens on startup](#3-lifecycle-what-happens-on-startup)
4. [The `ctx` object & replies](#4-the-ctx-object--replies)
5. [Slash commands & typed options](#5-slash-commands--typed-options)
6. [Every option type](#6-every-option-type)
7. [Subcommands & groups](#7-subcommands--groups)
8. [Context menus (user & message)](#8-context-menus-user--message)
9. [Install contexts: guild vs user install](#9-install-contexts-guild-vs-user-install)
10. [Events & intent autopilot](#10-events--intent-autopilot)
11. [Message triggers (auto-responders)](#11-message-triggers-auto-responders)
12. [Typed buttons & the customId router](#12-typed-buttons--the-customid-router)
13. [Select menus](#13-select-menus)
14. [Modals & text inputs](#14-modals--text-inputs)
15. [Building embeds](#15-building-embeds)
16. [Components V2 (`ui` builders)](#16-components-v2-ui-builders)
17. [Attachments & images](#17-attachments--images)
18. [Mentions, emojis & timestamps](#18-mentions-emojis--timestamps)
19. [Allowed mentions (safe pings)](#19-allowed-mentions-safe-pings)
20. [Smart cache & entity resolution](#20-smart-cache--entity-resolution)
21. [Guards (permissions, cooldowns, checks)](#21-guards-permissions-cooldowns-checks)
22. [Services & dependency injection](#22-services--dependency-injection)
23. [Scheduled jobs](#23-scheduled-jobs)
24. [Plugins, middleware & hooks](#24-plugins-middleware--hooks)
25. [Features (reusable packs)](#25-features-reusable-packs)
26. [Deploying: global + specific guilds](#26-deploying-global--specific-guilds)
27. [Error handling & codes](#27-error-handling--codes)
28. [Testing without Discord](#28-testing-without-discord)
29. [CLI reference](#29-cli-reference)
30. [Pagination & confirmation dialogs](#30-pagination--confirmation-dialogs)
31. [Presence & activities](#31-presence--activities)
32. [Avatars, banners & asset URLs](#32-avatars-banners--asset-urls)
33. [Voice-state helpers](#33-voice-state-helpers)
34. [Sharding & scaling](#34-sharding--scaling)
35. [Internationalisation (`ctx.t`)](#35-internationalisation-ctxt)
36. [Persistence (key-value stores)](#36-persistence-key-value-stores)
37. [Resilience (rate limits, circuit breakers, retry)](#37-resilience-rate-limits-circuit-breakers-retry)
38. [Audit trail (`ctx.audit`)](#38-audit-trail-ctxaudit)
39. [Feature flags per guild](#39-feature-flags-per-guild)
40. [Health checks & metrics](#40-health-checks--metrics)

---

## 1. Install & project layout

```bash
npm install @ix-xs/djs-bot discord.js
npm install -D tsx typescript
npx djs-bot init          # scaffold a starter
```

The file **suffix** decides the type; the **folder** groups a feature:

```
src/
  index.ts                       # defineBot(...)
  features/
    ping/ping.command.ts         # slash command
    config/config.command.ts     # command with subcommands
    tickets/
      open.command.ts
      close.button.ts            # button
      tickets.service.ts         # injectable service
    moderation/
      userinfo.user.ts           # user context menu
      report.message.ts          # message context menu
    fun/
      pong.trigger.ts            # message auto-responder
    welcome/welcome.event.ts     # gateway event
    cleanup/cleanup.job.ts       # scheduled job
```

Recognised suffixes: `.command`, `.user`, `.message`, `.event`, `.trigger`,
`.button`, `.select`, `.modal`, `.service`, `.job`, `.feature`.

> **No import side effects.** Importing a file registers nothing. Each file
> *exports* a `define*()` object; the loader collects it and routes by its
> `kind`. You can always trace behaviour back to an explicit definition.

---

## 2. The entry file (`defineBot`)

```ts
// src/index.ts
import { defineBot, env } from "@ix-xs/djs-bot";
import { requestLogger } from "./plugins/request-logger.js";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),                   // reads env + .env, throws if missing
  clientId: env.optional("DISCORD_CLIENT_ID"),   // needed to deploy
  features: `${import.meta.dirname}/features`,    // auto-discovered folder
  intents: "auto",                               // derived from your events/triggers
  plugins: [requestLogger],
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
  logger: { level: "info", pretty: process.env.NODE_ENV !== "production" },
  presence: { activities: [{ name: "/help" }] },
  onError: (err, ctx) => ctx?.reply.error("Something went wrong."),
});

export default bot;

// Start only when run directly (the CLI imports this file for tooling).
if (!process.env.DJSBOT_CLI) void bot.start();
```

`env(name, fallback?)` reads env vars **and** a `.env` file, throwing a clear
error if a required one is missing. `env.optional(name)` returns `undefined`.

You can also register definitions explicitly, without a folder:

```ts
import ping from "./commands/ping.js";
bot.use(ping, someButton, someService);
```

---

## 3. Lifecycle: what happens on startup

`bot.start()` runs deterministic phases:

```
configure → discover (loader) → validate (requires/provides contracts)
→ register services (DI) → run plugin setup → resolve DI
→ compute intents → connect (login) → ready
→ [running] → SIGTERM → drain → shutdown
```

- **validate** - every `feature.requires` / `plugin.requires` must be provided,
  or the bot fails loudly (`DJSBOT_E040`) *before* connecting.
- **ready** - starts scheduled jobs and auto-deploys commands in development.
- **shutdown** (Ctrl+C / SIGTERM) - stops jobs, runs `onShutdown` hooks, tears
  down plugins, destroys the client. No crash, no orphaned work.

Inspect everything without connecting:

```bash
npx djs-bot explain    # commands, intents, triggers, jobs, services, plugins…
npx djs-bot doctor     # token, privileged intents, permissions
```

---

## 4. The `ctx` object & replies

Every handler gets a single `ctx`. It bundles the raw discord.js interaction with
convenient shortcuts:

| Field | Type | Notes |
| --- | --- | --- |
| `ctx.interaction` | the djs interaction | full real API access |
| `ctx.client` | `Client<true>` | the connected client |
| `ctx.user` | `User` | who triggered it |
| `ctx.guild` / `ctx.guildId` | `Guild \| null` | |
| `ctx.member` | `GuildMember \| null` | |
| `ctx.channel` | `TextBasedChannel \| null` | |
| `ctx.services` | `ServiceMap` | injected services |
| `ctx.logger` | `Logger` | carries a `correlationId` |
| `ctx.options` | typed | slash commands |
| `ctx.params` | typed | buttons / selects (decoded from customId) |
| `ctx.fields` | typed | modals |
| `ctx.values` | `string[]` | select menus |
| `ctx.targetUser` / `targetMember` | | user context menu |
| `ctx.targetMessage` | `Message` | message context menu |

### Reply helpers

```ts
await ctx.reply("text, or a full InteractionReplyOptions object");
await ctx.reply.success("Done ✅");                 // green embed
await ctx.reply.error("Not allowed.");              // red embed, ephemeral by default
await ctx.reply.info("FYI", { ephemeral: true });
await ctx.reply.defer({ ephemeral: true });         // for slow handlers (> 2.5s)
await ctx.reply.followUp("another message");
await ctx.reply.editReply("updated");
```

`reply` is state-aware: if the interaction was deferred it edits; if already
replied it follows up; otherwise it replies - you don't track that yourself.

On **components** (buttons/selects) you also get `ctx.update` to edit the source
message:

```ts
await ctx.update("new content");   // edit the message the component is on
await ctx.update.disable();        // disable every component on that message
await ctx.update.defer();          // acknowledge without changing anything
```

---

## 5. Slash commands & typed options

Options are declared with `s`; `ctx.options` is inferred:

```ts
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  description: "Show a user profile",
  options: {
    target:   s.user({ description: "Whose profile", required: true }),
    detailed: s.boolean({ description: "Verbose output" }),
    format:   s.string({
      description: "Output format",
      choices: [
        { name: "Compact", value: "compact" },
        { name: "Full", value: "full" },
      ],
    }),
  },
  run: async (ctx) => {
    // ctx.options.target: User          (required → not optional)
    // ctx.options.detailed?: boolean    (optional → boolean | undefined)
    // ctx.options.format?: string
    await ctx.reply.info(`Profile of ${ctx.options.target}`);
  },
});
```

---

## 6. Every option type

| Builder | `ctx.options` type | Useful config |
| --- | --- | --- |
| `s.string()` | `string` | `minLength`, `maxLength`, `choices`, `autocomplete` |
| `s.integer()` | `number` | `min`, `max`, `choices`, `autocomplete` |
| `s.number()` | `number` | `min`, `max`, `choices` |
| `s.boolean()` | `boolean` | |
| `s.user()` | `User` | |
| `s.member()` | `GuildMember` | resolved to the guild member |
| `s.channel()` | `GuildBasedChannel` | `channelTypes: [ChannelType.GuildText]` |
| `s.role()` | `Role` | |
| `s.mentionable()` | `User \| Role \| GuildMember` | |
| `s.attachment()` | `Attachment` | see [Attachments](#17-attachments--images) |

Every builder accepts `{ description, required }`. `required: true` makes the
field non-optional in `ctx.options`.

```ts
options: {
  count:   s.integer({ description: "How many", min: 1, max: 100, required: true }),
  channel: s.channel({ description: "Where", channelTypes: [ChannelType.GuildText] }),
  file:    s.attachment({ description: "Upload" }),
}
```

### Autocomplete

Pass an async handler to an option's `autocomplete` - it returns up to 25
suggestions as the user types. Works on `s.string`, `s.integer`, `s.number`, and
inside subcommands.

```ts
const FRUITS = ["apple", "apricot", "banana", "cherry"];

export default defineCommand({
  name: "fruit",
  description: "Pick a fruit",
  options: {
    name: s.string({
      description: "Fruit",
      required: true,
      autocomplete: async (ctx) => {
        // ctx.value = what they've typed; ctx.focused = the option name
        return FRUITS.filter((f) => f.startsWith(ctx.value.toLowerCase()))
          .map((f) => ({ name: f, value: f }));   // or just return string[] / number[]
      },
    }),
  },
  run: (ctx) => ctx.reply.success(`You picked ${ctx.options.name}`),
});
```

The handler `ctx` also gives you `interaction`, `client`, `user`, `guild`,
`services`, and `logger` - so suggestions can be data-driven. Errors are caught
and an empty list is returned, so a slow/failing lookup never breaks the command.

---

## 7. Subcommands & groups

Each subcommand has its **own typed options** via the `subcommand()` helper.

```ts
import { defineCommand, subcommand, s, inGuild, hasPermission, PermissionFlagsBits } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "config",
  description: "Manage server configuration",
  guards: [inGuild(), hasPermission(PermissionFlagsBits.ManageGuild)],

  // /config view    and    /config set key:<...> value:<...>
  subcommands: {
    view: subcommand({
      description: "Show the config",
      run: (ctx) => ctx.reply.info("Current config: …"),
    }),
    set: subcommand({
      description: "Set a value",
      options: {
        key:   s.string({ description: "Key", required: true }),
        value: s.string({ description: "Value", required: true }),
      },
      run: (ctx) => ctx.reply.success(`**${ctx.options.key}** = \`${ctx.options.value}\``),
    }),
  },

  // /config role add role:<@role>    and    /config role remove role:<@role>
  groups: {
    role: {
      description: "Manage auto-roles",
      subcommands: {
        add: subcommand({
          description: "Add an auto-role",
          options: { role: s.role({ description: "Role", required: true }) },
          run: (ctx) => ctx.reply.success(`Added ${ctx.options.role}`),
        }),
        remove: subcommand({
          description: "Remove an auto-role",
          options: { role: s.role({ description: "Role", required: true }) },
          run: (ctx) => ctx.reply.success(`Removed ${ctx.options.role}`),
        }),
      },
    },
  },
});
```

- The **command's** guards run before the **subcommand's** guards.
- Routing to the right subcommand and option resolution are automatic - no
  `switch (getSubcommand())`.
- A command with `subcommands`/`groups` doesn't need a top-level `run`.

---

## 8. Context menus (user & message)

The right-click → **Apps** commands. No description, no options - they get a target.

```ts
// features/moderation/userinfo.user.ts
import { defineUserCommand } from "@ix-xs/djs-bot";
import { EmbedBuilder, time, TimestampStyles, MessageFlags } from "discord.js";

export default defineUserCommand({
  name: "User info",                 // label in the menu (spaces & capitals allowed)
  run: async (ctx) => {
    // ctx.targetUser: User, ctx.targetMember: GuildMember | null
    const embed = new EmbedBuilder()
      .setTitle(ctx.targetUser.tag)
      .setThumbnail(ctx.targetUser.displayAvatarURL())
      .addFields({ name: "Created", value: time(ctx.targetUser.createdAt, TimestampStyles.RelativeTime) });
    await ctx.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});
```

```ts
// features/moderation/report.message.ts
import { defineMessageCommand } from "@ix-xs/djs-bot";

export default defineMessageCommand({
  name: "Report message",
  run: async (ctx) => {
    // ctx.targetMessage: Message
    ctx.logger.warn({ id: ctx.targetMessage.id }, "message reported");
    await ctx.reply.success("Reported to moderators.", { ephemeral: true });
  },
});
```

Deployment picks the correct type automatically (chat = 1, user = 2, message = 3).
A slash command and a context menu may share a name (different types).

---

## 9. Install contexts: guild vs user install

Discord lets an app command be **installed to a server** (`guild`) and/or
**installed to a user account** (`user`, so they can use it anywhere), and be
usable in specific **contexts** (servers, the bot's DMs, or other private/group
DMs). Declare both on any command type:

```ts
export default defineCommand({
  name: "note",
  description: "A personal note command you can use anywhere",
  integrationTypes: ["guild", "user"],              // installable to servers AND user accounts
  contexts: ["guild", "botDm", "privateChannel"],   // usable in servers, bot DMs, group DMs
  options: { text: s.string({ description: "Text", required: true }) },
  run: (ctx) => ctx.reply.info(ctx.options.text, { ephemeral: true }),
});
```

- `integrationTypes`: `"guild"` (GuildInstall) and/or `"user"` (UserInstall).
- `contexts`: `"guild"`, `"botDm"`, `"privateChannel"`.
- Works on `defineCommand`, `defineUserCommand`, and `defineMessageCommand`.

They're emitted as Discord's `integration_types` / `contexts` and included in the
deploy diff, so changing them re-deploys the command.

### Localizations (worldwide)

Translate command & option names/descriptions per locale. Discord shows each user
the strings for their client language. Available on commands, options,
subcommands, and context menus (context menus localize the name only).

```ts
export default defineCommand({
  name: "help",
  description: "Show help",
  nameLocalizations: { fr: "aide", de: "hilfe", "es-ES": "ayuda" },
  descriptionLocalizations: { fr: "Afficher l'aide", de: "Hilfe anzeigen" },
  options: {
    topic: s.string({
      description: "Topic",
      nameLocalizations: { fr: "sujet" },
      descriptionLocalizations: { fr: "Le sujet" },
    }),
  },
  run: (ctx) => ctx.reply.info("…"),
});
```

Locale keys are discord.js `Locale` strings (`"fr"`, `"de"`, `"es-ES"`, `"pt-BR"`,
`"ja"`, …). Localizations are part of the deploy diff, so translating re-deploys.

---

## 10. Events & intent autopilot

```ts
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("guildMemberAdd", async (member, ctx) => {
  ctx.logger.info({ id: member.id }, "joined");
  const channel = member.guild.systemChannel;
  if (channel?.isTextBased()) await channel.send(`Welcome ${member}!`);
});

// once: fires a single time
export const boot = defineEvent("ready", (client, ctx) => {
  ctx.logger.info({ tag: client.user.tag }, "up");
}, { once: true });
```

The first argument is the discord.js event name (typed), then the event's own
arguments, and **last** the `ctx` (client, services, logger).

### The autopilot

With `intents: "auto"`, intents and partials are **derived** from the events (and
triggers) you registered:

| Event | Intent added |
| --- | --- |
| `guildMemberAdd`/`Remove` | `GuildMembers` *(privileged)* |
| `messageCreate` | `GuildMessages` + `MessageContent` *(privileged)* |
| `messageReactionAdd` | `GuildMessageReactions` (+ Message/Channel/Reaction partials) |
| `voiceStateUpdate` | `GuildVoiceStates` |
| `presenceUpdate` | `GuildPresences` *(privileged)* |
| … | … |

`Guilds` is always included. Privileged intents trigger a startup warning telling
you to enable them in the Developer Portal (`djs-bot doctor` reminds you too).

Prefer manual control? Pass an array:

```ts
import { GatewayIntentBits } from "@ix-xs/djs-bot";
intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
```

---

## 11. Message triggers (auto-responders)

Triggers fire on `messageCreate` when a message matches a keyword, a RegExp, or a
custom predicate. Registering any trigger auto-enables `GuildMessages` +
`MessageContent` (privileged) + `DirectMessages`.

```ts
import { defineTrigger } from "@ix-xs/djs-bot";

// Keyword (case-insensitive "includes" by default)
export default defineTrigger({
  name: "ping-pong",
  pattern: "ping",
  cooldown: "5s",                 // per-author
  run: (ctx) => ctx.reply("pong 🏓"),
});

// RegExp - capture groups are available on ctx.match
export const greet = defineTrigger({
  name: "greet",
  pattern: /\bgood (morning|night)\b/i,
  run: (ctx) => ctx.reply(ctx.match?.[1] === "morning" ? "☀️ Morning!" : "🌙 Night!"),
});

// Custom predicate - full control
export const longMsg = defineTrigger({
  name: "wall-of-text",
  pattern: (message) => message.content.length > 500,
  run: (ctx) => ctx.reply("That's a lot of text!"),
});
```

The trigger `ctx` gives you `message`, `author`, `member`, `guild`, `channel`,
`services`, `logger`, `match`, plus `ctx.reply(...)` (replies to the message) and
`ctx.send(...)` (new message in the channel). `mode` can be `"includes"`
(default), `"equals"`, `"startsWith"`, or `"endsWith"`; `caseInsensitive`
defaults to `true`; `ignoreBots` defaults to `true`.

---

## 12. Typed buttons & the customId router

A component's customId is the only state Discord round-trips, and it's capped at
100 chars. Instead of hand-building `"close_" + id` and parsing it, declare typed
**params** - the framework encodes them into the customId and decodes them back.

```ts
// features/tickets/close.button.ts
import { defineButton, p, ButtonStyle } from "@ix-xs/djs-bot";

export const CloseTicket = defineButton({
  id: "ticket:close",                            // stable routing key
  params: { ticketId: p.string, ownerId: p.string },
  run: async (ctx) => {
    // ctx.params: { ticketId: string; ownerId: string }  ← decoded & typed
    if (ctx.user.id !== ctx.params.ownerId) return void ctx.reply.error("Not your ticket.");
    await ctx.services.tickets.close(ctx.params.ticketId);
    await ctx.update.disable();
    await ctx.reply.success("Ticket closed 🔒", { ephemeral: true });
  },
});
```

Building the button anywhere else is type-checked - you can't forget a param:

```ts
import { ui } from "@ix-xs/djs-bot";
import { CloseTicket } from "./close.button.js";

const button = CloseTicket.build(
  { ticketId: id, ownerId: ctx.user.id },        // params (type-checked)
  { label: "Close", style: ButtonStyle.Danger, emoji: "🔒" },
);
await ctx.reply({ content: "🎫 Ticket opened", components: [ui.row(button)] });
```

- Param codecs: `p.string`, `p.number`, `p.boolean`.
- If the encoded customId would exceed 100 chars you get a coded error
  (`DJSBOT_E020`) instead of a silent bug - store big state elsewhere (a DB) and
  keep a short key.
- Link buttons use `ui.linkButton("Docs", url)` (no handler).

---

## 13. Select menus

**String select** - your own list of options:

```ts
import { defineSelectMenu, p, ui } from "@ix-xs/djs-bot";

export const RolePicker = defineSelectMenu({
  id: "roles:pick",
  params: { messageId: p.string },
  run: async (ctx) => {
    // ctx.values: string[]   ctx.params.messageId: string
    await ctx.reply.success(`You picked: ${ctx.values.join(", ")}`);
  },
});

const menu = RolePicker.build(
  { messageId: ctx.interaction.id },
  {
    placeholder: "Choose roles",
    minValues: 0,
    maxValues: 3,
    options: [
      { label: "Dev", value: "dev", emoji: "💻" },
      { label: "Design", value: "design", description: "UI/UX" },
    ],
  },
);
await ctx.reply({ content: "Select:", components: [ui.row(menu)] });
```

**Native selects** - `defineUserSelect`, `defineRoleSelect`, `defineChannelSelect`,
`defineMentionableSelect`. Discord resolves the picks for you; the context exposes
`ctx.users`, `ctx.members`, `ctx.roles`, `ctx.channels` depending on the type:

```ts
import { defineChannelSelect } from "@ix-xs/djs-bot";
import { ChannelType } from "discord.js";

export const PickChannel = defineChannelSelect({
  id: "setup:log-channel",
  run: async (ctx) => {
    const channel = ctx.channels?.first();       // ctx.channels: Collection<id, GuildChannel>
    await ctx.reply.success(`Log channel set to ${channel}`);
  },
});

// Building it:
const menu = PickChannel.build(undefined, {
  placeholder: "Pick a channel",
  channelTypes: [ChannelType.GuildText],
  maxValues: 1,
});
await ctx.reply({ content: "Where should logs go?", components: [ui.row(menu)] });
```

| Factory | Context field(s) | Extra build option |
| --- | --- | --- |
| `defineSelectMenu` | `ctx.values` | `options: [...]` |
| `defineUserSelect` | `ctx.users`, `ctx.members` | `defaultValues` |
| `defineRoleSelect` | `ctx.roles` | `defaultValues` |
| `defineChannelSelect` | `ctx.channels` | `channelTypes`, `defaultValues` |
| `defineMentionableSelect` | `ctx.users`, `ctx.roles`, `ctx.members` | |

All native builds accept `{ placeholder, minValues, maxValues, disabled }` and
carry typed customId `params` just like buttons.

---

## 14. Modals & text inputs

Text inputs are declared with `field`; `ctx.fields` is typed.

```ts
// features/feedback/feedback.modal.ts
import { defineModal, field } from "@ix-xs/djs-bot";

export const FeedbackModal = defineModal({
  id: "feedback:submit",
  title: "Send feedback",
  fields: {
    subject: field.short({ label: "Subject", required: true, maxLength: 80, placeholder: "Short summary" }),
    body:    field.paragraph({ label: "Details", maxLength: 1000, minLength: 10 }),
  },
  run: async (ctx) => {
    // ctx.fields: { subject: string; body: string }
    await ctx.reply.success(`Thanks for your feedback on **${ctx.fields.subject}**!`, { ephemeral: true });
  },
});
```

`field.short()` is a single-line input, `field.paragraph()` a multi-line one;
both accept `{ label, required, placeholder, minLength, maxLength, value }`.

Open a modal from a command or button (never after a `reply`/`defer` - Discord
requires the modal to be the first response):

```ts
export default defineCommand({
  name: "feedback",
  description: "Send feedback",
  run: (ctx) => ctx.interaction.showModal(FeedbackModal.build()),
});
```

Modals can carry typed customId params too (like buttons) via `params` +
`FeedbackModal.build({ … })`.

---

## 15. Building embeds

Embeds come from discord.js (`EmbedBuilder` is re-exported for convenience):

```ts
import { EmbedBuilder } from "@ix-xs/djs-bot"; // or from "discord.js"

const embed = new EmbedBuilder()
  .setColor(0x5865f2)
  .setTitle("Title")
  .setURL("https://example.com")
  .setDescription("A **markdown** description.")
  .setAuthor({ name: ctx.user.username, iconURL: ctx.user.displayAvatarURL() })
  .setThumbnail("https://…/thumb.png")
  .addFields(
    { name: "Field 1", value: "value", inline: true },
    { name: "Field 2", value: "value", inline: true },
  )
  .setImage("https://…/image.png")
  .setFooter({ text: "Footer" })
  .setTimestamp();

await ctx.reply({ embeds: [embed] });
```

`ctx.reply.success/info/error` are shortcuts that build a small coloured embed.
For full control, pass your own `embeds`.

---

## 16. Components V2 (`ui` builders)

Components V2 replace `content`/`embeds` with a tree of display components:
containers, sections, text, separators, media galleries, thumbnails, files. The
`ui` namespace gives you terse factories that return real discord.js builders.

> ⚠️ A Components V2 message uses `flags: MessageFlags.IsComponentsV2` and may
> **not** also use `content` or `embeds`. Use raw `ctx.reply(...)` (not
> `ctx.reply.success`, which builds an embed).

```ts
import { ui, MessageFlags } from "@ix-xs/djs-bot";
import { CloseTicket } from "./close.button.js";

export default defineCommand({
  name: "card",
  description: "A Components V2 card",
  run: async (ctx) => {
    const container = ui.container(
      ui.text("# Profile card\nA **Components V2** message."),
      ui.separator({ divider: true, spacing: "large" }),
      ui.section({
        text: [`User: ${ctx.user}`, "Status: online"],
        accessory: ui.thumbnail(ctx.user.displayAvatarURL()),
      }),
      ui.gallery("https://…/a.png", "https://…/b.png"),
      ui.row(CloseTicket.build({ ticketId: "1", ownerId: ctx.user.id }, { label: "Close" })),
    );

    await ctx.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
});
```

`ui` helpers:

| Helper | Builds |
| --- | --- |
| `ui.row(...components)` | an action row (buttons / select) |
| `ui.linkButton(label, url, emoji?)` | a link button |
| `ui.container(...)` | a V2 container (accepts the display components below) |
| `ui.text(markdown)` | a text block |
| `ui.separator({ divider?, spacing? })` | a separator |
| `ui.section({ text, accessory })` | text + a thumbnail or button accessory |
| `ui.thumbnail(url, description?)` | a section thumbnail |
| `ui.gallery(...urls)` | a media gallery (supports `attachment://name`) |
| `ui.file(attachmentUrl)` | a file display component |

---

## 17. Attachments & images

### Sending files & images

```ts
import { AttachmentBuilder, EmbedBuilder } from "@ix-xs/djs-bot";

// From a Buffer, path, or stream
const file = new AttachmentBuilder(Buffer.from("hello"), { name: "note.txt" });
await ctx.reply({ content: "Here you go:", files: [file] });

// Reference an uploaded image inside an embed via attachment://
const img = new AttachmentBuilder("./chart.png", { name: "chart.png" });
const embed = new EmbedBuilder().setImage("attachment://chart.png");
await ctx.reply({ embeds: [embed], files: [img] });

// …or in a Components V2 gallery
await ctx.reply({
  flags: MessageFlags.IsComponentsV2,
  files: [img],
  components: [ui.container(ui.gallery("attachment://chart.png"))],
});
```

### Receiving a file (the `attachment` option)

```ts
export default defineCommand({
  name: "scan",
  description: "Scan an uploaded file",
  options: { file: s.attachment({ description: "File to scan", required: true }) },
  run: async (ctx) => {
    const a = ctx.options.file;   // Attachment
    await ctx.reply.info(`Got **${a.name}** - ${a.contentType ?? "?"} - ${a.size} bytes\n${a.url}`);
  },
});
```

---

## 18. Mentions, emojis & timestamps

```ts
import { mention, emoji, timestamp, TimestampStyles } from "@ix-xs/djs-bot";

mention.user("123");            // <@123>
mention.channel("456");         // <#456>
mention.role("789");            // <@&789>
mention.everyone;               // @everyone
mention.command("config", id);          // </config:id>  (clickable slash mention)
mention.command("config", id, "set");   // </config set:id>

timestamp(new Date());                               // <t:…>
timestamp(new Date(), TimestampStyles.RelativeTime); // "in 2 hours"

emoji.custom("blob", "1234567890", true);   // <a:blob:1234567890>  (animated)
emoji.format({ name: "blob", id: "123" });  // <:blob:123>
emoji.parse("<a:blob:123>");                // { animated: true, name: "blob", id: "123" }
emoji.find(ctx.guild!, "blob");             // GuildEmoji | undefined (from cache)
```

Use them anywhere text goes:

```ts
await ctx.reply(`${mention.user(ctx.user.id)} joined ${timestamp(Date.now(), TimestampStyles.RelativeTime)}`);
```

---

## 19. Allowed mentions (safe pings)

Control who a message may actually ping - essential when echoing user input:

```ts
import { allowedMentions, mention } from "@ix-xs/djs-bot";

// Echo user text but never ping anyone
await ctx.reply({ content: userText, allowedMentions: allowedMentions.none() });

// Only ping specific users / roles
await ctx.reply({ content: `${mention.role(roleId)} heads up`, allowedMentions: allowedMentions.roles(roleId) });

// Don't ping the replied-to author
await ctx.reply({ content: "reply", allowedMentions: allowedMentions.repliedUser(false) });
```

---

## 20. Smart cache & entity resolution

### `resolve` - cache-first fetching

Read from discord.js's cache and only hit the API on a miss:

```ts
import { resolve } from "@ix-xs/djs-bot";

const member  = await resolve.member(ctx.guild!, userId);   // cache → fetch
const user    = await resolve.user(ctx.client, userId);
const role    = await resolve.role(ctx.guild!, roleId);
const channel = await resolve.channel(ctx.client, channelId);
const message = await resolve.message(ctx.channel!, messageId);

const fresh = await resolve.member(ctx.guild!, userId, /* force */ true); // always fetch
```

### `TTLCache` - your own smart cache

An in-memory cache with per-entry TTL, LRU bound, single-flight fetching, and
optional stale-while-revalidate - great for wrapping slow external calls:

```ts
import { createCache } from "@ix-xs/djs-bot";

const prices = createCache<string, number>({ ttl: "1m", max: 500, staleWhileRevalidate: true });

// Deduplicates concurrent calls for the same key; caches the result.
const price = await prices.getOrFetch(symbol, () => fetchPriceFromApi(symbol));

prices.get(symbol);          // value | undefined (fresh only)
prices.set(symbol, 42);      // manual set
prices.delete(symbol);
prices.clear();
```

Wire it into a service so it's shared and injectable:

```ts
export const Prices = defineService("prices", {
  factory: () => {
    const cache = createCache<string, number>({ ttl: "1m", staleWhileRevalidate: true });
    return { get: (s: string) => cache.getOrFetch(s, () => fetchPriceFromApi(s)) };
  },
});
```

---

## 21. Guards (permissions, cooldowns, checks)

Composable preconditions. A failing guard short-circuits and replies its reason.

```ts
import { inGuild, hasPermission, botHasPermission, cooldown, ownerOnly, guard, pass, fail, PermissionFlagsBits } from "@ix-xs/djs-bot";

const isPremium = guard("isPremium", async (ctx) =>
  (await ctx.services.billing.isPremium(ctx.guildId)) ? pass() : fail("Premium only."),
);

export default defineCommand({
  name: "kick",
  description: "Kick a member",
  options: { target: s.member({ description: "Member", required: true }) },
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.KickMembers),      // the invoking member
    botHasPermission(PermissionFlagsBits.KickMembers),   // the bot
    cooldown("10s"),                                     // per user
    isPremium,
  ],
  run: async (ctx) => {
    await ctx.options.target.kick();
    await ctx.reply.success(`Kicked ${ctx.options.target}.`);
  },
});
```

Cooldown scope: `cooldown("1m", { scope: "guild" })` - `"user"` (default),
`"guild"`, `"channel"`, or `"global"`. Built-ins: `inGuild`, `dmOnly`,
`hasPermission`, `botHasPermission`, `inChannel(...ids)`, `ownerOnly(...ids)`,
`cooldown`.

---

## 22. Services & dependency injection

An explicit container - no decorators, no `reflect-metadata`. Dependencies are
tokens resolved in order at boot, exposed as `ctx.services`.

```ts
import { defineService } from "@ix-xs/djs-bot";

export const Db = defineService("db", { factory: () => createDb() });

export const Tickets = defineService("tickets", {
  deps: ["db"],
  factory: ({ db }) => new TicketsService(db as Db),
});
```

Type `ctx.services` end to end by augmenting `ServiceMap`:

```ts
declare module "@ix-xs/djs-bot" {
  interface ServiceMap {
    db: Db;
    tickets: TicketsService;
  }
}
// ctx.services.tickets is now fully typed everywhere
```

---

## 23. Scheduled jobs

Cron **and** durations. Each job gets an `AbortSignal` (fired on shutdown) and a
concurrency limit (1 by default - no overlap).

```ts
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "nightly-cleanup",
  schedule: "0 3 * * *",        // 5-field cron, or "30s" / "5m" / "1h"
  timezone: "Europe/Paris",     // optional (cron)
  concurrency: 1,
  runOnStart: false,
  run: async (ctx) => {
    if (ctx.signal.aborted) return;
    await ctx.services.db.purgeExpired();
    ctx.logger.info({}, "cleanup done");
  },
});
```

---

## 24. Plugins, middleware & hooks

A plugin adds cross-cutting behaviour (middleware, hooks) through an `app` façade
- it never patches the core.

```ts
import { definePlugin } from "@ix-xs/djs-bot";

export const requestLogger = definePlugin({
  name: "request-logger",
  version: "1.0.0",
  requires: [],           // capabilities it needs
  provides: [],           // capabilities it exposes
  setup(app) {
    app.hooks.beforeInteraction(async (ctx, next) => {   // runs around every interaction
      const start = Date.now();
      await next();
      ctx.logger.info({ ms: Date.now() - start }, "interaction handled");
    });
    app.hooks.afterInteraction((ctx) => {/* on success */});
    app.hooks.onError((err, ctx) => {/* any handler error */});
    app.hooks.onReady((client) => {/* client ready */});
    app.hooks.onShutdown(() => {/* cleanup */});

    app.services.register("rateLimiter", createLimiter());  // expose a service
  },
});

// defineBot({ plugins: [requestLogger] })
```

The framework validates the **capability graph**: an unmet `requires` →
`DJSBOT_E040`; two plugins providing the same capability → `DJSBOT_E041`. Failures
happen at boot, never silently.

---

## 25. Features (reusable packs)

A feature bundles commands, events, triggers, components, services, and jobs into
one closed, publishable unit with a contract.

```ts
import { defineFeature } from "@ix-xs/djs-bot";
import Open from "./open.command.js";
import { CloseTicket } from "./close.button.js";
import { Tickets } from "./tickets.service.js";

export default defineFeature({
  name: "tickets",
  requires: ["db"],                 // the host must provide a "db" service
  commands: [Open],
  buttons: [CloseTicket],
  services: [Tickets],
  // userCommands, messageCommands, events, triggers, modals, selectMenus, jobs, plugins…
});

// defineBot({ features: ["./src/features", ticketsFeature] })
```

You can publish a feature as its own npm package and drop it into any bot.

---

## 26. Deploying: global + specific guilds

Discord has two command scopes:

| Scope | Propagation | Use for |
| --- | --- | --- |
| **Global** | up to **~1 hour** | commands for every server |
| **Guild** | **instant** | dev, or commands limited to specific servers |

### Per-command scoping (mix global + specific servers)

By default a command is **global**. Add `guilds` to a command to deploy it only
to those servers - perfect for admin/dev commands, or per-community features. You
can mix freely, and target multiple guilds:

```ts
// A global command - available everywhere.
export const help = defineCommand({ name: "help", description: "Help", run: … });

// A dev-only command - only on your support/dev server.
export const evalCmd = defineCommand({
  name: "eval",
  description: "Run code",
  guilds: ["123456789012345678"],           // ← only this guild
  run: …,
});

// A command deployed to several specific servers.
export const announce = defineCommand({
  name: "announce",
  description: "Announcement",
  guilds: ["111...", "222..."],             // ← these guilds
  run: …,
});
```

`guilds` works on `defineCommand`, `defineUserCommand`, and
`defineMessageCommand`. `djs-bot explain` prints the full plan:

```
Deployment plan
  global: help
  guild 111...: announce, eval
  guild 222...: announce
```

### The diff deployer

`djs-bot deploy` computes the plan, then diffs **each target independently**
against Discord and **pushes only the delta** (no needless 429s, no ghost
commands):

```bash
npx djs-bot deploy               # global commands → global, scoped → their guilds
npx djs-bot deploy --dry-run     # preview every target, push nothing
npx djs-bot deploy --guild 123…  # force EVERY command onto one guild (fast testing)
```

Output (one block per target):

```
✓ global
  + help              (added)
✓ guild 111...
  ~ announce          (changed)
```

### Updates & deletions are automatic

Deployment is **declarative** - your code is the source of truth. Each `deploy`
reconciles Discord to match it:

- a **new** command → added,
- a **changed** command (renamed option, new description, changed permissions,
  localizations, scope…) → updated,
- a command you **deleted from your code** → removed.

You never delete commands by hand. Just remove (or edit) the code and run
`deploy` again.

If you stop targeting a **whole guild** (remove the last command scoped to it),
djs-bot remembers the guilds it deployed to (in a small `.djs-bot/deploy-state.json`
file - gitignored) and **auto-prunes** that guild's commands on the next deploy.

To wipe a scope entirely - e.g. resetting, or a guild you no longer serve:

```bash
npx djs-bot clear --guild 123…   # remove all this app's commands from that guild
npx djs-bot clear --global       # remove all global commands
```

```ts
await bot.clear({ guildId: "123…" });   // or bot.clear() for global
```

### In development

The bot **auto-deploys instantly to your dev guild** on startup (when
`NODE_ENV !== "production"`), mirroring *all* commands there so you can test
immediately - regardless of their `guilds`:

```ts
deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
```

### In production

Set `NODE_ENV=production` (disables the dev mirror) and run `djs-bot deploy` once
per release - global commands go global, scoped commands go to their guilds. You
need `DISCORD_CLIENT_ID`. Or do it programmatically:

```ts
const result = await bot.deploy();          // honours per-command `guilds`
for (const t of result.targets) {
  console.log(t.scope, t.guildId ?? "", t.added, t.changed, t.removed);
}
```

---

## 27. Error handling & codes

- **Every interaction is wrapped.** A throwing handler is logged (with a
  `correlationId`) and the user gets an error message - never "This application
  did not respond".
- Customise via the global `onError` (config) or `app.hooks.onError` (plugin).
- The process **stays alive** on an interaction error.

All framework errors carry a stable `DJSBOT_Exxx` code and an actionable hint:

| Code | Meaning |
| --- | --- |
| `DJSBOT_E001` | missing token |
| `DJSBOT_E010` | duplicate command name |
| `DJSBOT_E011` | duplicate component id |
| `DJSBOT_E020` | customId over 100 chars |
| `DJSBOT_E030` | service dependency cycle |
| `DJSBOT_E040` | unmet feature/plugin contract |
| `DJSBOT_E041` | capability conflict |
| `DJSBOT_E070` | privileged intent required |

```ts
import { BotError, isBotError } from "@ix-xs/djs-bot";
try { /* … */ } catch (e) {
  if (isBotError(e)) console.error(e.code, e.hint, e.docs);
}
```

---

## 28. Testing without Discord

The harness invokes your handlers with **no token and no network** and captures
every reply.

```ts
import { createHarness } from "@ix-xs/djs-bot/testing";
import Profile from "../src/features/profile/profile.command.js";
import { CloseTicket } from "../src/features/tickets/close.button.js";

const h = createHarness();

test("replies", async () => {
  const { replies } = await h.command(Profile, { options: { target: {} } });
  expect(replies[0].type).toBe("info");
});

test("a guard blocks it", async () => {
  const { passedGuards, rejectionReason } = await h.command(GuildOnly);
  expect(passedGuards).toBe(false);
  expect(rejectionReason).toMatch(/server/i);
});

test("button params are decoded", async () => {
  const { replies } = await h.button(CloseTicket, {
    userId: "someone-else",
    params: { ticketId: "t1", ownerId: "owner" },
  });
  expect(replies[0].type).toBe("error");
});
```

Methods: `h.command`, `h.button`, `h.select`, `h.modal`. Options: `userId`,
`guildId`, `services` (injection), `runGuards` (default `true`).

---

## 29. CLI reference

```
djs-bot dev [entry]              # watch + instant guild deploy (uses tsx if present)
djs-bot start [entry]            # production mode
djs-bot deploy [entry]           # diff & deploy: adds/updates/removes  (--dry-run, --guild <id>)
djs-bot clear [entry]            # remove all commands from a scope     (--global | --guild <id>)
djs-bot doctor [entry]           # diagnose config, intents, permissions
djs-bot explain [entry]          # print what's loaded, incl. the deployment plan
djs-bot generate <type> <name>   # scaffold (command|user|message|event|trigger|button|modal|select|service|job|feature)
djs-bot init                     # minimal starter
djs-bot help | version
```

`dev`/`start` run your entry (with `tsx` if installed, so raw `.ts` works).
`deploy`/`clear`/`doctor`/`explain` import your entry in introspection mode
(`DJSBOT_CLI=introspect`) and **never connect** to the gateway.

```bash
npx djs-bot generate command warn         # → features/warn/warn.command.ts
npx djs-bot generate trigger welcome      # → features/welcome/welcome.trigger.ts
npx djs-bot generate user "User info"     # → user context menu
npx djs-bot explain                       # understand what's loaded
```

---

## 30. Pagination & confirmation dialogs

`paginate` and `confirm` manage their own buttons and collectors - no global
handler, no registered components.

```ts
import { paginate, confirm } from "@ix-xs/djs-bot";
import { EmbedBuilder } from "discord.js";

// Paginated embeds with ⏮ ◀ 1/3 ▶ ⏭ controls
export default defineCommand({
  name: "leaderboard",
  description: "Top players",
  run: async (ctx) => {
    const pages = chunk(players, 10).map((group, i) =>
      new EmbedBuilder().setTitle(`Leaderboard - page ${i + 1}`).setDescription(group.join("\n")),
    );
    await paginate(ctx, { pages, timeout: "5m", showFirstLast: true });
  },
});

// Yes/No confirmation → boolean
export const wipe = defineCommand({
  name: "wipe",
  description: "Delete all data",
  run: async (ctx) => {
    if (await confirm(ctx, { content: "⚠️ Delete everything?", confirmLabel: "Delete", cancelLabel: "Keep" })) {
      await ctx.services.db.wipe();
      await ctx.reply.success("Done.");
    } else {
      await ctx.reply.info("Cancelled.");
    }
  },
});
```

`paginate` also accepts a **lazy** page builder for large/expensive datasets:

```ts
await paginate(ctx, { count: 100, pages: (i) => renderPageEmbed(i), timeout: "2m" });
```

Pages aren't limited to embeds - a page can be a **full payload**, including
**Components V2**. Return `{ components, flags }` and the nav row is appended for
you:

```ts
import { ui, MessageFlags } from "@ix-xs/djs-bot";

await paginate(ctx, {
  pages: cards.map((card) => ({
    flags: MessageFlags.IsComponentsV2,
    components: [ui.container(ui.text(`# ${card.title}`), ui.gallery(card.image))],
  })),
  timeout: "5m",
});
```

A page is either an `EmbedBuilder` or a `{ content?, embeds?, components?, files?,
flags? }` payload. By default only the invoking user can use the controls
(`allowedUsers` to widen).

## 31. Presence & activities

Set an initial presence in config, rotate it, or change it at runtime.

```ts
import { defineBot, env, ActivityType } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  presence: { activities: [{ name: "/help", type: ActivityType.Listening }] },
  presenceRotation: {
    interval: "30s",
    items: [
      { activities: [{ name: "/help", type: ActivityType.Listening }] },
      { activities: [{ name: "over 12 servers", type: ActivityType.Watching }] },
      { status: "idle", activities: [{ name: "maintenance", type: ActivityType.Playing }] },
    ],
  },
});

// At runtime (e.g. from a command or event):
bot.setActivity("with fire", { type: ActivityType.Playing, status: "dnd" });
bot.setPresence({ status: "online", activities: [{ name: "you", type: ActivityType.Watching }] });
```

## 32. Avatars, banners & asset URLs

```ts
import { assets } from "@ix-xs/djs-bot";

assets.avatar(ctx.user, { size: 256 });          // best avatar (server avatar for members)
assets.avatar(ctx.member!, { extension: "png" }); // a member's server-specific avatar
await assets.banner(ctx.user, { size: 1024 });   // user banner (fetches - banners aren't cached) | null
assets.guildIcon(ctx.guild!, { size: 512 });     // string | null
assets.guildBanner(ctx.guild!);
assets.guildSplash(ctx.guild!);
assets.emoji("1234567890", { animated: true, size: 128 }); // custom emoji image URL
```

Size is a power of two (16-4096); extension is `"webp" | "png" | "jpg" | "gif"`.

## 33. Voice-state helpers

Inspect and move members between voice channels (moderation/utility - no audio,
so no `@discordjs/voice` dependency).

```ts
import { voice } from "@ix-xs/djs-bot";

voice.channelOf(member);           // VoiceBasedChannel | null
voice.isConnected(member);         // boolean
voice.membersIn(channel);          // Collection<id, GuildMember>
await voice.move(member, channel); // move to another channel
await voice.disconnect(member);    // kick from voice
await voice.mute(member, true);    // server mute
await voice.deafen(member, true);  // server deafen
```

Handle voice activity with events:

```ts
export default defineEvent("voiceStateUpdate", (oldState, newState, ctx) => {
  if (!oldState.channel && newState.channel) ctx.logger.info({ user: newState.id }, "joined voice");
});
```

## 34. Sharding & scaling

For large bots (2,500+ guilds, or just to scale), enable sharding. The process
you launch becomes a **manager** that spawns one child per shard, each running
your bot normally - your code is identical sharded or not.

```ts
const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./src/features",
  sharding: "auto",   // or true, or { totalShards: 4, mode: "process", respawn: true }
});
```

- `"auto"` lets Discord pick the shard count.
- `mode: "worker"` uses worker threads instead of child processes.
- The manager re-runs your **entry file**, so keep the
  `if (!process.env.DJSBOT_CLI) bot.start()` pattern.
- Run it in production against your built entry: `node dist/index.js` (or
  `djs-bot start`). Under introspection (`explain`/`doctor`) sharding is skipped.

Cross-shard work (totals, broadcasts) uses discord.js as usual:

```ts
export default defineCommand({
  name: "stats",
  description: "Global stats",
  run: async (ctx) => {
    const counts = await ctx.client.shard?.fetchClientValues("guilds.cache.size");
    const total = (counts as number[] | undefined)?.reduce((a, b) => a + b, 0) ?? ctx.client.guilds.cache.size;
    await ctx.reply.info(`Serving ${total} servers.`);
  },
});
```

## 35. Internationalisation (`ctx.t`)

Translate the **messages your bot sends** to each user's Discord client language.
(This is separate from command-name localizations in §9, which translate the
command in the picker.)

```ts
const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  i18n: {
    defaultLocale: "en",
    resources: {
      en: {
        daily: { claimed: "You claimed {amount} coins!" },
        items: { one: "{count} item", other: "{count} items" },   // pluralization
      },
      fr: {
        daily: { claimed: "Vous avez reçu {amount} pièces !" },
        items: { one: "{count} objet", other: "{count} objets" },
      },
    },
  },
});
```

Then in any interaction handler, `ctx.t` uses the caller's locale (`ctx.locale`):

```ts
run: async (ctx) => {
  await ctx.reply.success(ctx.t("daily.claimed", { amount: 100 }));
  // A French user sees "Vous avez reçu 100 pièces !", others the English string.
  await ctx.reply.info(ctx.t("items", { count: 3 }));   // "3 items" / "3 objets"
}
```

- Nested keys with dot paths (`"daily.claimed"`), `{var}` interpolation,
  `{count}` pluralization via `{ one, other }`.
- Locale fallback: exact (`"fr-CA"`) → base (`"fr"`) → `fallbackLocale` →
  `defaultLocale` → the key itself.
- Without `i18n` configured, `ctx.t(key)` just returns the key (safe no-op).
- Use `createI18n()` standalone anywhere you need translations outside handlers.

## 36. Persistence (key-value stores)

The core never imposes a database - it speaks the async {@link KVStore}
interface. Ship with two adapters (and write your own over Redis/Postgres):

```ts
import { defineBot, memoryStore, sqliteStore } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  store: sqliteStore("data/bot.sqlite"),   // durable, via node:sqlite - or memoryStore()
});
```

The `store` config is auto-registered as the `store` service:

```ts
run: async (ctx) => {
  const store = ctx.services.store as KVStore<number>;
  const balance = (await store.get(ctx.user.id)) ?? 0;
  await store.set(ctx.user.id, balance + 100);            // set(key, value, ttl?)
  await ctx.reply.success(`Balance: ${balance + 100}`);
}
```

`KVStore` API: `get` · `set(key, value, ttl?)` · `has` · `delete` · `keys` ·
`clear` · `namespace(prefix)` · `getOrSet(key, factory, ttl?)`. TTL accepts ms or
a duration (`"10m"`). Namespaces isolate keys without a second backend:

```ts
const guildStore = store.namespace(ctx.guildId!);   // keys scoped to this guild
await guildStore.set("prefix", "!");

// Type your store end to end by augmenting ServiceMap:
declare module "@ix-xs/djs-bot" {
  interface ServiceMap { store: KVStore<number> }
}
```

You can also register a store from a `*.service.ts` file with `defineStore`:

```ts
import { defineStore, sqliteStore } from "@ix-xs/djs-bot";
export const Store = defineStore("store", sqliteStore("data/bot.sqlite"));
```

## 37. Resilience (rate limits, circuit breakers, retry)

Production primitives for services that hit databases or third-party APIs.

### Rate limiting

More expressive than `cooldown` (which is one use per duration): allow **N per
window**. Use the guard, or the limiter directly.

```ts
import { rateLimit, createRateLimiter } from "@ix-xs/djs-bot";

// As a guard: 5 uses per minute, per user
guards: [rateLimit({ limit: 5, window: "1m" })]                 // or { scope: "guild" }

// Directly:
const limiter = createRateLimiter({ limit: 100, window: "1h" });
const { allowed, remaining, resetMs } = limiter.consume(apiKey);
if (!allowed) throw new Error(`Slow down for ${resetMs}ms`);
```

### Circuit breaker

After too many failures it "opens" and fails fast, protecting a struggling
dependency, then tries again before recovering.

```ts
import { createCircuitBreaker, CircuitOpenError } from "@ix-xs/djs-bot";

const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeout: "30s" });

try {
  const data = await breaker.execute(() => fetchFromFlakyApi());
} catch (err) {
  if (err instanceof CircuitOpenError) {
    // fail fast - the API is currently down
  }
}
```

### Retry & timeout

```ts
import { retry, timeout } from "@ix-xs/djs-bot";

const data = await retry(() => fetchFromApi(), { attempts: 5, delay: 300, backoff: 2 });
const fast = await timeout(fetchFromApi(), 5000, "API too slow");
```

Combine them in a service for a hardened external call:

```ts
export const Weather = defineService("weather", {
  factory: () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3, resetTimeout: "1m" });
    return {
      get: (city: string) =>
        breaker.execute(() => timeout(retry(() => fetchWeather(city), { attempts: 3 }), 4000)),
    };
  },
});
```

## 38. Audit trail (`ctx.audit`)

Keep a structured, queryable record of who did what. Configure one or more
**sinks** (in-memory, a `KVStore`, or the logger); optionally record every
command automatically.

```ts
import { defineBot, env, memoryStore, loggerAuditSink, storeAuditSink } from "@ix-xs/djs-bot";

const store = memoryStore();
const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  audit: {
    sinks: [loggerAuditSink(), storeAuditSink(store)],
    autoRecordCommands: true,   // logs every command as "command:<name>"
  },
});
```

In handlers, `ctx.audit` fills in the actor and guild for you:

```ts
run: async (ctx) => {
  await ctx.guild!.members.ban(ctx.options.user);
  await ctx.audit("member.ban", {
    targetId: ctx.options.user.id,
    metadata: { reason: ctx.options.reason },
  });
}
```

Query it (from an admin command, say) via the `audit` service:

```ts
const audit = ctx.services.audit as import("@ix-xs/djs-bot").AuditLog;
const recentBans = await audit.query({ action: "member.ban", guildId: ctx.guildId!, limit: 10 });
```

Filters: `action`, `actorId`, `guildId`, `since`, `limit` (results newest-first).
Sinks: `memoryAuditSink(max)`, `storeAuditSink(store, { namespace, ttl })`,
`loggerAuditSink(logger?)` - or implement `AuditSink` yourself.

## 39. Feature flags per guild

Turn features/commands on or off at runtime, globally or **per guild**, persisted
in a `KVStore`. Resolution: guild override → global override → declared default.

```ts
const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  store: sqliteStore("data/bot.sqlite"),
  flags: { defaults: { economy: true, beta: false } }, // reuses the bot's `store` automatically
});
```

Gate a command with the guard (fail-open if flags aren't configured):

```ts
import { featureEnabled } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "shop",
  description: "Open the shop",
  guards: [featureEnabled("economy")],   // disabled guilds get a friendly message
  run: (ctx) => ctx.reply.info("🛒 …"),
});
```

Toggle at runtime via the `flags` service (e.g. from an admin command):

```ts
const flags = ctx.services.flags as import("@ix-xs/djs-bot").FeatureFlags;
await flags.disable("economy", { guildId: ctx.guildId! });  // off in this guild
await flags.enable("beta");                                 // on globally
const effective = await flags.list(ctx.guildId!);           // { economy: false, beta: true }
```

Use `createFeatureFlags()` standalone anywhere you don't want it on the bot.

## 40. Health checks & metrics

Expose an HTTP health server for Docker/Kubernetes - zero dependencies.

```ts
const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  health: 3000,          // a port, or { port, host }
});
```

Endpoints:

| Route | Meaning |
| --- | --- |
| `GET /healthz` | `200` while the process is alive (liveness) |
| `GET /readyz` | `200` when the gateway is connected, else `503` (readiness) |
| `GET /metrics` | `200` JSON: uptime, interaction/command/error counts, guilds, shard |

```jsonc
// GET /metrics
{
  "ready": true,
  "uptimeMs": 84213,
  "metrics": { "interactions": 1240, "commands": 830, "errors": 3, "guilds": 57 },
  "shard": { "id": 0, "count": 4 }
}
```

Kubernetes probes:

```yaml
livenessProbe:  { httpGet: { path: /healthz, port: 3000 } }
readinessProbe: { httpGet: { path: /readyz,  port: 3000 } }
```

Need the server standalone? `startHealthServer(() => status, { port })`.

---

Need something not shown here (Redis persistence, audio playback via
`@discordjs/voice`, custom REST calls)? Persistence is a `KVStore` you can
implement over anything, audit/flags accept any backing store, and everything
else builds on discord.js directly through `ctx.interaction` / `ctx.client` -
the framework never locks you in.
