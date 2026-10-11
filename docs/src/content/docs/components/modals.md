---
title: "Modals"
description: "A modal is a pop-up form: text inputs, dropdowns, pickers, file uploads, radio buttons and checkboxes. Declare its fields once and the handler receives every submitted value already typed."
sidebar:
  order: 3
---

Use a modal when you need more from the user than command options can carry:
long text, several answers at once, or a file. You declare the fields with the
`field` builders, and `ctx.fields` is typed from what you declared.

## A first modal

```ts title="features/feedback/feedback.modal.ts"
import { defineModal, field } from "@ix-xs/djs-bot";

export const FeedbackModal = defineModal({
  id: "feedback:submit",
  title: "Send feedback",
  fields: {
    subject: field.short({ label: "Subject", required: true, maxLength: 80 }),
    body: field.paragraph({ label: "Your feedback", required: true }),
  },
  run: (ctx) => ctx.reply.success(`Thanks for "${ctx.fields.subject}".`, { ephemeral: true }),
});
```

```ts title="features/feedback/feedback.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";
import { FeedbackModal } from "./feedback.modal.js";

export default defineCommand({
  name: "feedback",
  description: "Send feedback to the team",
  run: (ctx) => ctx.showModal(FeedbackModal),
});
```

The command opens the form, and `run` on the modal is called when the user
submits it. The two are separate interactions: nothing happens on your side if
the user closes the form. The key of each field (`subject`, `body`) is the name
you read it back under.

Files ending in `.modal.ts` are loaded automatically, see
[Project layout](/basics/project-layout/).

## Field types

A modal holds 1 to 5 components. Every interactive one is drawn inside a
labelled block, so each takes a `label` and an optional `description`.

| Builder | Renders | `ctx.fields.x` |
| --- | --- | --- |
| `field.short(config)` | A single-line text input | `string` |
| `field.paragraph(config)` | A multi-line text input | `string` |
| `field.select(config)` | A dropdown of your own options (1-25) | `string[]` |
| `field.users(config)` | A user picker | `Collection<string, User>` |
| `field.roles(config)` | A role picker | `Collection<string, Role>` |
| `field.channels(config)` | A channel picker | `Collection<string, GuildBasedChannel>` |
| `field.mentionables(config)` | A picker for users and roles together | `{ users, members, roles }` |
| `field.files(config)` | A file upload | `Collection<string, Attachment>` |
| `field.radio(config)` | Radio buttons, pick one of 2-10 | `string`, or `string \| undefined` when optional |
| `field.checkboxes(config)` | Checkboxes, pick several of 1-10 | `string[]` |
| `field.checkbox(config)` | A single tick box | `boolean` |
| `field.text(content)` | A block of markdown between fields | absent |

```ts title="features/report/report.modal.ts"
import { defineModal, field } from "@ix-xs/djs-bot";

export const ReportModal = defineModal({
  id: "report:submit",
  title: "Report a problem",
  fields: {
    intro: field.text("Tell us what happened. Screenshots help a lot."),
    category: field.select({
      label: "Category",
      required: true,
      options: [
        { label: "Bug", value: "bug", emoji: "🐛" },
        { label: "Abuse", value: "abuse", description: "Someone broke the rules" },
      ],
    }),
    details: field.paragraph({ label: "Details", description: "Be specific", maxLength: 1000 }),
    proof: field.files({ label: "Screenshots", maxValues: 3, fileTypes: ["image"] }),
    urgent: field.checkbox({ label: "This is urgent" }),
  },
  run: async (ctx) => {
    const { category, details, proof, urgent } = ctx.fields;
    // category: string[]   details: string   proof: Collection<string, Attachment>   urgent: boolean
    ctx.logger.info({ category, urgent, files: proof.size, length: details.length }, "report received");
    await ctx.reply.success(`Reported as ${category[0]}.`, { ephemeral: true });
  },
});
```

A `field.text` block is display only. It counts towards the five components,
and it is left out of `ctx.fields`.

`fileTypes` restricts what may be uploaded: `"image"`, `"video"`, `"audio"`, or
an extension such as `".pdf"`. Check `contentType` on the attachment as well
when the type really matters.

## Reading the values

What `ctx.fields` holds depends only on the kind of each field:

