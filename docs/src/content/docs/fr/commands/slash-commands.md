---
title: "Commandes slash"
description: "Une commande slash est ce qu'un utilisateur lance en tapant / dans Discord. defineCommand déclare son nom, ses options et son gestionnaire dans un seul objet, et le gestionnaire reçoit des options déjà résolues et typées."
sidebar:
  order: 1
---

## Une première commande

```ts title="features/general/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check that the bot answers",
  run: (ctx) => ctx.reply("Pong."),
});
```

- `name` est ce que l'utilisateur tape après `/`. `description` s'affiche à côté dans le sélecteur de commandes de Discord.
- `run` est le gestionnaire. Il reçoit un seul [objet `ctx`](/basics/context/) et peut être `async`.
- Le nom du fichier se termine par `.command.ts`, c'est ainsi que le chargeur le trouve : voir [Structure du projet](/basics/project-layout/). Importer le fichier n'enregistre rien en soi, le chargeur collecte ce que le fichier exporte.

Une commande n'existe dans Discord qu'une fois déployée : voir [Déployer les commandes](/production/deploying/).

## Options typées

Déclarez ce que la commande accepte avec les constructeurs `s`. `ctx.options` est déduit de cette déclaration : il n'y a rien à convertir et rien à chercher par nom.

```ts title="features/profile/profile.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  description: "Show a user profile",
  options: {
    target: s.user({ description: "Whose profile", required: true }),
    detailed: s.boolean({ description: "Verbose output" }),
    format: s.string({
      description: "Output format",
      choices: [
        { name: "Compact", value: "compact" },
        { name: "Full", value: "full" },
      ],
    }),
  },
  run: async (ctx) => {
    // ctx.options.target:   User                  (obligatoire, donc jamais undefined)
    // ctx.options.detailed: boolean | undefined   (facultative)
    // ctx.options.format:   string | undefined
    await ctx.reply.info(`Profile of ${ctx.options.target}`);
  },
});
```

`required: true` fait deux choses à la fois : Discord refuse d'envoyer la commande sans l'option, et TypeScript retire `undefined` de son type. Chaque type d'option, ses réglages et l'autocomplétion sont traités dans [Options et autocomplétion](/commands/options/).

## Qui peut l'exécuter

Trois réglages limitent une commande, et ils agissent à des niveaux différents.

```ts title="features/moderation/ban.command.ts"
import {
  defineCommand,
  s,
  inGuild,
  hasPermission,
  botHasPermission,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ban",
  description: "Ban a member",
  contexts: ["guild"],
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.BanMembers),
    botHasPermission(PermissionFlagsBits.BanMembers),
  ],
  options: {
    target: s.user({ description: "Who to ban", required: true }),
    reason: s.string({ description: "Why", maxLength: 200 }),
  },
  async run(ctx) {
    await ctx.guild!.members.ban(ctx.options.target, { reason: ctx.options.reason });
    await ctx.audit("member.ban", { targetId: ctx.options.target.id });
    return ctx.reply.success(`Banned ${ctx.options.target.tag}`);
  },
});
```

- `contexts` indique à Discord où la commande peut être utilisée, tout court. Ici, elle n'apparaît jamais en message privé. Voir [Contextes d'installation](/commands/install-contexts/).
- `defaultMemberPermissions` fait que Discord masque la commande aux membres qui n'ont pas la permission. Les administrateurs du serveur peuvent changer cette règle dans leurs paramètres.
- `guards` sont vérifiées par le bot lui-même, à chaque fois, avant `run`. Personne ne peut les contourner. Voir [Gardes](/commands/guards/), qui explique aussi pourquoi on veut généralement les deux.

`nsfw: true` marque une commande comme réservée aux adultes. Discord applique la restriction, le bot n'a rien à vérifier.

`ctx.audit` enregistre qui a fait quoi. Il ne fait rien tant qu'un [journal d'audit](/data/audit/) n'est pas configuré.

## Noms localisés

Discord peut afficher une commande sous un nom et une description différents selon la langue du client. Donnez les traductions à côté des originaux :

```ts title="features/general/help.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "help",
  description: "Show help",
  nameLocalizations: { fr: "aide", de: "hilfe", "es-ES": "ayuda" },
  descriptionLocalizations: { fr: "Afficher l'aide", de: "Hilfe anzeigen" },
  options: {
    topic: s.string({
      description: "Topic",
      nameLocalizations: { fr: "sujet" },
      descriptionLocalizations: { fr: "Le sujet" },
    }),
  },
  run: (ctx) => ctx.reply.info(ctx.options.topic ?? "Pick a topic."),
});
```

Un utilisateur français tape alors `/aide sujet:...`. Votre code ne change pas : la commande est toujours routée comme `help` et l'option est toujours `ctx.options.topic`.

- Les clés sont des chaînes `Locale` de discord.js : `"fr"`, `"de"`, `"es-ES"`, `"pt-BR"`, `"ja"` et ainsi de suite. L'espagnol est `es-ES`, pas `es`.
- Les localisations existent sur les commandes, les options et les [sous-commandes](/commands/subcommands/). Les [menus contextuels](/commands/context-menus/) n'ont pas de description : ils prennent seulement `nameLocalizations`.
- Un nom localisé suit la même règle que l'original : 1-32 caractères, en minuscules, sans espaces. Sinon, Discord rejette le déploiement.
- Les localisations font partie de ce qui est déployé : ajouter une traduction redéploie donc la commande.

