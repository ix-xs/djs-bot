---
title: "Options & schemas (s, p, field)"
description: "Every command option type, every customId param codec, and modal text inputs."
sidebar:
  order: 5
---

Three tiny builder objects describe the three kinds of typed input:

| Builder | Describes | Read back as |
| --- | --- | --- |
| `s` | Slash-command options | `ctx.options` |
| `p` | customId parameters | `ctx.params` |
| `field` | Modal text inputs | `ctx.fields` |

All three are **type-driven**: what you declare is exactly what the handler
receives, with no casting and no `as`.

## `s` — command options

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
| `s.attachment(config?)` | `Attachment` | An uploaded file. |

### Common config

Accepted by every builder:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `description` | `string` | `"No description provided."` | Shown in the picker. |
| `required` | `boolean` | `false` | Drives both Discord and the inferred type. |
| `nameLocalizations` | `LocalizationMap` | — | Per-locale option names. |
| `descriptionLocalizations` | `LocalizationMap` | — | Per-locale descriptions. |

### Type-specific config

| Builder | Extra fields |
| --- | --- |
| `s.string` | `minLength`, `maxLength`, `choices: { name, value: string }[]`, `autocomplete` |
| `s.integer`, `s.number` | `min`, `max`, `choices: { name, value: number }[]`, `autocomplete` |
| `s.channel` | `channelTypes: ChannelType[]` |

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

:::note[choices vs autocomplete]
`choices` is a fixed list of up to 25 values Discord renders itself. Use
`autocomplete` when the list is dynamic, user-specific or longer than 25.
They are mutually exclusive.
:::

### Autocomplete

`autocomplete` is either `true` (you handle it elsewhere) or a handler:

```ts
options: {
  song: s.string({
    description: "Search the library",
    required: true,
    autocomplete: async (ac) => {
      const results = await ac.services.music.search(ac.value);
      return results.slice(0, 25).map((r) => ({ name: r.title, value: r.id }));
    },
  }),
}
```

The handler receives an [`AutocompleteContext`](/djs-bot/api/context/#autocompletecontext)
and may return `{ name, value }[]`, `string[]` or `number[]` — plain arrays are
mapped to choices for you. Discord accepts at most **25** suggestions.

## `p` — customId params

Discord round-trips exactly one piece of state for a component: its `customId`,
capped at **100 characters**. `p` codecs turn that into typed data instead of a
fragile `split("_")`.

| Codec | Type | Wire format |
| --- | --- | --- |
| `p.string` | `string` | as-is |
| `p.number` | `number` | decimal string |
| `p.boolean` | `boolean` | `"1"` / `"0"` |

```ts
export const Close = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, notify: p.boolean },
  run: (ctx) => {
    ctx.params.ticketId;  // string
    ctx.params.notify;    // boolean
  },
});

Close.build({ ticketId: "42", notify: true });   // typed — a typo will not compile
```

:::caution[The 100-character limit]
Exceeding it throws [`DJSBOT_E020`](/djs-bot/api/errors/#djsbot_e020) at build
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

## `field` — modal inputs

| Builder | Renders |
| --- | --- |
| `field.short(config)` | A single-line input |
| `field.paragraph(config)` | A multi-line textarea |

| Config | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | — | **Required.** Shown above the input. |
| `required` | `boolean` | `false` | Whether it must be filled. |
| `placeholder` | `string` | — | Greyed-out hint. |
| `minLength`, `maxLength` | `number` | — | Length bounds. |
| `value` | `string` | — | Pre-filled value. |

```ts
fields: {
  title: field.short({ label: "Title", required: true, maxLength: 80 }),
  body: field.paragraph({ label: "Details", placeholder: "What happened?", maxLength: 1000 }),
}
```

A modal accepts at most **5** fields, and every submitted value is a `string` —
parse and validate it yourself in the handler.

## Type helpers

Rarely needed directly, but exported for building your own abstractions:

| Type | Use |
| --- | --- |
| `InferOptions<M>` | The `ctx.options` shape for an option map. |
| `InferParams<M>` | The `ctx.params` shape for a param map. |
| `InferFields<M>` | The `ctx.fields` shape for a field map. |
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
