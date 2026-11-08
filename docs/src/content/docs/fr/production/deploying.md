---
title: "Déployer les commandes"
description: "Comment vos commandes slash et vos menus contextuels arrivent sur Discord : les portées globale et de serveur, le déploiement qui n'écrit que ce qui a changé, le miroir de développement, et la suppression des commandes."
sidebar:
  order: 1
---

Discord n'affiche une commande qu'une fois qu'elle a été enregistrée via son API
HTTP. Cette étape s'appelle le déploiement. Le framework construit la liste à
partir de vos définitions, la compare à ce que Discord détient déjà, et n'écrit
que lorsqu'il y a une différence. Votre code fait foi : vous n'enregistrez ni ne
supprimez jamais une commande à la main.

## Un premier déploiement

Donnez un serveur de test au bot, et il y déploie tout seul à chaque démarrage
en développement.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env.optional("DISCORD_CLIENT_ID"),
  features: `${import.meta.dirname}/features`,
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

```bash
npx djs-bot dev      # développement : chaque commande apparaît aussitôt dans le serveur de dev
npx djs-bot deploy   # release : enregistre les commandes pour de bon
```

`devGuildId` se rabat sur la variable `DISCORD_DEV_GUILD`, donc la ligne
`deploy` peut être omise quand cette variable est définie.

## Portées globale et de serveur

Une commande vit dans l'une de deux portées, et la portée décide qui la voit et
à quelle vitesse un changement apparaît.

| Portée | Visible dans | Un changement apparaît |
| --- | --- | --- |
| Globale | Tous les serveurs où se trouve le bot (et les messages privés, selon ses contextes) | En une heure environ |
| Serveur | Un seul serveur | Aussitôt |

Une commande est globale par défaut. Ajoutez `guilds` pour la déployer
uniquement sur les serveurs que vous listez : une commande d'administration pour
votre serveur de support, une fonctionnalité vendue à quelques communautés.

```ts title="src/features/admin/announce.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "announce",
  description: "Post an announcement",
  // Seuls ces deux serveurs reçoivent la commande.
  guilds: ["123456789012345678", "234567890123456789"],
  run: (ctx) => ctx.reply.success("Announced."),
});
```

`guilds` existe sur `defineCommand`, `defineUserCommand` et
`defineMessageCommand`. Vous pouvez mélanger librement commandes globales et
commandes limitées à des serveurs. Un tableau vide équivaut à l'absence de
`guilds` : la commande est globale.

`npx djs-bot explain` affiche le plan obtenu sans toucher à Discord :

```
Deployment plan
  global: help, ping
  guild 123456789012345678: announce
  guild 234567890123456789: announce
```

## Ce qu'un déploiement change

Un déploiement traite chaque portée séparément : la portée globale d'abord, puis
chaque serveur nommé par une commande. Pour chacune, il récupère les commandes
que Discord détient, les compare à vos définitions, et range chaque commande
dans l'une de quatre listes.

| Marque | Champ du résultat | Signification |
| --- | --- | --- |
| `+` | `added` | Dans votre code, pas encore sur Discord |
| `~` | `changed` | Des deux côtés, avec une définition différente |
| `-` | `removed` | Sur Discord, plus dans votre code |
| | `unchanged` | Identique des deux côtés |

Si les trois premières listes sont vides, la portée est laissée telle quelle :
aucune requête n'est envoyée, donc aucune limite de débit n'est consommée.
Sinon, toute la liste de commandes de cette portée est remplacée en une seule
requête. Lancer deux déploiements d'affilée n'écrit rien la deuxième fois.

Quelques détails rendent la comparaison fiable :

- Discord ajoute des champs de gestion et remplit des valeurs par défaut. Les
  deux côtés sont d'abord normalisés (valeurs vides retirées, listes et tables
  de localisation ordonnées), donc cela ne compte jamais comme un changement.
- Les options sont comparées en profondeur : sous-commandes, groupes, choix,
  plages de valeurs, types de salons, types de fichiers et autocomplétion en font
  tous partie. Les localisations, `defaultMemberPermissions` et `nsfw` aussi.
- `dmPermission`, `integrationTypes` et `contexts` ne sont comparés que si votre
  définition les renseigne, parce que Discord choisit une valeur par défaut qui
  dépend de la façon dont l'application est installée. Dans une portée de
  serveur, ils sont ignorés : Discord les accepte sur une commande de serveur
  puis les supprime.
- Une commande est identifiée par son type et son nom. Une commande slash et un
  menu contextuel peuvent partager un nom, et renommer une commande revient à une
  suppression plus un ajout.

