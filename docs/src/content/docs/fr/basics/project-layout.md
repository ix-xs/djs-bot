---
title: "Structure du projet"
description: "Comment un bot est organisé sur le disque : un fichier d'entrée, un dossier par fonctionnalité, et des suffixes de fichier qui disent au chargeur quoi importer."
sidebar:
  order: 1
---

Un bot, c'est un fichier d'entrée qui appelle `defineBot`, plus un dossier de
petits fichiers qui exportent chacun une définition (une commande, un bouton, un
événement...). Vous indiquez le dossier au bot et le chargeur retrouve les
fichiers grâce à leur nom. Pour créer cette structure en une seule commande,
voyez [Démarrage rapide](/quick-start/).

## Un projet typique

Regroupez les fichiers par fonctionnalité, pas par type : tout ce qui concerne
les tickets vit dans `features/tickets/`, quelle que soit sa nature. Le dossier
ne sert qu'à vous ; le chargeur regarde le suffixe du fichier.

```
src/
  index.ts                       # defineBot(...)
  features/
    ping/ping.command.ts         # slash command
    config/config.command.ts     # command with subcommands
    tickets/
      open.command.ts
      close.button.ts            # button
      tickets.service.ts         # injectable service
      tickets.feature.ts         # optional defineFeature() bundle
      helpers.ts                 # no suffix: never imported by the loader
    moderation/
      userinfo.user.ts           # user context menu
      report.message.ts          # message context menu
    fun/
      pong.trigger.ts            # message auto-responder
    welcome/welcome.event.ts     # gateway event
    cleanup/cleanup.job.ts       # scheduled job
```

Le fichier d'entrée donne le dossier à `features` :

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
});

export default bot;

// Démarre seulement quand le fichier est lancé directement (la CLI l'importe pour ses outils).
if (!process.env.DJSBOT_CLI) void bot.start();
```

Chaque fichier exporte le résultat d'une fonction `define*()` :

```ts title="src/features/ping/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply("Pong."),
});
```

Tout ce que `defineBot` accepte est décrit dans
[Configuration](/basics/configuration/).

## Suffixes de fichier

Le chargeur n'importe un fichier que si son nom, sans l'extension, se termine par
l'un de ces douze suffixes :

| Suffixe | Contient | Défini avec | Page |
| --- | --- | --- | --- |
| `.command` | Une commande slash | `defineCommand` | [Commandes slash](/commands/slash-commands/) |
| `.user` | Un menu contextuel d'utilisateur | `defineUserCommand` | [Menus contextuels](/commands/context-menus/) |
| `.message` | Un menu contextuel de message | `defineMessageCommand` | [Menus contextuels](/commands/context-menus/) |
| `.event` | Un écouteur d'événement de la passerelle (*gateway*) | `defineEvent` | [Événements et intents](/events/events-and-intents/) |
| `.trigger` | Un répondeur automatique aux messages | `defineTrigger` | [Déclencheurs de messages](/events/triggers/) |
| `.button` | Un bouton | `defineButton` | [Boutons](/components/buttons/) |
| `.select` | Un menu de sélection | `defineSelectMenu` et les variantes natives | [Menus de sélection](/components/select-menus/) |
| `.modal` | Une modale (formulaire) | `defineModal` | [Modales](/components/modals/) |
| `.service` | Un service injectable | `defineService` | [Services](/architecture/services/) |
| `.job` | Une tâche planifiée | `defineJob` | [Tâches planifiées](/events/jobs/) |
| `.plugin` | Un plugin | `definePlugin` | [Plugins et hooks](/architecture/plugins/) |
| `.feature` | Un lot de définitions | `defineFeature` | [Features](/architecture/features/) |

Les extensions acceptées sont `.ts`, `.mts`, `.cts`, `.js`, `.mjs` et `.cjs` : le
même dossier fonctionne donc depuis `src/` pendant le développement et depuis
`dist/` une fois compilé. Les fichiers de déclaration (`.d.ts`) sont ignorés.

Comme seuls les fichiers suffixés sont importés, les utilitaires (`utils.ts`,
`guards.ts`, `types.ts`) peuvent se trouver juste à côté de vos définitions. Le
suffixe doit être la dernière partie du nom : `ping.command.ts` est chargé,
`ping.command.test.ts` ne l'est pas.

## Comment fonctionne la découverte

Quand `features` est un dossier, le chargeur :

1. Le parcourt récursivement, à n'importe quelle profondeur. Les dossiers
   nommés `node_modules` sont ignorés.
2. Garde les fichiers qui portent un suffixe et les trie par chemin.
3. Les importe tous en parallèle, car le temps de démarrage d'un gros bot est
   surtout du chargement de modules.
4. Collecte toutes les définitions que chaque fichier exporte, export par défaut
   comme exports nommés, et les enregistre dans l'ordre trié. Le démarrage est
   rapide et reste pourtant déterministe.

Deux règles découlent de cette conception.

**Le suffixe décide si un fichier est chargé, jamais de ce qu'il enregistre.**
Le routage suit le `kind` de chaque définition exportée, que `define*()` fixe
pour vous. Un fichier peut donc exporter plusieurs définitions, de types
différents :

```ts title="src/features/tickets/close.button.ts"
import { ButtonStyle, defineButton, defineCommand, p, ui } from "@ix-xs/djs-bot";

