---
title: "Mettre à niveau"
description: "Ce qui change d'une version mineure à la suivante. Les anciens noms fonctionnent jusqu'à la 2.0 et avertissent une fois chacun : chaque ancien nom, son code d'avertissement, et ce qu'il faut écrire à la place."
---

| | |
| --- | --- |
| Anciens noms | Fonctionnent encore, affichent un `DeprecationWarning` chacun avec son code, supprimés en 2.0 |
| Node.js | Inchangé depuis la 1.4 : 22.23.4, 24.22.1, 26.12.1 ou plus |
| discord.js | 14.27 ou plus sur la 14 |
| node-comfort | 3.1 ou plus depuis la 1.7 (3.0 avant), installé avec le paquet |

```bash
npm install @ix-xs/djs-bot@latest
```

## Retrouver les anciens noms

La première utilisation d'un ancien nom affiche un `DeprecationWarning` avec son code, par exemple `DJS_BOT_DEP_ENV`, et le nom à utiliser à la place.

```bash
# où chaque ancien nom est utilisé
node --trace-deprecation dist/index.js

# faire échouer les tests au premier ancien nom
NODE_OPTIONS=--throw-deprecation npm test
```

```ts
// les recueillir dans un bot en marche
process.on("warning", (warning) => {
  if ((warning as { code?: string }).code?.startsWith("DJS_BOT_DEP_")) console.warn(warning.message);
});
```

Un avertissement n'apparaît que pour du code qui s'exécute. Pour trouver chaque utilisation, cherchez dans le code les noms ci-dessous.

## Version 1.7

node-comfort 3.1 reprend la limite de débit et le disjoncteur, qui y ont été portés depuis djs-bot. Les anciens noms sont désormais les objets de node-comfort et se comportent comme eux. La garde `rateLimit()` et le plugin `antiSpam()` restent.

### Remplacés par node-comfort

| 1.6 | 1.7 | Code de l'avertissement |
| --- | --- | --- |
| `createRateLimiter(options)` | `nc.quota.create(options)` | `DJS_BOT_DEP_RATE_LIMITER` |
| `RateLimiter` | `Quota` (`nc.quota.Quota`) | `DJS_BOT_DEP_RATE_LIMITER` |
| `RateLimiterOptions`, `RateLimitResult` | `QuotaOptions`, `QuotaResult` | `DJS_BOT_DEP_RATE_LIMITER` |
| `createCircuitBreaker(options)` | `nc.circuit.create(options)` | `DJS_BOT_DEP_CIRCUIT_BREAKER` |
| `CircuitBreaker` | `Circuit` (`nc.circuit.Circuit`) | `DJS_BOT_DEP_CIRCUIT_BREAKER` |
| `CircuitOpenError` | `nc.errors.CircuitOpenError`. Seul `new CircuitOpenError()` avertit : `instanceof` correspond toujours | `DJS_BOT_DEP_CIRCUIT_BREAKER` |
| `CircuitBreakerOptions`, `CircuitState` | `CircuitOptions`, `CircuitStatus` | `DJS_BOT_DEP_CIRCUIT_BREAKER` |

| Comportement | 1.6 | 1.7 |
| --- | --- | --- |
| `limit`, `window`, coût, seuil ou `resetTimeout` invalide | Retombait sur une valeur par défaut | Lève une erreur à la création, `rateLimit()` et `antiSpam()` compris |
| `reset(key)` d'un quota | | Renvoie `true` quand la clé avait une fenêtre |
| Clés d'un quota | Chaînes | Chaînes ou nombres |
| `onOpen`, `onClose` | | S'exécutent après le changement d'état. Une erreur dans `onClose` rejette cet appel mais ne compte pas comme un échec |
| Appel rejeté | `CircuitOpenError` de djs-bot | Celle de node-comfort, message `The circuit is open: the call was rejected`, `code: "ERR_CIRCUIT_OPEN"` |

