---
title: "Données & état"
description: "KVStore, cache, resolve, i18n, feature flags et audit - toutes les méthodes."
sidebar:
  label: "Données & état"
  order: 8
---

## `KVStore` - persistance clé-valeur

Le cœur du framework n'impose **aucune** base de données : il parle l'interface
asynchrone `KVStore`. Deux adaptateurs sont fournis, et tu peux écrire le tien
(Redis, Postgres…).

```ts
const bot = defineBot({
  store: sqliteStore("data/bot.sqlite"), // ou memoryStore()
});
```

Le `store` de la configuration est enregistré automatiquement comme service
`store` → `ctx.services.store`.

### Méthodes

| Méthode | Rôle |
| --- | --- |
| `get(clé)` | Lit une valeur, ou `undefined` si absente/expirée. |
| `set(clé, valeur, ttl?)` | Écrit. `ttl` en ms ou durée (`"10m"`) ; sans TTL = permanent. |
| `has(clé)` | `true` si une valeur fraîche existe. |
| `delete(clé)` | Supprime ; renvoie `true` si quelque chose a été retiré. |
| `keys()` | Toutes les clés de ce store (namespace compris). |
| `clear()` | Vide ce store (namespace compris). |
| `namespace(préfixe)` | Une **vue isolée** sous `préfixe:` - sans second backend. |
| `getOrSet(clé, fabrique, ttl?)` | Lit, ou calcule **et** stocke en cas d'absence (dédoublonné par processus). |

```ts
const store = ctx.services.store;
const soldes = store.namespace("economy");     // clés préfixées "economy:"
await soldes.set(ctx.user.id, 100, "30d");
const solde = (await soldes.get(ctx.user.id)) ?? 0;
```

### Adaptateurs

| Fonction | Rôle |
| --- | --- |
| `memoryStore<V>()` | En mémoire, rapide, **non durable** (perdu au redémarrage). |
| `sqliteStore<V>(chemin?)` | Durable via `node:sqlite`. Défaut : `"data/store.sqlite"`. `":memory:"` pour une base éphémère. |
| `defineStore(token, store)` | Emballe un store en **service** (découvrable depuis un `*.service.ts`). |

> Le dossier du fichier SQLite doit exister. Les namespaces sont correctement
> isolés même si leur nom contient `_` ou `%`.

## `TTLCache` - cache intelligent

Cache mémoire avec TTL par entrée, borne LRU, **dédoublonnage des appels
concurrents** (single-flight) et *stale-while-revalidate* optionnel.

```ts
const prix = createCache<string, number>({ ttl: "1m", max: 500, staleWhileRevalidate: true });
const p = await prix.getOrFetch(symbole, () => fetchPrix(symbole));
```

| Option | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `ttl` | `number \| string` | `"5m"` | Durée de vie d'une entrée. |
| `max` | `number` | `1000` | Nombre max d'entrées (éviction LRU au-delà). |
| `staleWhileRevalidate` | `boolean` | `false` | Sert la valeur périmée immédiatement et rafraîchit en arrière-plan. |

| Méthode | Rôle |
| --- | --- |
| `get(clé)` | Valeur fraîche, ou `undefined`. |
| `set(clé, valeur, ttl?)` | Écrit manuellement. |
| `has(clé)` | Existence d'une valeur fraîche. |
| `delete(clé)` / `clear()` | Suppression. |
| `getOrFetch(clé, fetcher, ttl?)` | Valeur en cache, sinon exécute `fetcher` (les appels concurrents sur la même clé sont mutualisés). |

## `resolve` - récupération cache-first

Lit le cache de discord.js et n'appelle l'API **qu'en cas d'absence**.

| Méthode | Renvoie |
| --- | --- |
| `resolve.member(guild, id, force?)` | `GuildMember` |
| `resolve.user(client, id, force?)` | `User` |
| `resolve.role(guild, id, force?)` | `Role \| null` |
| `resolve.channel(client, id, force?)` | `Channel \| null` |
| `resolve.message(salon, id, force?)` | `Message` |

`force: true` force toujours un appel API.

## i18n - traduire les messages envoyés

Traduit les **messages que ton bot envoie**, selon la langue du client Discord de
chaque utilisateur. (À ne pas confondre avec `nameLocalizations`, qui traduit le
nom des commandes dans le sélecteur.)

