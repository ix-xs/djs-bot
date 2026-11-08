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

Chaque option, propriété et type, avec ce qu'il accepte et renvoie, est dans la référence de l'API :

- `definePlugin()` : Définit un plugin transversal (hooks, middleware, capacités).
- `PluginDefinition` : Un plugin transversal.
- `PluginApp` : La façade restreinte transmise aux plugins dans `setup()`.
- `Logger` : Logger structuré avec filtrage par niveau et liaisons enfants.
- `HookRegistrar` : Permet aux plugins d'enregistrer des hooks sans toucher au cœur.
- `defineBot()` : Crée un `Bot`.
- `MiddlewareFn` : Un middleware s'exécute autour de chaque interaction ; appelez `next()` pour continuer.
- `antiSpam()` : Rejette les interactions d'un utilisateur qui dépasse une limite de débit par fenêtre : commandes, composants et formulaires.
- `commandLogger()` : Journalise une ligne structurée pour chaque interaction (avec sa durée), à l'aide du logger de corrélation propre à l'interaction.
- `errorReporter()` : Transmet chaque erreur d'interaction non gérée à votre outil de suivi d'erreurs (par exemple Sentry).
- `maintenance()` : Bloque toutes les interactions avec un avis de maintenance, sauf pour les utilisateurs de la liste d'autorisation.

## Voir aussi

- [Services](/architecture/services/) : le conteneur dans lequel un plugin enregistre, et les contrats de capacités.
- [Features](/architecture/features/) : livrer des commandes et des événements avec un plugin.
- [Gardes](/commands/guards/) : des règles pour certaines commandes plutôt que pour toutes.
- [Erreurs](/api/errors/) : la barrière d'erreurs sur laquelle se branchent les hooks `onError`.
- [Résilience](/production/resilience/) : le limiteur de débit sur lequel `antiSpam` est construit.
