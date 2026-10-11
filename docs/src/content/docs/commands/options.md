---
title: "Options and autocomplete"
description: "Options are the inputs of a slash command. The s builders declare them once, for Discord and for TypeScript, and an autocomplete handler suggests values while the user types."
sidebar:
  order: 2
---

`s` is one of three small builder objects. `s` describes command options
(`ctx.options`), `p` describes the parameters carried by a
[button](/components/buttons/) (`ctx.params`) and `field` describes the
components of a [modal](/components/modals/) (`ctx.fields`). All three work the
same way: what you declare is what the handler receives, with no casting.

## A first option

```ts title="features/general/repeat.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "repeat",
  description: "Repeat a message",
  options: {
    text: s.string({ description: "What to repeat", required: true, maxLength: 200 }),
    times: s.integer({ description: "How many times", min: 1, max: 5 }),
  },
  run: (ctx) => {
    // ctx.options.text:  string               (required)
    // ctx.options.times: number | undefined   (optional)
    const times = ctx.options.times ?? 1;
    return ctx.reply(Array(times).fill(ctx.options.text).join("\n"));
  },
});
```

The key of each entry is the option name the user sees. The framework reads the
value from the interaction, resolves it (a user id becomes a `User`, a channel
id becomes a channel) and puts it in `ctx.options` under the same key.

`required: true` makes the value non-optional in `ctx.options`. Anything else
makes it `T | undefined`. That one flag drives both Discord and TypeScript.

## Every option type

| Builder | `ctx.options` type | Extra settings | Notes |
| --- | --- | --- | --- |
| `s.string()` | `string` | `minLength`, `maxLength`, `choices`, `autocomplete` | Text. |
| `s.integer()` | `number` | `min`, `max`, `choices`, `autocomplete` | Whole numbers. |
| `s.number()` | `number` | `min`, `max`, `choices`, `autocomplete` | Decimals allowed. |
| `s.boolean()` | `boolean` | | A true/false toggle. |
| `s.user()` | `User` | | Any user, including one who is not in the server. |
| `s.member()` | `GuildMember` | | The picked user, as a member of the server. |
| `s.channel()` | `GuildBasedChannel` | `channelTypes` | A channel of the server. |
| `s.role()` | `Role` | | |
| `s.mentionable()` | `Role \| User \| GuildMember` | | Whatever the user picks: a user or a role. |
| `s.attachment()` | `Attachment` | `fileTypes` | An uploaded file. |

