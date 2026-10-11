---
title: "Context menus"
description: "Context-menu commands appear under Apps when someone right-clicks a user or a message. They take no options: the handler receives the user or the message that was clicked."
sidebar:
  order: 4
---

There are two kinds: a **user command**, shown on a user, and a **message
command**, shown on a message. On desktop the menu opens with a right-click, on
mobile with a long press. Both have a name and a handler, no description and no
options.

## A first user command

```ts title="features/moderation/userinfo.user.ts"
import { defineUserCommand, EmbedBuilder, timestamp, TimestampStyles } from "@ix-xs/djs-bot";

export default defineUserCommand({
  name: "User info",
  run: async (ctx) => {
    const embed = new EmbedBuilder()
      .setTitle(ctx.targetUser.tag)
      .setThumbnail(ctx.targetUser.displayAvatarURL())
      .addFields({
        name: "Created",
        value: timestamp(ctx.targetUser.createdAt, TimestampStyles.RelativeTime),
      });

    if (ctx.targetMember?.joinedAt) {
      embed.addFields({
        name: "Joined",
        value: timestamp(ctx.targetMember.joinedAt, TimestampStyles.RelativeTime),
      });
    }

    await ctx.reply.ephemeral({ embeds: [embed] });
  },
});
```

- `name` is the label in the menu. Unlike a slash command name, it may contain
  spaces and capitals.
- `ctx.targetUser` is the user that was clicked. `ctx.targetMember` is the same
  person as a member of the server, or `null` when there is none.
- The file name ends in `.user.ts`. See [Project layout](/basics/project-layout/).

## A message command

```ts title="features/moderation/report.message.ts"
import { defineMessageCommand } from "@ix-xs/djs-bot";

export default defineMessageCommand({
  name: "Report message",
  run: async (ctx) => {
    ctx.logger.warn({ id: ctx.targetMessage.id }, "message reported");
    await ctx.reply.success("Reported to moderators.", { ephemeral: true });
  },
});
```

`ctx.targetMessage` is the discord.js `Message` that was clicked, with its
content, author and attachments. The file name ends in `.message.ts`.

## Asking for details

A context menu cannot have options, so when the handler needs input, open a
[modal](/components/modals/). Pass what identifies the target through the
modal's params, because the modal handler runs later, as a separate
interaction:

```ts title="features/moderation/report.message.ts"
import { defineMessageCommand, defineModal, field, p } from "@ix-xs/djs-bot";

export const ReportModal = defineModal({
  id: "report:submit",
  title: "Report this message",
  params: { messageId: p.string },
  fields: {
    reason: field.paragraph({ label: "What is wrong?", required: true, maxLength: 500 }),
  },
  run: async (ctx) => {
    ctx.logger.warn({ id: ctx.params.messageId, reason: ctx.fields.reason }, "message reported");
    await ctx.reply.success("Reported to moderators.", { ephemeral: true });
  },
});

export default defineMessageCommand({
  name: "Report message",
  run: (ctx) => ctx.showModal(ReportModal, { messageId: ctx.targetMessage.id }),
});
```

A modal has to be the first response to an interaction, so call
`ctx.showModal` before any reply.

## Guards, permissions, install

Context menus accept the same access settings as slash commands:

```ts title="features/moderation/warn.user.ts"
import { defineUserCommand, inGuild, hasPermission, PermissionFlagsBits } from "@ix-xs/djs-bot";

export default defineUserCommand({
  name: "Warn",
  contexts: ["guild"],
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  guards: [inGuild(), hasPermission(PermissionFlagsBits.ModerateMembers)],
  run: (ctx) => ctx.reply.success(`Warned ${ctx.targetUser}.`, { ephemeral: true }),
});
```

- `guards` are checked before `run`. See [Guards](/commands/guards/).
- `defaultMemberPermissions` hides the entry from members who lack the
  permission.
- `integrationTypes` and `contexts` decide where the entry can be installed and
  used. A user command installed on a user account follows that person into
  every server and DM: see [Install contexts](/commands/install-contexts/).
- `guilds` deploys the entry to specific servers only. See
  [Deploying commands](/production/deploying/).

## Reference

### `defineUserCommand(input)`

Takes a `UserCommandInput` and returns a `UserCommandDefinition`, tagged
`kind: "userCommand"`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | required | The label in the Apps menu of a user. 1-32 characters, spaces and capitals allowed. |
| `run` | `(ctx: UserCommandContext) => unknown` | required | The handler, sync or async. |
| `guards` | `Guard[]` | `[]` | Preconditions checked before `run`. |
| `defer` | `DeferOption` | `defaults.defer` | See [Automatic deferral](/basics/automatic-deferral/). |
| `defaultMemberPermissions` | `PermissionResolvable` | - | Permissions a member needs to see the entry by default. |
| `integrationTypes` | `("guild" \| "user")[]` | set by Discord | Where it can be installed. |
| `contexts` | `("guild" \| "botDm" \| "privateChannel")[]` | set by Discord | Where it can be used. |
| `dmPermission` | `boolean` | - | Deprecated by Discord in favour of `contexts`. |
| `nameLocalizations` | `LocalizationMap` | - | The label per locale. See [Localized names](/commands/slash-commands/#localized-names). |
| `guilds` | `string[]` | - | Deploy to these guild ids only. Leave out for a global command. |

There is no `description`, no `descriptionLocalizations`, no `options` and no
`nsfw`: Discord does not have them for context menus.

### `defineMessageCommand(input)`

Takes a `MessageCommandInput` and returns a `MessageCommandDefinition`, tagged
`kind: "messageCommand"`. The options are the same as for `defineUserCommand`,
except that `run` receives a `MessageCommandContext` and `name` is the label in
the Apps menu of a message.

### `UserCommandContext`

Everything in [the ctx object](/basics/context/), plus:

| Property | Type | Description |
| --- | --- | --- |
| `targetUser` | `User` | The user the command was used on. |
| `targetMember` | `GuildMember \| null` | The same user as a member of the server. `null` in DMs, in a server the bot is not in, and when the user is no longer a member. |
| `showModal` | `ShowModalFn` | Opens a modal as the response. |
| `interaction` | `UserContextMenuCommandInteraction` | The raw discord.js interaction. |

### `MessageCommandContext`

Everything in [the ctx object](/basics/context/), plus:

| Property | Type | Description |
| --- | --- | --- |
| `targetMessage` | `Message` | The message the command was used on. |
| `showModal` | `ShowModalFn` | Opens a modal as the response. |
| `interaction` | `MessageContextMenuCommandInteraction` | The raw discord.js interaction. |

## Limits and errors

| Rule | Limit | Error |
| --- | --- | --- |
| Name | 1-32 characters, any case, spaces allowed | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| User commands in one scope (global, or one guild) | 15 | [`DJSBOT_E015`](/api/errors/#djsbot_e015), raised by the deploy |
| Message commands in one scope | 15 | [`DJSBOT_E015`](/api/errors/#djsbot_e015), raised by the deploy |
| Two user commands, or two message commands, with the same name | not allowed | [`DJSBOT_E011`](/api/errors/#djsbot_e011) |

A slash command, a user command and a message command may share a name: they
are three different types for Discord (chat input is type 1, user is 2, message
is 3), and the deploy sends the right type for each definition.

If Discord sends an entry the running bot does not have, the user gets the
`unknownCommand` message, as for a slash command. Deploying again fixes it.

## See also

- [Slash commands](/commands/slash-commands/)
- [Modals](/components/modals/)
- [Guards](/commands/guards/)
- [Install contexts](/commands/install-contexts/)
- [The ctx object](/basics/context/)
