---
title: "Select menus"
description: "A select menu is a dropdown under a message. Use a string select for your own list of options, or a native select to let Discord offer users, roles, channels or mentionables and resolve the picks for you."
sidebar:
  order: 2
---

There are five kinds of select menu and one factory for each. They all share the
same shape as a [button](/components/buttons/): a routing `id`, optional typed
`params`, and a `run` handler. What differs is what the user picks from and what
the handler reads.

## A first select menu

A string select offers your own list. The definition holds the handler, and the
options are given when the menu is built, so one definition can show a different
list each time.

```ts title="features/colours/colour.select.ts"
import { defineSelectMenu } from "@ix-xs/djs-bot";

export const ColourPicker = defineSelectMenu({
  id: "colour:pick",
  run: (ctx) => ctx.update({ content: `You chose ${ctx.values[0]}.`, components: [] }),
});
```

```ts title="features/colours/colour.command.ts"
import { defineCommand, ui } from "@ix-xs/djs-bot";
import { ColourPicker } from "./colour.select.js";

export default defineCommand({
  name: "colour",
  description: "Pick a colour",
  run: (ctx) => {
    const menu = ColourPicker.build(undefined, {
      placeholder: "Pick a colour",
      options: [
        { label: "Red", value: "red" },
        { label: "Blue", value: "blue", description: "The calm one", emoji: "🔵" },
      ],
    });
    return ctx.reply({ content: "Which colour?", components: [ui.row(menu)] });
  },
});
```

`build(params, visual)` takes the params first. This menu declares none, hence
the `undefined`. The `label` is what the user reads and the `value` is what the
handler receives in `ctx.values`.

A select menu takes a whole row to itself: `ui.row(menu)`. Files ending in
`.select.ts` are loaded automatically, see
[Project layout](/basics/project-layout/).

## Several choices and params

`minValues` and `maxValues` turn the menu into a multi-select. Both default to
`1`. With `minValues: 0` the user may clear the selection, and `ctx.values` is
then an empty array.

`params` work exactly as on a button: they are encoded into the customId and
come back typed in `ctx.params`.

```ts title="features/roles/interests.select.ts"
import { defineSelectMenu, p, ui } from "@ix-xs/djs-bot";

export const InterestPicker = defineSelectMenu({
  id: "interests:pick",
  params: { ownerId: p.string },
  run: async (ctx) => {
    // ctx.values: string[]   ctx.params.ownerId: string
    if (ctx.user.id !== ctx.params.ownerId) {
      await ctx.reply.error("This menu belongs to someone else.");
      return;
    }
    const picked = ctx.values.join(", ") || "nothing";
    await ctx.reply.success(`You picked: ${picked}`, { ephemeral: true });
  },
});

export const interestRow = (ownerId: string) =>
  ui.row(
    InterestPicker.build(
      { ownerId },
      {
        placeholder: "Choose up to three",
        minValues: 0,
        maxValues: 3,
        options: [
          { label: "Dev", value: "dev", emoji: "💻" },
          { label: "Design", value: "design", description: "UI/UX" },
          { label: "Music", value: "music", default: true },
        ],
      },
    ),
  );
```

`default: true` on an option pre-selects it. The codecs, the encoding and its
100-character limit are described in [Buttons](/components/buttons/).

## Native select menus

`defineUserSelect`, `defineRoleSelect`, `defineChannelSelect` and
`defineMentionableSelect` let Discord render the picker from the server's own
users, roles and channels. You give no options, and Discord
resolves the picks into full objects for you.

```ts title="features/setup/log-channel.select.ts"
import { defineChannelSelect, ChannelType, ui } from "@ix-xs/djs-bot";

export const LogChannelPicker = defineChannelSelect({
  id: "setup:log-channel",
  run: async (ctx) => {
    const channel = ctx.channels?.first(); // ctx.channels: Collection<string, GuildBasedChannel>
    if (!channel) return ctx.update.defer();
    await ctx.reply.success(`Log channel set to ${channel}`);
  },
});

export const logChannelRow = () =>
  ui.row(
    LogChannelPicker.build(undefined, {
      placeholder: "Pick a channel",
      channelTypes: [ChannelType.GuildText],
      maxValues: 1,
    }),
  );
```

Use the resolved collections in the handler, not the raw ids:

```ts title="features/roles/assign.select.ts"
import { defineRoleSelect } from "@ix-xs/djs-bot";

export const AssignRoles = defineRoleSelect({
  id: "roles:assign",
  run: async (ctx) => {
    for (const role of ctx.roles?.values() ?? []) await ctx.member?.roles.add(role);
    await ctx.update({ content: "Roles updated.", components: [] });
  },
});
```

| Factory | The user picks | The handler reads | Extra build options |
| --- | --- | --- | --- |
| `defineSelectMenu` | from your options | `ctx.values` | `options` |
| `defineUserSelect` | users | `ctx.users`, `ctx.members` | `defaultValues` |
| `defineRoleSelect` | roles | `ctx.roles` | `defaultValues` |
| `defineChannelSelect` | channels | `ctx.channels` | `channelTypes`, `defaultValues` |
| `defineMentionableSelect` | users and roles | `ctx.users`, `ctx.members`, `ctx.roles` | none |

All five also accept `placeholder`, `minValues`, `maxValues` and `disabled`. On
a native select `build()` needs no argument at all: `Picker.build()`.

:::note[Why the collections are optional]
One context type serves all five kinds, so `ctx.users`, `ctx.members`,
`ctx.roles` and `ctx.channels` are typed as possibly `undefined`. Each is always
set on the kinds listed for it in the table, so `?.` or `!` is safe there.
`ctx.values` is always set, and holds ids on a native select.
:::

## Answering a selection