Every builder also accepts `description`, `required` and the two localization
maps: see the [reference](#reference).

Two things are handled for you:

- **Order.** Discord rejects a command whose optional options come before
  required ones. Required options are sent first at deploy time, so the order
  you write them in never matters.
- **Description.** An option without a `description` is deployed with
  `"No description provided."`. Write one anyway: it is the only help the user
  gets in the picker.

:::note[`s.member()` and users who are not members]
Discord has no "member" option type, so `s.member()` is deployed as a user
option and resolved to a member afterwards. When the picked user is not in the
server, or the command runs outside a server, a required option refuses the
command before the handler runs, with the `notAMember`
[message](/basics/wording-and-theme/) ("That user is not a member of this
server."). A required member is therefore never `undefined` in the handler. An
optional `s.member()` is `undefined` in that case.
:::

## Choices and ranges

Most invalid input can be refused by Discord before it reaches your handler.

```ts title="features/shop/subscribe.command.ts"
import { defineCommand, s, ChannelType } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "subscribe",
  description: "Subscribe a channel to a plan",
  options: {
    plan: s.string({
      description: "Subscription plan",
      required: true,
      choices: [
        { name: "Free", value: "free" },
        { name: "Pro", value: "pro" },
      ],
    }),
    seats: s.integer({ description: "How many seats", min: 1, max: 100 }),
    channel: s.channel({ description: "Where to post", channelTypes: [ChannelType.GuildText] }),
    logo: s.attachment({ description: "Your logo", fileTypes: ["image"] }),
    contract: s.attachment({ description: "The signed contract", fileTypes: [".pdf", ".docx"] }),
  },
  run: (ctx) => ctx.reply.success(`Plan: ${ctx.options.plan}, seats: ${ctx.options.seats ?? 1}`),
});
```

- `choices` is a fixed list of up to 25 values that Discord renders itself. The
  user sees `name`, your handler receives `value`. The type stays `string` or
  `number`: it is not narrowed to the listed values.
- `min` and `max` bound a number. `minLength` and `maxLength` bound a text.
- `channelTypes` limits the channel picker to the types you list.
- `fileTypes` limits what may be attached: `"image"`, `"video"`, `"audio"`, or
  an extension such as `".pdf"`. Discord filters the file picker and refuses
  anything else. Matching is on the file extension only, so still check
  `contentType` if the type really matters. Reading the uploaded file is
  covered in [Embeds and attachments](/messages/embeds-and-attachments/).

:::tip[Strings can span several lines]
Since September 2026 users can type line breaks into a string option. If a
value ends up somewhere single-line (an embed title, a channel name), strip
them: `value.replace(/\s+/g, " ")`.
:::

## Autocomplete

A list of `choices` stops at 25 values and cannot change. When the list is
long, comes from a database or depends on who is typing, give the option an
`autocomplete` handler instead. It is called on every keystroke and returns the
suggestions to show. It works on `s.string`, `s.integer` and `s.number`, in
commands and in [subcommands](/commands/subcommands/). An option takes either
`choices` or `autocomplete`, never both.

```ts title="features/fruit/fruit.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

const FRUITS = ["apple", "apricot", "banana", "cherry"];

export default defineCommand({
  name: "fruit",
  description: "Pick a fruit",
  options: {
    name: s.string({
      description: "Fruit",
      required: true,
      autocomplete: (ctx) => FRUITS.filter((fruit) => fruit.startsWith(ctx.value.toLowerCase())),
    }),
  },
  run: (ctx) => ctx.reply.success(`You picked ${ctx.options.name}`),
});
```

`ctx.value` is what the user has typed so far. The `ctx` of an autocomplete
handler is typed, with nothing to annotate, and it is not a command context:
there is no `ctx.reply`, the handler returns the suggestions instead. Its
properties are listed under [`AutocompleteContext`](#autocompletecontext).

The handler may return any of these, directly or as a promise:

| Return | Shown as | Sent to your command as |
| --- | --- | --- |
| `["apple", "banana"]` | `apple`, `banana` | the same text |
| `[10, 20]` | `10`, `20` | the same number |
| `[{ name: "Apple (3 left)", value: "apple" }]` | `Apple (3 left)` | `"apple"` |

To make suggestions depend on an option the user has already filled in, read it
from `ctx.options`:

```ts
options: {
  category: s.string({ description: "Category", required: true, choices: CATEGORIES }),
  item: s.string({
    description: "Item",
    required: true,
    autocomplete: async (ctx) => {
      const items = await ctx.services.shop.search(ctx.options.category, ctx.value);
      return items.map((item) => ({ name: `${item.label} - ${item.price} coins`, value: item.id }));
    },
  }),
}
```

While the user types, Discord has not resolved anything yet. `ctx.options`
holds text, numbers and booleans as such, and only the **id** of a user, role,
channel, mentionable or attachment.

To test a handler without Discord, call
`h.autocomplete(command, { option, value, options })` from the harness
described in [Testing](/production/testing/).

## Autocomplete rules

One invalid suggestion makes Discord refuse the whole list, so the framework
makes each one valid before sending it:

| Discord's rule | What the framework does |
| --- | --- |
| At most 25 suggestions | Sends the first 25. |
| A name of 1 to 100 characters | Cuts a longer name, leaves out an empty one. |
| The value has the type of the option | Converts it: a number for `s.integer` and `s.number`, text for `s.string`. Leaves out what cannot be converted, such as `"abc"` for a number. |
| A text value of at most 100 characters | Leaves the suggestion out. |
| An answer within 3 seconds, not deferrable | Nothing: this part is yours. |

Suggestions that had to be left out are reported in the logs, once per option
rather than on every keystroke.

Three things remain your responsibility:

- **Keep it fast.** Discord waits 3 seconds at most and an autocomplete answer
  cannot be deferred. Query an index or a cache, not a slow API. `TTLCache`,
  described in [Cache and entity resolution](/data/cache/), is made for this.
- **Failures are silent for the user.** If the handler throws, the error is
  logged and an empty list is shown, so a failing lookup never breaks the
  command.
- **A suggestion is not a validation.** The user can ignore the list and send
  whatever they typed. Check the value again in `run`.

## Reference

### `s`

The object holding the ten builders listed in
[Every option type](#every-option-type). Each one takes an optional config
object and returns an option descriptor (`OptionDef`). These settings are
accepted by every builder:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `description` | `string` | `"No description provided."` | Shown under the option in the picker. 1-100 characters. |
| `required` | `boolean` | `false` | Whether the user must fill the option in. Drives the inferred type. |
| `nameLocalizations` | `LocalizationMap` | - | Option name per locale. See [Localized names](/commands/slash-commands/#localized-names). |
| `descriptionLocalizations` | `LocalizationMap` | - | Description per locale. |

`s.boolean`, `s.user`, `s.member`, `s.role` and `s.mentionable` accept nothing
else.

### `s.string(config?)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `minLength` | `number` | - | Shortest text accepted, 0-6000. |
| `maxLength` | `number` | - | Longest text accepted, 1-6000. |
| `choices` | `{ name: string; value: string }[]` | - | A fixed list of up to 25 values. Excludes `autocomplete`. |
| `autocomplete` | `AutocompleteHandler \| boolean` | - | A handler returning suggestions. `true` only marks the option, see [`toAutocompleteChoices`](#toautocompletechoicesresult-kind). |

### `s.integer(config?)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `min` | `number` | - | Smallest value accepted. |
| `max` | `number` | - | Largest value accepted. |
| `choices` | `{ name: string; value: number }[]` | - | A fixed list of up to 25 values. Excludes `autocomplete`. |
| `autocomplete` | `AutocompleteHandler \| boolean` | - | As for `s.string`. `ctx.value` is still text, the suggestions are sent as numbers. |

### `s.number(config?)`

The same settings as `s.integer`. The value may have decimals.

### `s.channel(config?)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `channelTypes` | `ChannelType[]` | every type | Only offer channels of these types, for example `[ChannelType.GuildText]`. |

### `s.attachment(config?)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `fileTypes` | `FileType[]` | any file | Up to 10 entries, each `"image"`, `"video"`, `"audio"` or a dot-prefixed extension such as `".pdf"`. |

### `AutocompleteContext`

What an `autocomplete` handler receives.

| Property | Type | Description |
| --- | --- | --- |
| `value` | `string` | What the user has typed so far, always as text. `""` when the field was just opened. |
| `focused` | `string` | The name of the option being typed. |
| `options` | `AutocompleteOptions` | What is filled in so far, by option name, the option being typed included. Text, numbers and booleans as such, the id of a user, role, channel, mentionable or attachment. An option left empty is absent. Inside a subcommand, these are the options of that subcommand. |
| `user` | `User` | Who is typing. |
| `guild` | `Guild \| null` | The server, when it is cached. |
| `guildId` | `string \| null` | The server id. `null` in DMs. |
| `channelId` | `string \| null` | The channel id. |
| `services` | `ServiceMap` | Your services, as in a command. |
| `logger` | `Logger` | Tagged with the correlation id and the option name. |
| `client` | `Client<true>` | The connected client. |
| `locale` | `string` | The user's Discord language. |
| `t(key, vars?)` | `string` | Translates for that language, to localize suggestion names. Returns the key when i18n is not configured. |
| `interaction` | `AutocompleteInteraction` | The raw discord.js interaction. |

A handler has the type `AutocompleteHandler`. It returns an
`AutocompleteResult`, which is `AutocompleteChoice[]` (`{ name, value }`),
`string[]` or `number[]`, directly or as a promise.

### `toAutocompleteChoices(result, kind?)`

The function that applies the [autocomplete rules](#autocomplete-rules). It is
exported for the rare bot that answers autocomplete itself: passing
`autocomplete: true` only marks the option, the framework then stays out of the
way and you answer from your own `interactionCreate` listener.

```ts title="features/search/search-autocomplete.event.ts"
import { defineEvent, toAutocompleteChoices } from "@ix-xs/djs-bot";

export default defineEvent("interactionCreate", async (interaction, ctx) => {
  if (!interaction.isAutocomplete() || interaction.commandName !== "search") return;

  const rows = await ctx.services.library.search(interaction.options.getFocused());
  const { choices, dropped } = toAutocompleteChoices(rows, "string");
  if (dropped > 0) ctx.logger.warn({ dropped }, "suggestions left out");
  await interaction.respond(choices);
});
```

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `result` | `unknown` | required | What a handler returned. Anything that is not an array gives an empty list. |
| `kind` | `"string" \| "integer" \| "number"` | `"string"` | The kind of the option being completed. Decides the type of the values. |

It returns a `NormalizedChoices`: `choices` (at most 25, ready for
`interaction.respond`) and `dropped` (how many suggestions were left out).
A name longer than 100 characters is cut and ends with `...`. A suggestion
without a `name` uses its value as the name. For `"integer"`, a value with
decimals is left out.

### Type helpers

Rarely needed directly, but exported for building your own abstractions.

| Type | Use |
| --- | --- |
| `InferOptions<M>` | The `ctx.options` shape for an option map. |
| `OptionMap` | A map of option name to descriptor, as passed to `options`. |
| `OptionDef` | One option descriptor, as returned by an `s` builder. |
| `OptionKind` | The ten option kinds: `"string"`, `"integer"` and so on. |
| `FileType` | An entry of a `fileTypes` filter. |
| `AutocompleteHandler`, `AutocompleteResult`, `AutocompleteChoice` | The handler, what it returns, and one suggestion. |
| `AutocompleteOptions` | The type of `ctx.options` in an autocomplete handler. |
| `NormalizedChoices` | What `toAutocompleteChoices` returns. |

```ts title="features/moderation/ban-options.ts"
import { s, type InferOptions, type OptionMap } from "@ix-xs/djs-bot";

export const banOptions = {
  target: s.user({ description: "Who to ban", required: true }),
  reason: s.string({ description: "Why" }),
} satisfies OptionMap;

export function formatBan(options: InferOptions<typeof banOptions>): string {
  return `${options.target.tag}: ${options.reason ?? "no reason"}`;
}
```

## Limits and errors

These are checked when the command is defined, and raise an error that names
the command and the option.

| Rule | Limit | Error |
| --- | --- | --- |
| Option name | 1-32 characters, lowercase, letters, digits, `-` and `_` | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| Option description, longest localization included | 1-100 characters | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Options per command or subcommand | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Choices per option | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Choice name | 1-100 characters | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Choice value, when it is text | 100 characters | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| `choices` together with `autocomplete` | not allowed | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| `minLength` / `maxLength` | 0-6000 / 1-6000, and `minLength` not above `maxLength` | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| `min` / `max` | `min` not above `max` | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| `fileTypes` | 10 entries, each a category or an extension | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |

Option names, descriptions and choices also count towards the 8000 characters
allowed for a whole command: see
[Slash commands](/commands/slash-commands/#limits-and-errors).

Autocomplete has no definition-time errors. Its limits (25 suggestions, names
of 1-100 characters, 3 seconds to answer) are handled at runtime as described
in [Autocomplete rules](#autocomplete-rules).

## See also

- [Slash commands](/commands/slash-commands/)
- [Subcommands](/commands/subcommands/)
- [Cache and entity resolution](/data/cache/)
- [Embeds and attachments](/messages/embeds-and-attachments/)
- [Testing](/production/testing/)
