---
title: "Configuration - defineBot"
description: "Tous les champs de configuration de defineBot, en détail."
sidebar:
  label: "Configuration"
  order: 1
---

`defineBot(config)` crée l'application. Il renvoie un objet `Bot` que tu exportes
par défaut et démarres avec `bot.start()`.

```ts
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  intents: "auto",
});

export default bot;
if (!process.env.DJSBOT_CLI) void bot.start();
```

## Champs de configuration (`BotConfig`)

| Champ | Type | Par défaut | Rôle |
| --- | --- | --- | --- |
| `token` | `string` | `DISCORD_TOKEN` | Jeton du bot. À défaut, lit la variable d'environnement `DISCORD_TOKEN`. Absent des deux → erreur `DJSBOT_E001`. |
| `clientId` | `string` | `DISCORD_CLIENT_ID` | Identifiant d'application, requis pour déployer les commandes. Absent au déploiement → `DJSBOT_E002`. |
| `features` | `FeatureSource \| FeatureSource[]` | - | Un chemin de dossier auto-découvert **et/ou** des définitions/features explicites. Voir ci-dessous. |
| `intents` | `"auto" \| GatewayIntentBits[]` | - | `"auto"` déduit les intents de tes événements/triggers. Sinon, un tableau explicite. |
| `partials` | `Partials[]` | dérivés | Partials explicites, **fusionnés** avec ceux déduits par l'autopilote. |
| `plugins` | `PluginDefinition[]` | `[]` | Plugins transverses (middleware, hooks). |
| `owners` | `string[]` | `[]` | Ids des propriétaires du bot. Utilisés par le guard `ownerOnly()` appelé sans argument, et exposés via `ctx.owners`. |
| `deploy` | `DeployConfig` | - | Réglages de déploiement (voir plus bas). |
| `logger` | `{ level?, pretty? }` | `info`, joli hors prod | Niveau de log et format. |
| `presence` | `PresenceData` | - | Présence initiale de la passerelle (statut + activités). |
| `presenceRotation` | `{ interval, items }` | - | Fait tourner la présence sur un intervalle. |
| `sharding` | `boolean \| "auto" \| ShardingOptions` | - | Active le sharding. Voir [Production](/djs-bot/reference-fr/production/). |
| `i18n` | `I18nOptions` | - | Traductions runtime des messages envoyés (`ctx.t`). |
| `store` | `KVStore` | - | Store clé-valeur, enregistré comme service `store` (`ctx.services.store`). Réutilisé par `flags` et `audit`. |
| `audit` | `{ sink?, sinks?, autoRecordCommands? }` | - | Journal d'audit. Active `ctx.audit(...)` et le service `audit`. |
| `flags` | `FeatureFlagsOptions` | - | Feature flags. Active le guard `featureEnabled()` et le service `flags`. |
| `health` | `number \| HealthOptions` | - | Serveur HTTP de santé : un port, ou `{ port, host }`. |
| `onError` | `(error, ctx?) => unknown` | - | Handler d'erreur global des interactions. Renvoyer une valeur marque l'erreur comme traitée (pas de message par défaut). |

### `features` en détail

`FeatureSource` = un **chemin de dossier** (`string`), une **définition** unique,
ou un **tableau** des deux.

```ts
features: [
  `${import.meta.dirname}/features`, // dossier auto-découvert par convention
  ticketsFeature,                    // une feature enregistrée explicitement
]
```

Le loader découvre les fichiers par **suffixe** (`*.command.ts`, `*.event.ts`,
`*.button.ts`, `*.select.ts`, `*.modal.ts`, `*.event.ts`, `*.trigger.ts`,
`*.job.ts`, `*.service.ts`, `*.feature.ts`). Tout autre fichier est **ignoré**,
donc les helpers partagés peuvent cohabiter sans risque. Importer un fichier n'a
**jamais** d'effet de bord : le loader collecte seulement les objets exportés.

### `deploy` (`DeployConfig`)

| Champ | Type | Rôle |
| --- | --- | --- |
| `devGuildId` | `string` | Serveur de dev. En développement (`NODE_ENV !== "production"`), **toutes** les commandes y sont déployées instantanément. À défaut, lit `DISCORD_DEV_GUILD`. |
| `autoDeploy` | `boolean` | Force (ou désactive) l'auto-déploiement. Par défaut : actif en dev, inactif en prod. |

### `presence` et `presenceRotation`

```ts
import { ActivityType } from "@ix-xs/djs-bot";

presence: { activities: [{ name: "/help", type: ActivityType.Listening }] },
presenceRotation: {
  interval: "45s",
  items: [
    { activities: [{ name: "/help", type: ActivityType.Listening }] },
    { status: "idle", activities: [{ name: "maintenance", type: ActivityType.Playing }] },
  ],
},
```

`interval` accepte un nombre de ms ou une durée (`"45s"`). `items` est une liste
de `PresenceData` parcourue en boucle.

## Méthodes de l'objet `Bot`

| Membre | Signature | Rôle |
| --- | --- | --- |
| `bot.use(...items)` | `(...Registrable) => this` | Enregistre des définitions supplémentaires (commandes, services…) sans dossier. |
| `bot.start()` | `() => Promise<void>` | Démarre le cycle de vie complet et se connecte. |
| `bot.deploy(options?)` | `({ guildId?, dryRun? }) => Promise<DeployResult>` | Réconcilie les commandes (global + par serveur). `guildId` force tout sur un serveur. |
| `bot.clear(options?)` | `({ guildId?, dryRun? }) => Promise<DeployTargetResult>` | Supprime toutes les commandes d'un scope (guilde, ou global si `guildId` omis). |
| `bot.describe()` | `() => Promise<BotDescription>` | Renvoie tout ce qui est chargé (intents, commandes, plan de déploiement…) sans se connecter. |
| `bot.setPresence(data)` | `(PresenceData) => void` | Change la présence à l'exécution. |
| `bot.setActivity(name, options?)` | `(string, { type?, status? }) => void` | Raccourci pour définir une activité. |
| `bot.client` | `Client<true>` | Le client discord.js connecté (lève une erreur avant `start()`). |
| `bot.devGuildId` | `string \| undefined` | Le serveur de dev configuré. |

## `env` - lecture d'environnement

```ts
import { env } from "@ix-xs/djs-bot";

env("DISCORD_TOKEN");            // lit env + .env ; lève une erreur claire si absent
env("PREFIX", "!");             // avec valeur de repli
env.optional("DISCORD_CLIENT_ID"); // renvoie undefined si absent
```

`env(nom, repli?)` lit les variables d'environnement **et** un fichier `.env`.
`env.optional(nom)` renvoie `undefined` au lieu de lever une erreur.

## Cycle de vie de `bot.start()`

```
configure → découverte (loader) → validation (contrats requires/provides)
→ enregistrement des services (DI) → setup des plugins → résolution DI
→ calcul des intents → connexion → ready
→ [en marche] → SIGTERM → drain → arrêt
```

- **validation** : chaque `requires` de feature/plugin doit être fourni, sinon
  échec bruyant (`DJSBOT_E040`) **avant** la connexion.
- **ready** : démarre les jobs planifiés et auto-déploie en développement.
- **arrêt** (Ctrl+C / SIGTERM) : stoppe les jobs, exécute les hooks `onShutdown`,
  démonte les plugins, détruit le client. Aucun crash, aucun travail orphelin.
