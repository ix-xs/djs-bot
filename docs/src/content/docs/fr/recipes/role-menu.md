---
title: "Un menu de rôles en libre-service"
description: "Un menu de sélection de chaînes qui donne et retire des rôles, plus un menu de rôles natif pour les administrateurs."
sidebar:
  order: 3
---

Deux petites fonctionnalités qui couvrent les deux sortes de menu de sélection : un
**menu de sélection de chaînes** dont vous décidez les options, et un **menu de
rôles natif** où c'est Discord qui affiche le sélecteur.

## Un menu de sélection de chaînes pour les membres

```ts title="features/roles/roles.config.ts"
/**
 * Les rôles que chacun peut s'attribuer. Remplacez les identifiants par les vôtres :
 * activez le mode développeur dans Discord, puis faites un clic droit sur un rôle -> Copier l'identifiant du rôle.
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

Deux choses rendent ce code robuste :

- **Revalidez les valeurs.** `ctx.values` vient du client : filtrez-les
  d'après votre propre liste autorisée plutôt que de leur faire confiance.
- **Calculez la différence, ne basculez pas.** Un menu de sélection renvoie la nouvelle
  sélection complète : comparez-la à ce que le membre possède déjà et n'appliquez que
  la différence.

## Publier le menu

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
    const channel = ctx.channel;
    if (!channel?.isSendable()) return ctx.reply.error("I cannot post in this channel.");

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

    await channel.send({
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

`minValues: 0` est ce qui permet à un membre de tout désélectionner et de perdre tous les
rôles. Sans cela, Discord ne le laisse pas valider une sélection vide.

## Un menu de rôles natif pour les administrateurs

Quand vous voulez que Discord affiche le sélecteur à partir de la vraie liste des rôles,
utilisez `defineRoleSelect`. `ctx.roles` est alors une collection résolue, pas des
identifiants bruts.

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

La vérification de la hiérarchie des rôles compte : un bot ne peut pas attribuer un rôle
situé au niveau de son rôle le plus élevé ou au-dessus, et sans cette vérification l'appel
échoue simplement avec une erreur `Missing Permissions` que l'utilisateur ne peut pas
interpréter.

## Construire le sélecteur

```ts
const picker = GrantSelect.build(
  { memberId: target.id },
  { placeholder: "Pick roles to grant", maxValues: 5 },
);

await ctx.reply({ content: `Roles for ${target.tag}:`, components: [ui.row(picker)] });
```

## Quel menu de sélection choisir ?

| | Menu de sélection de chaînes | Menu natif |
| --- | --- | --- |
| Options | Vous les définissez, 25 au maximum | Discord liste tout |
| Idéal pour | Une liste choisie que vous contrôlez | Choisir n'importe quel utilisateur, rôle ou salon |
| Le gestionnaire lit | `ctx.values` | `ctx.roles`, `ctx.users`, `ctx.members`, `ctx.channels` |
| À définir avec | `defineSelectMenu` | `defineRoleSelect`, `defineUserSelect`, `defineChannelSelect`, `defineMentionableSelect` |

## Aller plus loin

- Déplacez `SELF_ROLES` dans le store pour que les administrateurs puissent le modifier
  avec une commande plutôt qu'avec un nouveau déploiement.
- Ajoutez des groupes exclusifs (rôles de couleur) en retirant les autres rôles du groupe.
- Utilisez `ui.row()` deux fois pour publier plusieurs menus dans un même message, jusqu'à 5 rangées.
