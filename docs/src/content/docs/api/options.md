---
title: "Options & schemas (s, p, field)"
description: "Every command option type, every customId param codec, and every modal component."
sidebar:
  order: 5
---

Three tiny builder objects describe the three kinds of typed input:

| Builder | Describes | Read back as |
| --- | --- | --- |
| `s` | Slash-command options | `ctx.options` |
| `p` | customId parameters | `ctx.params` |
| `field` | Modal components | `ctx.fields` |

All three are **type-driven**: what you declare is exactly what the handler
receives, with no casting and no `as`.

## `s` - command options

```ts
import { s } from "@ix-xs/djs-bot";

options: {
  target: s.user({ description: "Who", required: true }),  // ctx.options.target: User
  reason: s.string({ description: "Why" }),                // ctx.options.reason: string | undefined
}
```

`required: true` makes the value non-nullable in `ctx.options`; anything else
makes it `T | undefined`. That single flag drives both Discord and TypeScript.

### Every option type

| Builder | `ctx.options` type | Notes |
| --- | --- | --- |
| `s.string(config?)` | `string` | Supports `minLength`, `maxLength`, `choices`, `autocomplete`. |
| `s.integer(config?)` | `number` | Whole numbers. Supports `min`, `max`, `choices`, `autocomplete`. |
| `s.number(config?)` | `number` | Floating point. Same extras as `integer`. |
| `s.boolean(config?)` | `boolean` | A true/false toggle. |
| `s.user(config?)` | `User` | Any user, including one not in the server. |
| `s.member(config?)` | `GuildMember` | Guild-only. |
| `s.channel(config?)` | `GuildBasedChannel` | Supports `channelTypes`. |
| `s.role(config?)` | `Role` | |
| `s.mentionable(config?)` | `Role \| User \| GuildMember` | Whatever the user picks. |
| `s.attachment(config?)` | `Attachment` | An uploaded file. Supports `fileTypes`. |

### Common config

Accepted by every builder:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `description` | `string` | `"No description provided."` | Shown in the picker. |
| `required` | `boolean` | `false` | Drives both Discord and the inferred type. |
| `nameLocalizations` | `LocalizationMap` | - | Per-locale option names. |
| `descriptionLocalizations` | `LocalizationMap` | - | Per-locale descriptions. |

### Type-specific config

| Builder | Extra fields |
| --- | --- |
| `s.string` | `minLength`, `maxLength`, `choices: { name, value: string }[]`, `autocomplete` |
| `s.integer`, `s.number` | `min`, `max`, `choices: { name, value: number }[]`, `autocomplete` |
| `s.channel` | `channelTypes: ChannelType[]` |
| `s.attachment` | `fileTypes: ("image" \| "video" \| "audio" \| ".ext")[]`, up to 10 |

```ts
options: {
  plan: s.string({
    description: "Subscription plan",
    required: true,
    choices: [
      { name: "Free", value: "free" },
      { name: "Pro", value: "pro" },
    ],
  }),
  amount: s.integer({ description: "How many", min: 1, max: 100 }),
  target: s.channel({ description: "Where", channelTypes: [ChannelType.GuildText] }),
}
```

Restrict what a user may attach with `fileTypes`: Discord filters the file
picker and refuses anything else. Matching is on the file extension only, so
still check `contentType` if the type really matters.

```ts
options: {
  avatar: s.attachment({ description: "Your picture", required: true, fileTypes: ["image"] }),
  report: s.attachment({ description: "The report", fileTypes: [".pdf", ".docx"] }),
}
```

:::tip[Strings can span several lines]
Since September 2026 users can type line breaks into a string option. If a value
ends up somewhere single-line (an embed title, a channel name), strip them:
`value.replace(/\s+/g, " ")`.
:::

:::note[choices vs autocomplete]
`choices` is a fixed list of up to 25 values Discord renders itself. Use
`autocomplete` when the list is dynamic, user-specific or longer than 25.
They are mutually exclusive.
:::

### Autocomplete

`autocomplete` takes a handler, called on every keystroke, that returns the
suggestions to show:

