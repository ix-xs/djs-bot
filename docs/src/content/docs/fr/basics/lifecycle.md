---
title: "Cycle de vie"
description: "Ce qui se passe entre bot.start() et la sortie du processus : chargement, validation, connexion, phase ready et arrêt propre, dans un ordre fixe."
sidebar:
  order: 5
---

`bot.start()` exécute toujours les mêmes phases dans le même ordre. Les connaître
vous dit d'où vient une erreur de démarrage, où placer le code qui ne doit
s'exécuter qu'une fois, et ce qui est nettoyé à l'arrêt du processus.

## Le démarrage en un coup d'œil

```
defineBot(config)      creates the bot, nothing else
bot.start()
  load                 discover -> register -> validate -> plugin setup
                       -> resolve services -> compute intents
  connect              create the client, attach listeners, log in
  ready                onReady hooks, jobs, presence rotation, health server, auto-deploy
  [running]            interactions, events, triggers, jobs
SIGINT / SIGTERM
  shutdown             jobs, hooks, plugins, services, store, client
```

Tout ce qui se passe dans `load` a lieu avant la connexion du bot. Une erreur de
configuration (un service manquant, un nom de commande en double, un fichier qui
ne s'importe pas) arrête le processus à ce stade, avec une erreur codée, au lieu
d'apparaître plus tard devant les utilisateurs.

## Le chargement

`bot.load()` fait tout le travail qui ne demande aucune connexion. `start()`
l'appelle pour vous. Il ne s'exécute qu'une fois : les appels suivants reviennent
immédiatement, et les appelants simultanés partagent le même chargement.

1. **Découverte.** Les définitions passées à `bot.use()` sont collectées, puis
   chaque entrée de `features`. Les dossiers passent par le chargeur : voir
   [Structure du projet](/basics/project-layout/).
2. **Enregistrement.** Chaque définition est ajoutée au registre, puis les
   `plugins` de la configuration. Deux commandes différentes portant le même nom,
   ou deux composants portant le même identifiant, arrêtent le bot ici.
3. **Enregistrement des services.** Les définitions de services entrent dans le
   conteneur, suivies de celles que fournit la configuration : `store`, `audit`
   et `flags`.
4. **Validation.** Chaque capacité qu'une fonctionnalité ou un plugin déclare
   dans `requires` doit être fournie par un service, une fonctionnalité ou un
   plugin. Rien ne doit fournir une capacité qu'un plugin déclare dans
   `conflicts`.
5. **Initialisation des plugins.** Le `setup` de chaque plugin s'exécute, l'un
   après l'autre, dans l'ordre d'enregistrement. C'est là que les hooks et les
   middlewares sont enregistrés.
6. **Résolution des services.** Chaque service est construit, ses dépendances en
   premier.
7. **Calcul des intents.** Les intents de la passerelle et les partials sont
   déduits de vos événements et de vos déclencheurs. Un avertissement est écrit
   dans les journaux quand un intent privilégié est concerné, car il doit aussi
   être activé dans le Developer Portal.

Comme le chargement n'a besoin ni de token ni de réseau, vous pouvez inspecter le
résultat sans vous connecter :

```bash
npx djs-bot explain    # commandes, intents, déclencheurs, tâches, services, plugins...
npx djs-bot doctor     # token, intents privilégiés, permissions
```

Les deux importent votre fichier d'entrée avec `DJSBOT_CLI=introspect`. Dans ce
mode, `start()` charge puis revient sans se connecter. Depuis votre propre code,
l'équivalent est `await bot.load()` suivi de `await bot.describe()` : voir
[Configuration](/basics/configuration/#using-the-bot-object).

## Connexion et phase ready

Après le chargement, `start()` :

1. Résout le token (`token`, puis `DISCORD_TOKEN`).
2. Passe la main au gestionnaire de shards quand `sharding` est activé et que ce
   processus n'est pas lui-même un shard. Le gestionnaire lance les shards, et
   chaque shard exécute ces mêmes phases : voir [Sharding](/production/sharding/).
3. Crée le client discord.js avec les intents et les partials calculés, vos
   options `client` et la `presence` initiale.
4. Attache vos écouteurs d'événements, l'écouteur de déclencheurs et le routeur
   d'interactions.
5. Installe les gestionnaires de signaux et de plantages décrits plus bas.
6. Se connecte.

Appeler `start()` une seconde fois ne fait rien.

Quand Discord signale que le client est prêt, le bot écrit `Ready` dans les
journaux avec son tag, son nombre de serveurs et la version du framework, puis :

1. Exécute les hooks `onReady` de vos plugins, dans l'ordre. Un hook qui lève
   une erreur est signalé et n'empêche pas les autres de s'exécuter.
2. Démarre les tâches planifiées. Sur un bot shardé, une tâche ne s'exécute que
   sur le premier shard, sauf si elle demande à s'exécuter sur tous : voir
   [Tâches planifiées](/events/jobs/).
3. Démarre la rotation de présence, si `presenceRotation` est défini.
4. Démarre le serveur de contrôle de santé, si `health` est défini.
5. Déploie les commandes, si le déploiement automatique est activé. Il l'est par
   défaut hors production. Un déploiement qui échoue est consigné dans les
   journaux et le bot continue de tourner : voir
   [Déployer les commandes](/production/deploying/).

## Pendant que le bot tourne

Chaque interaction passe par le même pipeline, à l'intérieur d'une barrière
d'erreurs :

1. Un `ctx` est créé, avec un nouvel identifiant de corrélation.
2. Le minuteur du [différé automatique](/basics/automatic-deferral/) est armé, si
   un différé s'applique.
3. Le middleware des plugins s'exécute (`beforeInteraction`). Il enveloppe tout
   ce qui suit : un plugin peut donc arrêter une interaction avant n'importe
   quelle garde, et mesurer l'ensemble.
4. Les gardes s'exécutent dans l'ordre, celles d'une commande avant celles de sa
   sous-commande. Le premier refus répond par une erreur éphémère et arrête le
   pipeline.
5. Le gestionnaire s'exécute.
6. Les hooks `afterInteraction` s'exécutent, seulement si le gestionnaire est
   allé au bout. Un hook qui lève une erreur est signalé, sans message d'erreur
   pour l'utilisateur.

Une erreur levée n'importe où entre les étapes 3 et 5 va à la barrière d'erreurs :
voir [Erreurs](/api/errors/). Une erreur dans un écouteur d'événement, un
déclencheur ou une tâche est consignée dans les journaux et transmise aux hooks
d'erreur et à `onError`, sans `ctx`.

Le processus est aussi protégé dans son ensemble. Une exception non interceptée
ou un rejet de promesse non géré est consigné et signalé de la même manière, et
le bot continue de tourner.

## L'arrêt

Sur `SIGINT` (Ctrl+C), `SIGTERM` ou `SIGQUIT`, le bot appelle `bot.shutdown()` et
quitte avec le code 0. Vous pouvez aussi appeler `shutdown()` vous-même. Il peut
être appelé plusieurs fois sans risque.

Dans l'ordre :

1. **Tâches.** Les minuteurs s'arrêtent, le `signal` de chaque tâche en cours est
   interrompu, et le bot attend que ces tâches se terminent, 10 secondes au
   maximum.
2. **Minuteurs et serveurs.** La rotation de présence s'arrête et le serveur de
   contrôle de santé se ferme.
3. **Hooks.** Les hooks `onShutdown` s'exécutent, dans l'ordre.
4. **Plugins.** Le `teardown` de chaque plugin s'exécute.
5. **Services.** Le `dispose` de chaque service s'exécute, le plus récemment
   construit en premier : un service est donc libéré avant ceux dont il dépend.
6. **Store.** Le `store` de la configuration est fermé.
7. **Client.** Le client discord.js est détruit, ce qui déconnecte le bot.

Un hook, un `teardown` ou un `dispose` qui lève une erreur est consigné et les
suivants s'exécutent quand même : un nettoyage qui échoue ne laisse donc pas le
reste ouvert. Passé les 10 secondes, l'arrêt continue même si une tâche tourne
encore.

## Où s'exécute votre code

| Moment | Placez votre code dans | Page |
| --- | --- | --- |
| Une seule fois, avant la connexion | Un `factory` de service, ou un `setup` de plugin | [Services](/architecture/services/), [Plugins et hooks](/architecture/plugins/) |
| Quand le client est prêt | Un hook `onReady` | [Plugins et hooks](/architecture/plugins/) |
| Autour de chaque interaction | Les hooks `beforeInteraction` et `afterInteraction` | [Plugins et hooks](/architecture/plugins/) |
| Selon une planification | Une tâche planifiée | [Tâches planifiées](/events/jobs/) |
| Quand quelque chose lève une erreur | Un hook `onError`, ou `defineBot({ onError })` | [Erreurs](/api/errors/) |
| À l'arrêt | Un hook `onShutdown`, un `teardown` de plugin, un `dispose` de service | [Plugins et hooks](/architecture/plugins/), [Services](/architecture/services/) |

Un plugin voit la plupart de ces moments :

```ts title="src/features/lifecycle/lifecycle.plugin.ts"
import { definePlugin } from "@ix-xs/djs-bot";

export default definePlugin({
  name: "lifecycle-log",
  setup(app) {
    // S'exécute pendant le chargement, avant la connexion du client.
    app.logger.info({}, "setting up");

    app.hooks.onReady((client) => {
      app.logger.info({ guilds: client.guilds.cache.size }, "connected");
    });
    app.hooks.onShutdown(() => {
      app.logger.info({}, "stopping");
    });
  },
  teardown(app) {
    // S'exécute pendant l'arrêt, après les hooks onShutdown.
    app.logger.info({}, "torn down");
  },
});
```

## Limites et erreurs

Chaque phase du démarrage a ses propres codes d'erreur, tous levés avant la
connexion du bot :

| Phase | Erreur | Cause |
| --- | --- | --- |
| Découverte | [`DJSBOT_E060`](/api/errors/#djsbot_e060) | Un fichier ne s'importe pas, ou n'exporte aucune définition. |
| Enregistrement | [`DJSBOT_E010`](/api/errors/#djsbot_e010) | Deux commandes portent le même nom. |
| Enregistrement | [`DJSBOT_E011`](/api/errors/#djsbot_e011) | Deux boutons, menus de sélection ou modales partagent un identifiant. |
| Validation | [`DJSBOT_E040`](/api/errors/#djsbot_e040) | Une fonctionnalité ou un plugin exige une capacité que rien ne fournit. |
| Validation | [`DJSBOT_E041`](/api/errors/#djsbot_e041) | Un plugin est en conflit avec une capacité qui est fournie. |
| Résolution des services | [`DJSBOT_E030`](/api/errors/#djsbot_e030) | Une dépendance de service est manquante, ou les dépendances forment un cycle. |
| Connexion | [`DJSBOT_E001`](/api/errors/#djsbot_e001) | Pas de token. |

Limites à connaître :

- Les tâches en cours disposent de 10 secondes pour se terminer pendant l'arrêt.
  Une tâche longue devrait surveiller `ctx.signal` et s'arrêter plus tôt.
- L'arrêt attend les tâches, pas les gestionnaires d'interactions encore en
  cours d'exécution.
- `bot.client` lève une erreur tant que `start()` n'a pas créé le client.

## Voir aussi

- [Configuration](/basics/configuration/) : `load()`, `start()`, `shutdown()` et les autres méthodes du bot.
- [Structure du projet](/basics/project-layout/) : ce que l'étape de découverte importe.
- [Plugins et hooks](/architecture/plugins/) : les hooks qui s'exécutent à chaque phase.
- [Services](/architecture/services/) : `factory`, `deps` et `dispose`.
- [CLI](/api/cli/) : `explain` et `doctor`.
