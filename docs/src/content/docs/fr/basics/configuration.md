---
title: "Configuration"
description: "Le fichier d'entrée d'un bot : defineBot et chacune de ses options, les variables d'environnement qu'il lit, et l'objet Bot que vous récupérez."
sidebar:
  order: 2
---

Tout ce qui concerne un bot se déclare au même endroit : l'objet que vous passez à
`defineBot`. Cette page liste tous les champs de cet objet. La plupart ont leur
propre page, indiquée dans le [tableau de référence](#botconfig).

## Un premier fichier d'entrée

```ts title="src/index.ts"
import { defineBot } from "@ix-xs/djs-bot";

const bot = defineBot({
  features: `${import.meta.dirname}/features`,   // dossier de définitions, découvertes pour vous
  defaults: { defer: true },                     // accuse réception automatiquement des gestionnaires lents
});

export default bot;

// Démarre seulement quand le fichier est lancé directement (la CLI l'importe pour ses outils).
if (!process.env.DJSBOT_CLI) void bot.start();
```

Trois choses comptent dans ce fichier :

- `defineBot` crée le bot mais ne se connecte pas. `bot.start()` le fait, et le
  fichier d'entrée doit l'appeler : `djs-bot dev` et `djs-bot start` exécutent ce
  fichier, ils ne démarrent pas le bot à votre place.
- Le bot est l'**export par défaut**. `deploy`, `clear`, `doctor` et `explain`
  importent le fichier et le cherchent là. Un export nommé `bot` est également
  accepté.
- Le test `DJSBOT_CLI` évite `start()` quand l'une de ces commandes importe le
  fichier pour l'inspecter. Elles définissent `DJSBOT_CLI=introspect`, et dans ce
  mode `start()` se contenterait de charger les définitions et de revenir sans se
  connecter.

Tous les champs sont facultatifs. Le bot lit lui-même `DISCORD_TOKEN`,
`DISCORD_CLIENT_ID` et `DISCORD_DEV_GUILD` dans l'environnement, de sorte que
`defineBot({ features })` est déjà une configuration qui fonctionne. `token`,
`clientId` et `deploy.devGuildId` servent à les remplacer.

| Variable | Champ | Valeur, depuis le Developer Portal |
| --- | --- | --- |
| `DISCORD_TOKEN` | `token` | Bot > Reset Token. Secret |
| `DISCORD_CLIENT_ID` | `clientId` | General Information > Application ID. Nécessaire pour déployer |
| `DISCORD_DEV_GUILD` | `deploy.devGuildId` | L'ID de votre serveur de test (mode développeur de Discord, clic droit sur le serveur). Les commandes y apparaissent aussitôt sous `dev` |

## Variables d'environnement

Le fichier `.env` du répertoire de travail est chargé dans `process.env` dès que
`@ix-xs/djs-bot` est importé : sa dépendance `@ix-xs/node-comfort` s'en charge,
avec ou sans la CLI. Définissez `NODE_COMFORT_DOTENV=false` pour le désactiver.

Lisez vos autres variables avec `nc.env` de node-comfort
([sa page](https://ix-xs.github.io/node-comfort/essentials/env/)). Il échoue au démarrage avec un message lisible au lieu de
vous remettre un `undefined` qui casse trois couches plus loin :

```ts title="src/index.ts"
import { defineBot } from "@ix-xs/djs-bot";
import nc from "@ix-xs/node-comfort";

export default defineBot({
  owners: nc.env.list("OWNER_IDS", { default: [] }),            // "1, 2,3" -> ["1", "2", "3"]
  health: nc.env.number("PORT", { default: 3000 }),              // lève une erreur si PORT n'est pas un nombre
  logger: { level: nc.env.boolean("DEBUG", { default: false }) ? "debug" : "info" },
});
```

| Pour lire | Appel |
| --- | --- |
| Une chaîne obligatoire | `nc.env.required(name)` |
| Une chaîne avec une valeur par défaut | `nc.env.string(name, { default })` |
| Une chaîne facultative | `nc.env.string(name, { optional: true })` : `undefined` si elle est absente ou vide |
| Un nombre | `nc.env.number(name, { default })`, ainsi que `min`, `max`, `integer` |
| Un booléen | `nc.env.boolean(name, { default: false })` |
| Une liste séparée par des virgules | `nc.env.list(name, { default: [] })` |

Une valeur vide compte comme absente, et une valeur absente ou mal formée lève
une `ValidationError` pendant l'évaluation du fichier d'entrée, avant toute
connexion. Les `env()` et `loadEnvFile()` de djs-bot fonctionnent encore jusqu'à
la 2.0, avec un avertissement : voir [Mettre à niveau](/help/upgrading/#version-16).

Quand une variable est définie à plusieurs endroits, la source la plus forte
l'emporte :

1. L'environnement réel (votre shell, votre hébergeur). Une variable qui y est
   déjà définie n'est jamais remplacée, ce que vous voulez en production.
2. Un fichier chargé avec `nc.env.load(path)`.
3. Le `.env` lu à l'import.

:::note[Charger un autre fichier]
Vous n'avez rien à appeler pour `.env`, même quand vous lancez vous-même le
fichier d'entrée (`node dist/index.js`). `nc.env.load(path)` sert à charger un
autre fichier, comme `.env.local` : appelez-la en haut du fichier d'entrée,
avant la première lecture.
:::

:::caution[Les variables qui peuvent exécuter du code]
Le `.env` lu à l'import écarte les variables qui peuvent exécuter du code ou
affaiblir TLS, et les nomme dans un seul avertissement sur stderr. Parmi elles :

- `NODE_OPTIONS`, `NODE_TLS_REJECT_UNAUTHORIZED`, `NODE_EXTRA_CA_CERTS`,
  `NODE_PATH`, `LD_PRELOAD`, `PATH` ;
- les variables de git qui lancent une commande (`GIT_SSH_COMMAND`,
  `GIT_EDITOR`...), et celles de l'éditeur et du pager (`EDITOR`, `VISUAL`,
  `PAGER`).

Un `.env` venu d'un dépôt qu'on vous a envoyé ne peut donc pas exécuter de code
dans votre bot. Quand vous voulez vraiment une telle variable, définissez-la dans
l'environnement réel. `nc.env.load(path)` charge toutes les variables du
fichier, celles-ci comprises : ne l'appelez que sur un fichier de confiance.
:::

:::caution[Mettez entre guillemets les secrets qui contiennent des caractères spéciaux]
Dans un fichier `.env`, `$NAME` est remplacé par la valeur de cette variable et
` #` ouvre un commentaire. Un secret qui contient `$` ou ` #` doit être écrit
entre guillemets simples, `TOKEN='pa$word'`, sinon il est altéré. Les règles
complètes sont sur [la page de node-comfort](https://ix-xs.github.io/node-comfort/essentials/env/#parsing).
:::

:::danger[Ne commitez jamais votre token]
Gardez `.env` dans `.gitignore`. Un token qui fuit permet à n'importe qui de
contrôler votre bot : si cela arrive, régénérez-le immédiatement dans le
Developer Portal.
:::

## Options du client Discord

Le framework crée le `Client` discord.js pour vous. `client` lui est transmis tel
quel : tout ce que discord.js accepte est donc disponible : `allowedMentions`,
`sweepers`, `makeCache`, `rest`... La seule exception est `intents`, qui est
calculé à partir de vos événements et se règle par l'option du même nom.

```ts title="src/index.ts"
import { defineBot } from "@ix-xs/djs-bot";
import nc from "@ix-xs/node-comfort";

export default defineBot({
  owners: nc.env.list("OWNER_IDS", { default: [] }),
  client: {
    // Ne laissez jamais le bot mentionner @everyone en répétant une saisie d'utilisateur.
    allowedMentions: { parse: ["users", "roles"], repliedUser: true },
    // Limite la mémoire d'un gros bot : oublie les messages de plus de 30 minutes.
    sweepers: { messages: { interval: 3600, lifetime: 1800 } },
  },
});
```

Deux champs de `client` sont combinés avec les options dédiées plutôt que
remplacés : `client.partials` est fusionné avec les partials que le framework
déduit, et `client.presence` n'est utilisé que si `presence` n'est pas défini.

`owners` est la liste des identifiants d'utilisateurs propriétaires du bot. Elle
est relue sous le nom `ctx.owners` dans chaque gestionnaire, et c'est ce que
vérifie la garde `ownerOnly()` quand elle est appelée sans identifiants : voir
[Gardes](/commands/guards/).

## Une configuration complète

Un bot qui utilise l'essentiel de ce que propose le framework. Chaque bloc tient
ici en une ligne de configuration et occupe une page entière ailleurs.

```ts title="src/index.ts"
import { ActivityType, defineBot, loggerAuditSink, sqliteStore } from "@ix-xs/djs-bot";
import nc from "@ix-xs/node-comfort";
import { antiSpam, commandLogger } from "@ix-xs/djs-bot/plugins";

const store = sqliteStore("data/bot.sqlite");

const bot = defineBot({
  owners: nc.env.list("OWNER_IDS", { default: [] }),
  features: `${import.meta.dirname}/features`,
  intents: "auto",
  defaults: { defer: true },
  client: { allowedMentions: { parse: ["users"], repliedUser: true } },

  plugins: [antiSpam({ max: 5, window: "10s" }), commandLogger()],

  store,
  flags: { store, defaults: { economy: true } },
  audit: { sinks: [loggerAuditSink()], autoRecordCommands: true },
  i18n: {
    defaultLocale: "en",
    resources: { en: { hello: "Hello" }, fr: { hello: "Bonjour" } },
  },
  messages: { cooldown: "Patiente {seconds}s." },
  theme: { success: 0x57f287 },

  logger: { level: "info", pretty: process.env.NODE_ENV !== "production" },
  health: nc.env.number("PORT", { default: 3000 }),
  presence: { activities: [{ name: "/help", type: ActivityType.Listening }] },

  onError(error, ctx) {
    ctx?.logger.error({ err: error }, "unhandled interaction error");
  },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

## Utiliser l'objet bot

`defineBot()` renvoie un `Bot`. Dans un projet normal, vous l'exportez, vous le
démarrez, et vous n'y touchez plus. C'est pourtant un objet ordinaire que vous
pouvez piloter vous-même.

Charger et inspecter sans se connecter, ce que fait `djs-bot explain` :

```ts
await bot.load();                                    // découvre, valide, résout les services
const { commands, intents } = await bot.describe();  // un instantané structuré
```

Changer la présence ou lire les compteurs pendant que le bot tourne :

```ts
bot.setActivity("/help", { type: ActivityType.Watching });
const { interactions, errors, handlerAvgMs } = bot.stats();
```

Charger un bot depuis un autre script. `isBot` est une garde de type qui continue
de fonctionner quand deux copies du paquet sont chargées (la CLI et votre code,
CommonJS et ESM), là où `instanceof Bot` échouerait en silence :

```ts title="scripts/inspect.ts"
import { isBot } from "@ix-xs/djs-bot";

const mod = await import("../src/index.js");
if (!isBot(mod.default)) throw new Error("The entry file must default-export defineBot().");

await mod.default.load();
console.dir(await mod.default.describe(), { depth: null });
```

Importer le fichier d'entrée l'exécute. Lancez un tel script avec
`DJSBOT_CLI=introspect` dans l'environnement, pour que la condition en bas du
fichier d'entrée ne connecte pas le bot.

Ce que font `load()`, `start()` et `shutdown()`, étape par étape, est décrit dans
[Cycle de vie](/basics/lifecycle/).

## Référence

### `defineBot(config)`

```ts
function defineBot(config: BotConfig): Bot
```

Crée un [`Bot`](#bot) à partir d'un simple objet de configuration. Elle ne lit
rien sur le disque et ne se connecte pas.

### `BotConfig`

Tous les champs sont facultatifs.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `token` | `string` | `DISCORD_TOKEN` | Le token du bot, issu du Developer Portal. |
| `clientId` | `string` | `DISCORD_CLIENT_ID` | L'identifiant d'application. Requis par `bot.deploy()`, `bot.clear()` et les commandes CLI du même nom. Le déploiement automatique au démarrage le lit dans l'application connectée quand il n'est pas défini. |
| `owners` | `string[]` | `[]` | Les identifiants d'utilisateurs propriétaires du bot, relus sous le nom `ctx.owners` et utilisés par `ownerOnly()`. |
| `features` | `FeatureSource \| FeatureSource[]` | aucun | D'où viennent les définitions : un dossier à parcourir, des définitions explicites, ou les deux. Voir [Structure du projet](/basics/project-layout/). |
| `plugins` | `PluginDefinition[]` | `[]` | Plugins transversaux. Voir [Plugins et hooks](/architecture/plugins/). |
| `intents` | `"auto" \| GatewayIntentBits[] \| { add?, remove? }` | `"auto"` | Intents de la passerelle : déduits de vos événements et déclencheurs, ajustés, ou listés à la main. Voir [Événements et intents](/events/events-and-intents/). |
| `partials` | `Partials[]` | déduits | Partials supplémentaires, fusionnés avec ceux qui sont déduits. Voir [Événements et intents](/events/events-and-intents/). |
| `client` | `Omit<ClientOptions, "intents">` | `{}` | Options supplémentaires pour le `Client` discord.js. Voir [Options du client Discord](#discord-client-options). |
| `defaults` | `{ defer?: DeferOption }` | `{}` | Comportement appliqué à toute définition qui ne définit pas le sien. |
| `defaults.defer` | `DeferOption` | désactivé | Accuse réception à votre place pour les gestionnaires lents. Voir [Différé automatique](/basics/automatic-deferral/). |
| `messages` | `FrameworkMessages` | anglais | Reformule ou traduit ce que dit le framework lui-même. Voir [Formulations et thème](/basics/wording-and-theme/). |
| `theme` | `Partial<Theme>` | palette intégrée | Couleurs des embeds `ctx.reply.success/error/info/warn`. Voir [Formulations et thème](/basics/wording-and-theme/). |
| `deploy` | `{ devGuildId?: string; autoDeploy?: boolean }` | `DISCORD_DEV_GUILD`, automatique hors production | Réglages du déploiement des commandes. Voir [Déployer les commandes](/production/deploying/). |
| `logger` | `{ level?: LogLevel; pretty?: boolean }` | `"info"`, formaté hors production | Réglages du logger. Voir [Journalisation](/production/logging/). |
| `presence` | `PresenceData` | aucun | La présence initiale sur la passerelle. Voir [Présence](/production/presence/). |
| `presenceRotation` | `{ interval: string \| number; items: PresenceData[] }` | aucun | Alterne entre plusieurs présences. Voir [Présence](/production/presence/). |
| `sharding` | `boolean \| "auto" \| ShardingOptions` | désactivé | Fait tourner le bot sur plusieurs shards. Voir [Sharding](/production/sharding/). |
| `health` | `number \| HealthOptions` | désactivé | Un serveur HTTP de contrôle de santé et de métriques : un port, ou des options complètes. Voir [Santé et métriques](/production/health/). |
| `i18n` | `I18nOptions` | désactivé | Traductions des messages que le bot envoie, lues avec `ctx.t`. Voir [Internationalisation](/data/i18n/). |
| `store` | `KVStore` | aucun | Un store clé-valeur, enregistré comme service `store`. Voir [Store](/data/store/). |
| `audit` | `{ sinks?, autoRecordCommands? }` | désactivé | Active `ctx.audit(...)` et le service `audit`. Voir [Journal d'audit](/data/audit/). |
| `flags` | `FeatureFlagsOptions` | désactivé | Active la garde `featureEnabled()` et le service `flags`. Voir [Feature flags](/data/flags/). |
| `onError` | `(error, ctx?) => unknown` | aucun | Gestionnaire d'erreurs global. Voir [Erreurs](/api/errors/). |

### `Bot`

L'objet renvoyé par `defineBot()`.

| Propriété | Type | Description |
| --- | --- | --- |
| `config` | `BotConfig` | La configuration que vous avez passée. |
| `logger` | `Logger` | Le logger racine. |
| `registry` | `Registry` | Chaque définition chargée, groupée par type. |
| `container` | `Container` | Le conteneur d'injection de dépendances. Voir [Services](/architecture/services/). |
| `client` | `Client<true>` | Le client discord.js connecté. Le lire avant `start()` lève une erreur. |
| `devGuildId` | `string \| undefined` | Le serveur de développement : `deploy.devGuildId`, ou `DISCORD_DEV_GUILD`. |

| Méthode | Retourne | Description |
| --- | --- | --- |
| `use(...items)` | `this` | Enregistre des définitions supplémentaires, en plus de `features`. Chaînable. À appeler avant le chargement du bot. |
| `load()` | `Promise<void>` | Découvre et enregistre tout, sans se connecter. S'exécute une seule fois : les appels suivants reviennent immédiatement. |
| `start()` | `Promise<void>` | Charge si besoin, puis se connecte. Les appels suivants ne font rien. |
| `shutdown()` | `Promise<void>` | Arrête tout proprement. Peut être appelé plusieurs fois sans risque. |
| `describe()` | `Promise<BotDescription>` | Charge si besoin, puis renvoie un instantané de ce qui est enregistré. |
| `stats()` | `BotStats` | Les compteurs d'exécution, les chiffres derrière `/metrics`. |
| `deploy(options?)` | `Promise<DeployResult>` | Compare les commandes avec Discord et envoie la différence. Options : `{ guildId?, dryRun? }`. Voir [Déployer les commandes](/production/deploying/). |
| `clear(options?)` | `Promise<DeployTargetResult>` | Retire toutes les commandes d'un serveur, ou du périmètre global. Options : `{ guildId?, dryRun? }`. Voir [Déployer les commandes](/production/deploying/). |
| `setPresence(presence)` | `void` | Remplace la présence sur la passerelle à l'exécution. Voir [Présence](/production/presence/). |
| `setActivity(name, options?)` | `void` | Raccourci pour une seule activité. Options : `{ type?, url?, status? }`. Voir [Présence](/production/presence/). |

### `BotDescription`

Ce que `describe()` renvoie, et ce qu'affiche `djs-bot explain --json`.

| Champ | Type | Description |
| --- | --- | --- |
| `version` | `string` | La version du framework. |
| `intents` | `string[]` | Les intents de la passerelle avec lesquels le client se connecte, par nom. |
| `partials` | `string[]` | Les partials activés sur le client, par nom. |
| `privilegedIntents` | `string[]` | Les intents qui doivent être activés dans le Developer Portal. |
| `commands` | `string[]` | Les noms des commandes slash. |
| `userCommands` | `string[]` | Les noms des commandes de menu contextuel d'utilisateur. |
| `messageCommands` | `string[]` | Les noms des commandes de menu contextuel de message. |
| `buttons` | `string[]` | Les identifiants de routage des boutons. |
| `selectMenus` | `string[]` | Les identifiants de routage des menus de sélection. |
| `modals` | `string[]` | Les identifiants de routage des modales. |
| `events` | `string[]` | L'événement de chaque écouteur enregistré. |
| `triggers` | `string[]` | Les noms des déclencheurs de message. |
| `jobs` | `string[]` | Les tâches planifiées, sous la forme `name (schedule)`. |
| `services` | `string[]` | Les jetons de services enregistrés dans le conteneur. |
| `plugins` | `string[]` | Les plugins, sous la forme `name@version`. |
| `features` | `string[]` | Les noms des fonctionnalités. |
| `deployment` | `{ global: string[]; guilds: Record<string, string[]> }` | Les noms des commandes déployées globalement, et par identifiant de serveur. |

### `BotStats`

Ce que renvoie `stats()`. Les compteurs partent de zéro quand le processus crée le
bot.

| Champ | Type | Description |
| --- | --- | --- |
| `uptimeMs` | `number` | Millisecondes écoulées depuis la création du bot par ce processus. |
| `interactions` | `number` | Interactions reçues, de tous types. |
| `commands` | `number` | Commandes slash et de menu contextuel routées vers un gestionnaire. |
| `components` | `number` | Interactions de boutons et de menus de sélection routées vers un gestionnaire. |
| `modals` | `number` | Soumissions de modales routées vers un gestionnaire. |
| `autocompletes` | `number` | Requêtes d'autocomplétion traitées. |
| `guardRejections` | `number` | Interactions refusées par une garde. |
| `errors` | `number` | Gestionnaires, événements, déclencheurs et tâches qui ont levé une erreur. |
| `handlerAvgMs` | `number` | Durée moyenne d'un gestionnaire, en millisecondes. |
| `handlerMaxMs` | `number` | Gestionnaire le plus lent observé, en millisecondes. |

### `isBot(value)`

```ts
function isBot(value: unknown): value is Bot
```

Renvoie `true` pour un `Bot`, y compris un bot créé par une autre copie du paquet.
Utilisez-la à la place de `instanceof Bot`.

## Limites et erreurs

| Situation | Résultat |
| --- | --- |
| Pas de `token` ni de `DISCORD_TOKEN` quand le bot démarre, déploie ou efface | [`DJSBOT_E001`](/api/errors/#djsbot_e001) |
| Pas de `clientId` ni de `DISCORD_CLIENT_ID` sur `bot.deploy()` ou `bot.clear()` | [`DJSBOT_E002`](/api/errors/#djsbot_e002) |
| `bot.client` lu avant `start()` | `Bot has not started yet - call bot.start() first.` |

## Voir aussi

- [Structure du projet](/basics/project-layout/) : ce que contient le dossier `features` et comment il est parcouru.
- [Cycle de vie](/basics/lifecycle/) : ce qui se passe entre `start()` et `shutdown()`.
- [Différé automatique](/basics/automatic-deferral/) : l'option `defaults.defer`.
- [Déployer les commandes](/production/deploying/) : l'option `deploy`, `bot.deploy()` et `bot.clear()`.
- [CLI](/api/cli/) : les commandes qui importent ce fichier.
