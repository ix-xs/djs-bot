---
title: "Cache et résolution d'entités"
description: "Un cache en processus avec expiration et limite de taille pour les résultats de tâches lentes, des helpers qui lisent le cache de discord.js avant d'appeler l'API, et une vérification pour les salons que Discord cache au bot."
sidebar:
  order: 2
---

Trois outils vivent ici. `createCache` retient ce que votre propre code a
calculé ou récupéré. `resolve` cherche des entités Discord (membres, rôles,
salons) dans le cache que discord.js tient déjà. `isHiddenChannel` distingue un
vrai salon d'un substitut.

## Un premier cache

Enveloppez un appel lent dans `getOrFetch`. Le premier appel exécute la
fonction de récupération, les suivants renvoient la valeur en cache jusqu'à son
expiration.

```ts title="features/prices/prices.service.ts"
import { createCache, defineService } from "@ix-xs/djs-bot";

async function fetchPrice(symbol: string): Promise<number> {
  const response = await fetch(`https://api.example.com/price/${symbol}`);
  const body = (await response.json()) as { price: number };
  return body.price;
}

export default defineService("prices", {
  factory: () => {
    const cache = createCache<string, number>({ ttl: "1m", max: 500 });
    return {
      get: (symbol: string) => cache.getOrFetch(symbol, () => fetchPrice(symbol)),
    };
  },
});
```

Le cache vit dans un [service](/architecture/services/) pour qu'une seule
instance soit partagée par tous les gestionnaires. Un cache créé dans un
gestionnaire repartirait vide à chaque interaction.

Les appels simultanés pour une même clé partagent une seule requête en cours :
une rafale d'interactions touche votre API une fois, pas cinquante. Si la
fonction de récupération lève une exception, chaque appelant en attente reçoit
l'erreur, rien n'est mis en cache, et l'appel suivant réessaie.

Les autres méthodes sont synchrones :

```ts
const prices = createCache<string, number>({ ttl: "1m", max: 500 });

prices.set("BTC", 42);          // écriture manuelle, avec le TTL du cache
prices.set("ETH", 7, "10s");    // ou un TTL propre à cette entrée
prices.get("BTC");              // 42, ou undefined si absente ou expirée
prices.has("BTC");              // true
prices.delete("BTC");
prices.clear();
```

## Stale while revalidate

Avec `staleWhileRevalidate: true`, une valeur expirée reste utile. Le prochain
`getOrFetch` la renvoie aussitôt et lance un seul rafraîchissement en arrière-plan,
si bien que l'utilisateur n'attend jamais la fonction de récupération après le
premier appel.

```ts
const stats = createCache<string, Stats>({ ttl: "1m", staleWhileRevalidate: true });
```

Cela convient aux classements, aux compteurs et aux tableaux de bord. Ne
l'utilisez pas pour ce qui doit être exact, et gardez ces points en tête :

- La valeur périmée est servie quel que soit son âge. Une clé que personne n'a
  lue depuis une heure est renvoyée une dernière fois, vieille d'une heure,
  pendant que le rafraîchissement s'exécute.
- Si le rafraîchissement en arrière-plan échoue, l'erreur est avalée et la
  valeur périmée continue d'être servie. L'appel suivant retente le
  rafraîchissement.
- `get` et `has` renvoient aussi les valeurs expirées dans ce mode, car les
  entrées expirées sont conservées pour être servies.
- Le tout premier appel pour une clé n'a rien à servir, il attend donc la
  fonction de récupération comme un cache normal.

## Cache ou store

| | `createCache` | [`KVStore`](/data/store/) |
| --- | --- | --- |
| Lectures | Synchrones | Asynchrones |
| Survit à un redémarrage | Non | Avec `sqliteStore` |
| Partagé entre les shards | Non | Avec un backend partagé |
| Borné, évince des entrées | Oui (`max`) | Non |
| Sert à | Les données chaudes, les réponses d'API | Un vrai état : profils, réglages, tickets |

Ils se marient bien, le cache devant et le store derrière :

```ts
const profile = await cache.getOrFetch(id, () => store.get(`profile:${id}`));
```

:::tip[Mettez en cache ce que vous calculez]
Les membres, rôles et salons sont déjà mis en cache par le client discord.js.
Mettez en cache le résultat de votre propre travail (un classement agrégé, une
réponse d'API externe, une image générée), pas les entités brutes.
:::

## Résoudre des entités Discord

discord.js garde en mémoire les entités qu'il a vues. Les helpers `resolve`
lisent ce cache et n'appellent l'API de Discord qu'en cas d'absence, ce qui
remplace partout le motif `cache.get(id) ?? (await fetch(id))`.

```ts
import { resolve } from "@ix-xs/djs-bot";

const member  = await resolve.member(ctx.guild!, userId);     // cache, puis fetch
const user    = await resolve.user(ctx.client, userId);
const role    = await resolve.role(ctx.guild!, roleId);
const channel = await resolve.channel(ctx.client, channelId);
const message = await resolve.message(ctx.channel!, messageId);

