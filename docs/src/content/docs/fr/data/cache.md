---
title: "Cache et résolution d'entités"
description: "Des helpers qui lisent le cache de discord.js avant d'appeler l'API, une vérification pour les salons que Discord cache au bot, et où mettre les résultats de votre propre travail."
sidebar:
  order: 2
---

Deux outils vivent ici. `resolve` cherche des entités Discord (membres, rôles,
salons) dans le cache que discord.js tient déjà. `isHiddenChannel` distingue un
vrai salon d'un substitut. Les résultats de votre propre travail vont dans le
cache de node-comfort.

## Mettre en cache vos propres résultats

Utilisez `nc.cache.create({ ttl, max })` de node-comfort ([sa page](https://ix-xs.github.io/node-comfort/flow/cache/)),
avec `getOrSet` pour charger en cas d'absence, et créez-le dans un
[service](/architecture/services/) pour que tous les gestionnaires le partagent.

## Cache ou store

| | `nc.cache` | [`KVStore`](/data/store/) |
| --- | --- | --- |
| Lectures | Synchrones | Asynchrones |
| Survit à un redémarrage | Non | Avec `sqliteStore` |
| Partagé entre les shards | Non | Avec un backend partagé |
| Borné, évince des entrées | Avec `max` | Non |
| Sert à | Les données chaudes, les réponses d'API | Un vrai état : profils, réglages, tickets |

Ils se marient bien, le cache devant et le store derrière :

```ts
const profile = await cache.getOrSet(id, () => store.get(`profile:${id}`));
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
`"___hidden___"`, ses autres détails effacés et l'indicateur
`CHANNEL_OBFUSCATED` (`1 << 17`). La liste des salons de l'API REST,
`GET /guilds/{guild.id}/channels`, l'omet entièrement : à partir de cette date,
`guild.channels.fetch()` ne renvoie que les salons que le bot peut voir. Quand le
bot obtient l'accès, une mise à jour du salon livre les données complètes.

D'ici là, l'option temporaire **Private Channel Obfuscation** du Developer Portal
active ce comportement en avance, pour le tester.

`isHiddenChannel` fait la différence, pour qu'une liste de salons, un compteur
ou une autocomplétion n'affiche jamais un substitut :

```ts
import { isHiddenChannel } from "@ix-xs/djs-bot";

const names = guild.channels.cache
  .filter((channel) => !isHiddenChannel(channel))
  .map((channel) => channel.name);
```

Les données des interactions ne sont pas masquées : les salons reçus via une
interaction (une option de salon, un menu de sélection de salons) portent
toujours leurs vraies données.

## Référence

Chaque option, propriété et type, avec ce qu'il accepte et renvoie, est dans la référence de l'API :

- `resolve` : Utilitaires de récupération qui interrogent d'abord le cache.
- `isHiddenChannel()` : Indique si un salon est un salon que le bot ne peut pas voir, envoyé par Discord sans son nom ni ses détails (« masqué »).

## Voir aussi

- [Store](/data/store/) : un état durable qui survit à un redémarrage.
- [Services](/architecture/services/) : l'endroit où placer un cache partagé.
- [Résilience](/production/resilience/) : limites de débit, nouvelles tentatives et disjoncteurs pour les appels que vous mettez en cache.
- [Options et autocomplétion](/commands/options/) : les options de salon, qui ne livrent jamais de salons cachés.