export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string },
  label: "Close",
  style: ButtonStyle.Danger,
  run: (ctx) => ctx.update({ content: `Ticket ${ctx.params.ticketId} closed.`, components: [] }),
});

export const CloseCommand = defineCommand({
  name: "close",
  description: "Close the current ticket",
  run: (ctx) =>
    ctx.reply({
      content: "Close this ticket?",
      components: [ui.row(CloseTicket.build({ ticketId: ctx.channelId ?? "unknown" }))],
    }),
});
```

Les tableaux et les objets simples de définitions sont trouvés eux aussi :
`export default [CommandA, CommandB]` fonctionne.

**Importer un fichier n'enregistre rien.** Un fichier se contente d'exporter des
objets ; c'est le chargeur qui les collecte. Il n'y a aucun effet de bord à
l'import : l'ordre de chargement ne peut donc jamais changer le comportement, et
vous pouvez toujours remonter de ce que fait le bot à une définition explicite.
`npx djs-bot explain` affiche le résultat : voir [CLI](/api/cli/).

:::caution[Les chemins relatifs partent du répertoire de travail]
`features: "./features"` est résolu depuis le répertoire dans lequel le processus
a été lancé, pas depuis le fichier d'entrée. Construisez le chemin à partir de
`import.meta.dirname`, comme dans l'exemple ci-dessus, et il pointera vers le bon
dossier depuis `src/` comme depuis `dist/`, quel que soit le répertoire de
travail.
:::

## Enregistrer sans dossier

Le dossier est un confort, pas une obligation. `features` accepte aussi les
définitions elles-mêmes, et vous pouvez mélanger les deux formes :

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";
import ping from "./commands/ping.js";
import { CloseTicket } from "./tickets/close.js";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: [`${import.meta.dirname}/features`, ping, CloseTicket],
});
```

`bot.use(...)` ajoute des définitions après la création du bot, en plus de
`features`. Il est chaînable et doit être appelé avant le chargement du bot :

```ts
bot.use(ping, CloseTicket, someService);
```

Enregistrer deux fois la même définition est sans danger : une commande peut
vivre dans son propre fichier `*.command.ts` et figurer aussi dans un lot
`*.feature.ts`. Les définitions passées à `bot.use()` sont enregistrées en
premier, puis les entrées de `features` dans l'ordre où vous les avez écrites.

## Référence

### `FeatureSource`

Le type d'une entrée de `features`. L'option accepte l'une d'elles, ou un
tableau d'entrées.

| Forme | Type | Description |
| --- | --- | --- |
| Un dossier | `string` | Découvert par le chargeur comme décrit plus haut. Les chemins relatifs partent du répertoire de travail. |
| Une définition | `Registrable` | Tout résultat d'un `define*()`, y compris un lot `defineFeature()`. |
| Une liste | `Registrable[]` | Plusieurs définitions à la fois. |

### `Registrable`

Tout objet que le registre accepte. Le chargeur en reconnaît un grâce à sa
propriété `kind` et ignore tous les autres exports.

| `kind` | Créé par |
| --- | --- |
| `"command"` | `defineCommand` |
| `"userCommand"` | `defineUserCommand` |
| `"messageCommand"` | `defineMessageCommand` |
| `"event"` | `defineEvent` |
| `"trigger"` | `defineTrigger` |
| `"button"` | `defineButton` |
| `"select"` | `defineSelectMenu`, `defineUserSelect`, `defineRoleSelect`, `defineChannelSelect`, `defineMentionableSelect` |
| `"modal"` | `defineModal` |
| `"service"` | `defineService` |
| `"job"` | `defineJob` |
| `"plugin"` | `definePlugin` |
| `"feature"` | `defineFeature` |

## Limites et erreurs

| Situation | Résultat |
| --- | --- |
| Un fichier suffixé ne s'importe pas (erreur de syntaxe, module manquant) | [`DJSBOT_E060`](/api/errors/#djsbot_e060), avec le fichier et le message d'origine. |
| Un fichier suffixé n'exporte aucune définition | [`DJSBOT_E060`](/api/errors/#djsbot_e060). Un fichier reconnu qui ne contient rien d'utilisable est presque toujours une erreur, par exemple un `export` oublié. |
| Deux commandes différentes portent le même nom | [`DJSBOT_E010`](/api/errors/#djsbot_e010). |
| Deux boutons, menus de sélection ou modales différents partagent un identifiant | [`DJSBOT_E011`](/api/errors/#djsbot_e011). |
| Le dossier n'existe pas | Rien n'est chargé et aucune erreur n'est levée. Un bot qui démarre sans commandes a généralement un mauvais chemin dans `features`. |

Tout cela se produit pendant le chargement du bot, avant sa connexion à Discord :
voir [Cycle de vie](/basics/lifecycle/).

## Voir aussi

- [Démarrage rapide](/quick-start/) : installer le paquet et générer cette structure.
- [Configuration](/basics/configuration/) : toutes les options de `defineBot`.
- [Features](/architecture/features/) : regrouper des définitions liées en un pack réutilisable.
- [Services](/architecture/services/) : partager un état entre les fichiers d'une fonctionnalité.
- [CLI](/api/cli/) : `explain` et `doctor` montrent ce qui a été découvert.
