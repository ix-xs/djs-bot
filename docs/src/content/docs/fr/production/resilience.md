---
title: "Résilience"
description: "Quatre petits outils pour le jour où votre bot dépend de quelque chose de lent, d'instable ou de détourné : une limite de débit, un disjoncteur, les nouvelles tentatives et le délai d'expiration."
sidebar:
  order: 4
---

Un bot qui appelle une base de données ou une API tierce hérite de ses mauvais
jours. Ces quatre outils sont de simples fonctions, sans configuration, utilisables
dans un gestionnaire, un service ou une tâche planifiée. Chacun répond à une
question différente : à quelle fréquence peut-on s'en servir, faut-il encore
essayer, faut-il réessayer, et combien de temps attendre.

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

## Réessayer un appel

`retry` exécute de nouveau une fonction quand elle lève une erreur, et abandonne
avec la dernière erreur une fois les tentatives épuisées.

```ts
const user = await retry(() => api.getUser(id), {
  attempts: 4,
  delay: 250,        // attend environ 250 ms, puis 500 ms, puis 1 s
  backoff: 2,
  maxDelay: 2000,
  shouldRetry: (error) => isNetworkError(error),
  onRetry: (error, attempt) => logger.warn({ err: error, attempt }, "Retrying"),
});
```

Sans options, `retry` fait trois tentatives, en attendant environ 200 ms puis
environ 400 ms : `delay` vaut `200` par défaut, `backoff` vaut `2` et `jitter`
vaut `0.2`. Le jitter décale chaque attente d'une quantité aléatoire, afin que
de nombreux appelants confrontés au même échec ne reviennent pas tous au même
instant. `delay` et `maxDelay` acceptent des millisecondes ou un texte comme
`"1s"`.

Deux choses mettent fin aux tentatives avant qu'elles soient épuisées :

- **Un signal.** Passez un `AbortSignal` dans `signal` : une fois qu'il est
  interrompu, aucune nouvelle tentative n'est faite et `retry` rejette avec une
  `AbortError`. La tentative en cours n'est pas interrompue. Le `ctx.signal`
  d'une [tâche planifiée](/events/jobs/) convient bien : une tâche que l'on
  arrête ne continue pas à réessayer.
- **Une tentative interrompue.** Une tentative qui échoue avec une erreur nommée
  `AbortError`, comme un `fetch` que vous avez interrompu vous-même, n'est pas
  réessayée. Une `TimeoutError` venue de `timeout()` est toujours réessayée.

```ts
// Dans une tâche planifiée : cesser de réessayer dès qu'on lui demande de s'arrêter.
await retry(() => syncLeaderboard(), { attempts: 5, delay: "1s", signal: ctx.signal });
```

:::caution[Ne réessayez que ce qui peut être répété sans risque]
Réessayer une lecture est sans danger. Réessayer « envoyer un message » peut le
publier trois fois. Filtrez ces appels avec `shouldRetry`, ou ne les réessayez
pas.
:::

## Borner un appel

`timeout` rejette quand une promesse ne s'est pas réglée à temps, de sorte
qu'une dépendance lente ne puisse pas bloquer un gestionnaire indéfiniment.

```ts
const data = await timeout(api.slowCall(), 5000, "The API took too long");
const same = await timeout(() => api.slowCall(), "5s");   // une fonction marche aussi, tout comme "5s"
const page = await timeout((signal) => fetch(url, { signal }), "5s");   // interrompu quand le temps est écoulé
```

Le rejet est une erreur nommée `TimeoutError`. Son message est le troisième
argument, ou `Operation timed out after 5000ms` s'il n'y en a pas.

Une promesse que vous passez n'est pas annulée : `timeout` cesse de l'attendre,
rien de plus. Pour arrêter aussi le travail, passez une fonction. Elle reçoit un
`AbortSignal` qui s'interrompt quand le temps est écoulé, et vous transmettez ce
signal à ce qui fait le travail, comme le `fetch` ci-dessus.

