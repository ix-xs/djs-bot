---
title: "Résilience"
description: "La garde rateLimit() pour le jour où votre bot est détourné, et les quotas, disjoncteurs, nouvelles tentatives et délais de node-comfort pour les services dont il dépend."
sidebar:
  order: 4
---

Un bot qui appelle une base de données ou une API tierce hérite de ses mauvais
jours. La garde
`rateLimit()` décide à quelle fréquence une commande peut servir. Les quotas,
les disjoncteurs, les nouvelles tentatives et les délais viennent de
node-comfort, utilisables dans un gestionnaire, un service ou une tâche
planifiée.

## Une première limite de débit

`rateLimit` est une garde : elle autorise un nombre d'utilisations par fenêtre de
temps, et refuse le reste avec un message qui indique combien de temps attendre.

```ts title="src/features/search/search.command.ts"
import { defineCommand, rateLimit, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "search",
  description: "Search the catalogue",
  options: { query: s.string({ description: "What to look for", required: true }) },
  // Cinq recherches par minute, pour chaque utilisateur.
  guards: [rateLimit({ limit: 5, window: "1m" })],
  run: (ctx) => ctx.reply.info(`Searching for ${ctx.options.query}...`),
});
```

Elle est plus expressive que `cooldown`, qui autorise une utilisation par durée
(voir [Gardes](/commands/guards/)). `scope` choisit qui partage le budget :

```ts
guards: [rateLimit({ limit: 100, window: "1h", scope: "guild" })]   // 100 par heure pour tout un serveur
```

Chaque appel à `rateLimit()` crée ses propres compteurs, donc une garde écrite
directement dans une commande ne limite que cette commande. Pour que plusieurs
commandes partagent un budget, créez la garde une seule fois et réutilisez la
même valeur dans chacune. Une `limit` ou une `window` invalide lève une erreur
dès la création de la garde.

Le refus s'affiche par défaut « Rate limit reached. Try again in 12s. ». Pour le
reformuler ou le traduire, utilisez le message `rateLimited`, décrit dans
[Formulations et thème](/basics/wording-and-theme/).

:::note[Les compteurs vivent en mémoire]
Le limiteur garde ses comptes dans le processus. Ils repartent de zéro au
redémarrage du bot, et sur un bot [shardé](/production/sharding/) chaque shard
compte de son côté. Il en va de même pour un disjoncteur.
:::

## Limiter le débit dans le code

Hors d'une garde, comptez avec `nc.quota.create({ limit, window })` et
`consume(key, cost)` de node-comfort ([sa page](https://ix-xs.github.io/node-comfort/flow/quota/)). Le
`createRateLimiter()` de djs-bot est obsolète.

## Disjoncteurs

Pour cesser d'appeler un service qui échoue déjà, utilisez `nc.circuit.create()`,
`execute()` et `nc.errors.CircuitOpenError` de node-comfort
([sa page](https://ix-xs.github.io/node-comfort/flow/circuit/)). Créez un disjoncteur par dépendance et gardez-le pendant
toute la vie du processus, dans un module ou un service. Le
`createCircuitBreaker()` de djs-bot est obsolète.

## Réessayer et borner un appel

Les nouvelles tentatives et les délais viennent de node-comfort :
`nc.async.retry()` et `nc.async.timeout()` ([leur page](https://ix-xs.github.io/node-comfort/flow/async/#retry)). Sans
options, `nc.async.retry()` réessaie aussitôt ; passez `{ delay: 200, backoff: 2, jitter: 0.2 }`
pour retrouver les attentes du `retry()` de djs-bot, qui est obsolète.

## Les combiner

L'empilement habituel pour un appel externe, de l'extérieur vers l'intérieur :

```ts
const result = await breaker.execute(() =>
  nc.async.retry(() => nc.async.timeout(api.fetch(id), 3000), {
    attempts: 3,
    delay: 300,
    backoff: 2,
    shouldRetry: (error) => !(error instanceof NotFoundError),
  }),
);
```

- `nc.async.timeout` borne une tentative. Sa `TimeoutError` est réessayée
  comme n'importe quel autre échec.
- `nc.async.retry` absorbe un échec passager.
- Le disjoncteur cesse d'essayer quand le service est vraiment en panne, et voit
  un échec par série de tentatives épuisée, pas un par tentative.

Pour plafonner la durée totale plutôt que chaque tentative, intervertissez les
deux appels intérieurs :
`nc.async.timeout(nc.async.retry(() => api.fetch(id), { attempts: 3 }), 4000)`.

Mettez cet empilement dans un [service](/architecture/services/) pour que les
gestionnaires restent lisibles et que le disjoncteur soit partagé :

```ts title="src/features/weather/weather.service.ts"
import { defineService } from "@ix-xs/djs-bot";
import nc from "@ix-xs/node-comfort";
import { fetchWeather } from "./weather.api.js";

export default defineService("weather", {
  factory: () => {
    const breaker = nc.circuit.create({ failureThreshold: 3, resetTimeout: "1m" });
    return {
      get: (city: string) =>
        breaker.execute(() =>
          nc.async.retry(() => nc.async.timeout(fetchWeather(city), 3000), { attempts: 3, delay: 300, backoff: 2 }),
        ),
    };
  },
});
```

## Référence

Chaque option, propriété et type, avec ce qu'il accepte et renvoie, est dans la référence de l'API :

- `rateLimit()` : Une garde qui autorise `limit` utilisations par `window`, par portée (`"user"` par défaut).

## Voir aussi

- [Gardes](/commands/guards/) : `cooldown` et les autres préconditions.
- [Services](/architecture/services/) : où un disjoncteur ou un limiteur doit vivre.
- [Différé automatique](/basics/automatic-deferral/) : rester dans les 3 secondes de Discord.
- [Santé et métriques](/production/health/) : voir les erreurs et les gestionnaires lents s'accumuler.
- [Erreurs](/api/errors/) : ce qui se passe quand un gestionnaire lève une erreur.
