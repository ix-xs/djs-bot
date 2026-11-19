---
title: "Installation"
description: "djs-bot est un framework TypeScript au-dessus de discord.js : un fichier par commande, bouton, événement ou tâche, des options et des params typés, les intents et le déploiement calculés pour vous."
---

```bash
npm install @ix-xs/djs-bot discord.js
npm install -D tsx typescript @types/node
```

| Prérequis | |
| --- | --- |
| Node.js | 22.23.4 ou plus sur la 22, 24.22.1 ou plus sur la 24, 26.12.1 ou plus. Node.js 23 et 25 ne sont pas pris en charge |
| discord.js | 14.27 ou plus sur la 14, installé par vous (dépendance de pair) |
| Modules | Modules ES et CommonJS. Trois points d'entrée : `@ix-xs/djs-bot`, `@ix-xs/djs-bot/plugins`, `@ix-xs/djs-bot/testing` |
| TypeScript | Déclarations incluses. `tsx` exécute les fichiers `.ts` sans étape de compilation ; il est facultatif |
| Dépendances | Une seule : `@ix-xs/node-comfort` 3.0 |

Les versions plus anciennes de Node.js ont une faille dans `fetch()` qui permet à un serveur distant d'arrêter le processus.

| Paquet | Rôle |
| --- | --- |
| `@ix-xs/djs-bot` | Le framework et la commande `djs-bot` |
| `discord.js` | Le client Discord que le framework pilote |
| `tsx` | Exécute l'entrée TypeScript sous `dev` et `start` (développement seulement) |
| `typescript`, `@types/node` | La vérification des types (développement seulement) |

## Projet de départ

```bash
npx djs-bot init     # src/index.ts, une commande /ping, tsconfig.json, .env, scripts
npx djs-bot doctor   # vérifie l'environnement et le bot, une fois .env rempli
npx djs-bot dev      # lance le bot, redémarre à l'enregistrement, déploie sur le serveur de test
```

`init` n'écrase jamais un fichier. Ce qu'il crée et comment il modifie `package.json` : [CLI](/api/cli/#init).

```ts title="src/features/ping/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply.success(`Pong! ${Math.round(ctx.client.ws.ping)} ms`),
});
```

Le fichier est trouvé par son suffixe, enregistré auprès de Discord et routé : aucune liste de commandes à tenir à jour. En JavaScript, retirez les annotations de type ; le reste est identique.

## Application Discord

Créée une fois, dans le [Developer Portal](https://discord.com/developers/applications).

| Valeur ou réglage | Où | Va dans |
| --- | --- | --- |
| Token | Bot > Reset Token. Affiché une seule fois ; qui l'a contrôle le bot | `DISCORD_TOKEN` |
| Application ID | General Information. Public | `DISCORD_CLIENT_ID` |
| ID du serveur de test | Discord : Paramètres utilisateur > Avancés > Mode développeur, puis clic droit sur le serveur > Copier l'identifiant du serveur | `DISCORD_DEV_GUILD` |
| Intents privilégiés | Bot > Privileged Gateway Intents : Server Members, Message Content, Presence. Seulement ceux dont votre code a besoin : `doctor` et le journal de démarrage les nomment | [Événements et intents](/events/events-and-intents/#privileged-intents) |
| URL d'invitation | OAuth2 > URL Generator : les scopes `bot` **et** `applications.commands`, puis les permissions dont le bot se sert | Sans `applications.commands`, aucune commande n'apparaît jamais |

Les trois variables vont dans `.env`, que le framework lit au démarrage : [Configuration](/basics/configuration/#environment-variables).

## Ce qu'il couvre

| Domaine | Pages |
| --- | --- |
| Configuration | [`defineBot()` et l'environnement](/basics/configuration/) |
| Les bases | [Structure du projet](/basics/project-layout/), [cycle de vie](/basics/lifecycle/), [`ctx`](/basics/context/), [différé automatique](/basics/automatic-deferral/), [formulations](/basics/wording-and-theme/), [erreurs](/api/errors/) |
| Commandes | [Commandes slash](/commands/slash-commands/), [options](/commands/options/), [sous-commandes](/commands/subcommands/), [menus contextuels](/commands/context-menus/), [gardes](/commands/guards/), [contextes d'installation](/commands/install-contexts/) |
| Composants | [Boutons](/components/buttons/), [menus de sélection](/components/select-menus/), [modales](/components/modals/), [Components V2](/components/components-v2/), [pagination](/components/pagination/) |
| Messages | [Embeds et pièces jointes](/messages/embeds-and-attachments/), [mise en forme](/messages/formatting/), [images et vocal](/messages/assets-and-voice/) |
| Événements | [Événements et intents](/events/events-and-intents/), [déclencheurs](/events/triggers/), [tâches](/events/jobs/) |
| Architecture | [Services](/architecture/services/), [plugins](/architecture/plugins/), [features](/architecture/features/) |
| Données | [Store](/data/store/), [cache](/data/cache/), [i18n](/data/i18n/), [flags](/data/flags/), [audit](/data/audit/) |
| Production | [Déploiement](/production/deploying/), [hébergement](/production/hosting/), [journaux](/production/logging/), [santé](/production/health/), [présence](/production/presence/), [résilience](/production/resilience/), [sharding](/production/sharding/) |
| Outils | [CLI](/api/cli/), [tests](/production/testing/) |

Chaque export figure dans [Tous les exports](/api/exports/) et a sa propre page dans la [référence](/reference/).
