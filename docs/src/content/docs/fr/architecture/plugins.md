---
title: "Plugins et hooks"
description: "Un plugin ajoute un comportement qui s'applique à chaque interaction, ou une ressource partagée par tout le bot : limitation de débit, journalisation, remontée d'erreurs, mode maintenance, connexion à une base de données. Utilisez les quatre plugins officiels, ou écrivez les vôtres avec definePlugin."
sidebar:
  order: 2
---

Un plugin ne modifie jamais le framework. Il reçoit un petit objet `app` et s'en
sert pour enregistrer des hooks (des fonctions que le framework appelle à des
moments précis) et des services. Tout ce qu'il fait est donc visible dans une
seule fonction `setup`.

## Utiliser un plugin officiel

Quatre plugins sont livrés avec le framework, sur le sous-chemin
`@ix-xs/djs-bot/plugins` : `antiSpam`, `commandLogger`, `errorReporter` et
`maintenance`. Chacun est une fonction qui prend des options et renvoie un
plugin, que vous listez dans `plugins`.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";
import { antiSpam, commandLogger, errorReporter } from "@ix-xs/djs-bot/plugins";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  plugins: [
    antiSpam({ max: 5, window: "10s", allow: env.list("OWNER_IDS") }),
    commandLogger(),
    errorReporter({ report: (error, ctx) => console.error(ctx?.correlationId, error) }),
  ],
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

Les plugins s'exécutent dans l'ordre où vous les listez, et le premier enveloppe
le suivant. Ici `antiSpam` vient en premier : une interaction qu'il rejette
n'atteint donc jamais `commandLogger` et n'est pas journalisée. Inversez-les pour
journaliser aussi les interactions rejetées.

