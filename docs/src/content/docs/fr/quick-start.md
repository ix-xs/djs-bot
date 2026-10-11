---
title: "Démarrage rapide"
description: "D'un dossier vide à un bot qui répond à une commande slash, en cinq minutes environ, pour les lecteurs qui connaissent déjà Node."
sidebar:
  order: 2
---

Cette page est le chemin court. Si vous n'avez jamais créé d'application
Discord ni invité un bot, suivez plutôt le [tutoriel](/tutorial/what-you-need/) :
il couvre aussi le côté Discord et ne suppose rien.

Il vous faut :

| | |
| --- | --- |
| Node | 22.13 ou plus récent (`node -v`) |
| Une application Discord | Créée sur [discord.com/developers](https://discord.com/developers/applications) |
| Son token de bot et son identifiant d'application | Depuis les pages **Bot** et **General Information** |
| Un serveur de test | Où le bot est invité avec les scopes `bot` et `applications.commands` |

## Installer

```bash
mkdir my-bot && cd my-bot
npm install @ix-xs/djs-bot discord.js
npm install -D tsx typescript @types/node
```

`tsx` permet à la CLI d'exécuter directement votre TypeScript, sans étape de
build pendant le développement. Le framework fonctionne aussi en JavaScript
pur, CommonJS ou ESM, et fournit ses déclarations de types : les éditeurs
proposent l'autocomplétion dans les deux cas. Cette page utilise TypeScript.

## Créer le projet

```bash
npx djs-bot init
```

Cette commande écrit le fichier d'entrée `src/index.ts`, une première commande,
`tsconfig.json`, `.env` et `.gitignore`, puis ajoute les scripts d'exécution et
`"type": "module"` à votre `package.json`. Rien de ce que vous avez déjà n'est
écrasé. La liste complète se trouve dans la [référence de la CLI](/api/cli/#init).
L'organisation des fichiers est décrite dans
[Structure du projet](/basics/project-layout/), et ce que le fichier d'entrée
configure dans [Configuration](/basics/configuration/).

## Remplir `.env`

```bash title=".env"
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-id
DISCORD_DEV_GUILD=your-test-server-id
```

`DISCORD_DEV_GUILD` fait apparaître les commandes immédiatement pendant que
vous construisez. Sans lui, elles sont déployées globalement et peuvent mettre
jusqu'à une heure à s'afficher.

:::caution[Gardez le token hors de git]
Quiconque détient le token contrôle votre bot. Le `.gitignore` généré liste
déjà `.env`. Ne changez pas cela.
:::

## Lancer le bot

```bash
npx djs-bot dev
```

Le bot se met en ligne, ses commandes sont déployées sur votre serveur de test,
et le processus redémarre à chaque enregistrement d'un fichier. Tapez `/ping`
dans le serveur.

Si la commande n'apparaît pas, lancez les vérifications, puis consultez
[Dépannage](/help/troubleshooting/) :

```bash
npx djs-bot doctor            # token, identifiants, .gitignore, intents, et si le bot se charge
npx djs-bot explain           # tout ce qui est chargé, et le plan de déploiement
```

## Votre première commande

`init` a créé celle-ci. Une commande est un fichier qui se termine par
`.command.ts` et exporte une définition. Il n'y a aucune liste où l'enregistrer.

```ts title="src/features/ping/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply.success(`Pong! 🏓 ${Math.round(ctx.client.ws.ping)} ms`),
});
```

Ajoutez-en une deuxième à côté, avec des options cette fois. Enregistrez le
fichier : `dev` redémarre et `/greet` apparaît dans le serveur.

```ts title="src/features/greet/greet.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "greet",
  description: "Say hello to someone",
  options: {
    user: s.user({ description: "Who to greet", required: true }),
    loudly: s.boolean({ description: "Shout it" }),
  },
  run(ctx) {
    // ctx.options.user est un User, jamais undefined, à cause de required: true.
    // ctx.options.loudly est un boolean | undefined.
    const message = `Hello ${ctx.options.user}!`;
    return ctx.reply(ctx.options.loudly ? message.toUpperCase() : message);
  },
});
```

Les options que vous déclarez sont les options que vous recevez : `ctx.options`
est typé à partir de la définition, sans aucun cast.

## À lire ensuite

| Vous voulez | Allez à |
| --- | --- |
| Un parcours guidé de zéro à un bot déployé | [Tutoriel](/tutorial/what-you-need/) |
| En savoir plus sur les commandes et leurs options | [Commandes slash](/commands/slash-commands/), [Options et autocomplétion](/commands/options/) |
| Ce que `ctx` vous donne dans un gestionnaire | [L'objet ctx](/basics/context/) |
| Boutons, menus et formulaires | [Boutons](/components/buttons/) |
| Mettre les commandes en ligne pour tout le monde | [Déployer les commandes](/production/deploying/) |
| Une fonctionnalité terminée à copier | [Recettes](/recipes/moderation/) |
| Réparer quelque chose qui ne marche pas | [Dépannage](/help/troubleshooting/) |
| Un mot que vous ne connaissez pas | [Glossaire](/help/glossary/) |
