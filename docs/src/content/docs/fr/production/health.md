---
title: "Santé et métriques"
description: "Un petit serveur HTTP qui indique à un orchestrateur, à un moniteur de disponibilité ou à un tableau de bord si votre bot est vivant, s'il est connecté à Discord, et quelle quantité de travail il effectue."
sidebar:
  order: 3
---

Le serveur de santé est intégré au framework et n'a aucune dépendance. Il
répond sur trois routes : une pour la vivacité, une pour la disponibilité et une
pour les métriques, en JSON ou au format texte de Prometheus.

## L'activer

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  health: 3000,
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

Un nombre est le port. Pour choisir aussi l'interface, passez un objet :

```ts
health: { port: env.number("PORT", 3000), host: "127.0.0.1" },
```

Le serveur démarre quand le bot devient prêt et journalise
`Health server listening`. Il est fermé par `bot.shutdown()`, et il ne maintient
jamais le processus en vie à lui seul.

Un port déjà pris ne fait pas planter le bot. La santé n'est pas essentielle,
donc l'échec est journalisé sous le nom `Health server failed to start`, transmis
à `health.onError` si vous en avez défini un, et le bot continue de tourner sans
serveur de santé.

## Points d'accès

| Route | Statut | Corps | Signification |
| --- | --- | --- | --- |
| `GET /healthz` | toujours `200` | `{ status, uptimeMs }` | Vivacité : le processus tourne et répond. |
| `GET /readyz` | `200` ou `503` | `{ ready }` | Disponibilité : `200` tant que la connexion à la passerelle (gateway) est prête, `503` sinon. |
| `GET /metrics` | `200` | l'état complet, en JSON | Temps de fonctionnement, compteurs, latence, et le shard quand le bot est shardé. |
| `GET /metrics?format=prometheus` | `200` | texte Prometheus | Les mêmes chiffres, prêts à être collectés. Également servi quand l'en-tête `Accept` commence par `text/plain`. |
| toute autre route | `404` | `{ error }` | |

```bash
curl localhost:3000/healthz
# {"status":"ok","uptimeMs":128374}

curl localhost:3000/readyz
# {"ready":true}
```

