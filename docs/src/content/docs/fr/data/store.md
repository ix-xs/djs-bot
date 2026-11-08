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
toucher à celles des autres.

Les espaces de noms sont distingués exactement. Chaque caractère d'un nom est
comparé littéralement, quel qu'il soit, et sa casse aussi :
`namespace("Users")` et `namespace("users")` sont deux espaces de noms
différents, avec SQLite également.

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

Avec `sqliteStore`, `setMany()` est une seule transaction : toutes les clés sont
écrites ou aucune, et c'est beaucoup plus rapide que de les écrire une par une.
`entries()` est une seule requête au lieu d'une par clé. Avec `memoryStore`, ou
avec un backend qui n'a pas de méthode groupée à lui, les clés sont écrites
l'une après l'autre : une écriture qui échoue laisse donc les précédentes en
place.

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

Deux fonctions facultatives accélèrent les accès groupés.
`setMany(entries, ttlMs)` écrit plusieurs clés d'un coup, en une seule étape
quand le backend le permet (une transaction, un pipeline). `entries(prefix)`
renvoie en une fois toutes les paires `[key, value]` vivantes sous `prefix`.
Sans elles, le store se rabat sur `set`, `keys` et `get`.

Un objet écrit à la main qui implémente `KVStore` directement fonctionne aussi,
y compris un objet écrit avant l'existence de `increment`, `update`, `getMany`,
`setMany`, `entries`, `size` et `close`. Quand un tel objet arrive dans
`defineBot({ store })`, `defineStore`, `createFeatureFlags` ou
`storeAuditSink`, le framework repère les méthodes manquantes et l'enveloppe
pour qu'elles existent. Pour un nouvel adaptateur, `createStore` demande moins
de code.

## Référence

Chaque option, propriété et type, avec ce qu'il accepte et renvoie, est dans la référence de l'API :

- `KVStore` : Un store clé-valeur asynchrone.
- `sqliteStore()` : Crée un `KVStore` durable reposant sur SQLite (via le `node:sqlite` intégré de node-comfort).
- `memoryStore()` : Crée un `KVStore` en mémoire (rapide, non durable).
- `createStore()` : Construit un `KVStore` complet à partir d'un `KVBackend` minimal.
- `KVBackend` : Le contrat minimal qu'un backend de stockage doit remplir.
- `defineStore()` : Enveloppe un `KVStore` dans une définition de service pour qu'il soit injectable sous `ctx.services.<token>` et découvert depuis un fichier `*.service.ts`.

## Voir aussi

- [Cache et résolution d'entités](/data/cache/) : la mise en cache en processus, et ce qui la distingue d'un store.
- [Feature flags](/data/flags/) : réutilisent le store du bot, pour que les bascules survivent aux redémarrages.
- [Journal d'audit](/data/audit/) : `storeAuditSink(store)` garde l'historique dans un store.
- [Services](/architecture/services/) : comment `ctx.services` est construit et typé.
- [Configuration](/basics/configuration/) : le champ `store` de `defineBot`.