Cela compte surtout dans les gestionnaires d'interaction, où Discord vous laisse
3 secondes pour répondre ou différer, puis 15 minutes ensuite. Voir
[Différé automatique](/basics/automatic-deferral/).

## Les combiner

L'empilement habituel pour un appel externe, de l'extérieur vers l'intérieur :

```ts
const result = await breaker.execute(() =>
  retry(() => timeout(api.fetch(id), 3000), {
    attempts: 3,
    delay: 300,
    backoff: 2,
    shouldRetry: (error) => !(error instanceof NotFoundError),
  }),
);
```

- `timeout` borne une tentative. Sa `TimeoutError` est réessayée comme
  n'importe quel autre échec.
- `retry` absorbe un échec passager.
- Le disjoncteur cesse d'essayer quand le service est vraiment en panne, et voit
  un échec par série de tentatives épuisée, pas un par tentative.

Pour plafonner la durée totale plutôt que chaque tentative, intervertissez les
deux appels intérieurs :
`timeout(retry(() => api.fetch(id), { attempts: 3 }), 4000)`.

Mettez cet empilement dans un [service](/architecture/services/) pour que les
gestionnaires restent lisibles et que le disjoncteur soit partagé :

```ts title="src/features/weather/weather.service.ts"
import { createCircuitBreaker, defineService, retry, timeout } from "@ix-xs/djs-bot";
import { fetchWeather } from "./weather.api.js";

export default defineService("weather", {
  factory: () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3, resetTimeout: "1m" });
    return {
      get: (city: string) =>
        breaker.execute(() =>
          retry(() => timeout(fetchWeather(city), 3000), { attempts: 3, delay: 300, backoff: 2 }),
        ),
    };
  },
});
```

## Référence

Les durées sont un nombre de millisecondes ou une chaîne comme `"30s"`, `"5m"` ou
`"1h"`.

### `rateLimit(options)`

Renvoie une garde qui autorise `limit` utilisations par `window`.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `limit` | `number` | requis | Utilisations autorisées par fenêtre. |
| `window` | `number \| string` | requis | Durée de la fenêtre. |
| `scope` | `"user" \| "guild" \| "channel" \| "global"` | `"user"` | Ce qui partage un même budget : chaque utilisateur, chaque serveur, chaque salon, ou tout le monde. |

En dehors d'un serveur, la portée `"guild"` compte par utilisateur. Il en va de
même pour `"channel"` quand l'interaction n'a pas de salon.

### `createRateLimiter(options)`

Renvoie un `RateLimiter`. `new RateLimiter(options)` fait la même chose.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `limit` | `number` | requis | Appels autorisés par fenêtre. |
| `window` | `number \| string` | requis | Durée de la fenêtre. Une chaîne qui ne peut pas être lue comme une durée compte pour une minute. |

| Membre | Renvoie | Description |
| --- | --- | --- |
| `consume(key, cost?)` | `RateLimitResult` | Enregistre un appel de coût `cost` (`1` par défaut) pour `key` et indique s'il rentre dans la limite. |
| `reset(key)` | `void` | Oublie la fenêtre d'une clé. |
| `size` | `number` | Nombre de clés qui ont une fenêtre ouverte. |

`RateLimitResult` :

| Champ | Type | Description |
| --- | --- | --- |
| `allowed` | `boolean` | Indique si cet appel est dans la limite. |
| `remaining` | `number` | Appels restants dans la fenêtre en cours. |
| `resetMs` | `number` | Millisecondes avant la fermeture de la fenêtre. |

### `createCircuitBreaker(options)`

Renvoie un `CircuitBreaker`. `new CircuitBreaker(options)` fait la même chose.
Toutes les options sont facultatives.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `failureThreshold` | `number` | `5` | Échecs d'affilée avant que le circuit s'ouvre. |
| `resetTimeout` | `number \| string` | `"30s"` | Durée pendant laquelle il reste ouvert avant un essai. Une chaîne qui ne peut pas être lue comme une durée compte pour 30 secondes. |
| `successThreshold` | `number` | `1` | Essais réussis nécessaires pour le refermer. |
| `isFailure` | `(error: unknown) => boolean` | toute erreur compte | Renvoyez `false` pour une erreur qui ne doit pas compter. |
| `onOpen` | `() => void` | aucun | Appelé chaque fois que le circuit s'ouvre. |
| `onClose` | `() => void` | aucun | Appelé quand il se ferme. |

