---
title: "CLI"
description: "Chaque commande et option de djs-bot : créer un projet, le lancer, déployer ses commandes, puis le vérifier ou l'inspecter sans se connecter à Discord."
sidebar:
  order: 2
---

Le paquet installe un seul binaire, `djs-bot`. Lancez-le avec `npx` depuis la
racine de votre projet, ou via les scripts que `init` ajoute à `package.json`.

```bash
npx djs-bot <command> [entry] [flags]
```

| Commande | Ce qu'elle fait |
| --- | --- |
| [`init`](#init) | Crée un projet de départ dans le dossier courant. |
| [`generate <type> <name>`](#generate-type-name) | Crée un fichier de définition. Alias : `g`. |
| [`dev [entry]`](#dev-entry) | Lance le bot en mode surveillance, avec un déploiement instantané vers votre serveur de test. |
| [`start [entry]`](#start-entry) | Lance le bot en mode production. |
| [`deploy [entry]`](#deploy-entry) | Compare vos commandes avec celles de Discord et envoie la différence. |
| [`clear [entry]`](#clear-entry) | Supprime toutes les commandes d'une portée. |
| [`doctor [entry]`](#doctor-entry) | Vérifie l'environnement et le bot avant de le lancer ou de le livrer. |
| [`explain [entry]`](#explain-entry) | Affiche tout ce qui est chargé, et le plan de déploiement. |
| [`help`, `version`](#help-and-version) | Affiche l'aide, ou les versions utilisées. |

Trois commandes ont leurs propres options : `deploy` (`--dry-run`,
`--guild <id>`), `clear` (`--dry-run`, `--global`, `--guild <id>`) et `explain`
(`--json`). Les autres n'en prennent aucune. Les options peuvent se placer avant
ou après le fichier d'entrée, et `--guild=<id>` est accepté aussi.

## Un premier lancement

Installez d'abord le paquet : `npx djs-bot` exécute la copie présente dans le
`node_modules` de votre projet.

```bash
npm install @ix-xs/djs-bot discord.js
npm install -D tsx typescript @types/node
npx djs-bot init      # génère le projet de départ
npx djs-bot doctor    # le vérifie, une fois .env rempli
npx djs-bot dev       # le lance
```

Le [Démarrage rapide](/quick-start/) détaille ces étapes.

## Le fichier d'entrée

Toutes les commandes sauf `init`, `generate`, `help` et `version` travaillent sur
votre fichier d'entrée : celui qui appelle `defineBot` et exporte le résultat en
export par défaut (un export nommé `bot` est accepté en solution de repli).
Passez son chemin, ou laissez la CLI le trouver. Sans chemin, le premier de ceux-ci
qui existe est utilisé :

`src/index.ts`, `src/bot.ts`, `src/main.ts`, `bot.ts`, `index.ts`,
`dist/index.js`, `dist/bot.js`, `src/index.js`, `index.js`.

La CLI se sert ensuite du fichier d'entrée de l'une de ces deux façons.

- `dev` et `start` l'**exécutent**, dans un processus enfant avec les source maps
  activées, pour que les traces d'erreur pointent vers vos propres lignes. Si
  `tsx` est installé dans le projet, il est chargé, et un fichier d'entrée `.ts`
  s'exécute sans étape de compilation.
- `deploy`, `clear`, `doctor` et `explain` l'**importent** et lisent son export
  par défaut. Ils définissent d'abord `DJSBOT_CLI=introspect`, puis chargent le
  bot : vos fichiers de features sont importés, les fonctions `setup` des plugins
  s'exécutent et les services sont construits. Ils ne se connectent jamais à la
  passerelle. C'est pourquoi ils sont rapides et sûrs à lancer en CI, et pourquoi
  un fichier d'entrée se termine par
  `if (!process.env.DJSBOT_CLI) void bot.start();`.

Avant l'un comme l'autre, la CLI lit le fichier `.env` du dossier courant et le
charge dans l'environnement. Les variables déjà définies sont conservées : votre
shell et votre hébergeur l'emportent donc sur le fichier.

## Créer des fichiers

### `init`

```bash
npx djs-bot init
```

Crée dans le dossier courant un projet que vous pouvez lancer tout de suite. Elle
ne prend aucun argument. Un fichier qui existe déjà est ignoré avec un avis,
jamais écrasé.

| Fichier | Contenu |
| --- | --- |
| `src/index.ts` | Le fichier d'entrée : `defineBot()` avec le token, l'identifiant client, le dossier des features, `intents: "auto"`, le serveur de développement et `defaults: { defer: true }`. |
| `src/features/ping/ping.command.ts` | Une première commande, `/ping`, qui répond avec la latence de la passerelle. |
| `src/types.d.ts` | L'endroit où vous déclarez vos services pour que `ctx.services` soit typé. |
| `tsconfig.json` | `strict`, `skipLibCheck`, `module` et `moduleResolution` à `NodeNext`, cible `ES2023`, `src` compilé vers `dist`. |
| `.env`, `.env.example` | `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` et `DISCORD_DEV_GUILD`, vides, chacun avec un commentaire qui indique où trouver la valeur. |
| `.gitignore` | `node_modules/`, `dist/`, `data/`, `.env`, `.djs-bot/`. |
| `package.json` | Privé, version `0.1.0`, `"type": "module"`, `engines.node` à `>=22.13.0`, et les scripts ci-dessous. Le nom est celui du dossier, en kebab-case. |

Les scripts sont `dev`, `start`, `deploy`, `doctor` et `explain` (chacun lance la
commande `djs-bot` du même nom) et `typecheck` (`tsc --noEmit`).

`package.json` est le seul fichier que `init` modifie quand il existe déjà, ce
qui est le cas habituel après `npm install` ou `npm init`. Elle ne fait qu'y
ajouter :

- Un script manquant est ajouté. Un script que vous avez déjà est conservé, même
  s'il porte l'un des noms ci-dessus.
- `"type": "module"` est défini quand le paquet n'est pas encore un module ES et
  que le fichier désigné par `main` (`index.js` par défaut) n'existe pas, c'est-à-dire
  quand le projet n'a aucun code que ce changement pourrait casser.
- Un paquet qui reste en CommonJS parce qu'il contient déjà du code est laissé tel
  quel. `init` vous le dit, et suggère `npm pkg set type=module` pour le jour où
  votre code sera prêt : le projet de départ utilise les modules ES.
- Un `package.json` qui n'est pas du JSON valide est ignoré.

`init` n'installe rien. Elle se termine en affichant ce qu'il reste à faire :
remplir `.env`, installer les dépendances si ce n'est pas fait, lancer `doctor`,
lancer `dev`.

### `generate <type> <name>`

```bash
npx djs-bot generate command warn
npx djs-bot g modal feedback
npx djs-bot generate user "User info"
```

Crée un fichier de définition, au bon endroit et avec le bon suffixe, pour que le
chargeur le prenne en compte. `g` est un alias.

Le fichier va dans `<features>/<name>/<name>.<suffix>.ts`, où `<features>` est
`src/features` quand ce dossier existe et `features` sinon, et `<name>` est votre
nom en kebab-case. `generate command warn` crée
`src/features/warn/warn.command.ts`, et `generate user "User info"` crée
`src/features/user-info/user-info.user.ts`.

| Type | Suffixe du fichier | Crée |
| --- | --- | --- |
| `command` | `.command.ts` | Une commande slash avec un bloc `options` vide. |
| `user` | `.user.ts` | Une commande de menu contextuel sur un utilisateur. |
| `message` | `.message.ts` | Une commande de menu contextuel sur un message. |
| `event` | `.event.ts` | Un écouteur d'événement de la passerelle, sur `guildMemberAdd` pour partir de quelque chose. |
| `trigger` | `.trigger.ts` | Une réponse automatique aux messages qui reconnaît le nom comme mot-clé. |
| `button` | `.button.ts` | Un bouton routé avec un paramètre typé. |
| `select` | `.select.ts` | Un menu de sélection. |
| `modal` | `.modal.ts` | Une modale avec un champ paragraphe. |
| `service` | `.service.ts` | Un service injectable. |
| `job` | `.job.ts` | Une tâche planifiée qui s'exécute toutes les heures. |
| `plugin` | `.plugin.ts` | Un plugin avec un middleware `beforeInteraction`. |
| `feature` | `.feature.ts` | Un ensemble de feature vide. |

Dans le fichier, le `name` ou l'`id` est le nom en kebab-case. Les constantes
exportées et les noms de commandes de menu contextuel utilisent le PascalCase :
`g button close-ticket` exporte `CloseTicketButton` avec l'id `close-ticket`, et
`generate user "User info"` nomme la commande `UserInfo`. Renommez librement
ensuite.

`generate` refuse d'écraser un fichier existant, et s'arrête sur un type inconnu
ou un nom manquant. Elle ne lit pas le fichier d'entrée.

## Lancer le bot

### `dev [entry]`

```bash
npx djs-bot dev
```

Lance le bot pour le développement, avec `NODE_ENV=development` :

- Le processus redémarre dès qu'un fichier qu'il a importé change (le mode
  surveillance de Node).
- Les commandes sont déployées à chaque démarrage, par défaut. Avec un serveur de
  développement, **toutes** les commandes sont reflétées vers ce serveur, où les
  changements apparaissent aussitôt. Sans lui, le plan normal est déployé, et les
  commandes globales peuvent mettre jusqu'à une heure à s'afficher.
- Les journaux sont lisibles par un humain et colorés.

Définissez le serveur de développement une fois pour toutes, dans `.env` :

```bash title=".env"
DISCORD_DEV_GUILD=123456789012345678
```

ou dans le fichier d'entrée, avec `deploy: { devGuildId: "..." }`. Voir
[Déployer les commandes](/production/deploying/) pour savoir ce qu'est le miroir
et son rapport avec un vrai déploiement.

### `start [entry]`

```bash
npx djs-bot start
```

Lance le bot une fois, avec `NODE_ENV=production` et sans surveillance. En
production, le logger écrit du JSON et les commandes ne sont plus déployées au
démarrage : déployez-les explicitement, avec `djs-bot deploy`, depuis votre
machine ou depuis la CI.

`start` recherche le fichier d'entrée comme `dev`, donc il exécute `src/index.ts`
via `tsx` quand les deux sont là. Pour lancer un build compilé, passez-le :
`npx djs-bot start dist/index.js`.

Quand une commande ne trouve aucun fichier d'entrée, elle affiche
`Could not find a bot entry file`, ou `Entry file "x" does not exist.` quand vous
en avez nommé un, et se termine avec le code 1 sans rien démarrer ni déployer.

## Déployer et effacer

### `deploy [entry]`

```bash
npx djs-bot deploy
npx djs-bot deploy --dry-run
npx djs-bot deploy --guild 123456789012345678
```

| Option | Effet |
| --- | --- |
| `--dry-run` | Calcule et affiche la différence sans rien écrire dans Discord. |
| `--guild <id>` | Place **toutes** les commandes sur ce seul serveur, sans tenir compte de la portée de chaque commande. `--guild=<id>` fonctionne aussi. |

Un déploiement est une différence, pas un écrasement à l'aveugle. La commande
récupère ce que Discord possède, le compare à vos définitions, et n'écrit que les
portées qui ont changé : les nouvelles commandes sont ajoutées, celles modifiées
mises à jour, et celles que vous avez supprimées du code retirées.

```text
✓ global
  + stats
  ~ config
  - old-command
✓ guild 123456789012345678
  no changes
```

`+` signifie ajouté, `~` modifié, `-` retiré. Avec `--dry-run`, chaque portée est
marquée `(dry run)` et rien n'est écrit. Les deux côtés sont normalisés avant
d'être comparés, donc les valeurs par défaut et les champs de gestion que Discord
ajoute ne comptent jamais comme un changement : un deuxième `deploy` d'affilée
affiche `no changes` partout, commandes localisées comprises.

Si votre configuration a un serveur de développement et que vous déployez des
commandes globales, `deploy` se termine par un avertissement : ce serveur contient
encore le miroir laissé par `dev`, donc chaque commande s'y afficherait en
double. Elle affiche la commande `clear` qui supprime le miroir.

Les portées, les commandes par serveur et l'élagage des serveurs que vous cessez
de cibler sont expliqués dans [Déployer les commandes](/production/deploying/).

### `clear [entry]`

```bash
npx djs-bot clear --global
npx djs-bot clear --guild 123456789012345678
npx djs-bot clear --guild 123456789012345678 --dry-run
```

Supprime **toutes** les commandes d'une portée et liste ce qu'elle a supprimé.

| Option | Effet |
| --- | --- |
| `--global` | Efface les commandes globales. |
| `--guild <id>` | Efface les commandes de ce serveur. `--guild=<id>` fonctionne aussi. |
| `--dry-run` | Liste ce qui serait supprimé sans le supprimer. |

Vous devez nommer la portée : sans `--global` ni `--guild`, la commande s'arrête,
volontairement. Avec les deux, `--global` l'emporte.

La raison habituelle d'y recourir : votre serveur de test affiche chaque commande
en double, parce qu'il contient à la fois le miroir de développement et
l'ensemble global. Effacer la portée du serveur laisse les commandes globales en
place.

## Inspecter et diagnostiquer

### `doctor [entry]`

```bash
npx djs-bot doctor
```

Vérifie tout ce qui tourne couramment mal, avant que vous ne lanciez ou ne livriez.

| Vérification | Résultat |
| --- | --- |
| Version de Node | Échoue en dessous de 22.13. |
| Version de discord.js | Échoue en dessous de 14.27. |
| `DISCORD_TOKEN` | Échoue s'il manque, ou s'il n'a pas les trois parties séparées par des points d'un token de bot (le client secret collé par erreur). La valeur n'est jamais affichée. |
| `DISCORD_CLIENT_ID` | Avertit s'il manque (il n'est nécessaire que pour déployer). Échoue si ce n'est pas un identifiant de 17 à 20 chiffres. |
| `DISCORD_DEV_GUILD` | Avertit s'il manque. Échoue si ce n'est pas un identifiant de 17 à 20 chiffres. |
| `.env` et git | Échoue quand le dossier est un dépôt git, contient un `.env`, et que `.gitignore` ne le liste pas : le token serait versionné. |
| Le bot se charge | Échoue sur tout ce qui interrompt le chargement : une erreur d'import, un nom en double, une définition invalide, un contrat non satisfait, un service impossible à résoudre. L'erreur est affichée avec son code et sa piste de résolution. |
| Intents privilégiés | Avertit avec la liste de ceux à activer dans le Developer Portal. |
| Commandes | Avertit quand aucune n'est enregistrée, ce qui signifie généralement que `features` pointe vers le mauvais dossier. |

```text
djs-bot doctor v1.1.0

✓ Node 24.14.0
✓ discord.js 14.27.0
✓ DISCORD_TOKEN is set
✓ DISCORD_CLIENT_ID is set
! DISCORD_DEV_GUILD is not set - commands will take up to an hour to appear while you develop
✓ .env is git-ignored
✓ Loaded 12 command(s), 7 component(s), 3 event(s), 2 job(s), 4 service(s)
! Enable these privileged intents in the Developer Portal: GuildMembers

✓ Doctor finished - everything looks good
```

Une vérification échouée (`✗`) fait quitter `doctor` avec le code 1, donc il
peut servir de barrière en CI. Un avertissement (`!`) non.

Les trois identifiants sont vérifiés dans l'environnement (`.env` compris), pas
dans ce que vous passez à `defineBot`. Un token écrit dans le code, ou lu depuis
une variable d'un autre nom, apparaît ici comme manquant.

### `explain [entry]`

```bash
npx djs-bot explain
npx djs-bot explain --json
```

Affiche ce que le bot a chargé, une liste titrée par type avec son nombre :
intents (avec un avertissement quand certains sont privilégiés), partials,
commandes, commandes utilisateur, commandes de message, boutons, menus de
sélection, modales, événements, déclencheurs, tâches planifiées avec leur
planification, services, plugins avec leur version, et features. Elle se termine
par le plan de déploiement : quelles commandes vont en global, et lesquelles vont
sur quel serveur.

C'est la réponse la plus rapide à « pourquoi ma commande est-elle absente ? » et
« mon service est-il enregistré ? ».

`--json` affiche les mêmes données sous forme d'un seul objet JSON, pour les
scripts et les assertions en CI :

```bash
npx djs-bot explain --json | jq '.commands | length'
```

| Clé | Contenu |
| --- | --- |
| `version` | La version du framework. |
| `intents`, `partials` | Les noms des intents de la passerelle et des partials que le client utilisera. |
| `privilegedIntents` | Parmi eux, les intents à activer dans le Developer Portal. |
| `commands`, `userCommands`, `messageCommands` | Les noms des commandes. |
| `buttons`, `selectMenus`, `modals` | Les identifiants des composants. |
| `events` | L'événement de chaque écouteur. |
| `triggers` | Les noms des déclencheurs. |
| `jobs` | Les tâches planifiées, sous la forme `name (schedule)`. |
| `services` | Les tokens des services. |
| `plugins` | Les plugins, sous la forme `name@version`. |
| `features` | Les noms des features. |
| `deployment` | `{ global: string[], guilds: { [guildId]: string[] } }`, par nom de commande. |

### `help` et `version`

```bash
npx djs-bot help
npx djs-bot version
# djs-bot 1.1.0  (discord.js 14.27.0, node 24.14.0)
```

`help` affiche la liste des commandes. `--help`, `-h` et le lancement de
`djs-bot` sans commande font la même chose. `version` (ainsi que `--version` et
`-v`) affiche sur une seule ligne les trois versions dont un rapport de bug a
besoin.

`--help` ou `-h` après n'importe quelle commande affiche l'aide et n'exécute
rien : `djs-bot deploy --help` ne déploie pas. `--version` et `-v` fonctionnent
de la même façon, n'importe où sur la ligne.

## Échecs et CI

| Code de sortie | Quand |
| --- | --- |
| `0` | La commande a réussi. `doctor` avec seulement des avertissements est un succès. |
| `1` | Une erreur d'utilisation (commande inconnue, option inconnue ou mal placée, argument manquant, pas de portée pour `clear`), un fichier d'entrée introuvable ou qui n'exporte pas de bot, une vérification de `doctor` échouée, ou toute erreur levée pendant le chargement ou le déploiement. |

`dev` et `start` se terminent avec le code du processus du bot qu'ils ont lancé,
avec `1` quand un signal a tué ce processus, et avec `1` quand ils ne trouvent
aucun fichier d'entrée à exécuter.

La ligne de commande est vérifiée avant toute exécution. Chacune de ces erreurs
arrête la commande avec le code de sortie 1, et rien n'est démarré, déployé ni
effacé :

| Erreur | Message |
| --- | --- |
| Une commande inconnue | `Unknown command "deplyo". Did you mean deploy?` |
| Une option inconnue | `Unknown option --dryrun. Did you mean --dry-run?` |
| Une option que la commande ne prend pas | `Option --json does not apply to "djs-bot dev"` |
| `--guild` sans identifiant | `Option --guild needs a value` |

Une faute de frappe dans `deploy --dry-run` ne se transforme donc jamais en vrai
déploiement, et `deploy --guild` sans l'identifiant ne déploie jamais
globalement.

La sortie n'est colorée que dans un terminal. Quand elle est redirigée vers un
tube ou un fichier, ou quand la variable d'environnement `NO_COLOR` est définie,
c'est du texte brut : les journaux de CI restent lisibles. `FORCE_COLOR=1` force
les couleurs.

Une erreur levée par le framework est affichée avec son code, sa piste de
résolution et un lien vers son entrée dans [Erreurs](/api/errors/). Quand Discord
rejette une requête, la CLI ajoute la cause probable :

| Réponse de Discord | Signification |
| --- | --- |
| `401` | Le token a été rejeté. Copiez-le de nouveau depuis le Developer Portal dans `DISCORD_TOKEN`. |
| `403`, ou code `50001` | Accès manquant : le bot n'est pas dans ce serveur, ou il a été invité sans la portée `applications.commands`. |
| Code `10002` | Application inconnue : `DISCORD_CLIENT_ID` n'appartient pas à l'application du token. |
| Code `30034` | Limite quotidienne atteinte : Discord autorise 200 créations de commandes par jour et par serveur. |
| `429` | Limite de débit atteinte. Attendez un moment et relancez la commande. |

En CI, vérifiez chaque pull request sans toucher à l'état de Discord :

```yaml
- run: npm ci
- run: npx djs-bot doctor
- run: npx djs-bot deploy --dry-run
```

et déployez lors d'une version :

```yaml
- run: npx djs-bot deploy
  env:
    DISCORD_TOKEN: ${{ secrets.DISCORD_TOKEN }}
    DISCORD_CLIENT_ID: ${{ secrets.DISCORD_CLIENT_ID }}
```

`doctor` et `deploy --dry-run` ont tous deux besoin du token, et le dry run a
aussi besoin de l'identifiant client, parce qu'il lit les commandes que Discord
possède actuellement.

## Voir aussi

- [Démarrage rapide](/quick-start/) pour le premier lancement, pas à pas.
- [Structure du projet](/basics/project-layout/) pour les suffixes de fichiers sur lesquels `generate` s'appuie.
- [Déployer les commandes](/production/deploying/) pour les portées, le miroir de développement et le déploiement depuis le code.
- [Erreurs](/api/errors/) pour chaque code que la CLI peut afficher.
- [Dépannage](/help/troubleshooting/) quand une commande n'apparaît pas.
