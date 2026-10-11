---
title: "Store"
description: "Un petit store clé-valeur asynchrone pour l'état que votre bot doit conserver : soldes, réglages, tickets. Il est livré avec un adaptateur en mémoire et un adaptateur SQLite, et toute autre base s'y branche avec quatre fonctions."
sidebar:
  order: 1
---

Le framework n'impose jamais de base de données. Il parle une seule interface,
`KVStore`, et tout ce qui a besoin de persistance (vos gestionnaires, les
[feature flags](/data/flags/), le [journal d'audit](/data/audit/)) passe par
elle. Remplacer plus tard SQLite par Redis change une ligne de configuration,
pas vos gestionnaires.

## Un premier store

Donnez un store à `defineBot`. `sqliteStore` écrit dans un fichier, donc les
données survivent à un redémarrage.

```ts title="src/index.ts"
import { defineBot, env, sqliteStore } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./features",
  store: sqliteStore("data/bot.sqlite"),
});
```

Le store est enregistré comme le service `store`, déjà typé, donc chaque
gestionnaire l'atteint par `ctx.services.store` :

```ts title="features/economy/daily.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "daily",
  description: "Claim your daily coins",
  run: async (ctx) => {
    const coins = await ctx.services.store.increment(`coins:${ctx.user.id}`, 100);
    return ctx.reply.success(`You now have ${coins} coins.`);
  },
});
```

Les événements, déclencheurs et tâches planifiées ont le même
`ctx.services.store`. Le lire quand aucun `store` n'est configuré lève
[`DJSBOT_E031`](/api/errors/#djsbot_e031), comme pour tout service inconnu.

## Lire et écrire

Chaque méthode est asynchrone, et les valeurs doivent être sérialisables en
JSON (chaînes, nombres, booléens, tableaux, objets simples).

```ts
const store = ctx.services.store;

await store.set("motd", "Welcome");          // sans expiration
await store.get("motd");                     // "Welcome", ou undefined si absente
await store.has("motd");                     // true
await store.delete("motd");                  // true si quelque chose a été supprimé
```

Un troisième argument de `set` donne à la clé une durée de vie, en
millisecondes ou sous forme de chaîne de durée :

```ts
await store.set("code:1234", payload, "10m");   // chaîne de durée
await store.set("session", data, 30_000);       // millisecondes
await store.set("config", settings);            // sans expiration
```

Une clé expirée est relue comme `undefined` et n'apparaît jamais dans `keys()`,
`entries()` ou `size()`. Les entrées expirées sont aussi purgées à mesure que de
nouvelles écritures arrivent (et à l'ouverture d'un store SQLite), si bien
qu'une clé écrite avec un TTL et jamais relue ne reste ni en mémoire ni sur le
disque.

Deux choses à savoir sur les TTL :

- Chaque écriture remplace l'expiration. Réécrire une clé sans TTL la rend
  permanente, y compris avec `increment` et `update` : passez le TTL à chaque
  appel si la clé doit continuer d'expirer.
- Une chaîne de durée impossible à analyser (`"soon"`) signifie aucune
  expiration, pas une erreur. Les mois et les années ne sont pas acceptés, car
  leur durée varie : écrivez `"90d"`.

`getOrSet` couvre le motif habituel « le lire, ou le calculer et le retenir » :

```ts
const stats = await store.getOrSet(
  `stats:${ctx.guildId}`,
  () => expensiveAggregation(ctx.guildId),
  "5m",
);
```

Les appels simultanés pour une même clé sont dédupliqués par processus : dix
requêtes simultanées exécutent la fabrique une seule fois et attendent toutes la
même promesse. Si la fabrique lève une exception, rien n'est stocké et chaque
appelant en attente reçoit l'erreur.

## Compteurs et mises à jour

Lire une valeur, la modifier et la réécrire en trois étapes perd des mises à
jour quand deux interactions arrivent en même temps. `increment` et `update`
font les trois étapes en une seule : les appels pour une même clé sont mis en
file, et s'exécutent donc l'un après l'autre.

```ts
const xp = store.namespace<number>("xp");

// Faux : deux commandes simultanées lisent toutes deux 10 et écrivent toutes deux 11.
const current = (await xp.get(ctx.user.id)) ?? 0;
await xp.set(ctx.user.id, current + 1);

// Correct.
await xp.increment(ctx.user.id);

// Correct, pour tout ce qui est plus riche qu'un nombre.
const profiles = store.namespace<{ xp: number; level: number }>("profiles");
await profiles.update(ctx.user.id, (profile = { xp: 0, level: 0 }) => ({
  ...profile,
  xp: profile.xp + 25,
}));
```

`increment` traite une clé absente (ou une valeur qui n'est pas un nombre)
comme `0`, et accepte un nombre négatif pour soustraire. `update` passe à votre
fonction la valeur actuelle, ou `undefined`, et cette fonction peut être
asynchrone.

:::note[Ce que couvre « une seule étape »]
La file vit dans le processus, ce qui suffit pour tout bot sans sharding.
Quand plusieurs processus partagent un même backend (des shards sur un seul
serveur Redis), deux d'entre eux peuvent encore s'entremêler. Pour un compteur
qui doit être exact dans ce cas, appelez plutôt l'opération atomique propre au
backend (Redis `INCRBY`, par exemple) au lieu de `increment`.
:::

## Espaces de noms et accès groupé

`namespace(prefix)` renvoie une vue du même store où chaque clé est stockée sous
`prefix:`. Il n'exige aucun second backend, et c'est aussi ainsi que vous
obtenez des valeurs typées : `ctx.services.store` contient du `unknown`, un
espace de noms contient ce que vous indiquez.

```ts
const tickets = store.namespace<{ open: boolean }>("tickets");
const economy = store.namespace<number>("economy");

await tickets.set("42", { open: true });   // stocké sous "tickets:42"
await economy.keys();                       // seulement les clés economy, sans le préfixe
await tickets.clear();                      // ne vide que tickets
```

Les espaces de noms s'imbriquent (`store.namespace("guild").namespace(id)`), et
les méthodes qui regardent plusieurs clés ne voient jamais que la vue que vous
tenez. Une fonctionnalité peut lister ou effacer ses propres données sans
toucher à celles des autres. Les préfixes sont comparés littéralement, donc un
espace de noms contenant `%` ou `_` ne pose pas de problème avec SQLite.

```ts
const economy = ctx.services.store.namespace<number>("economy");

await economy.update(ctx.user.id, (coins = 0) => coins + 100);

// Un classement : toutes les paires en une lecture, puis un tri.
const richest = (await economy.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

// Plusieurs clés d'un coup. Les clés absentes ne figurent pas dans la Map.
const balances = await economy.getMany([ctx.user.id, otherUserId]);

// Plusieurs écritures partageant un même TTL facultatif.
await economy.setMany({ [ctx.user.id]: 500, [otherUserId]: 250 });

await economy.size();   // combien de clés vivantes
```

## Choisir un adaptateur

| Adaptateur | Survit à un redémarrage | Sert à |
| --- | --- | --- |
| `memoryStore()` | Non | Les tests, l'état éphémère, les bots qui n'ont pas besoin de durabilité. |
| `sqliteStore(path)` | Oui | La plupart des bots : un fichier, aucun serveur à faire tourner. |
| Le vôtre, avec `createStore` | Selon le backend | Redis, Postgres, une API HTTP, un état partagé entre shards. |

`sqliteStore` utilise le SQLite intégré à Node en mode WAL et crée le dossier
parent pour vous. Tout vit dans une seule table, `djsbot_kv` (`key`, `value`,
`expires`), ce qui permet d'inspecter le fichier avec n'importe quel client
SQLite. Passez `":memory:"` pour une base transitoire qui exécute le même chemin
de code qu'en production, ce qui en fait un bon choix dans les tests :

```ts
const store = sqliteStore("data/bot.sqlite");
const test = sqliteStore(":memory:");
```

`memoryStore` garde l'objet que vous lui avez donné, pas une copie : modifier
une valeur après `get` change ce qui est stocké. `sqliteStore` sérialise en
JSON, donc il renvoie à chaque fois une copie neuve, et tout ce que JSON ne sait
pas représenter (une `Date`, une `Map`) est perdu ou transformé en chaîne.

Pour avoir plus d'un store, par exemple un durable plus un autre éphémère et
rapide, enregistrez le second comme service avec `defineStore` :

```ts title="features/cache.service.ts"
import { defineStore, memoryStore, type KVStore } from "@ix-xs/djs-bot";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap {
    cache: KVStore;
  }
}

export default defineStore("cache", memoryStore());
```

```ts
ctx.services.cache;   // le store en mémoire
ctx.services.store;   // celui de defineBot({ store })
```

Le bloc `declare module` est ce qui type `ctx.services.cache` : voir
[Services](/architecture/services/). À l'arrêt, le framework ferme le store de
`defineBot({ store })`. Un store enregistré avec `defineStore` n'est pas fermé
pour vous.

:::tip[Un store n'est pas un cache]
Pour des données chaudes en processus avec éviction automatique, utilisez plutôt
[`createCache`](/data/cache/) : il est synchrone, borné, et peut servir des
valeurs périmées pendant qu'il se rafraîchit. Cette page compare les deux.
:::

## Écrire un adaptateur

Implémentez un `KVBackend` (quatre fonctions) et `createStore` en déduit tout le
`KVStore` : espaces de noms, `getOrSet` à vol unique, compteurs, lectures
groupées.

```ts title="src/redis-store.ts"
import { createStore, type KVStore } from "@ix-xs/djs-bot";
import { createClient } from "redis";

export function redisStore<V = unknown>(url: string): KVStore<V> {
  const client = createClient({ url });
  const ready = client.connect();

  return createStore<V>({
    async get(key) {
      await ready;
      const raw = await client.get(key);
      return raw === null ? undefined : JSON.parse(raw);
    },
    async set(key, value, ttlMs) {
      await ready;
      await client.set(key, JSON.stringify(value), ttlMs ? { PX: ttlMs } : undefined);
    },
    async delete(key) {
      await ready;
      return (await client.del(key)) > 0;
    },
    async keys(prefix) {
      await ready;
      return client.keys(`${prefix}*`);
    },
    close: () => client.quit(),
  });
}
```

Les clés arrivent au backend entièrement préfixées, il n'a donc jamais à
connaître les espaces de noms. Le TTL arrive déjà converti en millisecondes, et
`0` signifie que la clé n'expire jamais. Le backend est responsable de
l'expiration : `get` doit renvoyer `undefined` pour une clé expirée, et `keys`
doit l'omettre.

Un objet écrit à la main qui implémente `KVStore` directement fonctionne aussi,
y compris un objet écrit avant l'existence de `increment`, `update`, `getMany`,
`setMany`, `entries`, `size` et `close`. Quand un tel objet arrive dans
`defineBot({ store })`, `defineStore`, `createFeatureFlags` ou
`storeAuditSink`, le framework repère les méthodes manquantes et l'enveloppe
pour qu'elles existent. Pour un nouvel adaptateur, `createStore` demande moins
de code.

## Référence

### `KVStore<V>`

L'interface que tout store implémente. `V` est le type des valeurs et vaut
`unknown` par défaut. `ttl` est toujours facultatif : des millisecondes, une
chaîne de durée comme `"10m"`, ou rien pour aucune expiration.

| Méthode | Renvoie | Description |
| --- | --- | --- |
| `get(key)` | `Promise<V \| undefined>` | Lit une valeur. `undefined` si absente ou expirée. |
| `set(key, value, ttl?)` | `Promise<void>` | Écrit une valeur et remplace son expiration. |
| `has(key)` | `Promise<boolean>` | Indique si une valeur vivante existe. |
| `delete(key)` | `Promise<boolean>` | Supprime une clé. `true` si quelque chose a été supprimé. |
| `getOrSet(key, factory, ttl?)` | `Promise<V>` | Lit, ou exécute `factory` et stocke le résultat en cas d'absence. Un seul appel de la fabrique pour des lecteurs simultanés. |
| `increment(key, by?, ttl?)` | `Promise<number>` | Ajoute `by` (`1` par défaut) à une clé numérique et renvoie la nouvelle valeur. Une clé absente compte pour `0`. |
| `update(key, fn, ttl?)` | `Promise<V>` | Lit, transforme et réécrit en une seule étape. `fn` reçoit la valeur actuelle ou `undefined` et peut être asynchrone. Renvoie la nouvelle valeur. |
| `getMany(keys)` | `Promise<Map<string, V>>` | Plusieurs clés d'un coup. Les clés absentes ne figurent pas dans la map. |
| `setMany(entries, ttl?)` | `Promise<void>` | Plusieurs écritures partageant un même TTL. Accepte un objet ou un itérable de paires `[key, value]`. |
| `keys()` | `Promise<string[]>` | Toutes les clés vivantes de ce store (avec espace de noms), sans le préfixe de l'espace de noms. |
| `entries()` | `Promise<[string, V][]>` | Toutes les paires `[key, value]` vivantes de ce store. |
| `size()` | `Promise<number>` | Le nombre de clés vivantes que contient ce store. |
| `clear()` | `Promise<void>` | Supprime toutes les clés de ce store (avec espace de noms). |
| `namespace<T>(prefix)` | `KVStore<T>` | Une vue limitée à `prefix:`. Synchrone. `T` vaut `V` par défaut. |
| `close()` | `Promise<void>` | Libère le descripteur de fichier ou la connexion. Peut être appelée deux fois sans risque. Appelée pour vous à l'arrêt pour le store du bot. |

### `memoryStore()`

```ts
memoryStore<V = unknown>(): KVStore<V>
```

Un store en mémoire. Aucune configuration, local au processus, perdu au
redémarrage. `close()` le vide.

### `sqliteStore(path)`

```ts
sqliteStore<V = unknown>(path?: string): KVStore<V>
```

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `path` | `string` | `"data/store.sqlite"` | Le fichier de base de données. Le dossier parent est créé. `":memory:"` donne une base transitoire. |

### `createStore(backend)`

```ts
createStore<V = unknown>(backend: KVBackend): KVStore<V>
```

Construit un `KVStore` complet à partir d'un `KVBackend`.

### `KVBackend`

Le contrat minimal qu'un backend de stockage remplit. Chaque fonction peut être
synchrone ou asynchrone.

| Méthode | Obligatoire | Description |
| --- | --- | --- |
| `get(key)` | Oui | La valeur brute, ou `undefined` si absente ou expirée. |
| `set(key, value, ttlMs)` | Oui | Écrit une valeur. `ttlMs` vaut `0` quand la clé n'expire jamais. |
| `delete(key)` | Oui | Supprime une clé et indique si quelque chose a été supprimé. |
| `keys(prefix)` | Oui | Toutes les clés vivantes qui commencent par `prefix` (`""` signifie toutes les clés). |
| `clear(prefix)` | Non | Un raccourci rapide pour supprimer toutes les clés sous `prefix`. Sans lui, `clear()` se rabat sur `keys` puis `delete`. |
| `close()` | Non | Nettoyage, appelé une fois par `store.close()`. |

### `defineStore(token, store)`

```ts
defineStore(token: string, store: KVStore): ServiceDefinition<KVStore>
```

Enveloppe un store dans une définition de service, pour qu'un fichier
`*.service.ts` puisse l'exporter et que les gestionnaires le lisent comme
`ctx.services.<token>`.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `token` | `string` | obligatoire | Le nom du service. |
| `store` | `KVStore` | obligatoire | N'importe quel store : un adaptateur livré avec le framework ou le vôtre. |

## Voir aussi

- [Cache et résolution d'entités](/data/cache/) : la mise en cache en processus, et ce qui la distingue d'un store.
- [Feature flags](/data/flags/) : réutilisent le store du bot, pour que les bascules survivent aux redémarrages.
- [Journal d'audit](/data/audit/) : `storeAuditSink(store)` garde l'historique dans un store.
- [Services](/architecture/services/) : comment `ctx.services` est construit et typé.
- [Configuration](/basics/configuration/) : le champ `store` de `defineBot`.