```ts
const bot = defineBot({
  i18n: {
    defaultLocale: "fr",
    resources: {
      fr: { daily: { claimed: "Vous avez reçu {n} pièces !" }, objets: { one: "{count} objet", other: "{count} objets" } },
      en: { daily: { claimed: "You claimed {n} coins!" },      objets: { one: "{count} item",  other: "{count} items" } },
    },
  },
});

// Dans un handler :
await ctx.reply.success(ctx.t("daily.claimed", { n: 100 }));
await ctx.reply.info(ctx.t("objets", { count: 3 })); // « 3 objets »
```

| Option | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `defaultLocale` | `string` | `"en"` | Locale utilisée en dernier recours. |
| `fallbackLocale` | `string` | - | Locale essayée **avant** la locale par défaut. |
| `resources` | `Record<locale, Messages>` | requis | Arbres de traductions par locale. |

**Fonctionnalités** : clés imbriquées avec des points (`"daily.claimed"`),
interpolation `{variable}`, pluriel via `{ one, other }` piloté par `{count}`.

**Chaîne de repli** : locale exacte (`"fr-CA"`) → base (`"fr"`) → `fallbackLocale`
→ `defaultLocale` → **la clé elle-même**. Sans configuration i18n, `ctx.t(clé)`
renvoie la clé (no-op sûr).

`createI18n(options)` permet aussi de traduire **hors** handler :
`i18n.t(locale, clé, vars)`, `i18n.locales()`, `i18n.defaultLocale`.

## Feature flags

Active/désactive des fonctionnalités à l'exécution, globalement ou **par
serveur**, persistées dans un `KVStore`.

```ts
const bot = defineBot({
  store,
  flags: { defaults: { economy: true, beta: false } }, // réutilise `store` automatiquement
});
```

| Option | Type | Rôle |
| --- | --- | --- |
| `store` | `KVStore` | Où persister les surcharges. **Par défaut : le `store` du bot.** |
| `defaults` | `Record<string, boolean>` | État par défaut de chaque drapeau. |

**Ordre de résolution** : surcharge du serveur → surcharge globale → valeur par
défaut → `false`.

| Méthode (`ctx.services.flags`) | Rôle |
| --- | --- |
| `isEnabled(nom, { guildId? })` | Le drapeau est-il actif dans ce contexte ? |
| `enable(nom, { guildId? })` | Active (globalement, ou pour un serveur). |
| `disable(nom, { guildId? })` | Désactive. |
| `clear(nom, { guildId? })` | Retire la surcharge (retour au niveau inférieur). |
| `setDefault(nom, actif)` | Change la valeur par défaut en mémoire. |
| `list(guildId?)` | Drapeaux effectifs (défauts + surcharges). |

Le guard `featureEnabled("economy")` bloque une commande quand le drapeau est
désactivé, et **laisse passer** si `flags` n'est pas configuré (fail-open).

## Audit - qui a fait quoi

```ts
const bot = defineBot({
  store,
  audit: {
    sinks: [loggerAuditSink(), storeAuditSink(store, { namespace: "audit" })],
    autoRecordCommands: true, // journalise chaque commande comme "command:<nom>"
  },
});
```

| Option | Type | Rôle |
| --- | --- | --- |
| `sink` | `AuditSink` | Un puits unique. |
| `sinks` | `AuditSink[]` | Plusieurs puits (tous reçoivent chaque entrée). |
| `autoRecordCommands` | `boolean` | Journalise automatiquement chaque commande. |

### Puits fournis

| Puits | Rôle |
| --- | --- |
| `memoryAuditSink(max?)` | En mémoire (défaut 5000 entrées). Interrogeable. |
| `storeAuditSink(store, { namespace?, ttl? })` | Écrit dans un `KVStore`. |
| `loggerAuditSink(logger?)` | Écrit dans le logger structuré. Sans argument, utilise un logger par défaut. |

Tu peux implémenter `AuditSink` toi-même : `{ record(entry), query?() }`.

### Entrée et requêtes

Une `AuditEntry` : `id`, `timestamp`, `action`, `actorId`, `guildId`, `targetId`,
`metadata`.

```ts
const audit = ctx.services.audit;
const bans = await audit.query({ action: "member.ban", guildId: ctx.guildId!, limit: 10 });
```

Filtres : `action`, `actorId`, `guildId`, `since`, `limit`. Résultats du **plus
récent au plus ancien**.

> Un puits qui échoue **ne casse jamais** la commande : les erreurs de puits sont
> avalées (l'audit est de l'observabilité, pas du chemin critique).