Les pages de node-comfort : [quota](https://ix-xs.github.io/node-comfort/flow/quota/), [disjoncteur](https://ix-xs.github.io/node-comfort/flow/circuit/). Les versions de Node.js ne changent pas.

## Version 1.6

djs-bot cesse de proposer ses propres copies de ce que fait node-comfort : variables d'environnement, nouvelles tentatives, délais et cache. `nc` est `import nc from "@ix-xs/node-comfort"`, déjà installé avec djs-bot.

### Remplacés par node-comfort

| 1.5 | 1.6 | Code de l'avertissement |
| --- | --- | --- |
| `env(name)` | `nc.env.required(name)` | `DJS_BOT_DEP_ENV` |
| `env(name, fallback)` | `nc.env.string(name, { default: fallback })` | `DJS_BOT_DEP_ENV` |
| `env.optional(name)` | `nc.env.string(name, { optional: true })`. `nc.env.get(name)` rend une valeur vide sous la forme `""` | `DJS_BOT_DEP_ENV` |
| `env.number(name, fallback)` | `nc.env.number(name, { default: fallback })`, qui refuse aussi `Infinity` | `DJS_BOT_DEP_ENV` |
| `env.boolean(name)` | `nc.env.boolean(name, { default: false })`. Sans `default`, la variable est obligatoire | `DJS_BOT_DEP_ENV` |
| `env.list(name)` | `nc.env.list(name, { default: [] })`. Sans `default`, la variable est obligatoire | `DJS_BOT_DEP_ENV` |
| `loadEnvFile(path)` | `nc.env.load(path)` | `DJS_BOT_DEP_LOAD_ENV_FILE` |
| `retry(fn, options)` | `nc.async.retry(fn, { delay: 200, backoff: 2, jitter: 0.2, ...options })`, pour garder les attentes | `DJS_BOT_DEP_RETRY_TIMEOUT` |
| `timeout(promise, ms, message)` | `nc.async.timeout(promise, ms, message)` | `DJS_BOT_DEP_RETRY_TIMEOUT` |
| `RetryOptions` | Les options de `nc.async.retry()`, mêmes noms | `DJS_BOT_DEP_RETRY_TIMEOUT` |
| `createCache(options)`, `new TTLCache(options)` | `nc.cache.create({ ttl: "5m", max: 1000, ...options })`, pour garder les valeurs par défaut | `DJS_BOT_DEP_CACHE` |
| `cache.getOrFetch(key, load)` | `cache.getOrSet(key, load)` | `DJS_BOT_DEP_CACHE` |
| `cache.set(key, value, ttl)` | `cache.set(key, value, { ttl })` | `DJS_BOT_DEP_CACHE` |
| `TTLCacheOptions` | Les options de `nc.cache.create()` | `DJS_BOT_DEP_CACHE` |

| Comportement | 1.5 | 1.6 avec node-comfort |
| --- | --- | --- |
| Variable absente ou invalide | `Error` | `ValidationError` |
| Valeurs par défaut des nouvelles tentatives | `delay: 200`, `backoff: 2`, `jitter: 0.2` | `delay: 0`, `backoff: 1`, `jitter: 0` |
| Valeurs par défaut du cache | `ttl: "5m"`, `max: 1000` | Entrées gardées pour toujours, sans limite de taille |
| `staleWhileRevalidate` | `true` : valeurs expirées servies par `getOrFetch`, `get()` et `has()` | Une fenêtre de temps, servie par `getOrSet` seulement. `get()` et `has()` ne rendent plus les valeurs expirées |

Les détails sont sur les pages de node-comfort : [variables d'environnement](https://ix-xs.github.io/node-comfort/essentials/env/), [nouvelles tentatives et délais](https://ix-xs.github.io/node-comfort/flow/async/#retry), [cache](https://ix-xs.github.io/node-comfort/flow/cache/). `resolve` et `isHiddenChannel`, qui concernent Discord, restent dans djs-bot.

### Le fichier d'entrée

Le bot lit lui-même `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` et `DISCORD_DEV_GUILD`, et node-comfort charge `.env` à l'import. `djs-bot init` ne les écrit plus dans le projet de départ, et les lignes qui ne font que les lire peuvent partir :

```ts
// 1.5
const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env.optional("DISCORD_CLIENT_ID"),
  features: `${import.meta.dirname}/features`,
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
});
```

```ts
// 1.6
const bot = defineBot({
  features: `${import.meta.dirname}/features`,
});
```

## Version 1.5

### Renommés

| 1.4 | 1.5 | Code de l'avertissement |
| --- | --- | --- |
| `oneOf("a", "b")`, importé depuis la racine | `p.oneOf("a", "b")` | `DJS_BOT_DEP_ONEOF` |
| `audit: { sink: x }` | `audit: { sinks: [x] }` | `DJS_BOT_DEP_AUDIT_SINK` |
| `emoji.custom(name, id, animated)` | `emoji.format({ name, id, animated })` | `DJS_BOT_DEP_EMOJI_CUSTOM` |
| `defineSelectMenu({ ... })` | `defineStringSelect({ ... })`, mêmes options | `DJS_BOT_DEP_DEFINE_SELECT_MENU` |
| `normalizeSharding()`, `launchShardManager()` | Aucun : internes désormais. Utilisez l'option `sharding` de `defineBot()` | `DJS_BOT_DEP_SHARDING_INTERNALS` |

```ts
// 1.4
import { defineSelectMenu, emoji, oneOf, p } from "@ix-xs/djs-bot";
const params = { action: oneOf("approve", "reject"), id: p.string };
emoji.custom("blob", "1234567890", true);
```

```ts
// 1.5
import { defineStringSelect, emoji, p } from "@ix-xs/djs-bot";
const params = { action: p.oneOf("approve", "reject"), id: p.string };
emoji.format({ name: "blob", id: "1234567890", animated: true });
```

### Nouveaux exports

| Export | Pour |
| --- | --- |
| `CronField` | Le type d'un champ analysé d'une planification cron. Voir [Tâches planifiées](/events/jobs/) |

### node-comfort 3.0

djs-bot 1.5 dépend de `@ix-xs/node-comfort` 3.0. npm l'installe avec le paquet.

| Votre bot | Que faire |
| --- | --- |
| N'importe pas `@ix-xs/node-comfort` | Rien |
| L'importe, en 2.x | Il garde sa propre copie, comme avant. Le passer en 3.0 partage une seule copie avec djs-bot |
| L'importe, en 3.x | Rien |

node-comfort 3.0 garde les noms de la 2.x jusqu'à la 4.0, avec un avertissement chacun : voir [sa page de mise à niveau](https://ix-xs.github.io/node-comfort/help/upgrade-3-0/). Le fichier `.env` est toujours lu à l'import, avec les mêmes règles ([Configuration](/basics/configuration/#environment-variables)).
