---
title: "Présence"
description: "Choisissez le point de statut et la ligne d'activité affichés sous le nom de votre bot : définissez-les une fois dans la configuration, faites-en alterner plusieurs, ou changez-les pendant que le bot tourne."
sidebar:
  order: 6
---

La présence est ce que les membres voient sur le profil du bot et dans la liste
des membres : un statut (en ligne, inactif, ne pas déranger, invisible) et une
activité comme « Écoute /help ». C'est un moyen peu coûteux d'indiquer aux gens
comment commencer, ou que le bot est en maintenance.

## Une première présence

Définissez `presence` dans `defineBot`. Elle est envoyée pendant la connexion du
bot, donc le bot n'apparaît jamais sans elle.

```ts title="src/index.ts"
import { defineBot, env, ActivityType } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  presence: {
    status: "online",
    activities: [{ name: "/help", type: ActivityType.Listening }],
  },
});
```

Les membres voient maintenant « Écoute /help » sous le nom du bot. Sans `type`,
une activité s'affiche comme « Joue à ».

## Faire alterner les présences

`presenceRotation` parcourt une liste de présences à intervalle fixe.

```ts title="src/index.ts"
import { defineBot, env, ActivityType } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  presenceRotation: {
    interval: "30s",
    items: [
      { status: "online", activities: [{ name: "/help", type: ActivityType.Listening }] },
      { status: "online", activities: [{ name: "over 12 servers", type: ActivityType.Watching }] },
      { status: "idle", activities: [{ name: "maintenance", type: ActivityType.Playing }] },
    ],
  },
});
```

La rotation démarre quand le bot est prêt. Le premier élément est appliqué
aussitôt, puis le suivant après chaque intervalle, dans l'ordre, et la liste
recommence quand elle arrive à la fin. `interval` est une chaîne de durée comme
`"30s"`, `"5m"` ou `"1h30m"`, ou un nombre de millisecondes. La rotation
s'arrête à l'arrêt du bot.

Comme le premier élément est appliqué dès que le bot est prêt, il remplace
`presence`. Définir les deux n'a de sens que si vous voulez afficher quelque
chose de précis pendant les quelques instants avant que le bot soit prêt.

:::caution[Définissez le statut sur chaque élément]
Un élément sans `status` conserve le statut que le bot a déjà. Dans l'exemple
ci-dessus, si les deux premiers éléments ne disaient pas `"online"`, le bot
passerait en inactif au troisième élément et le resterait ensuite. Il en va de
même pour un élément sans `activities` : l'activité actuelle reste.
:::

## La modifier à l'exécution

L'instance du bot a deux méthodes. Les deux exigent un bot connecté.

```ts
// Une activité, avec un type et un statut facultatifs :
bot.setActivity("with fire", { type: ActivityType.Playing, status: "dnd" });

// La présence complète :
bot.setPresence({ status: "online", activities: [{ name: "you", type: ActivityType.Watching }] });
```

Les gestionnaires ne reçoivent pas l'instance du bot. Ils reçoivent le client
discord.js sous la forme `ctx.client`, et `ctx.client.user.setPresence(...)` est
exactement ce que `bot.setPresence` appelle.

```ts title="features/admin/maintenance.command.ts"
import { defineCommand, ownerOnly, ActivityType } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "maintenance",
  description: "Show the bot as under maintenance",
  guards: [ownerOnly()],
  run: async (ctx) => {
    ctx.client.user.setPresence({
      status: "dnd",
      activities: [{ name: "maintenance", type: ActivityType.Playing }],
    });
    await ctx.reply.success("Presence updated.");
  },
});
```

Les éléments d'une rotation sont figés quand le bot est configuré. Pour un texte
qui change, comme un nombre de serveurs en direct, mettez plutôt la présence à
jour depuis une [tâche planifiée](/events/jobs/) :

```ts title="features/presence/server-count.job.ts"
import { defineJob, ActivityType } from "@ix-xs/djs-bot";

export default defineJob({
  name: "server-count",
  schedule: "10m",
  runOnStart: true,
  run: (ctx) => {
    const count = ctx.client.guilds.cache.size;
    ctx.client.user.setActivity(`${count} servers`, { type: ActivityType.Watching });
  },
});
```

:::caution[Une rotation écrase les modifications manuelles]
La rotation ne connaît pas les présences que vous définissez vous-même : son
prochain passage les remplace. Utilisez soit `presenceRotation`, soit des
modifications à l'exécution, pas les deux.
:::

## Types d'activité et statut