The handler answers like a button handler: `ctx.reply` sends a new message,
`ctx.update(content)` edits the message the menu is on, `ctx.update.disable()`
disables its components, and `ctx.showModal(modal)` opens a
[modal](/components/modals/). [The ctx object](/basics/context/) describes them.

Like every interaction, a selection has to be acknowledged within three
seconds, or the user sees "This interaction failed". When there is nothing to
say, `ctx.update.defer()` acknowledges without changing anything. Setting
`defer: "update"` on the definition does it for you, see
[Automatic deferral](/basics/automatic-deferral/).

Preconditions go in `guards`, as on a command. See
[Guards](/commands/guards/).

## Reference

### `defineSelectMenu(input)`

A string select menu. `defineUserSelect(input)`, `defineRoleSelect(input)`,
`defineChannelSelect(input)` and `defineMentionableSelect(input)` take the same
input, a `SelectMenuInput`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Stable routing key, for example `"settings:language"`. 1-100 characters, no `$`. |
| `params` | `ParamMap` | `{}` | Typed values encoded into the customId, built with `p`. See [Buttons](/components/buttons/). |
| `guards` | `Guard[]` | `[]` | Preconditions checked before `run`. See [Guards](/commands/guards/). |
| `defer` | `DeferOption` | the bot's `defaults.defer` | Acknowledge the selection for you. See [Automatic deferral](/basics/automatic-deferral/). |
| `run` | `(ctx: SelectMenuContext) => unknown` | required | The handler. `ctx.values` holds what was picked, `ctx.params` the decoded params. |

Each factory returns its own definition type (`SelectMenuDefinition`,
`UserSelectDefinition`, `RoleSelectDefinition`, `ChannelSelectDefinition`,
`MentionableSelectDefinition`, together `AnySelectDefinition`). They all extend
`SelectRoutable`: `kind: "select"`, a `selectType` (`SelectType`, one of
`"string"`, `"user"`, `"role"`, `"channel"`, `"mentionable"`), and the `id`,
`params`, `guards`, `defer` and `run` you passed. Each adds its own `build()`.

### `build(params, visual)`

On a string select. Returns a discord.js `StringSelectMenuBuilder` whose
customId encodes `params`. Both arguments are positional: pass `undefined` for
`params` when the menu declares none. `visual` is a `SelectVisualOptions`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `options` | `Array<SelectMenuComponentOptionData \| APISelectMenuOption>` | required | The choices, 1 to 25: `{ label, value, description?, emoji?, default? }`. `emoji` is a unicode emoji, custom-emoji markup or an `{ id, name }` object. |
| `placeholder` | `string` | - | Greyed text shown while nothing is picked, up to 150 characters. |
| `minValues` | `number` | `1` | Fewest options the user must pick. |
| `maxValues` | `number` | `1` | Most options the user may pick. |
| `disabled` | `boolean` | `false` | Greyed out, cannot be opened. |

### `build(params?, visual?)`

On a native select. Returns a `UserSelectMenuBuilder`, `RoleSelectMenuBuilder`,
`ChannelSelectMenuBuilder` or `MentionableSelectMenuBuilder`. `visual` is a
`NativeSelectVisualOptions`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `placeholder` | `string` | - | Greyed text shown while nothing is picked, up to 150 characters. |
| `minValues` | `number` | `1` | Fewest entries the user must pick. |
| `maxValues` | `number` | `1` | Most entries the user may pick. |
| `disabled` | `boolean` | `false` | Greyed out, cannot be opened. |
| `defaultValues` | `string[]` | - | Ids selected when the menu appears. User, role and channel selects only. |
| `channelTypes` | `ChannelType[]` | - | Only offer channels of these types. Channel selects only. |

An option that does not apply to the kind of select is ignored.

### `SelectMenuContext<Params>`

What `run` receives, on top of the [base context](/basics/context/):

| Property | Type | Present for |
| --- | --- | --- |
| `params` | `Params` | all selects |
| `values` | `string[]` | all selects: option values for a string select, ids for a native one |
| `users` | `Collection<string, User>` | user and mentionable selects |
| `members` | `Collection<string, GuildMember>` | user and mentionable selects, in a server |
| `roles` | `Collection<string, Role>` | role and mentionable selects |
| `channels` | `Collection<string, GuildBasedChannel>` | channel selects |
| `update` | `UpdateFn` | all selects |
| `showModal` | `ShowModalFn` | all selects |

`ctx.interaction` is the raw discord.js select interaction.

## Limits and errors

| Limit | Value |
| --- | --- |
| Options in a string select | 1 to 25 |
| Placeholder | 150 characters |
| customId, key and params together | 100 characters |
| Select menus in a row | 1 |
| Rows in a message | 5 |

| Code | When |
| --- | --- |
| [`DJSBOT_E013`](/api/errors/#djsbot_e013) | The `id` is empty, contains `$` or is longer than 100 characters. Thrown by the factory. |
| [`DJSBOT_E011`](/api/errors/#djsbot_e011) | Two select menus share an `id`. The five kinds share one namespace, so a role select and a string select cannot use the same `id`. Thrown at startup. |
| [`DJSBOT_E020`](/api/errors/#djsbot_e020) | The encoded customId exceeds 100 characters. Thrown by `build()`. |
| [`DJSBOT_E021`](/api/errors/#djsbot_e021) | A selection arrived with params that cannot be decoded. `run` is not called, and the user gets the error message, as for a failing handler. |

A selection whose routing key matches no registered menu is ignored, so that a
collector of your own can handle it.

## See also

- [Buttons](/components/buttons/) for `p`, the customId encoding and its limits
- [Modals](/components/modals/), where the same pickers exist as form fields
- [Options and autocomplete](/commands/options/) when the choice belongs in the command itself
- [A self-assign role menu](/recipes/role-menu/), a complete example
