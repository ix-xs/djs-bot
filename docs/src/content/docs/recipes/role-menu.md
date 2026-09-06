---
title: "A self-assign role menu"
description: "A string select menu that gives and removes roles, plus a native role select for admins."
sidebar:
  order: 3
---

Two small features that cover both kinds of select menu: a **string select**
where you decide the options, and a **native role select** where Discord renders
the picker.

## A string select for members

```ts title="features/roles/roles.config.ts"
/**
 * The self-assignable roles. Replace the ids with your own:
 * enable Developer Mode in Discord, then right-click a role -> Copy Role ID.
 */
export const SELF_ROLES = [
  { label: "Announcements", value: "123456789012345678", emoji: "📢", description: "Get pinged for news" },
  { label: "Events", value: "123456789012345679", emoji: "🎉", description: "Game nights and streams" },
  { label: "Support", value: "123456789012345680", emoji: "🛟", description: "Help other members" },
] as const;
```

```ts title="features/roles/roles.select.ts"
import { defineSelectMenu, inGuild, botHasPermission, PermissionFlagsBits, MessageFlags } from "@ix-xs/djs-bot";
import { SELF_ROLES } from "./roles.config.js";

const ALLOWED = new Set(SELF_ROLES.map((role) => role.value));

export const RolesSelect = defineSelectMenu({
  id: "roles:self",
  guards: [inGuild(), botHasPermission(PermissionFlagsBits.ManageRoles)],

  async run(ctx) {
    await ctx.update.defer();

    const chosen = new Set(ctx.values.filter((id) => ALLOWED.has(id)));
    const added: string[] = [];
    const removed: string[] = [];

    for (const id of ALLOWED) {
      const has = ctx.member!.roles.cache.has(id);
      if (chosen.has(id) && !has) {
        await ctx.member!.roles.add(id);
        added.push(id);
      } else if (!chosen.has(id) && has) {
        await ctx.member!.roles.remove(id);
        removed.push(id);
      }
    }

    if (added.length === 0 && removed.length === 0) {
      return ctx.reply.followUp({ content: "Nothing changed.", flags: MessageFlags.Ephemeral });
    }

    const lines = [
      added.length ? `Added: ${added.map((id) => `<@&${id}>`).join(", ")}` : null,
      removed.length ? `Removed: ${removed.map((id) => `<@&${id}>`).join(", ")}` : null,
    ].filter(Boolean);

    return ctx.reply.followUp({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
  },
});
```

Two things make this robust:

- **Re-validate the values.** `ctx.values` comes from the client, so filter it
  against your own allow-list rather than trusting it.
- **Diff, do not toggle.** A select reports the full new selection, so compare it
  with what the member already has and only apply the difference.

## Posting the menu

```ts title="features/roles/roles.command.ts"
import { defineCommand, ui, inGuild, hasPermission, PermissionFlagsBits, EmbedBuilder, Colors } from "@ix-xs/djs-bot";
import { RolesSelect } from "./roles.select.js";
import { SELF_ROLES } from "./roles.config.js";

export default defineCommand({
  name: "rolemenu",
  description: "Post the self-assign role menu",
  guards: [inGuild(), hasPermission(PermissionFlagsBits.ManageGuild)],
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,

  async run(ctx) {
    const menu = RolesSelect.build(undefined, {
      placeholder: "Pick your roles",
      minValues: 0,
      maxValues: SELF_ROLES.length,
      options: SELF_ROLES.map((role) => ({
        label: role.label,
        value: role.value,
        description: role.description,
        emoji: role.emoji,
      })),
    });

    await ctx.channel!.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Choose your roles")
          .setDescription("Select everything you want. Deselect to remove.")
          .setColor(Colors.Blurple),
      ],
      components: [ui.row(menu)],
    });

    return ctx.reply.success("Role menu posted.", { ephemeral: true });
  },
});
```

`minValues: 0` is what allows a member to deselect everything and lose all the
roles. Without it Discord will not let them submit an empty selection.

## A native role select for admins

When you want Discord to render the picker over the real role list, use
`defineRoleSelect`. `ctx.roles` is then a resolved collection, not raw ids.

```ts title="features/roles/grant.select.ts"
import { defineRoleSelect, inGuild, hasPermission, botHasPermission, PermissionFlagsBits, p } from "@ix-xs/djs-bot";

export const GrantSelect = defineRoleSelect({
  id: "roles:grant",
  params: { memberId: p.string },
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.ManageRoles),
    botHasPermission(PermissionFlagsBits.ManageRoles),
  ],

  async run(ctx) {
    const member = await ctx.guild!.members.fetch(ctx.params.memberId).catch(() => null);
    if (!member) return ctx.reply.error("That member has left the server.");

    const me = ctx.guild!.members.me!;
    const tooHigh = ctx.roles!.filter((role) => role.position >= me.roles.highest.position);
    if (tooHigh.size > 0) {
      return ctx.reply.error(`I cannot assign: ${tooHigh.map((r) => r.name).join(", ")}. My role is not above them.`);
    }

    await member.roles.add([...ctx.roles!.keys()]);
    await ctx.audit("roles.grant", {
      targetId: member.id,
      metadata: { roles: ctx.roles!.map((r) => r.name) },
    });

    return ctx.update({
      content: `Gave ${ctx.roles!.size} role(s) to ${member.user.tag}.`,
      components: [],
    });
  },
});
```

The role hierarchy check matters: a bot cannot assign a role positioned at or
above its own highest role, and without the check the call simply fails with a
`Missing Permissions` error the user cannot interpret.

## Building the picker

```ts
const picker = GrantSelect.build(
  { memberId: target.id },
  { placeholder: "Pick roles to grant", maxValues: 5 },
);

await ctx.reply({ content: `Roles for ${target.tag}:`, components: [ui.row(picker)] });
```

## Which select should I use?

| | String select | Native select |
| --- | --- | --- |
| Options | You define them, 25 max | Discord lists everything |
| Best for | A curated list you control | Picking any user, role or channel |
| Handler reads | `ctx.values` | `ctx.roles`, `ctx.users`, `ctx.members`, `ctx.channels` |
| Define with | `defineSelectMenu` | `defineRoleSelect`, `defineUserSelect`, `defineChannelSelect`, `defineMentionableSelect` |

## Going further

- Move `SELF_ROLES` into the store so admins can edit it with a command instead
  of a redeploy.
- Add exclusive groups (colour roles) by removing the other roles in the group.
- Use `ui.row()` twice to post several menus in one message, up to 5 rows.
