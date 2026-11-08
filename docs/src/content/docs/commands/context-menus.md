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

Every option, property and type, with what it accepts and returns, is in the API reference:

- `defineUserCommand()`: Defines a user context-menu command.
- `UserCommandInput`: Input accepted by `defineUserCommand`.
- `UserCommandDefinition`: A registered user context-menu command (right-click a user → Apps).
- `DeferOption`: When and how an interaction is acknowledged for you.
- `defineMessageCommand()`: Defines a message context-menu command.
- `MessageCommandInput`: Input accepted by `defineMessageCommand`.
- `MessageCommandDefinition`: A registered message context-menu command (right-click a message → Apps).
- `MessageCommandContext`: Context passed to message context-menu command handlers.
- `UserCommandContext`: Context passed to user context-menu command handlers.
- `ShowModalFn`: Opens a modal as the response to an interaction.

## Limits and errors

| Rule | Limit | Error |
| --- | --- | --- |
| Name | 1-32 characters, any case, spaces allowed | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| User commands in one scope (global, or one guild) | 15 | [`DJSBOT_E015`](/api/errors/#djsbot_e015), raised by the deploy |
| Message commands in one scope | 15 | [`DJSBOT_E015`](/api/errors/#djsbot_e015), raised by the deploy |
| Two user commands, or two message commands, with the same name | not allowed | [`DJSBOT_E010`](/api/errors/#djsbot_e010) |

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
