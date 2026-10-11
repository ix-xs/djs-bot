---
title: "Dépannage"
description: "Les symptômes que vous allez réellement rencontrer, leurs causes et comment corriger chacun."
sidebar:
  order: 1
---

Trouvez votre symptôme, appliquez la solution. Chaque entrée ici est un vrai cas
d'échec, pas une hypothèse.

:::tip[Commencez par le doctor]
```bash
npx djs-bot doctor
```
Il vérifie votre token, votre identifiant client, vos intents, les noms en double,
les contrats non satisfaits et les services impossibles à résoudre en une seule
passe, sans se connecter à Discord. L'essentiel de cette page, c'est ce qu'il
vous aurait dit.
:::

## Commandes

### Mes commandes slash n'apparaissent pas dans Discord

Par ordre de probabilité :

1. **Vous ne les avez jamais déployées.** Lancez `npx djs-bot deploy`, ou utilisez
   `npx djs-bot dev`, qui déploie automatiquement vers votre serveur de
   développement.
2. **Elles sont globales et se propagent encore.** Les commandes globales peuvent
   mettre jusqu'à une heure à apparaître. Définissez un serveur de développement
   pour qu'elles apparaissent instantanément :
   ```bash
   DISCORD_DEV_GUILD=your_test_server_id
   ```
3. **Le chargeur n'a jamais trouvé le fichier.** Lancez `npx djs-bot explain` et
   cherchez votre commande dans la liste. Si elle manque, vérifiez que le fichier
   se trouve dans votre dossier `features` et qu'il exporte la définition.
4. **Le bot a été invité sans la portée `applications.commands`.** Réinvitez-le
   avec `bot` et `applications.commands` cochés dans le générateur d'URL du
   Developer Portal.
5. **`defaultMemberPermissions` vous les cache.** Discord masque une commande à
   toute personne qui n'a pas la permission. Vérifiez avec un compte
   administrateur.

### Je vois chaque commande en double

Votre serveur de développement contient à la fois le miroir de développement
**et** les commandes globales. C'est normal tant que `devGuildId` est défini.
Supprimez le miroir quand vous n'en voulez plus :

```bash
npx djs-bot clear --guild your_test_server_id
```

### J'ai renommé une commande mais Discord affiche l'ancien nom

Le déploiement est une comparaison, donc un renommage est une suppression suivie
d'un ajout. Relancez `npx djs-bot deploy` et vérifiez la sortie. Si l'ancien nom
persiste, c'est le cache de votre client Discord : appuyez sur `Ctrl+R` dans
l'application.

### Les changements de mes sous-commandes ne se déploient pas

Corrigé dans la 1.0.0 : la comparaison examine récursivement les options
imbriquées. Si vous êtes sur une version plus ancienne, mettez à jour.

### Chaque démarrage redéploie des commandes qui n'ont pas changé

Corrigé dans la 1.1 : la comparaison ne prend plus les valeurs par défaut de
Discord, ni un nom localisé, pour un changement. Lancer `npx djs-bot deploy` deux
fois de suite affiche désormais `no changes` la deuxième fois.

### Le déploiement échoue avec « cannot remove this app's Entry Point command »

Votre application a les Activités activées, ce qui lui donne une commande que
Discord gère lui-même. Corrigé dans la 1.1 : cette commande est conservée telle
quelle.

## Interactions

### « This interaction failed »

L'erreur Discord la plus courante. Les causes, dans l'ordre :

1. **Vous avez mis plus de 3 secondes.** Discord invalide une interaction sans
   réponse au bout de 3 secondes. Laissez le framework acquitter les
   gestionnaires lents pour vous, une fois pour toutes :
   ```ts
   defineBot({ defaults: { defer: true } });
   ```
   ou différez à la main dans un seul gestionnaire avec `await ctx.reply.defer()`.
2. **Votre gestionnaire a levé une erreur avant de répondre.** Regardez les
   journaux : la barrière d'erreurs l'y consigne avec un `correlationId`.
3. **Vous avez répondu deux fois.** Utilisez `ctx.reply(...)` plutôt que
   `ctx.interaction.reply(...)` ; l'aide choisit toute seule correctement entre
   `reply`, `editReply` et `followUp`.

### « Unknown interaction » (erreur 10062)

