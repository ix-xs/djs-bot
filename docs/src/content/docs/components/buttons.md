---
title: "Buttons"
description: "A button is a clickable component under a message. Define it once with a routing id and typed params, build it wherever you send a message, and the click reaches your handler with those params decoded."
sidebar:
  order: 1
---

Discord gives a component one piece of state that survives until the click: its
`customId`, a string of at most 100 characters. Instead of gluing values into
that string and splitting them back, you declare typed params on the button and
the framework does both directions for you.

## A first button

A button has two halves: the definition, which holds the handler, and a call to
`build()` wherever you send the message.

```ts title="features/hello/wave.button.ts"
import { defineButton, ButtonStyle } from "@ix-xs/djs-bot";

export const WaveButton = defineButton({
  id: "hello:wave",
  label: "Wave back",
  style: ButtonStyle.Success,
  run: (ctx) => ctx.reply(`${ctx.user} waves back.`),
});
```

```ts title="features/hello/hello.command.ts"
import { defineCommand, ui } from "@ix-xs/djs-bot";
import { WaveButton } from "./wave.button.js";

export default defineCommand({
  name: "hello",
  description: "Say hello",
  run: (ctx) => ctx.reply({ content: "Hello.", components: [ui.row(WaveButton.build())] }),
});
```

The `id` is the routing key: when someone clicks, the framework reads it from
the customId and calls the `run` of the button registered under it. It has to
stay the same for as long as messages carrying the button exist, so pick a
namespaced name such as `ticket:close` and do not rename it later.

Buttons live in rows. `ui.row(...)` wraps up to five of them, see
[Components V2](/components/components-v2/) for the `ui` helpers. Files ending in
`.button.ts` are loaded automatically, see
[Project layout](/basics/project-layout/).

## Typed params

Declare `params` with the `p` codecs. `build()` then requires those values, and
`ctx.params` gives them back with the same types.

```ts title="features/tickets/close.button.ts"
import { defineButton, p, ButtonStyle } from "@ix-xs/djs-bot";

export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, ownerId: p.string },
  label: "Close",
  style: ButtonStyle.Danger,
  emoji: "🔒",
  run: async (ctx) => {
    // ctx.params: { ticketId: string; ownerId: string }
    if (ctx.user.id !== ctx.params.ownerId) {
      await ctx.reply.error("Not your ticket.");
      return;
    }
    await ctx.services.tickets.close(ctx.params.ticketId); // your own service
    await ctx.update.disable();
    await ctx.reply.success("Ticket closed 🔒", { ephemeral: true });
  },
});
```

```ts title="features/tickets/ticket.command.ts"
import { defineCommand, ui } from "@ix-xs/djs-bot";
import { CloseTicket } from "./close.button.js";

export default defineCommand({
  name: "ticket",
  description: "Open a ticket",
  run: async (ctx) => {
    const ticketId = crypto.randomUUID().slice(0, 8);
    const button = CloseTicket.build({ ticketId, ownerId: ctx.user.id });
    await ctx.reply({ content: "🎫 Ticket opened", components: [ui.row(button)] });
  },
});
```

A missing or misspelled param in `build()` does not compile, so the two halves
cannot drift apart.

| Codec | Type in `ctx.params` | Stored as |
| --- | --- | --- |
| `p.string` | `string` | the string itself |
| `p.number` | `number` | its decimal text |
| `p.boolean` | `boolean` | `"1"` or `"0"` |
| `p.oneOf("a", "b")` | `"a" \| "b"` | the string itself |

`p.oneOf` narrows a string to a fixed set, so one handler can serve several
buttons and TypeScript still knows every case:

```ts title="features/requests/decide.button.ts"
import { defineButton, p, ui, ButtonStyle } from "@ix-xs/djs-bot";

export const Decide = defineButton({
  id: "request:decide",
  params: { requestId: p.string, action: p.oneOf("approve", "reject") },
  run: async (ctx) => {
    // ctx.params.action: "approve" | "reject"
    const verdict = ctx.params.action === "approve" ? "approved" : "rejected";
    await ctx.update({ content: `Request ${ctx.params.requestId} ${verdict}.`, components: [] });
  },
});

export const decisionRow = (requestId: string) =>
  ui.row(
    Decide.build({ requestId, action: "approve" }, { label: "Approve", style: ButtonStyle.Success }),
    Decide.build({ requestId, action: "reject" }, { label: "Reject", style: ButtonStyle.Danger }),
  );
```