Pour voir les listes sans rien écrire, demandez une simulation :

```bash
npx djs-bot deploy --dry-run
```

`npx djs-bot deploy --guild <id>` ignore le plan et place toutes les commandes
sur ce seul serveur, ce qui est le moyen le plus rapide d'essayer une release
sur un serveur que vous contrôlez. Les deux options sont décrites sur la page
[CLI](/api/cli/).

## Développement et production

Quand le bot devient prêt, il peut déployer tout seul. `deploy.autoDeploy`
en décide, et vaut `true` par défaut sauf si `NODE_ENV` vaut `production`.
`djs-bot dev` définit `NODE_ENV=development` et `djs-bot start` définit
`NODE_ENV=production`.

| `NODE_ENV` | Serveur de dev défini | Au démarrage |
| --- | --- | --- |
| pas `production` | oui | Chaque commande va dans le serveur de dev, quel que soit son `guilds` |
| pas `production` | non | Le vrai plan est déployé : commandes globales en global, commandes limitées dans leurs serveurs |
| `production` | l'un ou l'autre | Rien, sauf avec `autoDeploy: true`, qui déploie le vrai plan |

La première ligne est le miroir de développement. Il existe parce qu'une
commande globale peut mettre une heure à apparaître, et que personne ne veut
attendre aussi longtemps pour tester une option renommée. Le miroir passe par la
même comparaison, donc redémarrer sans toucher à une commande n'écrit rien.

Le déploiement automatique est tolérant : un échec est journalisé sous le nom
`Auto-deploy failed` et le bot continue de tourner, et quand aucun identifiant
client n'est configuré, il utilise l'identifiant de l'application sous laquelle
il est connecté. Sur un bot [shardé](/production/sharding/), seul le shard 0
s'en charge.

:::caution[Chaque commande en double dans votre serveur de dev ?]
Le miroir crée des commandes de serveur. Si vous avez aussi déployé en global,
votre serveur de dev détient les deux copies et affiche chaque commande deux
fois. C'est normal. Supprimez le miroir avec `npx djs-bot clear --guild <id>`.
`djs-bot deploy` vous le rappelle quand un serveur de dev est configuré.
:::

En production, déployez une fois par release plutôt qu'à chaque démarrage :

```bash
npx djs-bot deploy
```

Il faut `DISCORD_TOKEN` et `DISCORD_CLIENT_ID` (ou `token` et `clientId` dans
`defineBot`), et la commande ne se connecte jamais à la passerelle (gateway),
donc elle peut sans risque tourner dans une tâche de CI. Lancer
`npx djs-bot deploy --dry-run` sur chaque pull request montre ce qu'une fusion
changerait. La recette [Hébergement](/recipes/hosting/) contient un pipeline
complet.

La même chose depuis votre propre script :

```ts title="scripts/deploy.ts"
// Empêche le fichier d'entrée de démarrer le bot quand il est importé.
process.env.DJSBOT_CLI = "introspect";
const { default: bot } = await import("../src/index.js");

const result = await bot.deploy({ dryRun: process.argv.includes("--dry-run") });

for (const target of result.targets) {
  const where = target.scope === "global" ? "global" : `guild ${target.guildId}`;
  console.log(where, { added: target.added, changed: target.changed, removed: target.removed });
}
```

## Supprimer des commandes

Supprimez le fichier (ou la définition) et déployez de nouveau : la commande se
retrouve dans `removed` et disparaît de Discord. Modifier fonctionne de la même
manière. Il n'y a rien à supprimer à la main.

Un cas demande de la mémoire : un serveur que plus aucune commande ne cible. Il
est absent du plan, donc rien n'irait le visiter. `bot.deploy()` et
`djs-bot deploy` écrivent donc les serveurs sur lesquels ils ont déployé dans
`.djs-bot/deploy-state.json`, et au déploiement suivant ils vident les serveurs
sortis du plan.

