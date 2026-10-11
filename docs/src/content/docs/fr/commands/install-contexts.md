---
title: "Contextes d'installation"
description: "Une application Discord peut être ajoutée à un serveur ou à un compte utilisateur, et chaque commande peut être limitée aux serveurs, aux messages privés du bot ou à d'autres conversations privées. Deux champs d'une commande décident des deux."
sidebar:
  order: 6
---

Discord sépare deux questions faciles à confondre :

- **Où la commande est-elle installée ?** Sur un serveur (chaque membre l'y trouve) ou sur un compte utilisateur (cette personne la retrouve partout où elle va). C'est `integrationTypes`.
- **Où peut-on l'utiliser ?** Dans les serveurs, dans le message privé avec le bot, ou dans les autres messages privés et groupes privés. C'est `contexts`.

## Une commande utilisable partout

```ts title="features/notes/note.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "note",
  description: "A personal note command you can use anywhere",
  integrationTypes: ["guild", "user"],              // installable sur des serveurs et sur des comptes utilisateur
  contexts: ["guild", "botDm", "privateChannel"],   // utilisable dans les serveurs, les messages privés du bot et les groupes privés
  options: { text: s.string({ description: "Text", required: true }) },
  run: (ctx) => ctx.reply.info(ctx.options.text, { ephemeral: true }),
});
```

Une personne qui ajoute l'application à son propre compte peut désormais lancer `/note` dans n'importe quel serveur, dans un message privé avec un ami ou dans un groupe privé, que le bot en soit membre ou non.

Les deux champs fonctionnent de la même façon sur `defineCommand`, `defineUserCommand` et `defineMessageCommand` :

```ts title="features/general/userinfo.user.ts"
import { defineUserCommand } from "@ix-xs/djs-bot";

export default defineUserCommand({
  name: "User info",
  integrationTypes: ["guild", "user"],
  run: (ctx) =>
    ctx.reply.info(`Joined: ${ctx.targetMember?.joinedAt?.toDateString() ?? "not a member here"}`),
});
```

## Choisir les valeurs

| Vous voulez | Écrivez |
| --- | --- |
| Une commande de serveur qui n'apparaît jamais en message privé | `contexts: ["guild"]` |
| Une commande uniquement pour le message privé avec le bot | `contexts: ["botDm"]` |
| Un outil personnel qui suit l'utilisateur partout | `integrationTypes: ["user"]`, `contexts: ["guild", "botDm", "privateChannel"]` |
| Les deux : installée sur des serveurs et sur des comptes | `integrationTypes: ["guild", "user"]` |

`contexts: ["guild"]` remplace l'ancien `dmPermission: false`, que Discord a déprécié. `dmPermission` est toujours accepté et envoyé tel quel, mais le nouveau code doit utiliser `contexts`.

Quand vous omettez un champ, le framework n'envoie rien pour lui et Discord applique sa propre valeur par défaut, qui dépend de la configuration de l'application.

Pour que les utilisateurs puissent ajouter l'application à leur compte, l'installation par l'utilisateur doit être activée pour l'application dans le Discord Developer Portal, sur la page Installation.

## Des gestionnaires hors de vos serveurs

Une commande installée sur un compte utilisateur peut s'exécuter dans un serveur que le bot n'a jamais rejoint, ou dans un message privé entre deux personnes. L'interaction atteint quand même votre gestionnaire, mais le bot en sait beaucoup moins sur l'endroit :

| Propriété | Dans un serveur où le bot n'est pas présent |
| --- | --- |
| `ctx.guildId` | Défini |
| `ctx.guild` | `null` |
| `ctx.member` | `null` |
| `ctx.targetMember` (commandes d'utilisateur) | `null` |
| `ctx.channel` | Peut être `null`. `ctx.channelId` est défini. |
| `ctx.user`, `ctx.reply` | Comme d'habitude |

Dans un message privé ou un groupe privé, `ctx.guildId` vaut aussi `null`.

Cela change le comportement de certaines [gardes](/commands/guards/). `inGuild()` ne regarde que l'identifiant du serveur : elle passe donc dans un serveur où le bot n'est pas présent. `hasRole()` et `guildOwnerOnly()` ont besoin du membre ou du serveur et y refusent. `hasPermission()` continue de fonctionner, car Discord envoie les permissions du membre avec l'interaction.

Écrivez ces gestionnaires de façon qu'ils n'aient pas besoin du serveur : répondez à l'interaction, et évitez de récupérer des salons, des membres ou des rôles que le bot ne peut pas voir.

## Référence

### `integrationTypes`

`InstallContext[]`. Où la commande peut être installée. Envoyé à Discord sous le nom `integration_types`.

| Valeur | Nom Discord | Signification |
| --- | --- | --- |
| `"guild"` | `GuildInstall` | Installée sur un serveur, pour ses membres. |
| `"user"` | `UserInstall` | Installée sur un compte utilisateur, pour cet utilisateur partout. |

### `contexts`

`InteractionContext[]`. Où la commande peut être utilisée. Envoyé à Discord sous le nom `contexts`.

| Valeur | Nom Discord | Signification |
| --- | --- | --- |
| `"guild"` | `Guild` | Dans les serveurs. |
| `"botDm"` | `BotDM` | Dans le message privé entre l'utilisateur et le bot. |
| `"privateChannel"` | `PrivateChannel` | Dans les autres messages privés et dans les groupes privés. |

### `dmPermission`

`boolean`. Indique si une commande globale est disponible en message privé. Déprécié par Discord au profit de `contexts`.

`InstallContext` et `InteractionContext` sont exportés en tant que types.

## Limites et erreurs

:::caution[Commandes globales uniquement]
`integrationTypes`, `contexts` et `dmPermission` n'existent que sur les commandes globales. Discord les accepte sur une commande de serveur, puis les ignore. Elles n'ont donc aucun effet sur une commande qui définit `guilds`, ni sur rien de ce qui est déployé sur un serveur de développement : testez-les avec un déploiement global. Voir [Déployer les commandes](/production/deploying/).
:::

- Les deux champs font partie de ce que le déploiement compare. Les modifier redéploie la commande. Une commande qui les omet n'est pas redéployée à cause des valeurs par défaut que Discord a renseignées.
- Les valeurs ne sont vérifiées que par les types TypeScript. Il n'y a pas de code d'erreur à la définition pour elles.
- Ces réglages s'appliquent à une commande entière. Une [sous-commande](/commands/subcommands/) ne peut pas avoir les siens.

## Voir aussi

- [Commandes slash](/commands/slash-commands/)
- [Menus contextuels](/commands/context-menus/)
- [Gardes](/commands/guards/)
- [Déployer les commandes](/production/deploying/)
