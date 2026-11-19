---
title: "Résilience"
description: "Une limite de débit et un disjoncteur pour le jour où votre bot dépend de quelque chose de lent, d'instable ou de détourné, à combiner avec les nouvelles tentatives et les délais de node-comfort."
sidebar:
  order: 4
---

Un bot qui appelle une base de données ou une API tierce hérite de ses mauvais
jours. La limite de débit et le disjoncteur sont de simples fonctions, sans
configuration, utilisables dans un gestionnaire, un service ou une tâche
planifiée : à quelle fréquence peut-on s'en servir, et faut-il encore essayer.
Les nouvelles tentatives et les délais viennent de node-comfort.

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
même valeur dans chacune.

Le refus s'affiche par défaut « Rate limit reached. Try again in 12s. ». Pour le
reformuler ou le traduire, utilisez le message `rateLimited`, décrit dans
[Formulations et thème](/basics/wording-and-theme/).

:::note[Les compteurs vivent en mémoire]
Le limiteur garde ses comptes dans le processus. Ils repartent de zéro au
redémarrage du bot, et sur un bot [shardé](/production/sharding/) chaque shard
compte de son côté. Il en va de même pour le disjoncteur.
:::

## Limiter le débit dans le code

En dehors d'une garde, utilisez directement le limiteur. La clé est n'importe
quelle chaîne : un identifiant d'utilisateur, de serveur, une clé d'API.

```ts title="src/features/export/exports.service.ts"
import { createRateLimiter, defineService } from "@ix-xs/djs-bot";

export default defineService("exports", {
  factory: () => {
    const limiter = createRateLimiter({ limit: 10, window: "1h" });
    return {
      /** Compte un export pour un serveur. Un export complet pèse cinq. */
      take: (guildId: string, full = false) => limiter.consume(guildId, full ? 5 : 1),
    };
  },
});
```

`consume` enregistre l'appel et vous dit où en est la clé :

```ts
const { allowed, remaining, resetMs } = limiter.consume(userId);
if (!allowed) return ctx.reply.error(`Wait ${Math.ceil(resetMs / 1000)}s.`);
```

Le deuxième argument est un coût, `1` par défaut, ce qui permet à une opération
coûteuse de compter pour davantage. Un appel qui ne rentre pas est refusé et ne
consomme rien.

La fenêtre est fixe : elle s'ouvre au premier appel d'une clé et se ferme après
`window`, quoi qu'il se passe entre-temps. Les fenêtres closes sont balayées au
fil de l'utilisation du limiteur, donc les clés qui ne reviennent jamais
(utilisateurs ponctuels, serveurs que le bot a quittés) ne s'accumulent pas.

## Disjoncteurs

Un disjoncteur cesse d'appeler un service qui échoue déjà. Cela garde vos
gestionnaires rapides pendant la panne, et laisse au service de la marge pour se
rétablir.

```ts title="src/features/weather/weather.command.ts"
import { CircuitOpenError, createCircuitBreaker, defineCommand, s } from "@ix-xs/djs-bot";
import { fetchWeather } from "./weather.api.js";

const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeout: "30s" });

export default defineCommand({
  name: "weather",
  description: "Current weather",
  options: { city: s.string({ description: "City name", required: true }) },
  run: async (ctx) => {
    try {
      const report = await breaker.execute(() => fetchWeather(ctx.options.city));
      await ctx.reply.info(report.summary);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        await ctx.reply.error("The weather service is down right now. Try again in a minute.");
        return;
      }
      throw error;
    }
  },
});
```

Le disjoncteur est toujours dans l'un de trois états, lisible via `breaker.status` :

| État | Comportement |
| --- | --- |
| `closed` | Normal. Les appels passent. Les échecs sont comptés, et un succès remet le compte à zéro. |
| `open` | Les appels échouent aussitôt avec `CircuitOpenError`, sans toucher au service. |
| `half-open` | Une fois `resetTimeout` écoulé, les appels repassent à titre d'essai. `successThreshold` succès referment le circuit. Un seul échec le rouvre. |

Il s'ouvre après `failureThreshold` échecs d'affilée. L'erreur d'un appel échoué
vous est toujours renvoyée, qu'elle compte ou non.

Toute erreur n'est pas une panne. `isFailure` décide de ce qui compte, et
`onOpen` et `onClose` vous signalent les changements d'état :

```ts
const breaker = createCircuitBreaker({
  isFailure: (error) => !(error instanceof NotFoundError),   // un 404 n'est pas une panne
  onOpen: () => logger.warn({}, "Payment API circuit opened"),
  onClose: () => logger.info({}, "Payment API circuit closed"),
});
```

Créez un disjoncteur par dépendance et gardez-le pour toute la vie du processus
(dans un module ou un service). Un disjoncteur créé dans un gestionnaire oublie
tout à chaque appel.

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
import { createCircuitBreaker, defineService } from "@ix-xs/djs-bot";
import nc from "@ix-xs/node-comfort";
import { fetchWeather } from "./weather.api.js";

export default defineService("weather", {
  factory: () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3, resetTimeout: "1m" });
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
- `createRateLimiter()` : Crée un `RateLimiter`.
- `RateLimiter` : Un limiteur de débit à fenêtre fixe, indexé par une chaîne arbitraire.
- `RateLimitResult` : Le résultat d'un appel à `RateLimiter.consume`.
- `createCircuitBreaker()` : Crée un `CircuitBreaker`.
- `CircuitBreaker` : Un disjoncteur : après trop d'échecs, il s'« ouvre » et échoue immédiatement pendant une période de repos, puis réessaie (« semi-ouvert ») avant de se rétablir complètement.
- `CircuitOpenError` : Erreur levée lorsque des appels sont rejetés parce que le circuit est ouvert.
- `CircuitState` : L'état d'un `CircuitBreaker`.

## Voir aussi

- [Gardes](/commands/guards/) : `cooldown` et les autres préconditions.
- [Services](/architecture/services/) : où un disjoncteur ou un limiteur doit vivre.
- [Différé automatique](/basics/automatic-deferral/) : rester dans les 3 secondes de Discord.
- [Santé et métriques](/production/health/) : voir les erreurs et les gestionnaires lents s'accumuler.
- [Erreurs](/api/errors/) : ce qui se passe quand un gestionnaire lève une erreur.
