---
title: "Introduction"
description: "Ce qu'est djs-bot, ce qu'il prend en charge, ce qui reste à vous, et par où commencer la lecture."
sidebar:
  order: 1
---

djs-bot est un framework pour bots Discord, pensé pour TypeScript et construit
au-dessus de [discord.js](https://discord.js.org). Vous décrivez ce que fait
votre bot, un fichier par fonctionnalité, et le framework s'occupe du
câblage : il trouve les fichiers, enregistre les commandes auprès de Discord,
dirige chaque interaction vers son gestionnaire et lui remet des valeurs déjà
typées.

Il ne remplace pas discord.js. Le client, les serveurs, les membres et les
builders que vous utilisez sont les vrais objets de discord.js : tout ce que
vous savez de discord.js reste valable, et chaque guide écrit pour lui
fonctionne toujours.

## À quoi ressemble une fonctionnalité

Une commande slash, c'est un fichier qui exporte une définition :

```ts title="features/profile/profile.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  description: "Show a user profile",
  options: {
    target: s.user({ description: "Whose profile", required: true }),
    detailed: s.boolean({ description: "Verbose output" }),
  },
  run: async (ctx) => {
    // ctx.options.target:   User                  (obligatoire, donc jamais undefined)
    // ctx.options.detailed: boolean | undefined   (facultative)
    await ctx.reply.info(`Profile of ${ctx.options.target}`);
  },
});
```

Il n'y a rien d'autre à écrire. Le nom du fichier se termine par
`.command.ts`, c'est ainsi que le chargeur le trouve. Les options sont
déclarées une fois, et `ctx.options` est typé d'après cette déclaration. La
commande est déployée sur Discord par le framework, et seulement quand elle a
changé.

Les boutons, les menus de sélection, les formulaires, les menus contextuels,
les événements, les tâches planifiées et les services suivent le même
principe : une fonction `define...`, dans un fichier à elle.

## Ce qu'il prend en charge

| Vous n'écrivez plus | Le framework s'en charge | Pour aller plus loin |
| --- | --- | --- |
| Des conversions et des tests de `null` sur les options | Les options, les paramètres de customId et les champs de formulaire sont typés d'après leur déclaration | [Options](/commands/options/) |
| Un script de déploiement | Les commandes sont comparées à ce que Discord détient, et seules les différences sont envoyées | [Déployer les commandes](/production/deploying/) |
| La liste des intents de la Gateway | Les intents sont calculés à partir des événements que vous écoutez | [Événements et intents](/events/events-and-intents/) |
| Des `split("_")` sur l'identifiant d'un bouton | Un bouton transporte des données typées, et le clic revient décodé | [Boutons](/components/buttons/) |
| Un `defer()` dans chaque gestionnaire lent | Un gestionnaire qui tarde est acquitté à votre place | [Différé automatique](/basics/automatic-deferral/) |
| Un `try/catch` autour de chaque gestionnaire | Un gestionnaire qui lève une erreur est journalisé, l'utilisateur reçoit une réponse, et le bot reste en ligne | [Cycle de vie](/basics/lifecycle/) |
| Des vérifications de permissions recopiées de fichier en fichier | Les gardes se déclarent à côté de la commande qu'elles protègent | [Gardes](/commands/guards/) |

Il fournit aussi ce dont un bot a besoin quand de vraies personnes
l'utilisent : un [store](/data/store/) clé-valeur, des
[tâches planifiées](/events/jobs/), des [traductions](/data/i18n/), des
[journaux](/production/logging/) structurés, des
[contrôles de santé](/production/health/), le
[sharding](/production/sharding/), et un
[harnais de test](/production/testing/) qui exécute une commande sans token et
sans réseau.

Une [ligne de commande](/api/cli/) pilote l'ensemble : `djs-bot dev` lance le
bot et le redémarre quand un fichier change, `djs-bot doctor` vérifie votre
installation, et `djs-bot deploy` publie vos commandes.

## Ce qui reste à vous

- **discord.js.** `ctx.interaction`, `ctx.client`, `ctx.guild` et
  `ctx.member` sont les vrais objets. Tout ce que discord.js sait faire, vous
  pouvez le faire depuis un gestionnaire.
- **Vos données.** Le store intégré couvre les réglages, les compteurs et les
  petits enregistrements. Pour le reste, apportez votre base de données et
  exposez-la comme un [service](/architecture/services/).
- **L'hébergement.** Le framework tourne partout où Node tourne. Où et comment
  garder le bot en ligne est expliqué dans
  [Héberger en production](/recipes/hosting/).
- **La porte de sortie.** Les définitions sont de simples objets et il n'y a
  pas de runtime propre à défaire. Vous pouvez ajouter djs-bot à un bot
  existant une commande à la fois, et le retirer de la même façon.

## Ce qu'il vous faut

| | |
| --- | --- |
| Node | 22.13 ou plus récent |
| discord.js | 14.27 ou plus récent |
| Langage | TypeScript, ou JavaScript (CommonJS ou modules ES) |

TypeScript n'est pas obligatoire, mais l'essentiel de ce que le framework
apporte se trouve dans les types. En JavaScript, vous gardez le routage, les
gardes et la ligne de commande, et votre éditeur complète toujours grâce aux
déclarations fournies.

## Comment cette documentation est organisée

Une page par sujet, regroupées selon ce que vous cherchez à faire. Une page
de sujet s'ouvre sur un exemple qui fonctionne, et se termine par la référence
de ses options et les erreurs que vous pouvez rencontrer.

| Rubrique | Ce que vous y trouvez |
| --- | --- |
| Démarrer | Le [démarrage rapide](/quick-start/) et le [tutoriel](/tutorial/what-you-need/) |
| [Bases](/basics/project-layout/) | Structure du projet, configuration, l'objet `ctx`, la vie d'un bot |
| [Commandes](/commands/slash-commands/) | Commandes slash, options, sous-commandes, menus contextuels, gardes |
| [Composants](/components/buttons/) | Boutons, menus de sélection, formulaires, Components V2, pagination |
| [Événements](/events/events-and-intents/) | Événements de la Gateway, déclencheurs de messages, tâches planifiées |
| [Architecture](/architecture/features/) | Features, services, plugins |
| [Données](/data/store/) | Store, cache, traductions, feature flags, journal d'audit |
| [Messages](/messages/embeds-and-attachments/) | Embeds, pièces jointes, mentions, horodatages |
| [Production](/production/deploying/) | Déploiement, journaux, santé, sharding, résilience, tests |
| [Recettes](/recipes/moderation/) | Des fonctionnalités complètes à copier : modération, tickets, menu de rôles, niveaux |
| Référence | [Tous les exports](/api/exports/), [toutes les erreurs](/api/errors/), la [CLI](/api/cli/), le [dépannage](/help/troubleshooting/), la [FAQ](/help/faq/) et un [glossaire](/help/glossary/) |

## Par où commencer

- **Vous n'avez jamais créé de bot Discord.** Suivez le
  [tutoriel](/tutorial/what-you-need/). Il part de zéro, couvre aussi le côté
  Discord, et se termine avec un bot en ligne.
- **Vous connaissez Node et vous avez une application Discord.** Le
  [démarrage rapide](/quick-start/) prend cinq minutes environ.
- **Vous avez déjà un bot discord.js.** Lisez
  [Structure du projet](/basics/project-layout/), puis migrez une commande à
  la fois : la [FAQ](/help/faq/#can-i-add-this-to-an-existing-discordjs-bot)
  montre comment.