Les options des quatre plugins sont dans la [référence](#reference). Chacun est
assez court pour être lu en une minute et constitue un exemple concret de l'API
des plugins.

## Écrire un plugin

```ts title="src/plugins/request-timer.ts"
import { definePlugin, describeInteraction } from "@ix-xs/djs-bot";

export const requestTimer = definePlugin({
  name: "request-timer",
  version: "1.0.0",
  setup(app) {
    app.hooks.beforeInteraction(async (ctx, next) => {
      const started = performance.now();
      await next(); // les gardes, puis le gestionnaire
      const { kind, name } = describeInteraction(ctx.interaction);
      ctx.logger.info({ kind, name, ms: Math.round(performance.now() - started) }, "handled");
    });

    app.hooks.onReady((client) => {
      app.logger.info({ guilds: client.guilds.cache.size }, "request timer active");
    });
  },
});
```

`setup` s'exécute une fois au démarrage, avant que le bot se connecte. Il reçoit
`app` :

- `app.hooks` enregistre les middlewares et les hooks de cycle de vie ;
- `app.services` enregistre une valeur dans le conteneur de
  [services](/architecture/services/) ;
- `app.config` est la configuration passée à `defineBot`, en lecture seule (par
  exemple `app.config.owners`) ;
- `app.logger` est un logger étiqueté avec le nom du plugin.

Un plugin peut arriver jusqu'au bot de trois façons : dans le tableau `plugins`
de `defineBot`, exporté depuis un fichier dont le nom se termine par `.plugin`
dans votre dossier de features, ou listé dans les `plugins` d'une
[feature](/architecture/features/). Les plugins qui viennent des features et des
fichiers découverts sont initialisés en premier, puis le tableau `plugins`, dans
l'ordre.

### Plugin, garde ou feature

| À utiliser | Quand |
| --- | --- |
| Une [garde](/commands/guards/) | Une règle pour certaines commandes : permissions, délais de récupération, vérifications premium. |
| Un plugin | Un comportement pour chaque interaction, ou une ressource partagée : journalisation, limites de débit, base de données. |
| Une [feature](/architecture/features/) | Un ensemble de commandes, d'événements et de services livré comme une seule unité. |

## Middleware

`beforeInteraction` enregistre un middleware : une fonction qui enveloppe le
traitement d'une interaction. Elle reçoit le `ctx` et une fonction `next`.
Appelez `await next()` pour continuer, ou ne l'appelez pas pour arrêter
l'interaction là.

```ts
app.hooks.beforeInteraction(async (ctx, next) => {
  if (blocked.has(ctx.user.id)) {
    await ctx.reply.error("You cannot use this bot.");
    return; // on s'arrête ici : ni garde, ni gestionnaire
  }
  const started = performance.now();
  await next(); // les gardes, puis le gestionnaire
  metrics.observe(performance.now() - started);
});
```

Un middleware enveloppe les gardes aussi bien que le gestionnaire. Il s'exécute
donc avant tout le reste, ce dont un mode maintenance a besoin, et il voit toute
la durée, ce dont la mesure du temps et les métriques ont besoin. Le code avant
`await next()` est votre logique « avant », le code après est votre logique
« après » : mesure du temps, transactions, traçage.

- Plusieurs middlewares s'imbriquent dans l'ordre où leurs plugins ont été
  initialisés.
- Le middleware s'exécute pour les commandes slash, les menus contextuels, les
  boutons, les menus de sélection et les envois de modales. Les requêtes
  d'autocomplétion, les événements, les déclencheurs et les tâches planifiées ne
  passent pas par lui.
- `ctx` est le contexte de base partagé par toutes les interactions. Il n'a pas
  de `ctx.options`. Utilisez `describeInteraction(ctx.interaction)` pour savoir
  ce qui est en cours de traitement (voir [L'objet ctx](/basics/context/)).
- Si vous arrêtez une interaction, répondez vous-même à l'utilisateur, sinon il
  voit une interaction échouée.
- `next()` ne peut être appelé qu'une fois. Un second appel lève une erreur.
- Un middleware qui lève une erreur est traité comme un gestionnaire qui lève
  une erreur : la barrière d'erreurs la journalise et répond à l'utilisateur.

## Hooks de cycle de vie

Les autres hooks n'enveloppent rien. Ils sont appelés à un moment précis chacun.

```ts
setup(app) {
  app.hooks.afterInteraction((ctx, { durationMs }) => {
    if (durationMs > 2000) ctx.logger.warn({ durationMs }, "slow interaction");
  });

  app.hooks.onError((error, ctx) => {
    // ctx est défini pour une interaction, absent pour un événement, un déclencheur ou une tâche
    reporter.send(error, { user: ctx?.user.id });
  });

  app.hooks.onReady((client) => {
    app.logger.info({ tag: client.user.tag }, "ready");
  });

  app.hooks.onShutdown(async () => {
    await reporter.flush();
  });
}
```

| Hook | Appelé |
| --- | --- |
| `afterInteraction` | Après qu'un gestionnaire s'est terminé sans lever d'erreur. Pas appelé quand une garde a refusé, quand un middleware a arrêté l'interaction, ou quand le gestionnaire a levé une erreur. |
| `onError` | Chaque fois que quelque chose que le framework exécute lève une erreur : un gestionnaire d'interaction (`ctx` est défini), un écouteur d'événement, un déclencheur ou une tâche planifiée (`ctx` est absent). |
| `onReady` | Une fois, quand le client est prêt. Les hooks sont attendus l'un après l'autre, avant le démarrage des tâches planifiées. |
| `onShutdown` | Pendant l'arrêt propre, une fois les tâches en cours terminées et avant que les plugins soient démontés et les services libérés. |

Un hook qui lève une erreur ne fait jamais tomber le bot. Un hook
`afterInteraction`, `onReady` ou `onShutdown` qui échoue est journalisé et les
suivants s'exécutent quand même. Un hook `afterInteraction` qui échoue ne change
pas non plus ce que voit l'utilisateur, car le gestionnaire a déjà répondu. Une
erreur levée dans un hook `onError` est ignorée.

Les hooks `onError` s'exécutent avant le `onError` de `defineBot`. La façon dont
les erreurs sont interceptées et traitées est décrite sur la page
[Erreurs](/api/errors/), et l'ordre complet du démarrage et de l'arrêt sur la
page [Cycle de vie](/basics/lifecycle/).

## Partager une ressource

Un plugin peut ouvrir une ressource dans `setup`, l'enregistrer comme service et
la fermer dans `teardown`.

```ts title="src/plugins/postgres.ts"
import { definePlugin } from "@ix-xs/djs-bot";
import { Pool } from "pg";

export function postgres(url: string) {
  const pool = new Pool({ connectionString: url });

  return definePlugin({
    name: "postgres",
    version: "1.0.0",
    provides: ["db"],
    async setup(app) {
      await pool.query("select 1");
      app.services.register("db", pool);
      app.logger.info({}, "postgres connected");
    },
    teardown: () => pool.end(),
  });
}
```

```ts
plugins: [postgres(env("DATABASE_URL"))],
```

Chaque gestionnaire peut maintenant lire `ctx.services.db`, un `defineService`
peut lister `"db"` dans ses `deps`, et une feature peut déclarer
`requires: ["db"]`. Déclarez le type du token une seule fois, comme indiqué dans
[Typer vos services](/architecture/services/#type-your-services).

`provides` compte ici : c'est lui qui indique à la vérification du démarrage que
`"db"` existera. Les règles sont décrites sous
[Contrats de capacités](/architecture/services/#capability-contracts).

:::tip[Service ou plugin]
Pour une simple ressource partagée sans rien de transversal, un
[`defineService`](/architecture/services/) avec une fonction `dispose` est plus
court. Passez à un plugin quand vous avez aussi besoin de hooks.
:::

## Publier un plugin

Un plugin est un simple objet : un plugin publié est donc un paquet npm
ordinaire.

```ts title="index.ts"
import { definePlugin, type PluginDefinition } from "@ix-xs/djs-bot";

export interface MyPluginOptions {
  apiKey: string;
}

export function myPlugin(options: MyPluginOptions): PluginDefinition {
  return definePlugin({
    name: "my-plugin",
    version: "1.0.0",
    setup(app) {
      app.logger.info({ keyLength: options.apiKey.length }, "my-plugin loaded");
    },
  });
}
```

Des consignes pour qu'un plugin tiers reste agréable à utiliser :

- Exportez une fonction fabrique qui prend des options, pas un plugin construit à
  l'avance.
- Gardez `@ix-xs/djs-bot` dans `peerDependencies`, jamais dans `dependencies`.
- Déclarez `provides` quand vous enregistrez un service, pour que les
  utilisateurs puissent le lister dans `requires`.
- Nettoyez dans `teardown` : sockets, minuteurs, pools.
- Ne laissez jamais votre propre gestion d'erreurs lever une erreur.

Si le paquet a aussi besoin de commandes et d'événements, pas seulement de hooks,
publiez plutôt une [feature](/architecture/features/), ou une feature qui
embarque le plugin.

## Référence

### `definePlugin(input)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | Un nom unique, utilisé dans les journaux, dans les messages d'erreur et par `djs-bot explain`. |
| `version` | `string` | aucune | La version propre au plugin. Informative, affichée par `djs-bot explain`. |
| `requires` | `string[]` | `[]` | Capacités qui doivent exister, sinon le démarrage échoue avec [`DJSBOT_E040`](/api/errors/#djsbot_e040). |
| `provides` | `string[]` | `[]` | Capacités que ce plugin offre, que d'autres peuvent lister dans `requires`. |
| `conflicts` | `string[]` | `[]` | Capacités que rien d'autre ne peut fournir tant que ce plugin est chargé, sinon le démarrage échoue avec [`DJSBOT_E041`](/api/errors/#djsbot_e041). |
| `setup` | `(app: PluginApp) => unknown` | - | Appelé une fois au démarrage, avant que le bot se connecte et avant que les services soient construits. Peut être asynchrone. Enregistrez-y les hooks et les services. |
| `teardown` | `(app: PluginApp) => unknown` | aucun | Appelé pendant l'arrêt propre. Libère ce que `setup` a ouvert. Un échec est journalisé et l'arrêt continue. |

Renvoie un `PluginDefinition` (`kind: "plugin"`). Un `setup` qui lève une erreur
arrête le démarrage. La façon dont `requires`, `provides` et `conflicts` sont
vérifiés est décrite sous
[Contrats de capacités](/architecture/services/#capability-contracts).

### `PluginApp`

L'objet transmis à `setup` et à `teardown`.

| Membre | Type | Description |
| --- | --- | --- |
| `app.logger` | `Logger` | Un logger étiqueté avec le nom du plugin. |
| `app.hooks` | `HookRegistrar` | Enregistre les middlewares et les hooks de cycle de vie. |
| `app.config` | `Readonly<BotConfig>` | La configuration passée à `defineBot`, en lecture seule. |
| `app.services.register(token, value)` | `void` | Enregistre une valeur déjà construite sous un token. |
| `app.services.has(token)` | `boolean` | Indique si un token existe, comme définition de service ou comme valeur enregistrée. |

### `HookRegistrar`

| Méthode | Callback | Description |
| --- | --- | --- |
| `beforeInteraction(fn)` | `(ctx: BaseContext, next: () => Promise<void>) => Promise<void> \| void` | Middleware autour des gardes et du gestionnaire. Arrêtez l'interaction en n'appelant pas `next`. Le type du callback est exporté sous le nom `MiddlewareFn`. |
| `afterInteraction(fn)` | `(ctx: BaseContext, info: { durationMs: number }) => unknown` | Après un gestionnaire réussi. `durationMs` couvre les middlewares, les gardes et le gestionnaire. |
| `onError(fn)` | `(error: unknown, ctx?: BaseContext) => unknown` | Quand un gestionnaire d'interaction, un écouteur d'événement, un déclencheur ou une tâche planifiée lève une erreur. `ctx` n'est défini que pour une interaction. |
| `onReady(fn)` | `(client: Client<true>) => unknown` | Une fois le client prêt. |
| `onShutdown(fn)` | `() => unknown` | Pendant l'arrêt propre. |

### `antiSpam(options?)`

Rejette les interactions d'un utilisateur qui dépasse une limite de débit. La
limite est comptée par utilisateur sur toutes les interactions, quels que soient
la commande ou le serveur, et elle est conservée en mémoire. Un utilisateur
rejeté reçoit une réponse d'erreur, et ni les gardes ni le gestionnaire ne
s'exécutent.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `max` | `number` | `5` | Interactions autorisées par fenêtre, par utilisateur. |
| `window` | `number \| string` | `"10s"` | Durée de la fenêtre : des millisecondes ou une durée. |
| `message` | `string` | le message `slowDown` du framework | Affiché à un utilisateur limité. Reformulez la valeur par défaut dans [Formulations et thème](/basics/wording-and-theme/). |
| `allow` | `string[]` | `[]` | Identifiants d'utilisateurs qui ne sont jamais limités (propriétaires, équipe). |

```ts
antiSpam({ max: 10, window: "30s", allow: env.list("OWNER_IDS") });
```

### `commandLogger(options?)`

Écrit une ligne structurée par interaction, via le logger de cette interaction,
de sorte que la ligne porte son `correlationId`. Les champs sont `kind`, `name`,
`guildId` et, avec `timing`, `ms`.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `timing` | `boolean` | `true` | Journalise aussi la durée en millisecondes, gardes comprises. |

```text
14:22:07 INFO  interaction handled correlationId=8f3a kind=command name="config set" guildId=123 ms=143
```

La ligne est écrite une fois que le gestionnaire a rendu la main. Une interaction
dont le gestionnaire a levé une erreur est journalisée par la barrière d'erreurs,
pas par ce plugin.

### `errorReporter(options)`

Transmet les erreurs à votre outil de remontée : Sentry, un webhook, ce que vous
voulez. Il est enregistré comme hook `onError` : il reçoit donc les erreurs
d'interaction avec leur `ctx`, et celles des événements, des déclencheurs et des
tâches planifiées sans `ctx`. Il s'exécute en parallèle de la barrière d'erreurs
du framework : l'utilisateur reçoit toujours la réponse d'erreur habituelle.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `report` | `(error: unknown, ctx?: BaseContext) => void \| Promise<void>` | - | Obligatoire. Où envoyer l'erreur. |

```ts
errorReporter({
  report: (error, ctx) => {
    const where = ctx ? describeInteraction(ctx.interaction) : undefined;
    Sentry.captureException(error, { tags: { interaction: where?.name, guild: ctx?.guildId } });
  },
});
```

Un outil de remontée qui lève une erreur est ignoré : la remontée ne doit jamais
faire tomber le bot.

### `maintenance(options?)`

Répond à chaque interaction par un avis et l'arrête, sauf pour les utilisateurs
que vous autorisez.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean \| (() => boolean)` | `true` | Indique si le mode maintenance est actif. Une fonction est rappelée à chaque interaction : vous pouvez donc basculer le mode sans redémarrer. |
| `message` | `string` | `"🔧 The bot is under maintenance - please try again soon."` | Affiché aux utilisateurs bloqués. |
| `allow` | `string[]` | `[]` | Identifiants d'utilisateurs qui peuvent continuer à utiliser le bot. |

```ts
let down = false; // basculez-le depuis une commande réservée aux propriétaires

maintenance({ enabled: () => down, allow: env.list("OWNER_IDS") });
```

:::caution[Actif par défaut]
`maintenance()` sans option `enabled` bloque tout le monde immédiatement. Passez
`enabled: false` ou une fonction quand le plugin reste en permanence dans votre
liste `plugins`.
:::

## Voir aussi

- [Services](/architecture/services/) : le conteneur dans lequel un plugin enregistre, et les contrats de capacités.
- [Features](/architecture/features/) : livrer des commandes et des événements avec un plugin.
- [Gardes](/commands/guards/) : des règles pour certaines commandes plutôt que pour toutes.
- [Erreurs](/api/errors/) : la barrière d'erreurs sur laquelle se branchent les hooks `onError`.
- [Résilience](/production/resilience/) : le limiteur de débit sur lequel `antiSpam` est construit.
