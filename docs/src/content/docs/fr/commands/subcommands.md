---
title: "Sous-commandes"
description: "Les sous-commandes divisent une commande slash en plusieurs actions, comme /config view et /config set. Chacune a ses propres options typées et son propre gestionnaire, et le framework route vers la bonne."
sidebar:
  order: 3
---

## Une première sous-commande

Placez les actions sous `subcommands`, indexées par nom, et construisez chacune avec `subcommand()`.

```ts title="features/config/config.command.ts"
import { defineCommand, subcommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "config",
  description: "Manage server configuration",

  // /config view    et    /config set key:<...> value:<...>
  subcommands: {
    view: subcommand({
      description: "Show the config",
      run: (ctx) => ctx.reply.info("Current config: ..."),
    }),
    set: subcommand({
      description: "Set a value",
      options: {
        key: s.string({ description: "Key", required: true }),
        value: s.string({ description: "Value", required: true }),
      },
      run: (ctx) => ctx.reply.success(`**${ctx.options.key}** = \`${ctx.options.value}\``),
    }),
  },
});
```

- Le routage est automatique. Il n'y a pas de `switch (interaction.options.getSubcommand())` à écrire : le bon `run` est appelé avec les bonnes options.
- Chaque sous-commande a ses propres `options` : le `ctx.options` de chaque gestionnaire est donc typé avec précision. `view` n'en a aucune, `set` a `key` et `value`.
- Une commande avec des sous-commandes n'a pas besoin de `run` propre.

Les options fonctionnent exactement comme sur une commande simple, autocomplétion comprise : voir [Options et autocomplétion](/commands/options/).

## Groupes

Un groupe est un dossier de sous-commandes. Il ajoute un niveau : `/config role add` et `/config role remove`.

```ts title="features/config/config.command.ts"
import { defineCommand, subcommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "config",
  description: "Manage server configuration",

  subcommands: {
    view: subcommand({
      description: "Show the config",
      run: (ctx) => ctx.reply.info("Current config: ..."),
    }),
  },

  // /config role add role:<@role>    et    /config role remove role:<@role>
  groups: {
    role: {
      description: "Manage auto-roles",
      subcommands: {
        add: subcommand({
          description: "Add an auto-role",
          options: { role: s.role({ description: "Role", required: true }) },
          run: (ctx) => ctx.reply.success(`Added ${ctx.options.role}`),
        }),
        remove: subcommand({
          description: "Remove an auto-role",
          options: { role: s.role({ description: "Role", required: true }) },
          run: (ctx) => ctx.reply.success(`Removed ${ctx.options.role}`),
        }),
      },
    },
  },
});
```

Un groupe est un simple objet avec une `description` et ses `subcommands`. Il n'a pas de constructeur et pas de gestionnaire. Une commande peut mélanger des sous-commandes directes et des groupes, comme ci-dessus.

Discord autorise deux niveaux, pas plus : `/commande sous-commande` et `/commande groupe sous-commande`. Un groupe ne peut pas en contenir un autre.

## Gardes et différé

Les gardes peuvent se trouver sur la commande, sur une sous-commande, ou sur les deux. Les gardes de la commande s'exécutent d'abord, puis celles de la sous-commande. Mettez sur la commande ce qui s'applique à tout, et les exceptions sur les feuilles :

```ts title="features/config/config.command.ts"
import {
  defineCommand,
  subcommand,
  s,
  inGuild,
  hasPermission,
  cooldown,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";

export default defineCommand({
  name: "config",
  description: "Manage server configuration",
  guards: [inGuild()],                                        // toutes les sous-commandes
  subcommands: {
    view: subcommand({
      description: "Show the config",
      run: (ctx) => ctx.reply.info("Current config: ..."),
    }),
    reset: subcommand({
      description: "Reset everything",
      guards: [hasPermission(PermissionFlagsBits.ManageGuild), cooldown("1m")],   // celle-ci seulement
      defer: "ephemeral",
      run: (ctx) => ctx.reply.success("Configuration reset."),
    }),
  },
});
```

`defer` suit la même idée : le `defer` d'une sous-commande remplace celui de la commande, qui remplace la valeur par défaut valable pour tout le bot. Voir [Différé automatique](/basics/automatic-deferral/).

Tout le reste se règle sur la commande et s'applique à tout l'arbre, car Discord ne connaît qu'une seule commande : `defaultMemberPermissions`, `nsfw`, `integrationTypes`, `contexts` et `guilds`. Une sous-commande qui exige une permission plus stricte que ses sœurs prend une [garde](/commands/guards/).

## Référence

### `subcommand(input)`

Prend un `SubcommandInput` et renvoie un `SubcommandDefinition`. Son nom est la clé sous laquelle vous la rangez dans `subcommands`.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `description` | `string` | obligatoire | Affichée sous la sous-commande dans Discord. 1-100 caractères. |
| `run` | `(ctx) => unknown` | obligatoire | Le gestionnaire, synchrone ou asynchrone. `ctx.options` est typé d'après `options`. |
| `options` | `OptionMap` | `{}` | Options de cette sous-commande uniquement, construites avec `s.*`. |
| `guards` | `Guard[]` | `[]` | Vérifiées avant `run`, après les gardes de la commande parente. |
| `defer` | `DeferOption` | le `defer` de la commande | Remplace le réglage de la commande parente. Voir [Différé automatique](/basics/automatic-deferral/). |
| `nameLocalizations` | `LocalizationMap` | - | Nom de la sous-commande par langue. Voir [Noms localisés](/commands/slash-commands/#localized-names). |
| `descriptionLocalizations` | `LocalizationMap` | - | Description par langue. |

Le gestionnaire reçoit le même `CommandContext` qu'une commande simple, décrit dans [L'objet ctx](/basics/context/).

### `subcommands`

Un champ de [`defineCommand`](/commands/slash-commands/#definecommandinput) : `Record<string, SubcommandDefinition>`. Les clés sont les noms des sous-commandes.

### `groups`

Un champ de `defineCommand` : `Record<string, SubcommandGroupDefinition>`. Les clés sont les noms des groupes. Un groupe est composé de :

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `description` | `string` | obligatoire | Affichée sous le groupe dans Discord. 1-100 caractères. |
| `subcommands` | `Record<string, SubcommandDefinition>` | obligatoire | Les sous-commandes du groupe, par nom. |

`SubcommandInput`, `SubcommandDefinition` et `SubcommandGroupDefinition` sont exportés en tant que types.

## Limites et erreurs

Vérifiées par `defineCommand` quand le fichier est importé :

| Règle | Limite | Erreur |
| --- | --- | --- |
| Nom d'une sous-commande ou d'un groupe | 1-32 caractères, minuscules, lettres, chiffres, `-` et `_` | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| Description d'une sous-commande ou d'un groupe | 1-100 caractères | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Sous-commandes et groupes d'une même commande, ensemble | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Sous-commandes d'un même groupe | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Options d'une même sous-commande | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Noms, descriptions et choix de toute la commande | 8000 caractères | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |

:::caution[La commande de base cesse d'exister]
Dès qu'une commande a des sous-commandes ou des groupes, `/config` seule ne peut plus être exécutée : Discord n'offre que les feuilles. Un `options` ou un `run` de premier niveau sur la même commande n'est pas déployé et n'est jamais appelé.
:::

Si Discord envoie une sous-commande que le bot en cours d'exécution ne connaît pas (l'arbre déployé est périmé), l'utilisateur reçoit le message `unknownSubcommand`, que vous pouvez reformuler dans [Formulations et thème](/basics/wording-and-theme/). Déployer à nouveau règle le problème.

## Voir aussi

- [Commandes slash](/commands/slash-commands/)
- [Options et autocomplétion](/commands/options/)
- [Gardes](/commands/guards/)
- [Tests](/production/testing/)