:::note[Localisation et traduction sont deux choses différentes]
`nameLocalizations` change ce que le sélecteur de commandes affiche. Cela ne traduit pas ce que votre gestionnaire répond : c'est le rôle de `ctx.t()`, décrit dans [Internationalisation](/data/i18n/). Les deux sont indépendants.
:::

## Référence

### `defineCommand(input)`

Prend un `CommandInput` et renvoie un `CommandDefinition`, un objet simple marqué `kind: "command"`.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `name` | `string` | obligatoire | Ce que les utilisateurs tapent après `/`. Minuscules, 1-32 caractères. |
| `description` | `string` | obligatoire | Affichée dans le sélecteur de commandes. 1-100 caractères. |
| `options` | `OptionMap` | `{}` | Options typées, construites avec `s.*`. Pilote `ctx.options`. À omettre quand on utilise des sous-commandes. Voir [Options et autocomplétion](/commands/options/). |
| `run` | `(ctx) => unknown` | - | Le gestionnaire, synchrone ou asynchrone. Facultatif uniquement quand la commande a des sous-commandes. |
| `guards` | `Guard[]` | `[]` | Conditions préalables vérifiées avant `run`, et avant toute sous-commande. Voir [Gardes](/commands/guards/). |
| `subcommands` | `Record<string, SubcommandDefinition>` | - | Sous-commandes, indexées par nom. Voir [Sous-commandes](/commands/subcommands/). |
| `groups` | `Record<string, SubcommandGroupDefinition>` | - | Groupes de sous-commandes, indexés par nom. |
| `defer` | `DeferOption` | `defaults.defer` | Accuse réception de l'interaction pour un gestionnaire lent. Voir [Différé automatique](/basics/automatic-deferral/). |
| `defaultMemberPermissions` | `PermissionResolvable` | - | Permissions dont un membre a besoin pour voir et utiliser la commande par défaut. |
| `nsfw` | `boolean` | - | Marque la commande comme réservée aux adultes. |
| `integrationTypes` | `("guild" \| "user")[]` | défini par Discord | Où la commande peut être installée. Voir [Contextes d'installation](/commands/install-contexts/). |
| `contexts` | `("guild" \| "botDm" \| "privateChannel")[]` | défini par Discord | Où la commande peut être utilisée. |
| `dmPermission` | `boolean` | - | Déprécié par Discord au profit de `contexts`. Utilisez `contexts: ["guild"]` pour garder une commande hors des messages privés. |
| `nameLocalizations` | `LocalizationMap` | - | Nom de la commande par langue, par exemple `{ fr: "aide" }`. |
| `descriptionLocalizations` | `LocalizationMap` | - | Description par langue. |
| `guilds` | `string[]` | - | Déploie la commande uniquement sur ces identifiants de serveur. À omettre pour une commande globale. Voir [Déployer les commandes](/production/deploying/). |

Le gestionnaire reçoit un `CommandContext` : tout ce que reçoit chaque gestionnaire, plus `ctx.options` (typé d'après `options`) et `ctx.showModal`. Tout est décrit dans [L'objet ctx](/basics/context/). Ce que `run` renvoie est ignoré. Une promesse renvoyée est attendue, et tout ce qu'elle lève part vers la barrière d'erreurs décrite dans [Erreurs](/api/errors/).

`CommandInput` et `CommandDefinition` sont exportés en tant que types, pour le code qui construit ou inspecte des commandes.

## Limites et erreurs

`defineCommand` vérifie la définition dès que le fichier est importé. Une erreur arrête le bot au démarrage avec un message qui nomme le champ, là où Discord aurait seulement répondu `400 Invalid Form Body` au moment du déploiement.

| Règle | Limite | Erreur |
| --- | --- | --- |
| Nom d'une commande, d'une sous-commande, d'un groupe ou d'une option | 1-32 caractères, minuscules, lettres, chiffres, `-` et `_`, sans espaces | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| Description, localisation la plus longue comprise | 1-100 caractères | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Options d'une commande | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Noms, descriptions et choix d'une commande, additionnés | 8000 caractères | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Commandes slash dans une même portée (globale, ou un seul serveur) | 100 | [`DJSBOT_E015`](/api/errors/#djsbot_e015), levée par le déploiement |
| Deux commandes slash avec le même nom | interdit | [`DJSBOT_E010`](/api/errors/#djsbot_e010) |

Les limites sur les choix, les longueurs et les types de fichiers sont listées dans [Options et autocomplétion](/commands/options/#limits-and-errors). Si vous atteignez 100 commandes, regroupez les commandes proches en [sous-commandes](/commands/subcommands/) ou limitez-en certaines à des serveurs précis avec `guilds`.

Quand Discord envoie une commande que le bot en cours d'exécution ne connaît pas (la liste déployée est plus ancienne ou plus récente que le code), l'utilisateur reçoit le message `unknownCommand`, que vous pouvez reformuler dans [Formulations et thème](/basics/wording-and-theme/). Déployer à nouveau règle le problème.

## Voir aussi

- [Options et autocomplétion](/commands/options/)
- [Sous-commandes](/commands/subcommands/)
- [Gardes](/commands/guards/)
- [L'objet ctx](/basics/context/)
- [Déployer les commandes](/production/deploying/)