```ts
options: {
  song: s.string({
    description: "Search the library",
    required: true,
    autocomplete: async (ctx) => {
      const results = await ctx.services.music.search(ctx.value);
      return results.map((song) => ({ name: song.title, value: song.id }));
    },
  }),
}
```

The handler receives an [`AutocompleteContext`](/api/context/#autocompletecontext)
and may return `{ name, value }[]`, `string[]` or `number[]`.

| Rule | What the framework does |
| --- | --- |
| At most 25 suggestions | Sends the first 25. |
| Names of 1 to 100 characters | Cuts a longer name, leaves out an empty one. |
| The value has the type of the option | Converts it: a number for `s.integer` / `s.number`, text for `s.string`. |
| A text value of at most 100 characters | Leaves the suggestion out. |
| An answer within 3 seconds, not deferrable | Nothing: keep the lookup fast, or cache it with [`TTLCache`](/api/cache/). |

Suggestions left out are reported once per option in the logs. A handler that
throws is logged and answers an empty list.

Make suggestions depend on what was already filled in with `ctx.options`:

```ts
item: s.string({
  autocomplete: (ctx) => ctx.services.shop.search(ctx.options.category, ctx.value),
}),
```

`toAutocompleteChoices(result, kind?)` is the function that applies these
rules. It is exported for the rare bot that answers autocomplete itself
(`autocomplete: true` marks the option and leaves the answer to your own
`interactionCreate` listener):

```ts
const { choices, dropped } = toAutocompleteChoices(rows, "string");
await interaction.respond(choices);
```

:::caution[A suggestion is not a validation]
The user can ignore the list and submit what they typed. Validate the value
again in `run`.
:::

## `p` - customId params

Discord round-trips exactly one piece of state for a component: its `customId`,
capped at **100 characters**. `p` codecs turn that into typed data instead of a
fragile `split("_")`.

| Codec | Type | Wire format |
| --- | --- | --- |
| `p.string` | `string` | as-is |
| `p.number` | `number` | decimal string |
| `p.boolean` | `boolean` | `"1"` / `"0"` |
| `p.oneOf("a", "b")` | `"a" \| "b"` | as-is |

```ts
export const Close = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, notify: p.boolean },
  run: (ctx) => {
    ctx.params.ticketId;  // string
    ctx.params.notify;    // boolean
  },
});

Close.build({ ticketId: "42", notify: true });   // typed - a typo will not compile
```

`p.oneOf` narrows a string to a fixed set, so one handler can serve several
buttons and stay exhaustive:

```ts
export const Decide = defineButton({
  id: "request:decide",
  params: { requestId: p.string, action: p.oneOf("approve", "reject") },
  run: (ctx) => {
    ctx.params.action;   // "approve" | "reject"
  },
});
```

A customId is client-supplied data. If a tampered value does not belong to the
set, it decodes to the first one rather than to something unexpected.

:::caution[The 100-character limit]
Exceeding it throws [`DJSBOT_E020`](/api/errors/#djsbot_e020) at build
time, not silently at runtime. For large state, store it and keep only a short
key in the customId:

```ts
const key = crypto.randomUUID().slice(0, 8);
await ctx.services.store.set(`draft:${key}`, bigObject, "10m");
Confirm.build({ key });
```
:::

Custom codecs are just objects, so you can add your own:

```ts
const date: ParamCodec<Date> = {
  type: "number",
  encode: (d) => String(d.getTime()),
  decode: (raw) => new Date(Number(raw)),
};
```

## `field` - modal components

A modal holds 1 to 5 components. Every interactive one is rendered inside a
labelled block, so each takes a `label` and an optional `description`.

| Builder | `ctx.fields.x` | Renders |
| --- | --- | --- |
| `field.short(cfg)` | `string` | A single-line text input |
| `field.paragraph(cfg)` | `string` | A multi-line textarea |
| `field.select(cfg)` | `string[]` | A dropdown of your own options (1-25) |
| `field.users(cfg)` | `Collection<string, User>` | A user picker |
| `field.roles(cfg)` | `Collection<string, Role>` | A role picker |
| `field.channels(cfg)` | `Collection<string, GuildBasedChannel>` | A channel picker |
| `field.mentionables(cfg)` | `{ users, members, roles }` | A picker for users and roles together |
| `field.files(cfg)` | `Collection<string, Attachment>` | A file upload |
| `field.radio(cfg)` | `string`, or `string \| undefined` when optional | Radio buttons, pick one of 2-10 |
| `field.checkboxes(cfg)` | `string[]` | Checkboxes, pick several of 1-10 |
| `field.checkbox(cfg)` | `boolean` | A single tick box |
| `field.text(markdown)` | *absent* | A block of text between fields |

```ts
export const Apply = defineModal({
  id: "staff:apply",
  title: "Staff application",
  fields: {
    why: field.paragraph({ label: "Why you?", required: true, maxLength: 800 }),
    timezone: field.select({
      label: "Timezone",
      required: true,
      options: [
        { label: "Europe", value: "eu", emoji: "🇪🇺" },
        { label: "Americas", value: "am" },
      ],
    }),
    availability: field.radio({
      label: "Availability",
      required: true,
      options: [
        { label: "Weekdays", value: "week" },
        { label: "Weekends", value: "weekend" },
      ],
    }),
    cv: field.files({ label: "CV", description: "PDF or image", maxValues: 1 }),
    rules: field.checkbox({ label: "I have read the rules" }),
  },
  run: (ctx) => {
    ctx.fields.why;            // string
    ctx.fields.timezone;       // string[]
    ctx.fields.availability;   // string (required, so never undefined)
    ctx.fields.cv;             // Collection<string, Attachment>
    ctx.fields.rules;          // boolean
  },
});
```

### Options shared by labelled fields

| Config | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | - | **Required.** Shown above the component. |
| `description` | `string` | - | Smaller help text under the label. |
| `required` | `boolean` | `false` | Whether it must be filled. Not available on `checkbox`. |

### Per-kind options

| Kind | Extra options |
| --- | --- |
| `short`, `paragraph` | `placeholder`, `minLength`, `maxLength`, `value` (pre-filled) |
| `select` | `options`, `placeholder`, `minValues`, `maxValues` |
| `users`, `roles` | `placeholder`, `minValues`, `maxValues`, `defaultValues` (ids) |
| `channels` | the same, plus `channelTypes` |
| `mentionables` | `placeholder`, `minValues`, `maxValues` |
| `files` | `minValues`, `maxValues` (up to 10), `fileTypes` (`"image"`, `"video"`, `"audio"` or `".pdf"`-style extensions, up to 10) |
| `radio` | `options` |
| `checkboxes` | `options`, `minValues`, `maxValues` |
| `checkbox` | `default` (ticked when the modal opens) |

A choice (`FieldChoice`) is `{ label, value, description?, default?, emoji? }`;
`emoji` applies to `select` only.

### Things to know

- Pickers and uploads always resolve to a collection, **empty** when nothing was
  chosen: no `null` to check.
- Text values are plain strings. Parse and validate them yourself.
- A modal that breaks Discord's limits fails at definition time with
  [`DJSBOT_E014`](/api/errors/#djsbot_e014): a label over 45 characters, a
  description or option text over 100, a placeholder over 100 (text) or 150
  (pickers), a text length outside 0-4000, more than 10 files.
- These components need discord.js 14.27 or newer.

## Type helpers

Rarely needed directly, but exported for building your own abstractions:

| Type | Use |
| --- | --- |
| `InferOptions<M>` | The `ctx.options` shape for an option map. |
| `InferParams<M>` | The `ctx.params` shape for a param map. |
| `InferFields<M>` | The `ctx.fields` shape for a field map. |
| `FieldKind`, `FieldChoice`, `FieldOutput` | Modal component kinds, a choice entry, and the value each kind resolves to. |
| `FileType` | An entry of a `fileTypes` filter. |
| `OptionKind`, `OptionDef`, `OptionMap` | Option descriptors. |
| `ParamCodec`, `ParamMap` | Param codecs. |
| `FieldDef`, `FieldMap` | Field descriptors. |

```ts
const banOptions = {
  target: s.user({ required: true }),
  reason: s.string(),
} satisfies OptionMap;

function formatBan(options: InferOptions<typeof banOptions>) {
  return `${options.target.tag}: ${options.reason ?? "no reason"}`;
}
```
