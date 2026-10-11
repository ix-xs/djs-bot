---
title: "Sharding"
description: "Répartissez un grand bot sur plusieurs connexions à la passerelle avec une seule option. Vos commandes, événements et services restent les mêmes ; cette page couvre ce qui change autour : tâches planifiées, déploiements, contrôles de santé et tout ce qui est gardé en mémoire."
sidebar:
  order: 2
---

Un shard est une connexion à la passerelle (gateway) qui dessert une partie de
vos serveurs. Discord impose le sharding à partir de 2 500 serveurs, et vous
pouvez l'activer plus tôt pour répartir la charge. Le framework s'occupe du
câblage : le processus que vous lancez devient un gestionnaire qui démarre un
enfant par shard, et chaque enfant exécute votre bot comme d'habitude.

## Activer le sharding

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  sharding: "auto",
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

`"auto"` (ou `true`) demande à Discord combien de shards le bot nécessite. Pour
décider vous-même, passez un objet :

```ts
sharding: { totalShards: 4, mode: "process", respawn: true },
```

Rien d'autre ne change dans votre code. discord.js lit l'attribution du shard
dans ce que le gestionnaire transmet à chaque enfant, donc un gestionnaire est
identique, shardé ou non.

## Ce qui démarre où

Avec `sharding` défini, `bot.start()` se comporte différemment selon qui l'appelle.

| Processus | Ce que fait `bot.start()` |
| --- | --- |
| Celui que vous lancez (le gestionnaire) | Charge le bot, démarre les shards, puis rend la main. Il ne se connecte jamais à Discord, donc `bot.client` lève une erreur à cet endroit. |
| Chaque shard | Se connecte et exécute le bot : gestionnaires, événements, tâches planifiées, serveur de santé. |

Trois conséquences méritent d'être connues :

- Le gestionnaire démarre chaque shard en réexécutant le fichier avec lequel le
  processus a été lancé, avec les mêmes options de Node (donc un chargeur
  TypeScript comme `tsx` continue de fonctionner). Ce fichier doit donc appeler
  lui-même `bot.start()`. Gardez la ligne
  `if (!process.env.DJSBOT_CLI) void bot.start();` à la fin de votre fichier
  d'entrée.
- Le gestionnaire charge vos fonctionnalités et construit vos services comme
  n'importe quel autre processus, il saute seulement la connexion. Un service qui
  ouvre une connexion à une base de données en ouvre aussi une dans le
  gestionnaire.
- Les commandes CLI qui se contentent d'inspecter le bot (`deploy`, `clear`,
  `doctor`, `explain`) ne démarrent jamais de shards.

Lancez un bot shardé comme n'importe quel autre : `node dist/index.js` sur votre
fichier d'entrée compilé, ou `npx djs-bot start`. La recette
[Hébergement](/recipes/hosting/) explique comment garder ce processus en vie. Le
gestionnaire journalise `Spawned shard` pour chaque enfant, `Shard died`
quand l'un d'eux s'arrête, et `All shards spawned` une fois qu'ils sont tous
démarrés.

## Données entre les shards

Chaque shard ne connaît que ses propres serveurs, et tout ce qui est gardé en
mémoire appartient à un seul shard : les caches de discord.js, un
`memoryStore()`, les compteurs derrière `cooldown()` et `rateLimit()`, un
`TTLCache`, les chiffres de `bot.stats()`. Tout ce qui doit être identique
partout doit aller dans une base de données partagée par les shards.

Pour lire une valeur auprès de tous les shards, utilisez l'assistant de
discord.js sur `ctx.client.shard`. Il vaut `null` quand le bot n'est pas shardé,
donc prévoyez une solution de repli :

```ts title="src/features/stats/stats.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "stats",
  description: "Global stats",
  run: async (ctx) => {
    const counts = await ctx.client.shard?.fetchClientValues("guilds.cache.size");
    const total =
      (counts as number[] | undefined)?.reduce((a, b) => a + b, 0) ?? ctx.client.guilds.cache.size;
    await ctx.reply.info(`Serving ${total} servers.`);
  },
});
```

Les diffusions fonctionnent de la même façon, via `ctx.client.shard.broadcastEval(...)`.

## Tâches planifiées et déploiements

Chaque shard exécute votre code, donc une tâche planifiée s'exécuterait une fois
par shard. C'est correct pour un travail qui parcourt les serveurs du shard, et
faux pour quelque chose qui ne doit arriver qu'une fois. L'option `shard` d'une
tâche planifiée tranche :

| `shard` | S'exécute sur | À utiliser pour |
| --- | --- | --- |
| `"all"` (défaut) | Chaque shard | Un travail sur les serveurs propres à chaque shard |
| `"first"` | Seulement le shard qui possède l'identifiant 0 | Une annonce quotidienne, une sauvegarde, un appel d'API unique |

```ts title="src/features/digest/digest.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "daily-digest",
  schedule: "0 9 * * *",
  shard: "first",
  run: async (ctx) => {
    ctx.logger.info({}, "Posting the daily digest");
  },
});
```

