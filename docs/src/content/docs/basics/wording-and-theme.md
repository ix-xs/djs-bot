---
title: "Wording and theme"
description: "Reword or translate every sentence the framework itself shows to users (guard refusals, the generic error, the confirm buttons) and change the colours of the semantic replies."
sidebar:
  order: 6
---

Some messages do not come from your handlers. When a guard refuses a command,
when a handler throws, when `confirm()` shows its two buttons, the text is the
framework's. All of it goes through one table of messages, in English by
default, that you can override key by key.

## Reword a message

Pass the sentences you want to change to `messages`. Keys you leave out keep
their default wording.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  messages: {
    error: "Une erreur est survenue. L'équipe a été prévenue.",
    guildOnly: "Cette commande s'utilise sur un serveur.",
    missingPermissions: "Il te manque : {permissions}.",
    cooldown: "Patiente {seconds}s avant de recommencer.",
    confirm: "Confirmer",
    cancel: "Annuler",
  },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

A value is a template: `{seconds}`, `{permissions}` and the other placeholders
are replaced by the variables of that message. The
[table of keys](#frameworkmessages) lists which variables each message
receives. For a bot that speaks a single language, plain strings are enough.

## Translate per user

A value can also be a function. It receives the variables and, when there is
one, the `ctx` of the interaction, so it can use your translator and answer
each user in their own Discord language:

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const resources = {
  en: {
    framework: {
      error: "Something went wrong.",
      guildOnly: "This can only be used in a server.",
      cooldown: "Please wait {seconds}s.",
    },
  },
  fr: {
    framework: {
      error: "Une erreur est survenue.",
      guildOnly: "Cette commande s'utilise sur un serveur.",
      cooldown: "Patiente {seconds}s avant de recommencer.",
    },
  },
};

export default defineBot({
  token: env("DISCORD_TOKEN"),
  i18n: { defaultLocale: "en", resources },
  messages: {
    error: (_vars, ctx) => ctx?.t("framework.error") ?? "Something went wrong.",
    guildOnly: (_vars, ctx) => ctx?.t("framework.guildOnly") ?? "Server only.",
    cooldown: (vars, ctx) => ctx?.t("framework.cooldown", vars) ?? `Wait ${vars.seconds}s.`,
  },
});
```

A function is also the place for anything a template cannot express, such as
a plural:

```ts
messages: {
  cooldown: ({ seconds }) => `Wait ${seconds} second${seconds === 1 ? "" : "s"}.`,
}
```

Setting up `i18n` and `ctx.t` is covered in
[Internationalisation](/data/i18n/).

## Reuse the wording

`ctx.say(key, vars?)` renders one of these messages from your own code, with
your overrides applied. A custom guard can refuse with the same sentence as
the built-in ones:

```ts title="src/features/moderation/guards.ts"
import { fail, guard, pass } from "@ix-xs/djs-bot";

/** Passes for members who joined the server more than a week ago. */
export const establishedMember = guard("establishedMember", (ctx) => {
  if (!ctx.member) return fail(ctx.say("guildOnly"));

  const joined = ctx.member.joinedTimestamp ?? Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - joined > week ? pass() : fail(ctx.say("guardDenied"));
});
```

The key and its variables are type-checked: `ctx.say("cooldown", { seconds: 5 })`
compiles, a misspelt key or a missing variable does not.

`DEFAULT_MESSAGES` is exported when you want to read the built-in English
templates, for example to seed a translation file.

## Change the colours

`ctx.reply.success`, `ctx.reply.error`, `ctx.reply.info` and `ctx.reply.warn`
send an embed with an accent colour. `theme` changes those four colours for the
whole bot. Set only the ones you want to replace:

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  theme: { success: 0x57f287, error: 0xed4245, info: 0x5865f2, warn: 0xfee75c },
});
```

A colour is a number, usually written as a hexadecimal literal. The helpers
themselves are described in [The ctx object](/basics/context/).

## Reference

### `FrameworkMessages`

The type of `messages` in [`defineBot`](/basics/configuration/#botconfig). Every
key is optional and holds a [`MessageValue`](#messagevalue).

| Key | Variables | Default text | Shown when |
| --- | --- | --- | --- |
| `error` | none | `Something went wrong. The team has been notified.` | A handler threw and nothing handled the error. |
| `unknownCommand` | `{name}` | `Unknown command.` | A slash or context-menu command reached the bot that is not registered. |
| `unknownSubcommand` | `{name}` | `Unknown subcommand.` | A subcommand reached the bot that is not registered. `name` includes the group, if any. |
| `guardDenied` | none | `You can't do that.` | A guard failed without giving a reason. |
| `guildOnly` | none | `This can only be used in a server.` | `inGuild()` failed, or a permission guard ran outside a server. |
| `dmOnly` | none | `This can only be used in DMs.` | `dmOnly()` failed. |
| `missingPermissions` | `{permissions}` | `You need: {permissions}.` | `hasPermission()` failed. |
| `botMissingPermissions` | `{permissions}` | `I need: {permissions}.` | `botHasPermission()` failed. |
| `wrongChannel` | none | `This can't be used in this channel.` | `inChannel()` failed. |
| `ownerOnly` | none | `You can't use this.` | `ownerOnly()` failed. |
| `guildOwnerOnly` | none | `Only the server owner can use this.` | `guildOwnerOnly()` failed. |
| `missingRole` | none | `You don't have the role required for this.` | `hasRole()` failed. |
| `cooldown` | `{seconds}` | `Please wait {seconds}s before doing that again.` | `cooldown()` failed. |
| `rateLimited` | `{seconds}` | `Rate limit reached. Try again in {seconds}s.` | `rateLimit()` failed. |
| `slowDown` | `{seconds}` | `You're doing that too fast - please slow down.` | The `antiSpam` plugin refused an interaction. |
| `featureDisabled` | `{feature}` | `This feature is currently disabled here.` | `featureEnabled()` failed. |
| `confirm` | none | `Confirm` | Label of the confirm button of `confirm()`. |
| `cancel` | none | `Cancel` | Label of the cancel button of `confirm()`. |

The variables:

| Variable | Type | Value |
| --- | --- | --- |
| `name` | `string` | The command that was received, or the subcommand with its group. |
| `permissions` | `string` | The missing permissions, readable and comma-separated: `Ban Members, Kick Members`. |
| `seconds` | `number` | The remaining wait, in whole seconds, rounded up. |
| `feature` | `string` | The name of the flag that is off. |

Every message except `confirm` and `cancel` is sent with `ctx.reply.error`: an
ephemeral embed in the `error` colour of the theme.

### `MessageValue`

```ts
type MessageValue<K extends MessageKey = MessageKey> =
  | string
  | ((vars: MessageVars[K], ctx?: BaseContext) => string);
```

| Form | Behaviour |
| --- | --- |
| `string` | A template. Each `{placeholder}` that names a variable of the message is replaced by its value. Other placeholders are left as written. |
| function | Called with the variables and the `ctx`, when there is one. Its return value is used as is, without placeholder replacement. |

`MessageKey` is the union of the eighteen keys above, and `MessageVars` maps
each key to the type of its variables.

### `ctx.say(key, vars?)`

```ts
say<K extends MessageKey>(key: K, vars?: MessageVars[K]): string
```

Renders a message with the overrides of `defineBot({ messages })`, falling back
to the English default for a key you did not set.

### `DEFAULT_MESSAGES`

The built-in English wording: an object with one template string per key, with
the texts of the table above.

### `Theme`

The type behind `theme`, which accepts a `Partial<Theme>`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `success` | `number` | `0x22c55e` | Colour of `ctx.reply.success`. |
| `error` | `number` | `0xef4444` | Colour of `ctx.reply.error`, and so of every framework refusal. |
| `info` | `number` | `0x3b82f6` | Colour of `ctx.reply.info`. |
| `warn` | `number` | `0xf59e0b` | Colour of `ctx.reply.warn`. |

`DEFAULT_THEME` is exported and holds these four defaults.

## Limits and errors

- **A more specific text wins.** A guard that fails with its own reason shows
  that reason. `antiSpam({ message })` replaces `slowDown`, and the
  `confirmLabel` and `cancelLabel` options of `confirm()` replace `confirm` and
  `cancel` for one dialog.
- **Two defaults ignore their variable.** The English `slowDown` and
  `featureDisabled` sentences do not mention `{seconds}` or `{feature}`. Your
  own wording can.
- **`error` is not shown when you handle the error.** An `onError` that returns
  a value suppresses the default reply: see [Errors](/api/errors/).
- **`messages` is only for the framework's sentences.** The text your own
  handlers send is translated with `ctx.t`.

## See also

- [Guards](/commands/guards/): the built-in guards behind most of these messages.
- [Internationalisation](/data/i18n/): `ctx.t`, locales and translation files.
- [Pagination and confirmation](/components/pagination/): the `confirm()` dialog.
- [The ctx object](/basics/context/): the semantic reply helpers that use the theme.
- [Errors](/api/errors/): when the generic `error` message is sent.