:::caution[Le fichier d'état est local]
`.djs-bot/` est ignoré par git dans un projet créé avec `djs-bot init`, et il
est lu depuis le répertoire où le déploiement s'exécute. Un runner de CI qui
part d'un checkout propre n'a pas de fichier d'état, donc il ne peut pas savoir
quels serveurs vider. Conservez le fichier entre les exécutions, ou videz vous-même
un tel serveur. Le déploiement automatique au démarrage ne lit ni n'écrit ce
fichier.
:::

Pour vider entièrement une portée, par exemple le miroir de développement ou un
serveur que vous ne desservez plus :

```bash
npx djs-bot clear --guild 123456789012345678
npx djs-bot clear --global
```

```ts
await bot.clear({ guildId: "123456789012345678" });   // un serveur
await bot.clear();                                     // les commandes globales
```

Vous devez nommer la portée sur la ligne de commande : il n'y a pas de valeur
par défaut, volontairement. Vider un serveur laisse les commandes globales en
place, et inversement.

Une commande Entry Point est la seule exception. Discord la crée pour les
applications qui ont des Activities et refuse une écriture qui l'omet, donc un
déploiement ne la liste jamais comme supprimée, la renvoie telle quelle, et
`clear` la conserve aussi.

## Référence

Chaque option, propriété et type, avec ce qu'il accepte et renvoie, est dans la référence de l'API :

- `defineBot()` : Crée un `Bot`.
- `DeployConfig` : Configuration du déploiement.
- `DeployResult` : Le résultat d'un déploiement sur toutes les cibles.
- `DeployCallOptions` : Options de `Bot.deploy`.
- `DeployTargetResult` : Ce qui a changé pour une cible de déploiement (globale, ou un serveur précis).
- `deployCommands()` : Déploie les commandes en respectant la portée propre à chacune : - les commandes sans `guilds` sont **globales**, - les commandes avec `guilds` vont dans **ces serveurs**.
- `Registry` : Contient toutes les définitions et expose des recherches typées.
- `DeployOptions` : Options de `deployCommands`.
- `Logger` : Logger structuré avec filtrage par niveau et liaisons enfants.
- `clearCommands()` : Supprime **toutes** les commandes de l'application d'une portée (un serveur, ou global).
- `ClearOptions` : Options de `clearCommands`.
- `planDeployment()` : Répartit les commandes du registre en un ensemble global et des ensembles par serveur, d'après le champ `guilds` de chaque commande.
- `DeploymentPlan` : Un plan de déploiement résolu : quelles commandes sont globales, et lesquelles vont dans quel serveur.
- `buildCommandTree()` : Construit l'arbre de commandes complet souhaité (sans tenir compte de la portée propre à chaque commande).

## Limites et erreurs

Discord plafonne le nombre de commandes dans chaque portée. Tout le plan est
vérifié avant la première requête, donc un déploiement qui dépasse la limite est
refusé avec [`DJSBOT_E015`](/api/errors/#djsbot_e015) au lieu d'être appliqué à
moitié.

| Limite | Valeur |
| --- | --- |
| Commandes slash par portée | 100 |
| Commandes de menu contextuel utilisateur par portée | 15 |
| Commandes de menu contextuel message par portée | 15 |
| Créations de commandes par serveur et par jour | 200 |
| Propagation d'une commande globale | jusqu'à environ une heure |

Une portée est la liste globale, ou la liste d'un serveur : un serveur peut
contenir 100 commandes slash globales plus 100 qui lui sont propres. Quand un
seul serveur reçoit tout (`--guild`, ou le miroir de développement), toutes vos
commandes comptent pour ce serveur. Pour rester sous la limite, regroupez les
commandes voisines en [sous-commandes](/commands/subcommands/) d'une seule
commande.

| Échec | Cause |
| --- | --- |
| [`DJSBOT_E001`](/api/errors/#djsbot_e001) | Pas de token : définissez `token` ou `DISCORD_TOKEN`. |
| [`DJSBOT_E002`](/api/errors/#djsbot_e002) | Pas d'identifiant client : définissez `clientId` ou `DISCORD_CLIENT_ID`. |
| [`DJSBOT_E015`](/api/errors/#djsbot_e015) | Trop de commandes dans une portée. |
| HTTP 401 | Discord a rejeté le token. |
| HTTP 403, ou code 50001 | Le bot n'est pas dans ce serveur, ou a été invité sans la portée `applications.commands`. |
| Code 10002 | L'identifiant client n'appartient pas à l'application du token. |
| Code 30034 | La limite quotidienne de créations de ce serveur est atteinte. |
| HTTP 429 | Limite de débit atteinte. Patientez, puis déployez de nouveau. |

## Voir aussi

- [CLI](/api/cli/) : tous les paramètres de `deploy`, `clear` et `explain`.
- [Commandes slash](/commands/slash-commands/) : les définitions qui sont déployées.
- [Contextes d'installation](/commands/install-contexts/) : où une commande globale peut être utilisée.
- [Hébergement](/recipes/hosting/) : déployer depuis un pipeline de release.
- [Sharding](/production/sharding/) : quel processus déploie sur un bot shardé.