const fresh = await resolve.member(ctx.guild!, userId, true);  // toujours fetch
```

Passez `true` en dernier argument quand vous avez besoin de données à jour, par
exemple juste après un changement de rôle, où le cache peut encore montrer
l'ancien état.

`resolve.role` et `resolve.channel` sont typés `... | null`, vérifiez donc le
résultat avant de l'utiliser. En cas d'absence, les helpers appellent le
`fetch` de discord.js, qui rejette quand Discord ne connaît pas l'identifiant :
entourez l'appel d'un `try`/`catch` quand l'identifiant vient d'une saisie de
l'utilisateur.

## Salons cachés

À partir du 16 novembre 2026, Discord cesse d'envoyer aux bots les vraies
données des salons pour lesquels ils n'ont pas la permission `VIEW_CHANNEL`.
Via la passerelle (gateway), un tel salon arrive toujours, mais avec le nom
`"___hidden___"`, ses autres détails effacés et un indicateur dédié. La liste
des salons de l'API REST l'omet. Quand le bot obtient l'accès, une mise à jour
du salon livre les données complètes.

`isHiddenChannel` fait la différence, pour qu'une liste de salons, un compteur
ou une autocomplétion n'affiche jamais un substitut :

```ts
import { isHiddenChannel } from "@ix-xs/djs-bot";

const names = guild.channels.cache
  .filter((channel) => !isHiddenChannel(channel))
  .map((channel) => channel.name);
```

Les salons reçus via une interaction (une option de salon, un menu de sélection
de salons) ne sont jamais cachés de cette manière.

## Référence

### `createCache(options)`

```ts
createCache<K, V>(options?: TTLCacheOptions): TTLCache<K, V>
```

Crée un `TTLCache`. `K` est le type des clés et `V` celui des valeurs, les clés
n'ont donc pas besoin d'être des chaînes.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `ttl` | `number \| string` | `"5m"` | Durée de vie d'une entrée : des millisecondes, ou une durée comme `"30s"`, `"5m"`, `"1h"`. |
| `max` | `number` | `1000` | Nombre maximal d'entrées. Quand le cache est plein, ajouter une nouvelle clé en évince une. |
| `staleWhileRevalidate` | `boolean` | `false` | Sert immédiatement une valeur expirée et la rafraîchit en arrière-plan. |

Une chaîne de durée impossible à analyser retombe sur la valeur par défaut
(`"5m"` dans les options, le TTL du cache dans `set` et `getOrFetch`).

### `TTLCache<K, V>`

La classe derrière `createCache`. `new TTLCache<K, V>(options)` est identique si
vous la préférez.

```ts
import { TTLCache } from "@ix-xs/djs-bot";

const perGuild = new TTLCache<string, Settings>({ ttl: "10m" });
```

| Méthode | Renvoie | Description |
| --- | --- | --- |
| `get(key)` | `V \| undefined` | La valeur, ou `undefined` si absente ou expirée. Marque l'entrée comme récemment utilisée. |
| `set(key, value, ttl?)` | `void` | Stocke une valeur. `ttl` remplace le TTL du cache pour cette entrée. |
| `has(key)` | `boolean` | Indique si `get(key)` renverrait une valeur. |
| `delete(key)` | `void` | Supprime une entrée. |
| `clear()` | `void` | Vide le cache. |
| `getOrFetch(key, fetcher, ttl?)` | `Promise<V>` | La valeur en cache, ou exécute `fetcher` (synchrone ou asynchrone), met le résultat en cache et le renvoie. Les appels simultanés pour une clé partagent un seul fetch. |

Comment les entrées quittent le cache :

- Une entrée expirée est supprimée quand `get` ou `has` la lit (sauf si
  `staleWhileRevalidate` est activé). Il n'y a pas de nettoyage en arrière-plan :
  c'est `max` qui borne la mémoire.
- Quand le cache contient `max` entrées et qu'une nouvelle clé est ajoutée,
  l'entrée insérée, ou lue avec `get`, il y a le plus longtemps est évincée. Un
  succès dans `getOrFetch` et l'écrasement d'une clé existante avec `set` ne
  comptent pas comme une utilisation.

### `resolve`

Chaque helper lit le cache de discord.js et fait un fetch en cas d'absence.
`force` vaut `false` par défaut. Avec `true`, le cache est ignoré.

| Helper | Renvoie |
| --- | --- |
| `resolve.member(guild, id, force?)` | `Promise<GuildMember>` |
| `resolve.user(client, id, force?)` | `Promise<User>` |
| `resolve.role(guild, id, force?)` | `Promise<Role \| null>` |
| `resolve.channel(client, id, force?)` | `Promise<Channel \| null>` |
| `resolve.message(channel, id, force?)` | `Promise<Message>` |

Le `channel` de `resolve.message` est un salon textuel, comme `ctx.channel`.

### `isHiddenChannel(channel)`

```ts
isHiddenChannel(channel): boolean
```

`true` quand le salon porte l'indicateur « obfuscated » de Discord ou le nom de
substitution `"___hidden___"`. Accepte n'importe quel objet salon, et renvoie
`false` pour `null` ou `undefined`.

## Voir aussi

- [Store](/data/store/) : un état durable qui survit à un redémarrage.
- [Services](/architecture/services/) : l'endroit où placer un cache partagé.
- [Résilience](/production/resilience/) : limites de débit, nouvelles tentatives et disjoncteurs pour les appels que vous mettez en cache.
- [Options et autocomplétion](/commands/options/) : les options de salon, qui ne livrent jamais de salons cachés.