:::note[La vivacité n'est pas la disponibilité]
Utilisez `/healthz` pour décider s'il faut redémarrer le processus, et `/readyz`
pour décider si le bot est en service. Redémarrer un bot qui ne fait que se
reconnecter transforme un à-coup en panne.
:::

## Métriques

```jsonc
// GET /metrics
{
  "ready": true,
  "uptimeMs": 84213,
  "metrics": {
    "interactions": 1240, "commands": 830, "components": 390, "modals": 20,
    "autocompletes": 64, "guardRejections": 12, "errors": 3,
    "handlerAvgMs": 41.7, "handlerMaxMs": 912.4,
    "guilds": 57, "wsPingMs": 38, "memoryRssMb": 142
  },
  "shard": { "id": 0, "count": 4 }
}
```

| Métrique | Signification |
| --- | --- |
| `interactions` | Interactions reçues, de tout type. |
| `commands` | Commandes slash et de menu contextuel acheminées vers un gestionnaire. |
| `components` | Interactions de boutons et de menus de sélection acheminées vers un gestionnaire. |
| `modals` | Soumissions de modales acheminées vers un gestionnaire. |
| `autocompletes` | Requêtes d'autocomplétion auxquelles un gestionnaire a répondu. |
| `guardRejections` | Interactions refusées par une garde. |
| `errors` | Gestionnaires, événements, déclencheurs, tâches planifiées et hooks qui ont levé une erreur. |
| `handlerAvgMs` | Durée moyenne d'une interaction, gardes et middleware compris. |
| `handlerMaxMs` | La plus lente observée. |
| `guilds` | Serveurs présents dans le cache de ce processus. |
| `wsPingMs` | Latence du battement de cœur de la passerelle. `0` jusqu'au premier battement. |
| `memoryRssMb` | Mémoire résidente du processus. |

Chaque valeur est calculée à l'arrivée de la requête, et les compteurs
repartent de zéro au redémarrage du processus. `shard` n'est présent que sur un
bot [shardé](/production/sharding/), où chaque shard rend compte de lui-même.

Les compteurs et les deux durées sont aussi disponibles dans le code, sans le
serveur, via `bot.stats()` :

```ts
const stats = bot.stats();
bot.logger.info({ errors: stats.errors, avgMs: stats.handlerAvgMs }, "Hourly report");
```

`guilds`, `wsPingMs` et `memoryRssMb` sont ajoutés par le serveur de santé et ne
font pas partie de `bot.stats()`.

## Prometheus

```bash
curl "localhost:3000/metrics?format=prometheus"
# # TYPE djsbot_ready gauge
# djsbot_ready{shard="0"} 1
# # TYPE djsbot_uptime_ms gauge
# djsbot_uptime_ms{shard="0"} 128374
# # TYPE djsbot_interactions gauge
# djsbot_interactions{shard="0"} 842
# # TYPE djsbot_handler_avg_ms gauge
# djsbot_handler_avg_ms{shard="0"} 41.7
```

Un nom de métrique est la clé JSON en snake case avec le préfixe `djsbot_` :
`handlerAvgMs` devient `djsbot_handler_avg_ms`. Deux séries viennent en premier,
`djsbot_ready` (`1` ou `0`) et `djsbot_uptime_ms`. Chaque série est déclarée
comme une jauge (*gauge*), et porte un label `shard` sur un bot shardé (aucun
label sinon).

```yaml title="prometheus.yml"
scrape_configs:
  - job_name: discord-bot
    metrics_path: /metrics
    params: { format: [prometheus] }
    static_configs: [{ targets: ["bot:3000"] }]
```

## Sondes et supervision

Le serveur démarre quand le bot est prêt pour la première fois. Jusque-là, le
port est fermé, donc une sonde est refusée. Donnez aux sondes un délai de
démarrage qui couvre la connexion.

```yaml title="deployment.yaml"
livenessProbe:
  httpGet: { path: /healthz, port: 3000 }
  initialDelaySeconds: 20
  periodSeconds: 30
readinessProbe:
  httpGet: { path: /readyz, port: 3000 }
  periodSeconds: 10
```

Pour Docker, la ligne `HEALTHCHECK` et le reste de la configuration du
conteneur se trouvent dans la recette [Hébergement](/recipes/hosting/).

Pour un moniteur de disponibilité (UptimeRobot, Better Stack, une tâche cron
avec `curl`), pointez-le vers `/readyz` : il passe au rouge quand le bot ne
répond pas à Discord, ce que vivent vos utilisateurs.

:::caution[Ne l'exposez pas publiquement]
`/metrics` révèle le nombre de serveurs et des éléments internes, et le serveur
n'a aucune authentification. Liez-le à une interface privée avec `host`, ou
gardez-le derrière votre pare-feu ou votre reverse proxy.
:::

## Un serveur autonome

`startHealthServer` lance le même serveur en dehors de `defineBot` : pour un
processus worker, ou pour publier vos propres compteurs. Vous fournissez une
fonction qui renvoie l'état. Elle est appelée à chaque requête, donc les chiffres
sont toujours à jour.

```ts title="src/worker.ts"
import { startHealthServer } from "@ix-xs/djs-bot";

const started = Date.now();
let processed = 0;

const server = startHealthServer(
  () => ({
    ready: true,
    uptimeMs: Date.now() - started,
    metrics: { processed },
  }),
  {
    port: 3000,
    host: "127.0.0.1",
    onError: (error) => console.error("health server:", error.message),
  },
);

// Plus tard, pour l'arrêter :
server.close();
```

Si vous avez déjà un serveur HTTP, gardez-le et utilisez `toPrometheus` pour
produire vous-même le texte. Ici, les compteurs du bot sont publiés avec l'un
des vôtres :

```ts title="src/metrics.ts"
import { toPrometheus } from "@ix-xs/djs-bot";
import bot from "./index.js";
import { queue } from "./queue.js";

export function metricsText(): string {
  const { uptimeMs, ...counters } = bot.stats();
  return toPrometheus({
    ready: bot.client.isReady(),
    uptimeMs,
    metrics: { ...counters, queueSize: queue.size },
  });
}
```

## Référence

### `health`

Le champ `health` de [`defineBot`](/basics/configuration/) : un numéro de port,
ou des `HealthOptions`. Omettez-le et aucun serveur n'est démarré.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `port` | `number` | `3000` | Port d'écoute. |
| `host` | `string` | toutes les interfaces | Interface à laquelle se lier. |
| `onError` | `(error: Error) => void` | écrit sur stderr | Appelé quand le serveur ne peut pas se lier. Dans `defineBot`, le bot journalise d'abord l'échec, puis l'appelle. |

### `startHealthServer(getStatus, options)`

Démarre le serveur et renvoie le `http.Server` de Node. `getStatus` est une
fonction qui renvoie un [`HealthStatus`](/production/health/#healthstatus) et qui est appelée
une fois par requête. `options` est le tableau `HealthOptions` ci-dessus et peut
être omis. Le serveur ne maintient pas le processus en vie, et un échec de liaison
est transmis à `onError` au lieu d'être levé.

### `HealthStatus`

La forme renvoyée par `/metrics`, et l'argument de `toPrometheus`.

| Champ | Type | Description |
| --- | --- | --- |
| `ready` | `boolean` | Indique si le bot est connecté et prêt. Pilote `/readyz`. |
| `uptimeMs` | `number` | Millisecondes de fonctionnement. Avec `defineBot`, compté depuis la création du bot. |
| `metrics` | `Record<string, number>` | Les compteurs. Toute clé que vous ajoutez en mode autonome est exportée aussi. |
| `shard` | `{ id: number; count: number }?` | Le shard, quand le bot est shardé. |

### `toPrometheus(status)`

Produit un `HealthStatus` au format d'exposition texte de Prometheus et renvoie
la chaîne. Servez-la avec le type de contenu
`text/plain; version=0.0.4; charset=utf-8`.

### `bot.stats()`

Renvoie un instantané `BotStats`. Il fonctionne avant que le bot ait démarré,
avec tous les compteurs à zéro.

| Champ | Type | Description |
| --- | --- | --- |
| `uptimeMs` | `number` | Millisecondes écoulées depuis que ce processus a créé le bot. |
| `interactions` | `number` | Interactions reçues, de tout type. |
| `commands` | `number` | Commandes slash et de menu contextuel acheminées vers un gestionnaire. |
| `components` | `number` | Interactions de boutons et de menus de sélection acheminées vers un gestionnaire. |
| `modals` | `number` | Soumissions de modales acheminées vers un gestionnaire. |
| `autocompletes` | `number` | Requêtes d'autocomplétion auxquelles il a été répondu. |
| `guardRejections` | `number` | Interactions refusées par une garde. |
| `errors` | `number` | Gestionnaires, événements, déclencheurs, tâches planifiées et hooks qui ont levé une erreur. |
| `handlerAvgMs` | `number` | Durée moyenne d'un gestionnaire en millisecondes, arrondie à deux décimales. |
| `handlerMaxMs` | `number` | Gestionnaire le plus lent observé, en millisecondes. |

## Voir aussi

- [Hébergement](/recipes/hosting/) : des configurations Docker, systemd et pm2 qui utilisent ces points d'accès.
- [Sharding](/production/sharding/) : un serveur de santé par shard, et comment donner un port à chacun.
- [Journalisation](/production/logging/) : l'autre moitié pour savoir ce que fait le bot.
- [Erreurs](/api/errors/) : ce qui alimente le compteur `errors`.