| Membre | Renvoie | Description |
| --- | --- | --- |
| `execute(fn)` | `Promise<T>` | Exécute `fn` (synchrone ou asynchrone) à travers le disjoncteur et se résout avec son résultat. Rejette avec `CircuitOpenError` tant qu'il est ouvert, ou avec l'erreur de `fn`. |
| `status` | `CircuitState` | `"closed"`, `"open"` ou `"half-open"`. |

### `CircuitOpenError`

L'erreur avec laquelle `execute` rejette tant que le circuit est ouvert. Son
`name` est `"CircuitOpenError"`. Testez-la avec `instanceof` pour distinguer
« le service est en panne » d'une erreur de l'appel lui-même.

### `retry(fn, options)`

Appelle `fn` (synchrone ou asynchrone) jusqu'à ce qu'elle réussisse, et se
résout avec son résultat. Rejette avec la dernière erreur. Une tentative qui
échoue avec une erreur nommée `AbortError` n'est pas réessayée. `options` est un
`RetryOptions` :

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `attempts` | `number` | `3` | Nombre total de tentatives, la première comprise. |
| `delay` | `number \| string` | `200` | Attente avant la deuxième tentative : des millisecondes, ou un texte comme `"1s"`. |
| `backoff` | `number` | `2` | Multiplie l'attente après chaque échec. `2` transforme 200 en 200, 400, 800. |
| `maxDelay` | `number \| string` | aucun plafond | Borne supérieure de l'attente : des millisecondes, ou un texte comme `"30s"`. |
| `jitter` | `number` | `0.2` | Rend chaque attente aléatoire : `0` pour aucune variation, jusqu'à `1` pour n'importe quelle valeur entre zéro et le double du délai. |
| `shouldRetry` | `(error: unknown, attempt: number) => boolean` | réessayer toute erreur | Renvoyez `false` pour abandonner aussitôt. |
| `onRetry` | `(error: unknown, attempt: number) => void` | aucun | Appelé avant chaque attente. `attempt` est celle qui a échoué, en commençant à 1. |
| `signal` | `AbortSignal` | aucun | Une fois interrompu, aucune nouvelle tentative n'est faite et l'appel rejette avec une `AbortError`. La tentative en cours n'est pas interrompue. |

Un `delay` ou un `maxDelay` qui ne peut pas être lu comme une durée rejette avec
une `TypeError`.

### `timeout(promise, ms, message)`

Se résout avec la valeur de `promise` si elle se règle dans le délai `ms`, et
rejette sinon avec une `TimeoutError`. Un `ms` qui ne peut pas être lu comme une
durée lève une `TypeError`.

| Paramètre | Type | Défaut | Description |
| --- | --- | --- | --- |
| `promise` | `Promise<T> \| ((signal: AbortSignal) => Promise<T>)` | requis | Le travail à borner, ou une fonction qui le démarre. La fonction reçoit un signal qui s'interrompt quand le temps est écoulé. |
| `ms` | `number \| string` | requis | Le temps accordé : des millisecondes (`5000`) ou un texte (`"5s"`). |
| `message` | `string` | `Operation timed out after <ms>ms` | Le message du rejet. |

## Voir aussi

- [Gardes](/commands/guards/) : `cooldown` et les autres préconditions.
- [Services](/architecture/services/) : où un disjoncteur ou un limiteur doit vivre.
- [Différé automatique](/basics/automatic-deferral/) : rester dans les 3 secondes de Discord.
- [Santé et métriques](/production/health/) : voir les erreurs et les gestionnaires lents s'accumuler.
- [Erreurs](/api/errors/) : ce qui se passe quand un gestionnaire lève une erreur.
