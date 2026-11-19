---
title: "Passer à la 1.5"
description: "La 1.5 renomme cinq exports et options. Les noms de la 1.4 fonctionnent jusqu'à la 2.0 et avertissent une fois chacun. Chaque ancien nom, son remplaçant, et le passage à node-comfort 3.0."
---

| | |
| --- | --- |
| Anciens noms | Fonctionnent comme en 1.4, affichent un `DeprecationWarning` chacun, supprimés en 2.0 |
| Node.js | Les mêmes versions qu'en 1.4 : 22.23.4, 24.22.1, 26.12.1 ou plus |
| discord.js | Le même : 14.27 ou plus sur la 14 |
| node-comfort | 3.0 ou plus, installé avec le paquet |

```bash
npm install @ix-xs/djs-bot@1.5
```

## Retrouver les anciens noms

La première utilisation d'un ancien nom affiche un `DeprecationWarning` avec son code, par exemple `DJS_BOT_DEP_ONEOF`, et le nom à utiliser à la place.

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

## Renommés

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

## Nouveaux exports

| Export | Pour |
| --- | --- |
| `CronField` | Le type d'un champ analysé d'une planification cron. Voir [Tâches planifiées](/events/jobs/) |

## node-comfort 3.0

djs-bot 1.5 dépend de `@ix-xs/node-comfort` 3.0. npm l'installe avec le paquet : rien à faire pour un bot qui n'importe pas node-comfort lui-même.

| Votre bot | Que faire |
| --- | --- |
| N'importe pas `@ix-xs/node-comfort` | Rien |
| L'importe, en 2.x | Il garde sa propre copie, comme avant. Le passer en 3.0 partage une seule copie avec djs-bot |
| L'importe, en 3.x | Rien |

node-comfort 3.0 garde les noms de la 2.x jusqu'à la 4.0, avec un avertissement chacun : voir [sa page de mise à niveau](https://ix-xs.github.io/node-comfort/help/upgrade-3-0/). Le fichier `.env` est toujours lu à l'import, avec les mêmes règles ([Configuration](/basics/configuration/#environment-variables)).