If a value that is not in the set comes back, it decodes to the first one
(`"approve"` here) and never to an unexpected string.

:::caution[Params come from the client]
A customId travels through the user's Discord client and is only encoded, not
encrypted or signed. Anyone can read it, and a modified client can send a
different one. Do not put a secret in it, and decide who may act in the handler
or with a [guard](/commands/guards/), not from a param such as `isAdmin`.
:::

## Label, style and state

`label`, `emoji` and `style` on the definition are defaults. The second argument
of `build()` overrides them for one button, and is the only place to disable it.

```ts
CloseTicket.build(
  { ticketId, ownerId: ctx.user.id },
  { label: "Close now", style: ButtonStyle.Secondary, disabled: locked },
);
```

The style falls back to `ButtonStyle.Primary`. A button with neither a label nor
an emoji shows its `id`, because Discord refuses an empty button.

A button that opens a URL, or one that sells one of your SKUs, has no handler
and no customId. Build those with `ui.linkButton(label, url, emoji?)` and
`ui.premiumButton(skuId)`, described in
[Components V2](/components/components-v2/).

## Answering a click

A click is an interaction like a command, so `ctx.reply` works as usual and
sends a new message. A button context adds three things:

| Call | What it does |
| --- | --- |
| `ctx.update(content)` | Edits the message the button is on. |
| `ctx.update.disable()` | Disables every component of that message. |
| `ctx.showModal(modal)` | Opens a [modal](/components/modals/) as the answer. |

[The ctx object](/basics/context/) describes them in full. A button that edits
its own message can rebuild itself with new params, which is how state moves
from one click to the next:

```ts title="features/counter/counter.button.ts"
import { defineButton, p, ui } from "@ix-xs/djs-bot";

export const Counter = defineButton({
  id: "counter:add",
  params: { count: p.number },
  label: "+1",
  defer: "update",
  run: async (ctx) => {
    const count = ctx.params.count + 1;
    await ctx.update({
      content: `Clicked ${count} times.`,
      components: [ui.row(Counter.build({ count }))],
    });
  },
});
```

Start it with `Counter.build({ count: 0 })`. Preconditions go in `guards`, the
same way as on a command: a rejected click gets an ephemeral error and `run` is
not called. See [Guards](/commands/guards/).

## How the id is encoded

The customId is the routing key alone, or the key, a `$`, and the params:

```text
ticket:close
ticket:close$WyI0MiIsIjEiXQ
```

Each value is turned into text by its codec, the texts are put in a JSON array
in the order the `params` object declares them, and the array is written in
base64url. `$` appears neither in base64url nor in a valid routing key, so the
split is unambiguous. That is the reason an `id` may not contain `$`.

Two consequences are worth knowing:

- **Names are not stored, positions are.** Renaming a param is safe. Reordering
  or removing one changes the meaning of every button already sent. Add new
  params at the end: on an older button they decode from an empty text, which
  gives `""`, `0`, `false`, or the first value of a `p.oneOf`. A button sent
  before the definition had any params arrives with an empty `ctx.params`.
- **Base64 adds a third to the length.** With the key `ticket:close`, two
  Discord ids already produce 73 of the 100 characters.

### When 100 characters is not enough

Store the payload and keep a short key in the button:

```ts
const key = crypto.randomUUID().slice(0, 8);
await ctx.services.store.set(`draft:${key}`, draft, "15m");

const row = ui.row(Publish.build({ key }));
```

The handler reads it back with `ctx.services.store.get(...)` and treats a
missing value as an expired button. See [Store](/data/store/).

## Reference

### `defineButton(input)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Stable routing key, for example `"ticket:close"`. 1-100 characters, no `$`. |
| `params` | `ParamMap` | `{}` | Typed values encoded into the customId, built with `p`. |
| `guards` | `Guard[]` | `[]` | Preconditions checked before `run`. See [Guards](/commands/guards/). |
| `style` | `ButtonStyle` | `ButtonStyle.Primary` | Default colour used by `build()`. |
| `label` | `string` | - | Default text used by `build()`. |
| `emoji` | `string` | - | Default emoji used by `build()`. |
| `defer` | `DeferOption` | the bot's `defaults.defer` | Acknowledge the click for you. `"update"` suits a button that edits its message. See [Automatic deferral](/basics/automatic-deferral/). |
| `run` | `(ctx: ButtonContext) => unknown` | required | The handler. `ctx.params` is decoded and typed. |

