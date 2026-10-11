---
title: "Tâches planifiées"
description: "Une tâche planifiée exécute votre code selon une planification : toutes les quelques minutes, ou à une heure cron dans le fuseau horaire de votre choix. Chaque exécution a son propre logger, ne peut pas chevaucher la précédente sauf si vous l'autorisez, et est prévenue quand le bot s'arrête."
sidebar:
  order: 3
---

Utilisez une tâche planifiée pour le travail que personne ne demande : un résumé
quotidien, un nettoyage de nuit, un compteur rafraîchi toutes les dix minutes.
Vous décrivez quand elle s'exécute, et le framework gère les minuteurs, la
protection contre le chevauchement et l'arrêt.

## Une première tâche

```ts title="src/features/digest/digest.job.ts"
import { defineJob, env } from "@ix-xs/djs-bot";

export default defineJob({
  name: "daily-digest",
  schedule: "0 9 * * MON-FRI", // 09:00, du lundi au vendredi
  timezone: "Europe/Paris",
  run: async (ctx) => {
    const channel = await ctx.client.channels.fetch(env("DIGEST_CHANNEL_ID"));
    if (channel?.isSendable()) await channel.send("Good morning. Here is today's digest.");
    ctx.logger.info({}, "digest sent");
  },
});
```

Le chargeur prend en compte tout fichier dont le nom se termine par `.job` (voir
[Structure du projet](/basics/project-layout/)). Les tâches démarrent une fois le
bot connecté et prêt : `ctx.client` est donc utilisable tout de suite. `ctx`
contient aussi vos `services`, un `logger` qui étiquette chaque ligne avec le nom
de la tâche et un `correlationId` propre à l'exécution, ainsi qu'un `signal`
décrit [plus bas](#overlap-and-shutdown).

## Choisir une planification

`schedule` est une chaîne dans l'une de ces trois syntaxes :

| Syntaxe | Exemples | S'exécute |
| --- | --- | --- |
| Une durée | `"30s"`, `"5m"`, `"1h"`, `"1d"` | De façon répétée, avec cet intervalle, compté depuis le démarrage. |
| Une expression cron, 5 champs | `"0 3 * * *"`, `"*/15 * * * *"`, `"0 9 * * MON-FRI"`, `"0 0 1 JAN,JUL *"` | À des heures fixes de l'horloge. |
| Une macro | `"@hourly"`, `"@daily"`, `"@weekly"`, `"@monthly"`, `"@yearly"` | Une expression cron nommée. |

Choisissez une durée quand seul le rythme compte, et une expression cron quand
l'heure de la journée compte. `"1h"` signifie une heure après le démarrage du
bot, puis toutes les heures. `"0 * * * *"` signifie à la minute 0 de chaque
heure.

Les cinq champs cron sont la minute, l'heure, le jour du mois, le mois et le jour
de la semaine :

```
"0 9 * * MON-FRI"
 | | | | |
 | | | | day of week   (0-7 or SUN-SAT)
 | | | month           (1-12 or JAN-DEC)
 | | day of month      (1-31)
 | hour                (0-23)
 minute                (0-59)
```

Une expression cron est lue dans l'heure locale de la machine qui exécute le
bot, sauf si vous définissez `timezone` avec un nom de fuseau IANA comme
`"Europe/Paris"` ou `"UTC"`. Définissez-le dès que l'heure de la journée compte
pour vos utilisateurs : une machine d'hébergement est souvent en UTC. `timezone`
n'a aucun effet sur une durée.

La grammaire complète est dans la [référence](#schedule-syntax).

## Chevauchement et arrêt

Par défaut, une tâche ne se chevauche jamais elle-même. Si une exécution est
encore en cours quand la suivante est due, cette suivante est ignorée, pas mise
en file d'attente (l'omission est journalisée au niveau debug). Augmentez
`concurrency` pour autoriser plusieurs exécutions en même temps.

Chaque exécution reçoit aussi `ctx.signal`, un `AbortSignal` qui se déclenche
quand le bot s'arrête. Une tâche longue devrait le vérifier entre deux étapes, ou
le transmettre à tout ce qui accepte un signal, pour que le bot puisse s'arrêter
rapidement :

```ts title="src/features/stats/member-counts.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "member-counts",
  schedule: "10m",
  run: async (ctx) => {
    for (const guild of ctx.client.guilds.cache.values()) {
      if (ctx.signal.aborted) return; // le bot est en train de s'arrêter
      // "stats" est l'un de vos propres services
      await ctx.services.stats.record(guild.id, guild.memberCount);
    }
  },
});
```

À l'arrêt, les minuteurs s'arrêtent, le signal est interrompu, et le bot attend
jusqu'à 10 secondes que les exécutions en cours se terminent avant de continuer.

## Exécuter au démarrage

Une tâche s'exécute d'abord quand sa planification le dit : après un intervalle
complet pour une durée, à la prochaine minute correspondante pour une expression
cron. Ajoutez `runOnStart: true` pour l'exécuter aussi une fois dès que le bot
est prêt, par exemple pour remplir un cache qu'une exécution ultérieure ne fait
que rafraîchir.

```ts title="src/features/prices/refresh.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "refresh-prices",
  schedule: "15m",
  runOnStart: true,
  run: async (ctx) => {
    const response = await fetch("https://example.com/prices.json", { signal: ctx.signal });
    ctx.logger.info({ status: response.status }, "prices refreshed");
  },
});
```

## Les tâches sur un bot shardé

Sur un bot shardé, chaque shard est un processus distinct qui exécute tout votre
code, tâches comprises. Une tâche s'exécuterait donc une fois par shard. L'option
`shard` décide si c'est ce que vous voulez :

| `shard` | S'exécute sur | À utiliser pour |
| --- | --- | --- |
| `"all"` (par défaut) | Chaque shard | Le travail sur les serveurs du shard, comme une boucle sur `ctx.client.guilds.cache`. Chaque shard gère ses propres serveurs, donc rien n'est fait deux fois. |
| `"first"` | Uniquement le shard qui possède l'identifiant de shard 0 | Le travail qui doit avoir lieu une seule fois pour tout le bot : une annonce quotidienne, un nettoyage de données partagées. |

```ts title="src/features/cleanup/cleanup.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "nightly-cleanup",
  schedule: "0 3 * * *",
  shard: "first", // une fois pour tout le bot, pas une fois par shard
  run: async (ctx) => {
    // "db" est l'un de vos propres services
    await ctx.services.db.purgeExpired();
    ctx.logger.info({}, "cleanup done");
  },
});
```

Sur un bot qui n'est pas shardé, les deux valeurs se comportent de la même façon.
Tout le reste au sujet des shards se trouve sur la page
[Sharding](/production/sharding/).

## Référence

### `defineJob(input)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | Un nom unique, utilisé dans les journaux et par `djs-bot explain`. |
| `schedule` | `string` | - | Une durée, une expression cron à 5 champs ou une macro. Voir la [syntaxe des planifications](#schedule-syntax). |
| `timezone` | `string` | heure locale de l'hôte | Fuseau IANA dans lequel une expression cron est évaluée, par exemple `"Europe/Paris"`. Ignoré pour une durée. |
| `concurrency` | `number` | `1` | Combien d'exécutions peuvent être actives en même temps. Une exécution qui dépasserait cette limite est ignorée. |
| `runOnStart` | `boolean` | `false` | Exécute aussi une fois quand le bot est prêt, en plus de la planification. |
| `shard` | `"all" \| "first"` | `"all"` | Sur un bot shardé : chaque shard, ou uniquement celui qui possède l'identifiant de shard 0. |
| `run` | `(ctx: JobContext) => unknown` | - | Le travail à faire à chaque exécution. Peut être asynchrone. |

Renvoie un `JobDefinition` (`kind: "job"`), à exporter depuis un fichier `.job`
ou à lister dans une [feature](/architecture/features/). La planification est
analysée quand `defineJob` est appelé.

### `JobContext`

| Propriété | Type | Description |
| --- | --- | --- |
| `client` | `Client<true>` | Le client connecté. |
| `services` | `ServiceMap` | Vos [services](/architecture/services/), typés. |
| `logger` | `Logger` | Un logger étiqueté avec le nom de la tâche et le `correlationId` de cette exécution. |
| `signal` | `AbortSignal` | Interrompu quand le bot s'arrête. |
| `correlationId` | `string` | Un identifiant unique pour cette exécution. Chaque ligne journalisée via `logger` le porte. |

### Syntaxe des planifications

**Durées.** Un nombre suivi d'une unité, sans espaces : `ms`, `s`, `m`, `h`, `d`
ou `w`. Les unités peuvent être combinées (`"1h30m"`). Une chaîne composée
uniquement de chiffres est un nombre de millisecondes. Les mois et les années ne
sont pas acceptés, et la durée doit être supérieure à zéro.

**Expressions cron.** Exactement cinq champs séparés par des espaces :

| Champ | Valeurs | Noms |
| --- | --- | --- |
| Minute | `0-59` | - |
| Heure | `0-23` | - |
| Jour du mois | `1-31` | - |
| Mois | `1-12` | `JAN` à `DEC` |
| Jour de la semaine | `0-7` (`0` et `7` sont dimanche) | `SUN` à `SAT` |

Chaque champ accepte ces formes. Les noms ne sont pas sensibles à la casse.

| Forme | Exemple | Signification |
| --- | --- | --- |
| Tout | `*` | Chaque valeur. |
| Valeur | `5`, `JAN` | Cette valeur uniquement. |
| Liste | `1,15`, `JAN,JUL` | Chaque valeur de la liste. Un élément peut avoir n'importe quelle autre forme. |
| Plage | `1-5`, `MON-FRI` | Du premier au dernier, tous deux inclus. |
| Pas | `*/10` | Une valeur sur 10, à partir de la plus basse. |
| Début avec pas | `5/15` | À partir de 5, toutes les 15 : `5`, `20`, `35`, `50`. |
| Plage avec pas | `1-10/2` | `1`, `3`, `5`, `7`, `9`. |

Une plage doit aller vers le haut. `SAT-SUN` et `FRI-MON` sont rejetés parce que
dimanche vaut `0` : écrivez `SAT,SUN` ou `6-7`.

Comme dans le cron standard, quand **à la fois** le jour du mois et le jour de la
semaine sont restreints, la tâche s'exécute dès que l'un des deux correspond :
`"0 0 1 * MON"` signifie le 1er du mois, et chaque lundi.

**Macros.** Non sensibles à la casse.

| Macro | Équivalent à | S'exécute |
| --- | --- | --- |
| `@hourly` | `0 * * * *` | À la minute 0 de chaque heure. |
| `@daily`, `@midnight` | `0 0 * * *` | Chaque jour à minuit. |
| `@weekly` | `0 0 * * 0` | Chaque dimanche à minuit. |
| `@monthly` | `0 0 1 * *` | Le 1er de chaque mois à minuit. |
| `@yearly`, `@annually` | `0 0 1 1 *` | Le 1er janvier à minuit. |

### `parseSchedule(schedule)`

L'analyseur utilisé par `defineJob`, exporté pour que vous puissiez valider une
planification qui vient d'un fichier de configuration ou d'un utilisateur.

```ts title="scripts/check-schedule.ts"
import { parseSchedule } from "@ix-xs/djs-bot";

parseSchedule("5m"); // { type: "interval", ms: 300000 }
parseSchedule("0 3 * * *"); // { type: "cron", fields: [...] }
parseSchedule("every day"); // lève une Error qui dit ce qui ne va pas
```

Elle renvoie un `ParsedSchedule` : `{ type: "interval", ms }` pour une durée,
`{ type: "cron", fields }` pour une expression cron ou une macro.

## Limites et erreurs

- **Une planification invalide échoue immédiatement.** `defineJob` lève
  [`DJSBOT_E080`](/api/errors/#djsbot_e080) quand la planification ne peut pas
  être analysée : vous le découvrez au démarrage et pas à 3 h du matin. Dans un
  fichier découvert automatiquement, le chargeur la signale par
  [`DJSBOT_E060`](/api/errors/#djsbot_e060), avec le nom du fichier et la raison.
- **Un `timezone` inconnu échoue de la même façon.** `defineJob` lève
  [`DJSBOT_E080`](/api/errors/#djsbot_e080) avec le détail
  `unknown timezone "X"` quand le fuseau n'est pas un nom IANA connu.
- **Une tâche qui lève une erreur n'arrête pas la planification.** L'erreur est
  journalisée avec le nom de la tâche et son `correlationId`, puis transmise à
  chaque hook `onError` des plugins et au `onError` de `defineBot`, sans `ctx`.
  L'exécution suivante a lieu comme prévu. Voir [Erreurs](/api/errors/).
- **Le cron travaille à la minute.** Une tâche cron se déclenche au début de la
  minute. Il n'y a pas de champ pour les secondes, et les extensions `?`, `L`,
  `W` et `#` ne sont pas prises en charge. Pour tout ce qui est plus court
  qu'une minute, utilisez une durée.
- **Les exécutions manquées ne sont pas rattrapées.** Les planifications vivent
  en mémoire. Une exécution qui était due pendant que le bot était hors ligne
  n'est pas rejouée, et une durée recommence à compter à chaque démarrage.
- **Heure d'été.** Une heure cron qui n'existe pas le jour où les horloges
  avancent est ignorée ce jour-là, et une heure qui se produit deux fois quand
  elles reculent s'exécute deux fois.
- **La limite de concurrence est propre à chaque processus.** Sur un bot shardé
  avec `shard: "all"`, chaque shard compte ses propres exécutions.

## Voir aussi

- [Sharding](/production/sharding/) : ce qui change d'autre quand le bot tourne sur plusieurs shards.
- [Services](/architecture/services/) : donner à une tâche l'accès à une base de données ou à un client d'API.
- [Cycle de vie](/basics/lifecycle/) : quand les tâches démarrent et ce qui se passe à l'arrêt.
- [Tests](/production/testing/) : exécuter une tâche une fois dans un test, avec de faux services.
- [Journalisation](/production/logging/) : suivre une exécution grâce à son `correlationId`.