`ActivityType` est réexporté depuis discord.js. Le type décide des mots affichés
avant le nom.

| Type | Affiché comme |
| --- | --- |
| `ActivityType.Playing` | Joue à **nom** (la valeur par défaut) |
| `ActivityType.Streaming` | En direct sur **nom**. Exige une `url` Twitch ou YouTube. |
| `ActivityType.Listening` | Écoute **nom** |
| `ActivityType.Watching` | Regarde **nom** |
| `ActivityType.Competing` | Participe à **nom** |
| `ActivityType.Custom` | **nom** seul, sans préfixe |

Le statut est le point coloré :

| Statut | Signification |
| --- | --- |
| `"online"` | Point vert. La valeur par défaut. |
| `"idle"` | Lune jaune. |
| `"dnd"` | Panneau rouge « Ne pas déranger ». |
| `"invisible"` | Affiché comme hors ligne, alors que le bot continue de fonctionner. |

## Référence

### `presence`

```ts
presence?: PresenceData
```

La présence avec laquelle le bot se connecte. Par défaut : en ligne, sans
activité. Quand elle n'est pas définie, c'est la `presence` donnée dans l'option
`client` de `defineBot` qui est utilisée.

### `presenceRotation`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `interval` | `string \| number` | requis | Durée pendant laquelle chaque présence reste : une chaîne de durée ou des millisecondes. Une chaîne qui ne peut pas être lue comme une durée revient à 60 secondes. |
| `items` | `PresenceData[]` | requis | Les présences à parcourir, dans l'ordre. Une liste vide désactive la rotation. |

### `PresenceData`

Le type discord.js utilisé par chaque option et méthode de cette page.

| Champ | Type | Défaut | Description |
| --- | --- | --- | --- |
| `status` | `"online" \| "idle" \| "dnd" \| "invisible"` | le statut actuel | Le point de statut. |
| `activities` | `{ name, type?, state?, url? }[]` | les activités actuelles | Ce que fait le bot. Un tableau vide efface l'activité. |
| `afk` | `boolean` | `false` | Marque le bot comme éloigné du clavier. |
| `shardId` | `number \| number[]` | tous les shards | Limite le changement à certains shards de ce processus. |

Dans une activité, `name` est obligatoire, `type` est un `ActivityType`, `url`
est le lien du flux pour `Streaming`, et `state` est le texte d'une activité
`Custom` (quand il est omis, `name` est utilisé).

### `bot.setPresence(presence)`

```ts
bot.setPresence(presence: PresenceData): void
```

Remplace la présence. Les champs omis conservent leur valeur actuelle, comme
décrit plus haut.

### `bot.setActivity(name, options?)`

```ts
bot.setActivity(name: string, options?: { type?: ActivityType; url?: string; status?: PresenceStatusData }): void
```

Un raccourci pour une présence avec exactement une activité.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `type` | `ActivityType` | `ActivityType.Playing` | Les mots affichés avant le nom. |
| `url` | `string` | aucun | Une URL Twitch ou YouTube, pour `ActivityType.Streaming`. |
| `status` | `"online" \| "idle" \| "dnd" \| "invisible"` | le statut actuel | Le point de statut. |

## Limites et erreurs

- `bot.setPresence` et `bot.setActivity` lèvent
  `Bot has not started yet - call bot.start() first.` quand ils sont appelés avant
  `bot.start()`. Appelez-les depuis du code qui s'exécute une fois le bot prêt :
  un gestionnaire, un événement, une tâche planifiée.
- Chaque changement est un message sur la connexion à la passerelle (gateway), et
  Discord limite leur débit. Un intervalle de quelques dizaines de secondes
  suffit largement pour une rotation ; ne descendez pas sous quelques secondes.
- Sur un bot [shardé](/production/sharding/), chaque shard exécute sa propre
  rotation et définit sa propre présence. Le processus gestionnaire ne se
  connecte jamais, donc les deux méthodes de `bot` n'y sont pas utilisables.
- Voir la présence des autres membres est un autre sujet : cela exige l'intent
  privilégié `GuildPresences`, traité dans
  [Événements et intents](/events/events-and-intents/). Définir la présence du
  bot lui-même n'exige aucun intent.

## Voir aussi

- [Configuration](/basics/configuration/) pour les autres options de `defineBot`.
- [Tâches planifiées](/events/jobs/) pour mettre à jour la présence selon une planification.
- [Cycle de vie](/basics/lifecycle/) pour ce qui s'exécute quand le bot devient prêt.
- [Sharding](/production/sharding/) pour exécuter plusieurs processus.