Sur un bot qui n'est pas shardé, les deux valeurs se comportent de la même façon :
la tâche s'exécute. Les autres options des tâches planifiées sont sur la page
[Tâches planifiées](/events/jobs/).

Le déploiement automatique au démarrage suit la même règle : seul le shard 0
déploie, donc les commandes sont enregistrées une fois par démarrage et non une
fois par shard. Déployer avec `npx djs-bot deploy` n'est pas concerné, puisqu'il
ne se connecte jamais à la passerelle. Voir [Déployer les commandes](/production/deploying/).

## La santé par shard

Chaque shard démarre son propre [serveur de santé](/production/health/) et ne
rend compte que de lui-même. Le JSON de `/metrics` gagne un champ `shard`, ici
pour le troisième de quatre shards :

```json
"shard": { "id": 2, "count": 4 }
```

Dans le format Prometheus, chaque série porte à la place le label `shard="2"`,
ce qui permet de distinguer les shards sur un tableau de bord. Les compteurs, et
`guilds` en particulier, sont ceux de ce shard et non de l'ensemble du bot. Le
gestionnaire n'a pas de serveur de santé, parce qu'il ne se connecte jamais.

:::caution[Un port par shard]
Tous les shards lisent la même configuration, donc avec `health: 3000` ils
demandent tous le port 3000 sur la même machine. Le premier l'obtient. Les
autres journalisent `Health server failed to start` et continuent sans serveur
de santé.
:::

En mode `process`, discord.js donne à chaque enfant son identifiant de shard dans
la variable d'environnement `SHARDS`, ce qui suffit pour répartir les ports :

```ts
health: 3000 + Number(process.env.SHARDS ?? 0),   // shard 0 sur 3000, shard 1 sur 3001...
```

En mode `worker`, les threads partagent un même environnement et cette variable
n'est pas définie. La même valeur est disponible sous la forme
`workerData.SHARDS` depuis `node:worker_threads`.

## Référence

### `sharding`

Le champ `sharding` de [`defineBot`](/basics/configuration/).

| Valeur | Effet |
| --- | --- |
| omis, `false` | Pas de sharding : un processus, une connexion. |
| `true`, `"auto"` | Sharding avec toutes les valeurs par défaut ci-dessous. |
| `ShardingOptions` | Sharding avec vos réglages. Les champs omis prennent leur valeur par défaut. |

### `ShardingOptions`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `totalShards` | `number \| "auto"` | `"auto"` | Combien de shards démarrer. `"auto"` laisse Discord décider. |
| `mode` | `"process" \| "worker"` | `"process"` | `"process"` crée un processus enfant par shard. `"worker"` utilise des worker threads dans un seul processus. |
| `respawn` | `boolean` | `true` | Redémarrer un shard quand il s'arrête. |

### `normalizeSharding(input)`

Transforme la valeur souple de `sharding` (`true`, `"auto"` ou des options
partielles) en `ShardingOptions` complètes avec les valeurs par défaut
ci-dessus.

### `isShardChild()`

Renvoie `true` dans un processus ou un thread démarré par un gestionnaire de
shards, qui doit exécuter le bot, et `false` dans le gestionnaire (et dans un
bot qui n'est pas shardé). Utilisez-le pour garder le travail réservé au
gestionnaire hors des shards.

Dans le gestionnaire, la réponse reste `false`, avant comme après `bot.start()`.

```ts title="src/index.ts"
import { defineBot, env, isShardChild } from "@ix-xs/djs-bot";

const bot = defineBot({ token: env("DISCORD_TOKEN"), sharding: "auto" });

export default bot;

if (!process.env.DJSBOT_CLI) {
  if (!isShardChild()) bot.logger.info({}, "Starting the shard manager");
  await bot.start();
}
```

### `launchShardManager(entryFile, token, options, logger)`

Ce que `bot.start()` appelle dans le gestionnaire. Elle crée un
`ShardingManager` de discord.js pour `entryFile`, transmet aux enfants les
options actuelles de Node, journalise la vie de chaque shard, et se résout avec
le gestionnaire une fois que tous les shards ont été démarrés. Ne l'appelez vous-même
que si vous écrivez votre propre lanceur.

| Paramètre | Type | Description |
| --- | --- | --- |
| `entryFile` | `string` | Le fichier que chaque shard exécute. `bot.start()` passe le fichier avec lequel le processus a été lancé. |
| `token` | `string` | Le token du bot. |
| `options` | `ShardingOptions` | Nombre de shards, mode et redémarrage. |
| `logger` | `Logger` | Reçoit les événements des shards. |

## Voir aussi

- [Tâches planifiées](/events/jobs/) : toutes les options de `defineJob`.
- [Santé et métriques](/production/health/) : les points d'accès que chaque shard expose.
- [Déployer les commandes](/production/deploying/) : comment et quand les commandes sont enregistrées.
- [Store](/data/store/) : garder un état en dehors de la mémoire d'un seul shard.
- [Hébergement](/recipes/hosting/) : exécuter le gestionnaire sous systemd, Docker ou pm2.