Le token de l'interaction a expiré avant votre réponse. Même solution que
ci-dessus : différez dans les 3 secondes. Une interaction différée vous laisse
ensuite 15 minutes.

### Ma modale ne s'ouvre pas

Une modale doit être la **première** réponse à une interaction. Si le
gestionnaire a répondu ou différé avant `ctx.showModal(...)`, ou si le
[différé automatique](/basics/automatic-deferral/) s'est déclenché le premier
parce que le gestionnaire faisait un travail lent avant de l'ouvrir, Discord la
refuse. Ouvrez la modale en premier, ou définissez `defer: false` sur cette
définition.

### `ctx.update` lève une erreur après `ctx.update.defer()`

Corrigé dans la 1.1 : `ctx.update` et `ctx.update.disable` modifient désormais le
message quand l'interaction a déjà été acquittée. Mettez à jour.

### Mon bouton ne fait rien

1. Le bouton est-il **enregistré** ? Un `defineButton` dans un fichier que le
   chargeur n'a jamais lu reste inerte. Vérifiez avec `npx djs-bot explain`.
2. Son `id` correspond-il à ce que `build()` a produit ? Construisez toujours le
   bouton à partir de la définition (`Close.build({...})`), jamais avec un
   customId écrit à la main.
3. Le message est-il plus ancien que votre dernier changement d'identifiant ? Les
   anciens messages portent d'anciens customId et ne seront pas routés. Envoyez-en
   un nouveau.

### `DJSBOT_E020` en construisant un bouton