Returns a `ButtonDefinition`: the `id`, `params`, `guards`, `defer` and `run`
you passed, a `kind: "button"` tag the loader routes on, and `build()`.
`ButtonInput`, `ButtonDefinition` and `ButtonVisualOptions` are exported types.

### `build(params?, visual?)`

Returns a discord.js `ButtonBuilder` whose customId encodes `params`. Omit
`params` when the button declares none. `visual` is a `ButtonVisualOptions`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | the definition's `label` | The text on the button, up to 80 characters. |
| `emoji` | `string` | the definition's `emoji` | Shown before the label: a unicode emoji or `<:name:id>`. |
| `style` | `ButtonStyle` | the definition's `style` | The colour of the button. |
| `disabled` | `boolean` | `false` | Greyed out, cannot be clicked. |

The result is a real builder, so `.setDisabled(true)` and the rest of its
methods still apply.

### `p`

The param codecs: `p.string`, `p.number`, `p.boolean` and
`p.oneOf(...values)`, listed under
[Typed params](/components/buttons/#typed-params). `oneOf` is also exported on
its own. Select menus and modals take the same `params`.

### `ParamCodec<T>`

A codec is a plain object, so you can write your own. The type is exported
from `"@ix-xs/djs-bot"`:

```ts
const date: ParamCodec<Date> = {
  type: "number",
  encode: (d) => String(d.getTime()),
  decode: (raw) => new Date(Number(raw)),
};
```

| Member | Type | Description |
| --- | --- | --- |
| `type` | `"string" \| "number" \| "boolean"` | The runtime type the param decodes to. |
| `encode` | `(value: T) => string` | Turns a value into text. |
| `decode` | `(raw: string) => T` | Parses the text back. |

`ParamMap` is a record of codecs, the shape of `params`. `InferParams<M>` is the
`ctx.params` type for a `ParamMap`.

### `encodeCustomId(key, schema, values)`

Builds a customId from a routing key, a `ParamMap` and the values. Returns the
key alone when the schema is empty. Throws
[`DJSBOT_E020`](/api/errors/#djsbot_e020) past 100 characters. `build()` calls it
for you. `encodeCustomId`, `decodeCustomId` and `customIdKey` are exported for
code that handles customIds itself.

```ts
const schema = { ticketId: p.string, notify: p.boolean };
const id = encodeCustomId("ticket:close", schema, { ticketId: "42", notify: true });
decodeCustomId(id, schema); // { key: "ticket:close", params: { ticketId: "42", notify: true } }
```

### `decodeCustomId(raw, schema)`

Returns `{ key, params }`. Throws [`DJSBOT_E021`](/api/errors/#djsbot_e021)
when the part after `$` cannot be decoded. The router calls it before every
handler.

### `customIdKey(raw)`

Returns the routing key of a customId without decoding its params.

## Limits and errors

| Limit | Value |
| --- | --- |
| customId, key and params together | 100 characters, exported as `CUSTOM_ID_MAX_LENGTH` |
| Label | 80 characters |
| Buttons in a row | 5 |
| Rows in a message | 5 |

| Code | When |
| --- | --- |
| [`DJSBOT_E013`](/api/errors/#djsbot_e013) | The `id` is empty, contains `$` or is longer than 100 characters. Thrown by `defineButton`. |
| [`DJSBOT_E011`](/api/errors/#djsbot_e011) | Two buttons share an `id`. Thrown at startup. |
| [`DJSBOT_E020`](/api/errors/#djsbot_e020) | The encoded customId exceeds 100 characters. Thrown by `build()`, in the handler that sends the message, so the mistake is visible the first time that code runs. |
| [`DJSBOT_E021`](/api/errors/#djsbot_e021) | A click arrived with a payload that cannot be decoded. `run` is not called, and the click is handled like a failing handler: the user gets the error message and `onError` is called. |

A click whose routing key matches no registered button is ignored, not answered
with an error: it may belong to a collector, such as the ones behind
[`paginate` and `confirm`](/components/pagination/). If one of your own buttons
does nothing, check that its file is loaded and that the `id` was not renamed.

## See also

- [Select menus](/components/select-menus/) and [Modals](/components/modals/), which carry params the same way
- [Components V2](/components/components-v2/) for rows, link buttons and layouts
- [The ctx object](/basics/context/) for `ctx.reply`, `ctx.update` and `ctx.showModal`
- [A ticket system](/recipes/ticket-system/), a full flow built on buttons and a modal
