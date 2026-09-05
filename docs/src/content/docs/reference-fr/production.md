---
title: "Production - déploiement, résilience, ops"
description: "Déploiement des commandes, résilience, health checks, sharding et présence."
sidebar:
  label: "Production"
  order: 9
---

## Déploiement des commandes

Discord a deux portées :

| Portée | Propagation | Usage |
| --- | --- | --- |
| **Globale** | jusqu'à **~1 heure** | Commandes pour tous les serveurs. |
| **Serveur** | **instantanée** | Dev, ou commandes limitées à certains serveurs. |

Par défaut, une commande est **globale**. Ajoute `guilds: ["id", …]` pour ne la
déployer que sur ces serveurs. Tu peux mélanger librement.

### Le déployeur différentiel

`djs-bot deploy` calcule le plan, compare **chaque cible** à Discord et ne pousse
que le delta.

Le déploiement est **déclaratif** : ton code est la source de vérité.

- une commande **nouvelle** → ajoutée,
- une commande **modifiée** (description, option, permissions, localisations,
  portée, **y compris une option de sous-commande**) → mise à jour,
- une commande **supprimée du code** → retirée.

Tu ne supprimes jamais une commande à la main.

### Auto-purge des serveurs

Si tu cesses de cibler un serveur entier, `djs-bot` s'en souvient (dans
`.djs-bot/deploy-state.json`, gitignoré) et **purge** les commandes de ce serveur
au déploiement suivant.

### En développement

Le bot **auto-déploie instantanément sur ton serveur de dev** au démarrage quand
`NODE_ENV !== "production"`, en y reflétant **toutes** les commandes.

> ⚠️ **Piège des doublons** : ce miroir de dev crée des commandes **de serveur**.
> Si tu déploies ensuite les mêmes commandes en **global**, elles apparaîtront en
> double dans ce serveur. `djs-bot deploy` t'avertit et te donne la commande pour
> nettoyer : `djs-bot clear --guild <id>`.

### API programmatique

| Fonction | Rôle |
| --- | --- |
| `bot.deploy({ guildId?, dryRun? })` | Réconcilie. Sans `guildId` : plan réel (global + serveurs ciblés). |
| `bot.clear({ guildId?, dryRun? })` | Vide un scope (serveur, ou global si omis). |
| `planDeployment(registry)` | Renvoie `{ global, guilds }` sans rien pousser. |
| `deployCommands(registry, options)` | Bas niveau : `{ token, clientId, guildId?, knownGuilds?, dryRun?, logger? }`. |
| `clearCommands(options)` | Bas niveau. |
| `closeRestConnections()` | Ferme proprement le pool HTTP (utile pour un script one-shot). |

Un `DeployTargetResult` contient : `scope` (`"global"`/`"guild"`), `guildId`,
`added`, `changed`, `removed`, `unchanged`, `applied`.

## Résilience

Primitives pour durcir les appels aux bases et API tierces.

### Limiteur de débit

```ts
const limiteur = createRateLimiter({ limit: 100, window: "1h" });
const { allowed, remaining, resetMs } = limiteur.consume(cléApi);
```

| Élément | Rôle |
| --- | --- |
| `createRateLimiter({ limit, window })` | Fenêtre fixe, indexée par une clé libre. |
| `.consume(clé, coût?)` | Enregistre un passage. Renvoie `{ allowed, remaining, resetMs }`. |
| `.reset(clé)` | Réinitialise la fenêtre d'une clé. |
| `rateLimit({...})` | La version **guard** (voir [Guards](/djs-bot/reference-fr/guards/)). |

### Disjoncteur (circuit breaker)

Après trop d'échecs, il « ouvre » et échoue immédiatement, protégeant la
dépendance en difficulté, puis retente avant de se refermer.

```ts
const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeout: "30s" });
try {
  const data = await breaker.execute(() => appelApiInstable());
} catch (err) {
  if (err instanceof CircuitOpenError) { /* échec rapide : l'API est down */ }
}
```

