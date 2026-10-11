---
title: "Features"
description: "Une feature regroupe des commandes, des composants, des événements, des services et des tâches planifiées en une unité fermée avec un contrat déclaré. Utilisez-la pour partager une capacité complète, comme les tickets ou les niveaux, entre plusieurs bots ou pour la publier comme paquet npm."
sidebar:
  order: 3
---

Dans votre propre bot, un dossier de fichiers suffit : le chargeur trouve chaque
définition grâce au nom de son fichier. `defineFeature` sert quand vous voulez
une liste explicite à la place, pour l'une de ces trois raisons : le code se
trouve en dehors de votre dossier de features, il a besoin de quelque chose du
bot hôte et doit le dire, ou vous voulez le publier.

## Une première feature

```ts title="src/features/tickets/tickets.feature.ts"
import { defineFeature } from "@ix-xs/djs-bot";
import Open from "./open.command.js";
import { CloseTicket } from "./close.button.js";
import { Tickets } from "./tickets.service.js";

export default defineFeature({
  name: "tickets",
  requires: ["db"], // le bot hôte doit fournir un service "db"
  commands: [Open],
  buttons: [CloseTicket],
  services: [Tickets],
});
```

Une feature est une liste de définitions que vous savez déjà écrire, plus un nom
et un contrat. En plus de `commands`, `buttons` et `services`, elle accepte
`userCommands`, `messageCommands`, `events`, `triggers`, `selectMenus`, `modals`,
`jobs` et `plugins`. Enregistrer la feature enregistre tout ce qu'elle liste.

## Charger une feature

Il y a trois façons de confier une feature au bot.

**Laisser le chargeur la trouver.** Dans votre dossier de features, nommez le
fichier avec le suffixe `.feature`, comme ci-dessus (voir
[Structure du projet](/basics/project-layout/)).

**La passer explicitement.** `features` accepte côte à côte des dossiers et des
définitions, ce qui est la façon de charger une feature qui vient d'un paquet :

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";
import tickets from "./features/tickets/tickets.feature.js";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: [`${import.meta.dirname}/features`, tickets],
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

**L'ajouter dans le code.** `bot.use(tickets)` l'enregistre en plus de
`features`, avant le démarrage du bot.

Dans cet exemple, la feature et ses fichiers sont trouvés deux fois : une fois
par le chargeur, une fois par l'entrée explicite. Ce n'est pas grave. Un même
objet n'est jamais enregistré qu'une seule fois, donc une commande peut vivre
dans son propre fichier `.command` **et** être listée dans une feature.

## Déclarer ce dont elle a besoin

Une feature qui lit `ctx.services.db` ne fonctionne que dans un bot qui a un
service `db`. `requires` énonce cette dépendance, et le framework la vérifie au
démarrage, avant que le bot se connecte :

```ts
defineFeature({
  name: "tickets",
  requires: ["db", "store"],
  commands: [Open],
});
```