```ts title="features/staff/apply.modal.ts"
import { defineModal, field } from "@ix-xs/djs-bot";

export const ApplyModal = defineModal({
  id: "staff:apply",
  title: "Staff application",
  fields: {
    why: field.paragraph({ label: "Why you?", required: true, maxLength: 800 }),
    availability: field.radio({
      label: "Availability",
      required: true,
      options: [
        { label: "Weekdays", value: "week" },
        { label: "Weekends", value: "weekend", default: true },
      ],
    }),
    teams: field.checkboxes({
      label: "Teams you would join",
      maxValues: 2,
      options: [
        { label: "Moderation", value: "mod" },
        { label: "Events", value: "events" },
        { label: "Support", value: "support" },
      ],
    }),
    referee: field.users({ label: "Who can vouch for you?", maxValues: 1 }),
    cv: field.files({ label: "CV", description: "PDF or image", maxValues: 1, fileTypes: ["image", ".pdf"] }),
  },
  run: async (ctx) => {
    const { why, availability, teams, referee, cv } = ctx.fields;
    // why: string            availability: string (required, so never undefined)
    // teams: string[]        referee: Collection<string, User>
    // cv: Collection<string, Attachment>
    const voucher = referee.first();
    ctx.logger.info({ availability, teams, words: why.split(/\s+/).length, cv: cv.first()?.url }, "application");
    await ctx.reply.success(
      voucher ? `Application received. We will ask ${voucher.username}.` : "Application received.",
      { ephemeral: true },
    );
  },
});
```

- **No `null` to check.** A text input left empty is `""`. Pickers and uploads
  always resolve to a collection, empty when nothing was chosen. `select` and
  `checkboxes` give an array, possibly empty. Only an optional `radio` can be
  `undefined`.
- **`required` drives the type of a radio group.** With `required: true` the
  value is a `string`, otherwise `string | undefined`.
- **`field.mentionables` splits its picks**: `{ users, members, roles }`, three
  collections. `members` holds the same users as server members when the modal
  was opened in a server.
- **Text values are plain strings.** Parse and validate them yourself.
- **A field missing from the submission resolves to its empty value** and does
  not throw. This happens when the definition changed while a user still had
  the form open.

## Opening a modal

Call `ctx.showModal(Modal)` from a command, a context menu, a button or a select
menu. [The ctx object](/basics/context/) describes `showModal` in full.

:::caution[A modal must be the first response]
Discord only accepts a modal as the first answer to an interaction. Call
`showModal` before any `ctx.reply` or defer. For the same reason a modal handler
has no `ctx.showModal`: one modal cannot open another. If
[automatic deferral](/basics/automatic-deferral/) is on, open the modal before
any slow work, or set `defer: false` on the definition that opens it.
:::

A modal can carry typed `params` in its customId, like a
[button](/components/buttons/). They are passed as the second argument of
`showModal`, checked at compile time, and come back in `ctx.params`:

```ts title="features/tickets/rename.modal.ts"
import { defineButton, defineModal, field, p } from "@ix-xs/djs-bot";

export const RenameTicket = defineModal({
  id: "ticket:rename",
  title: "Rename ticket",
  params: { ticketId: p.string },
  fields: {
    subject: field.short({ label: "New subject", required: true, maxLength: 80 }),
  },
  run: async (ctx) => {
    await ctx.services.store.set(`ticket:${ctx.params.ticketId}:subject`, ctx.fields.subject);
    await ctx.reply.success("Subject updated.", { ephemeral: true });
  },
});

export const RenameButton = defineButton({
  id: "ticket:rename-open",
  params: { ticketId: p.string },
  label: "Rename",
  run: (ctx) => ctx.showModal(RenameTicket, { ticketId: ctx.params.ticketId }),
});
```

This is how a form remembers what it is about: the button knows the ticket, and
hands it to the modal. A modal handler answers with `ctx.reply`. It has no
`ctx.update`.

The fields are fixed when the modal is defined. A pre-filled `value`, a
`default` or `defaultValues` is therefore the same for everyone who opens it.

## Reference

### `defineModal(input)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Stable routing key, for example `"feedback:submit"`. 1-100 characters, no `$`. |
| `title` | `string` | required | Shown at the top of the dialog. 1-45 characters. |
| `fields` | `FieldMap` | required | 1 to 5 components keyed by name, built with `field`. |
| `params` | `ParamMap` | `{}` | Typed values encoded into the customId, built with `p`. See [Buttons](/components/buttons/). |
| `guards` | `Guard[]` | `[]` | Preconditions checked before `run`, on submission. See [Guards](/commands/guards/). |
| `defer` | `DeferOption` | the bot's `defaults.defer` | Acknowledge the submission for you. See [Automatic deferral](/basics/automatic-deferral/). |
| `run` | `(ctx: ModalContext) => unknown` | required | Called on submit. `ctx.fields` and `ctx.params` are typed. |

Returns a `ModalDefinition`: what you passed, a `kind: "modal"` tag the loader
routes on, and `build()`. `ModalInput` and `ModalDefinition` are exported types.

The handler receives a `ModalContext<Fields>`, which adds `fields` to the
[base context](/basics/context/), plus `params`.

### `build(params?)`

Returns a discord.js `ModalBuilder` made from the declared fields, with a
customId that encodes `params`. `ctx.showModal(Modal, params)` calls it for you.
Use it directly only when you need the raw builder, and note that `showModal`
accepts any object with a compatible `build()`.

### `field`