Votre customId encodé a dépassé 100 caractères. Stockez la charge utile et
gardez une clé courte. Voir [le codec de customId](/components/buttons/#when-100-characters-is-not-enough).

## Démarrage

### Le bot démarre mais reste hors ligne

Cherchez une erreur de connexion dans les journaux. En général :

- Le token est faux ou a été régénéré. Copiez-le de nouveau depuis **Bot** dans le
  Developer Portal.
- Vous avez copié le **client secret** ou la **public key** à la place du token.

### `DJSBOT_E001` / `DJSBOT_E002`

Token ou identifiant client manquant. Les deux se rabattent sur des variables
d'environnement :

```bash
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
```

Une valeur vide compte comme manquante : méfiez-vous d'une ligne `DISCORD_TOKEN=`
oubliée.

### `DJSBOT_E060` au démarrage

Un fichier découvert n'a pas pu être importé, ou n'exporte aucune définition
valide. L'erreur nomme le fichier. Importez ce fichier directement dans un script
jetable pour voir la vraie erreur sous-jacente, et vérifiez qu'il n'y a pas un
ancien build `dist/` à côté de vos sources.

### `DJSBOT_E070`, ou des événements qui ne se déclenchent jamais

Un événement a besoin d'un **intent privilégié** que vous n'avez pas activé.
Activez-le sous **Bot -> Privileged Gateway Intents** dans le Developer Portal :

| Intent | Nécessaire pour |
| --- | --- |
| `Server Members Intent` | `guildMemberAdd`, `guildMemberRemove`, mise en cache des membres |
| `Message Content Intent` | lire le texte des messages, donc **tout** `defineTrigger` |
| `Presence Intent` | mises à jour de présence |

Une application de moins de 10 000 utilisateurs peut les activer librement ; au-delà,
Discord exige une demande, à reconfirmer chaque année.

### `DJSBOT_E080` : planification de tâche invalide

La planification d'un `defineJob` n'est ni une durée, ni une expression cron à
5 champs, ni une macro, ou son `timezone` n'est pas un fuseau IANA connu.
L'erreur nomme la tâche et la partie fautive.

### `DJSBOT_E015` : commande invalide

Une commande enfreint une limite que Discord applique au déploiement : une
description vide ou de plus de 100 caractères, plus de 25 options ou choix,
`choices` avec `autocomplete`. L'erreur nomme la commande et le champ.

### `DJSBOT_E014` : modale invalide

Une modale n'a aucun composant, en a plus de cinq, ou contient un champ à choix
avec trop peu ou trop d'options (un groupe radio en demande de 2 à 10).

### `DJSBOT_E040` : contrat non satisfait

Une feature ou un plugin déclare `requires: ["x"]` et rien ne fournit `x`.
Enregistrez un service sous ce token, ou retirez l'exigence. Notez que la
configuration compte : `defineBot({ store })` satisfait `requires: ["store"]`.

### `DJSBOT_E030` : cycle de dépendances

Deux services dépendent l'un de l'autre. Les métadonnées de l'erreur contiennent
la chaîne. Extrayez la partie commune dans un troisième service.

### `EADDRINUSE` dans les journaux

Autre chose occupe le port du contrôle de santé. Cela n'arrête **pas** le bot, par
conception. Changez de port, ou retirez `health` de votre configuration.

## Permissions

### La commande s'exécute mais rien ne se passe dans Discord

Le bot n'a pas une permission dans ce salon. Ajoutez une garde pour que l'échec
soit visible au lieu de rester silencieux :

```ts
guards: [botHasPermission(PermissionFlagsBits.ManageMessages)]
```

Rappelez-vous que les **surcharges de salon** l'emportent sur les rôles du
serveur : un bot qui a Gérer les messages sur tout le serveur peut quand même se
le voir refuser dans un salon.

### `Missing Access` / `Missing Permissions`

Vérifiez, dans cet ordre : la position du rôle du bot (il doit être **au-dessus**
des rôles qu'il gère), les surcharges du salon, et si la cible est le
propriétaire du serveur (personne ne peut modérer le propriétaire).

### Un salon s'appelle `___hidden___`

À partir du 16 novembre 2026, Discord n'envoie plus aux bots les détails des
salons qu'ils ne peuvent pas voir : le nom est remplacé et le salon est signalé.
Filtrez-les avant de lister ou de compter des salons :

```ts
import { isHiddenChannel } from "@ix-xs/djs-bot";

const visible = guild.channels.cache.filter((channel) => !isHiddenChannel(channel));
```

Les salons qu'un utilisateur passe à une commande ne sont pas concernés : les
données d'une interaction ne sont jamais masquées.

## Données

### Mon store est vide après un redémarrage

`memoryStore()` n'est pas durable. Passez à `sqliteStore("data/bot.sqlite")`.

### `node:sqlite` n'est pas disponible

Le framework demande **Node 22.13 ou plus récent**. Vérifiez avec `node -v` et
mettez à jour.

### Un compteur perd des mises à jour sous charge

Lire une valeur, la modifier puis la réécrire en trois étapes crée une
concurrence quand deux interactions arrivent ensemble. Utilisez les aides
atomiques :

```ts
await store.increment(`xp:${id}`, 25);
await store.update(`profile:${id}`, (p = { wins: 0 }) => ({ ...p, wins: p.wins + 1 }));
```

### Une feature a effacé les clés d'une autre

Utilisez des espaces de noms, pour que `clear()` ne touche que vos propres
données :

```ts
const tickets = ctx.services.store.namespace("tickets");
await tickets.clear();   // seulement les clés de tickets
```

## Développement

### Mes changements ne sont pas pris en compte

`npx djs-bot dev` surveille vos fichiers. S'il ne recharge pas, vérifiez que
`tsx` est installé pour le TypeScript brut, et que vous modifiez bien des
fichiers dans le dossier que vous avez passé à `features`.

### Les types sont faux ou absents sur `ctx.services`

Augmentez la carte des services une fois :

```ts
declare module "@ix-xs/djs-bot" {
  interface ServiceMap { db: Db }
}
```

Voir [typer ctx.services](/architecture/services/#type-your-services).

### `ctx.options.x` est possiblement undefined

C'est normal : l'option n'est pas `required: true`. Marquez-la obligatoire, ou
gérez le cas `undefined`. Le type reflète ce que Discord enverra réellement.

## Toujours bloqué ?

1. `npx djs-bot explain` montre exactement ce qui a été chargé et ce qui sera
   déployé.
2. `npx djs-bot doctor` exécute toutes les vérifications préalables.
3. Montez le niveau de journalisation : `logger: { level: "debug" }`.
4. Cherchez dans vos journaux par `correlationId` pour suivre une interaction de
   bout en bout.
5. Ouvrez une [discussion](https://github.com/ix-xs/djs-bot/discussions) avec le
   code d'erreur, la définition concernée et ce qu'`explain` a affiché.