Si rien ne fournit `db`, le bot refuse de démarrer avec
[`DJSBOT_E040`](/api/errors/#djsbot_e040) et nomme ce qui manque :

```text
BotError [DJSBOT_E040]: Feature contract not satisfied: feature "tickets" requires "db"
```

Sans `requires`, la même erreur n'apparaîtrait que plus tard, sous la forme d'un
service inconnu à la première interaction qui l'utilise.

Une exigence est satisfaite par un `defineService` portant ce token (où qu'il
soit enregistré, y compris dans une autre feature), par un plugin ou une feature
qui la liste dans `provides`, ou par l'option correspondante de `defineBot` pour
les `store`, `audit` et `flags` intégrés.

`provides` est l'autre côté du contrat. Les services qu'une feature liste
comptent déjà sous leur propre token : vous n'avez donc besoin de `provides` que
pour une capacité qui n'est pas un `defineService`, par exemple une valeur
enregistrée par un plugin que la feature embarque.

Les règles exactes, et le champ `conflicts` des plugins, sont décrits sous
[Contrats de capacités](/architecture/services/#capability-contracts).

## Publier une feature

Une feature est un simple objet : une feature publiée est donc un paquet npm
ordinaire dont le fichier d'entrée l'exporte. Le bot qui l'installe l'ajoute à
`features` et fournit ce dont la feature a besoin :

```ts title="src/index.ts"
import { defineBot, env, memoryStore } from "@ix-xs/djs-bot";
import tickets from "djs-bot-tickets"; // un paquet qui exporte le résultat d'un defineFeature()

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  store: memoryStore(), // satisfait requires: ["store"]
  features: [`${import.meta.dirname}/features`, tickets],
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

Une feature peut embarquer un plugin dans `plugins` quand elle a aussi besoin de
hooks ou d'une ressource partagée. Les consignes de packaging sont les mêmes que
pour un plugin : voir
[Publier un plugin](/architecture/plugins/#publish-a-plugin).

## Référence

### `defineFeature(input)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | Le nom de la feature, utilisé dans les journaux, dans les messages d'erreur et par `djs-bot explain`. |
| `requires` | `string[]` | `[]` | Capacités que le bot hôte, ou une autre feature, doit fournir. Sinon le démarrage échoue avec [`DJSBOT_E040`](/api/errors/#djsbot_e040). |
| `provides` | `string[]` | `[]` | Capacités que cette feature offre, que d'autres peuvent lister dans `requires`. |
| `config` | `Record<string, unknown>` | `{}` | Configuration par défaut de la feature, de forme libre. Elle est stockée sur la définition sous le nom `config` ; le framework ne la lit pas. |
| `commands` | `CommandDefinition[]` | `[]` | Commandes slash à enregistrer. |
| `userCommands` | `UserCommandDefinition[]` | `[]` | Commandes de menu contextuel d'utilisateur à enregistrer. |
| `messageCommands` | `MessageCommandDefinition[]` | `[]` | Commandes de menu contextuel de message à enregistrer. |
| `events` | `EventDefinition[]` | `[]` | Écouteurs d'événements à enregistrer. |
| `triggers` | `TriggerDefinition[]` | `[]` | Déclencheurs de messages à enregistrer. |
| `buttons` | `ButtonDefinition[]` | `[]` | Boutons à enregistrer. |
| `selectMenus` | `AnySelectDefinition[]` | `[]` | Menus de sélection à enregistrer, de tout type (chaîne, utilisateur, rôle, salon, mentionnable). |
| `modals` | `ModalDefinition[]` | `[]` | Modales à enregistrer. |
| `services` | `ServiceDefinition[]` | `[]` | Services à enregistrer. |
| `jobs` | `JobDefinition[]` | `[]` | Tâches planifiées à enregistrer. |
| `plugins` | `PluginDefinition[]` | `[]` | Plugins à enregistrer. |

Renvoie un `FeatureDefinition` (`kind: "feature"`) dans lequel chaque liste est
remplie, vide quand vous l'avez omise.

Chaque type de définition a sa propre page :
[commandes slash](/commands/slash-commands/),
[menus contextuels](/commands/context-menus/),
[événements](/events/events-and-intents/), [déclencheurs](/events/triggers/),
[boutons](/components/buttons/), [menus de sélection](/components/select-menus/),
[modales](/components/modals/), [services](/architecture/services/),
[tâches planifiées](/events/jobs/) et [plugins](/architecture/plugins/).

## Limites et erreurs

- **Enregistrer deux fois n'est sans conséquence que pour le même objet.** Deux
  définitions différentes qui partagent un nom de commande ou un identifiant de
  composant arrêtent quand même le démarrage
  ([`DJSBOT_E010`](/api/errors/#djsbot_e010),
  [`DJSBOT_E011`](/api/errors/#djsbot_e011)).
- **Un `requires` non satisfait arrête le démarrage** avec
  [`DJSBOT_E040`](/api/errors/#djsbot_e040). Rien n'est connecté ni déployé avant
  la vérification.
- **Une feature ne peut pas contenir d'autres features.** Listez plusieurs
  features côte à côte dans `features`.
- **Les définitions embarquées se comportent comme les autres.** Les événements
  et les déclencheurs d'une feature comptent pour les intents automatiques, ses
  commandes sont déployées avec les autres, et ses plugins sont initialisés avec
  les autres.
- **Qu'est-ce qui est chargé ?** `npx djs-bot explain` liste les features par
  nom, avec toutes les définitions qu'elles ont enregistrées. Voir
  [CLI](/api/cli/).

## Voir aussi

- [Structure du projet](/basics/project-layout/) : comment le chargeur trouve les fichiers, et quand un dossier suffit.
- [Services](/architecture/services/) : les services qu'une feature embarque ou exige, et les contrats de capacités.
- [Plugins et hooks](/architecture/plugins/) : un comportement pour chaque interaction, qu'une feature peut embarquer.
- [Configuration](/basics/configuration/) : le champ `features` de `defineBot` et `bot.use()`.