The builders are listed under
[Field types](/components/modals/#field-types). Each takes one config object,
except `field.text(content)`, which takes the markdown to show.

| Option | Type | Default | Applies to | Description |
| --- | --- | --- | --- | --- |
| `label` | `string` | required | all but `text` | Shown above the component. 1-45 characters. |
| `description` | `string` | - | all but `text` | Smaller help text under the label. Up to 100 characters. |
| `required` | `boolean` | `false` | all but `checkbox`, `text` | Whether the field must be filled. |
| `placeholder` | `string` | - | `short`, `paragraph`, `select`, `users`, `roles`, `channels`, `mentionables` | Greyed text shown while empty. Up to 100 characters on a text input, 150 on a picker. |
| `minLength` | `number` | - | `short`, `paragraph` | Shortest text accepted, 0-4000. |
| `maxLength` | `number` | - | `short`, `paragraph` | Longest text accepted, 1-4000. |
| `value` | `string` | - | `short`, `paragraph` | A pre-filled value, up to 4000 characters. |
| `options` | `FieldChoice[]` | required | `select`, `radio`, `checkboxes` | The choices: 1-25 for `select`, 2-10 for `radio`, 1-10 for `checkboxes`. |
| `minValues` | `number` | Discord's | `select`, `users`, `roles`, `channels`, `mentionables`, `checkboxes`, `files` | Fewest items to pick: 0-25, or 0-10 files. |
| `maxValues` | `number` | Discord's | the same | Most items to pick: 1-25, or 1-10 files. |
| `defaultValues` | `string[]` | - | `users`, `roles`, `channels` | Ids selected when the modal opens. |
| `channelTypes` | `ChannelType[]` | - | `channels` | Only offer channels of these types. |
| `fileTypes` | `FileType[]` | - | `files` | What may be uploaded. Up to 10 entries. |
| `default` | `boolean` | `false` | `checkbox` | Whether the box starts ticked. |

### `FieldChoice`

One entry of the `options` of a `select`, `radio` or `checkboxes` field.

| Property | Type | Description |
| --- | --- | --- |
| `label` | `string` | What the user reads. Up to 100 characters. |
| `value` | `string` | What your handler receives. Up to 100 characters. |
| `description` | `string` | Extra text under the label. Up to 100 characters. |
| `default` | `boolean` | Pre-selected when the modal opens. |
| `emoji` | `string` | An emoji next to the label. `select` only. |

### `InferFields<M>`

The `ctx.fields` type for a `FieldMap`, for when you build your own abstraction
over modals. The related exported types:

| Type | Use |
| --- | --- |
| `FieldMap` | A record of field descriptors, the shape of `fields`. |
| `FieldDef` | One field descriptor, what a `field` builder returns. |
| `FieldKind` | The twelve kinds: `"short"`, `"paragraph"`, `"select"`, `"users"`, `"roles"`, `"channels"`, `"mentionables"`, `"files"`, `"radio"`, `"checkboxes"`, `"checkbox"`, `"text"`. |
| `FieldOutput` | The value each kind resolves to. |
| `FileType` | An entry of `fileTypes`: `"image"`, `"video"`, `"audio"` or `` `.${string}` ``. |

## Limits and errors

A modal that breaks one of Discord's rules fails when it is defined, with
[`DJSBOT_E014`](/api/errors/#djsbot_e014), and not with an HTTP 400 the first
time a user opens it. The message names the modal and the field.

| Rule | Limit |
| --- | --- |
| Components in a modal, `field.text` blocks included | 1 to 5 |
| Title | 1-45 characters |
| Label | 1-45 characters |
| Description | 100 characters |
| Placeholder | 100 characters on a text input, 150 on a picker |
| `minLength`, `maxLength`, pre-filled `value` | 0-4000, 1-4000, 4000 characters, and `minLength` not above `maxLength` |
| Options | 1-25 for `select`, 2-10 for `radio`, 1-10 for `checkboxes` |
| Option label, value and description | 100 characters each |
| `minValues`, `maxValues` | 0-25 and 1-25, or 0-10 and 1-10 for `files`, and `minValues` not above `maxValues` |
| `fileTypes` | 10 entries, each `"image"`, `"video"`, `"audio"` or an extension of letters and digits such as `".pdf"` |

The other errors are those of every component: an invalid `id` is
[`DJSBOT_E013`](/api/errors/#djsbot_e013), two modals with the same `id` are
[`DJSBOT_E011`](/api/errors/#djsbot_e011), and a customId over 100 characters is
[`DJSBOT_E020`](/api/errors/#djsbot_e020), thrown when the modal is opened.

:::note
These components need discord.js 14.27 or newer.
:::

## See also

- [The ctx object](/basics/context/) for `ctx.showModal` and `ctx.reply`
- [Buttons](/components/buttons/) for `p` and how params travel in the customId
- [Select menus](/components/select-menus/) for the same pickers under a message
- [Options and autocomplete](/commands/options/) when a few command options are enough
- [A ticket system](/recipes/ticket-system/), which opens a modal from a button
