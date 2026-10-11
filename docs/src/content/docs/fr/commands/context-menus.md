---
title: "Menus contextuels"
description: "Les commandes de menu contextuel apparaissent sous Applications quand on fait un clic droit sur un utilisateur ou sur un message. Elles n'ont pas d'options : le gestionnaire reçoit l'utilisateur ou le message sur lequel on a cliqué."
sidebar:
  order: 4
---

Il en existe deux sortes : une **commande d'utilisateur**, affichée sur un utilisateur, et une **commande de message**, affichée sur un message. Sur ordinateur, le menu s'ouvre avec un clic droit, sur mobile avec un appui long. Les deux ont un nom et un gestionnaire, sans description et sans options.

## Une première commande d'utilisateur

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

- `name` est le libellé affiché dans le menu. Contrairement au nom d'une commande slash, il peut contenir des espaces et des majuscules.
- `ctx.targetUser` est l'utilisateur sur lequel on a cliqué. `ctx.targetMember` est la même personne en tant que membre du serveur, ou `null` s'il n'y en a pas.
- Le nom du fichier se termine par `.user.ts`. Voir [Structure du projet](/basics/project-layout/).

## Une commande de message

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

`ctx.targetMessage` est le `Message` discord.js sur lequel on a cliqué, avec son contenu, son auteur et ses pièces jointes. Le nom du fichier se termine par `.message.ts`.

## Demander des précisions

Un menu contextuel ne peut pas avoir d'options. Quand le gestionnaire a besoin d'une saisie, ouvrez donc une [modale](/components/modals/). Passez ce qui identifie la cible dans les paramètres de la modale, car le gestionnaire de la modale s'exécute plus tard, dans une interaction distincte :

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

Une modale doit être la première réponse à une interaction : appelez donc `ctx.showModal` avant toute réponse.

## Gardes, permissions, installation

Les menus contextuels acceptent les mêmes réglages d'accès que les commandes slash :

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

- `guards` sont vérifiées avant `run`. Voir [Gardes](/commands/guards/).
- `defaultMemberPermissions` masque l'entrée aux membres qui n'ont pas la permission.
- `integrationTypes` et `contexts` décident où l'entrée peut être installée et utilisée. Une commande d'utilisateur installée sur un compte utilisateur suit cette personne dans tous les serveurs et tous les messages privés : voir [Contextes d'installation](/commands/install-contexts/).
- `guilds` déploie l'entrée sur certains serveurs seulement. Voir [Déployer les commandes](/production/deploying/).

## Référence

### `defineUserCommand(input)`

Prend un `UserCommandInput` et renvoie un `UserCommandDefinition`, marqué `kind: "userCommand"`.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `name` | `string` | obligatoire | Le libellé dans le menu Applications d'un utilisateur. 1-32 caractères, espaces et majuscules autorisés. |
| `run` | `(ctx: UserCommandContext) => unknown` | obligatoire | Le gestionnaire, synchrone ou asynchrone. |
| `guards` | `Guard[]` | `[]` | Conditions préalables vérifiées avant `run`. |
| `defer` | `DeferOption` | `defaults.defer` | Voir [Différé automatique](/basics/automatic-deferral/). |
| `defaultMemberPermissions` | `PermissionResolvable` | - | Permissions dont un membre a besoin pour voir l'entrée par défaut. |
| `integrationTypes` | `("guild" \| "user")[]` | défini par Discord | Où elle peut être installée. |
| `contexts` | `("guild" \| "botDm" \| "privateChannel")[]` | défini par Discord | Où elle peut être utilisée. |
| `dmPermission` | `boolean` | - | Déprécié par Discord au profit de `contexts`. |
| `nameLocalizations` | `LocalizationMap` | - | Le libellé par langue. Voir [Noms localisés](/commands/slash-commands/#localized-names). |
| `guilds` | `string[]` | - | Déploie uniquement sur ces identifiants de serveur. À omettre pour une commande globale. |

Il n'y a ni `description`, ni `descriptionLocalizations`, ni `options`, ni `nsfw` : Discord ne les propose pas pour les menus contextuels.

### `defineMessageCommand(input)`

Prend un `MessageCommandInput` et renvoie un `MessageCommandDefinition`, marqué `kind: "messageCommand"`. Les options sont les mêmes que pour `defineUserCommand`, sauf que `run` reçoit un `MessageCommandContext` et que `name` est le libellé dans le menu Applications d'un message.

### `UserCommandContext`

Tout ce que contient [l'objet ctx](/basics/context/), plus :

| Propriété | Type | Description |
| --- | --- | --- |
| `targetUser` | `User` | L'utilisateur sur lequel la commande a été utilisée. |
| `targetMember` | `GuildMember \| null` | Le même utilisateur en tant que membre du serveur. `null` en message privé, dans un serveur où le bot n'est pas présent, et quand l'utilisateur n'est plus membre. |
| `showModal` | `ShowModalFn` | Ouvre une modale comme réponse. |
| `interaction` | `UserContextMenuCommandInteraction` | L'interaction discord.js brute. |

### `MessageCommandContext`

Tout ce que contient [l'objet ctx](/basics/context/), plus :

| Propriété | Type | Description |
| --- | --- | --- |
| `targetMessage` | `Message` | Le message sur lequel la commande a été utilisée. |
| `showModal` | `ShowModalFn` | Ouvre une modale comme réponse. |
| `interaction` | `MessageContextMenuCommandInteraction` | L'interaction discord.js brute. |

## Limites et erreurs

| Règle | Limite | Erreur |
| --- | --- | --- |
| Nom | 1-32 caractères, majuscules et espaces autorisés | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| Commandes d'utilisateur dans une même portée (globale, ou un seul serveur) | 15 | [`DJSBOT_E015`](/api/errors/#djsbot_e015), levée par le déploiement |
| Commandes de message dans une même portée | 15 | [`DJSBOT_E015`](/api/errors/#djsbot_e015), levée par le déploiement |
| Deux commandes d'utilisateur, ou deux commandes de message, avec le même nom | interdit | [`DJSBOT_E010`](/api/errors/#djsbot_e010) |

Une commande slash, une commande d'utilisateur et une commande de message peuvent porter le même nom : ce sont trois types différents pour Discord (la saisie de chat est le type 1, l'utilisateur le type 2, le message le type 3), et le déploiement envoie le bon type pour chaque définition.

Si Discord envoie une entrée que le bot en cours d'exécution ne connaît pas, l'utilisateur reçoit le message `unknownCommand`, comme pour une commande slash. Déployer à nouveau règle le problème.

## Voir aussi

- [Commandes slash](/commands/slash-commands/)
- [Modales](/components/modals/)
- [Gardes](/commands/guards/)
- [Contextes d'installation](/commands/install-contexts/)
- [L'objet ctx](/basics/context/)