| Option | Défaut | Rôle |
| --- | --- | --- |
| `failureThreshold` | `5` | Échecs consécutifs avant ouverture. |
| `resetTimeout` | `"30s"` | Durée d'ouverture avant un essai. |
| `successThreshold` | `1` | Succès nécessaires pour se refermer depuis « demi-ouvert ». |
| `isFailure` | tout compte | Décide si une erreur compte comme un échec. |
| `onOpen` / `onClose` | - | Callbacks de changement d'état. |

`breaker.status` renvoie `"closed"`, `"open"` ou `"half-open"`.

### Retry & timeout

```ts
const data = await retry(() => appelApi(), { attempts: 5, delay: 300, backoff: 2 });
const vite = await timeout(appelApi(), 5000, "API trop lente");
```

| Option de `retry` | Défaut | Rôle |
| --- | --- | --- |
| `attempts` | `3` | Nombre total de tentatives. |
| `delay` | `200` | Délai de base en ms. |
| `backoff` | `2` | Multiplicateur exponentiel. |
| `maxDelay` | - | Plafond du délai. |
| `shouldRetry` | - | `(erreur, tentative) => boolean`. |
| `onRetry` | - | Appelé avant chaque nouvelle tentative. |

## Health checks & métriques

```ts
const bot = defineBot({ health: 3000 }); // ou { port, host }
```

| Route | Signification |
| --- | --- |
| `GET /healthz` | `200` tant que le processus vit (**liveness**). |
| `GET /readyz` | `200` quand la passerelle est connectée, sinon `503` (**readiness**). |
| `GET /metrics` | `200` JSON : uptime, compteurs d'interactions/commandes/erreurs, serveurs, shard. |

| Option | Rôle |
| --- | --- |
| `port` | Port d'écoute (défaut `3000`). |
| `host` | Interface d'écoute. |
| `onError` | Appelé si le serveur ne peut pas démarrer (port occupé…). |

> Un conflit de port **ne fait jamais planter le bot** : l'erreur est signalée et
> le bot continue. Le serveur est aussi `unref` : il n'empêche pas la sortie du
> processus.

Besoin du serveur seul ? `startHealthServer(() => status, { port })`.

## Sharding

```ts
const bot = defineBot({ sharding: "auto" }); // ou true, ou { totalShards, mode, respawn }
```

Le processus que tu lances devient un **manager** qui relance **ton fichier
d'entrée** une fois par shard ; chaque enfant exécute le bot normalement. Ton code
est identique, shardé ou non.

| Option | Défaut | Rôle |
| --- | --- | --- |
| `totalShards` | `"auto"` | Nombre de shards, ou `"auto"` (Discord décide). |
| `mode` | `"process"` | `"process"` (processus enfants) ou `"worker"` (threads). |
| `respawn` | `true` | Relance un shard qui meurt. |

Garde le motif `if (!process.env.DJSBOT_CLI) bot.start();` : le manager réexécute
ton entrée. En introspection (`explain`/`doctor`), le sharding est ignoré.

Travail inter-shards via discord.js :

```ts
const counts = await ctx.client.shard?.fetchClientValues("guilds.cache.size");
const total = (counts as number[] | undefined)?.reduce((a, b) => a + b, 0) ?? ctx.client.guilds.cache.size;
```

Helpers : `isShardChild()`, `normalizeSharding(input)`, `launchShardManager(...)`.

## Présence

Voir aussi [Configuration](/djs-bot/reference-fr/configuration/).

```ts
bot.setActivity("avec le feu", { type: ActivityType.Playing, status: "dnd" });
bot.setPresence({ status: "online", activities: [{ name: "vous", type: ActivityType.Watching }] });
```

## Ce qui est prêt pour la production

- **Logs structurés** : JSON en production, lisibles en dev, avec un
  `correlationId` sur chaque interaction. Les erreurs sont sérialisées
  complètement (message, stack, code `DJSBOT_Exxx`).
- **Frontières d'erreur** : un handler qui lève est journalisé **et** répond à
  l'utilisateur ; le processus reste en vie.
- **Arrêt gracieux** : `SIGTERM`/`SIGINT` stoppent les jobs, exécutent les hooks
  `onShutdown`, démontent les plugins et détruisent le client.
- **Déploiements différentiels** : rien n'est poussé si rien n'a changé.
