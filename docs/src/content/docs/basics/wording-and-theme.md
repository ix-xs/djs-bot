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
[table of keys](/reference/framework-messages/) lists which variables each message
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

Every option, property and type, with what it accepts and returns, is in the API reference:

- `FrameworkMessages`: The overridable message table accepted by `defineBot({ messages })`.
- `defineBot()`: Creates a `Bot`.
- `MessageValue`: One message: a template string with `{placeholders}`, or a function for full control (translation, pluralisation).
- `inGuild()`: Requires the interaction to happen inside a guild.
- `dmOnly()`: Requires the interaction to happen in DMs.
- `hasPermission()`: Requires the invoking member to have all of the given permissions **in the current channel** (channel overwrites included, as computed by Discord).
- `botHasPermission()`: Requires the *bot* to have all of the given permissions **in the current channel** (channel overwrites included, as computed by Discord).
- `inChannel()`: Restricts usage to specific channel ids.
- `ownerOnly()`: Restricts usage to specific user ids.
- `guildOwnerOnly()`: Restricts usage to the owner of the server the interaction happens in.
- `hasRole()`: Requires the invoking member to hold **at least one** of the given roles.
- `cooldown()`: Per-invocation cooldown.
- `rateLimit()`: A guard that allows `limit` uses per `window`, per scope (default `"user"`).
- `antiSpam()`: Rejects the interactions of a user who exceeds a per-window rate limit: commands, components and forms.

## Limits and errors

- **A more specific text wins.** A guard that fails with its own reason shows
  that reason. `antiSpam({ message })` replaces `slowDown`, and the
  `confirmLabel` and `cancelLabel` options of `confirm()` replace `confirm` and
  `cancel` for one dialog.
- **Five defaults ignore their variable.** The English `unknownCommand`,
  `unknownSubcommand`, `slowDown`, `featureDisabled` and `notAMember` sentences
  do not mention `{name}`, `{seconds}`, `{feature}` or `{option}`. Your own
  wording can.
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
