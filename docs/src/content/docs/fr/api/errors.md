---
title: "Erreurs"
description: "Ce qui se passe quand un gestionnaire lève une erreur, ce que voit l'utilisateur, comment gérer et signaler les erreurs vous-même, et ce que signifie chaque code DJSBOT_Exxx avec sa solution."
sidebar:
  order: 3
---

Un bot connaît deux sortes d'erreurs. Celles que lèvent vos gestionnaires pendant
que le bot tourne sont attrapées par la barrière d'erreurs : elles sont
journalisées, signalées, et l'utilisateur reçoit une réponse. Celles que le
framework lève lui-même, surtout au démarrage, sont des `BotError` : chacune
porte un code stable, une piste de résolution et un lien vers cette page.

```text
BotError [DJSBOT_E020]: customId too long: key "ticket:close" produced 128 chars
  ↳ Shorten params or move large state into a store keyed by a short id. Limit is 100.
  ↳ https://ix-xs.github.io/djs-bot/api/errors/#djsbot_e020
```

## La barrière d'erreurs

Chaque gestionnaire s'exécute dans un `try`/`catch` qui appartient au framework.
Vous n'enveloppez pas votre propre code : répondez à l'utilisateur pour les
issues que vous attendez, et laissez tout le reste lever une erreur.

```ts title="src/features/tickets/close.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "close",
  description: "Close a ticket",
  options: {
    id: s.string({ description: "The ticket id", required: true }),
  },
  run: async (ctx) => {
    const ticket = await ctx.services.tickets.find(ctx.options.id);
    // Attendu : une réponse normale. Rien n'est journalisé.
    if (!ticket) return ctx.reply.error("No ticket with that id.");

    // Inattendu : si cela lève une erreur, la barrière prend le relais.
    await ctx.services.tickets.close(ticket);
    return ctx.reply.success("Closed.");
  },
});
```

Quand un gestionnaire d'interaction lève une erreur (ou l'une de ses gardes, ou
un middleware qui l'entoure), le framework fait quatre choses, dans cet ordre :

1. Il journalise l'erreur au niveau `error` avec le message
   `Interaction handler failed`. La ligne porte le `correlationId` de
   l'interaction et l'identifiant de l'utilisateur, ce qui permet de retrouver
   toutes les autres lignes de la même interaction.
2. Il appelle chaque hook `onError` des plugins, avec l'erreur et le `ctx`.
3. Il appelle votre `defineBot({ onError })`, avec l'erreur et le `ctx`.
4. Il envoie un message d'erreur à l'utilisateur, sauf si votre `onError` a
   renvoyé une valeur.

Rien de ce qu'un gestionnaire lève ne peut arrêter le processus ni laisser
l'utilisateur devant « The application did not respond ». Le code qui s'exécute
hors d'une interaction est protégé lui aussi, avec une différence : il n'y a
personne à qui répondre.

| Ce qui a levé l'erreur | Message de journal | Hooks et `onError` | Ce que voit l'utilisateur |
| --- | --- | --- | --- |
| Un gestionnaire d'interaction, une garde, un middleware | `Interaction handler failed` | Appelés avec `ctx` | Le message d'erreur |
| Un écouteur d'événement | `Event handler failed` | Appelés sans `ctx` | Rien |
| Un déclencheur de message | `Trigger handler failed` | Appelés sans `ctx` | Rien |
| Une tâche planifiée | `Job failed` | Appelés sans `ctx` | Rien |
| Un hook `onReady` ou `afterInteraction` | `onReady hook failed`, `afterInteraction hook failed` | Appelés sans `ctx` | Rien |
| Une exception non interceptée ou un rejet non géré, une fois le bot démarré | `Uncaught error (kept alive)` | Appelés sans `ctx` | Rien |
| Un gestionnaire d'autocomplétion | `Autocomplete handler failed` | Non appelés | Une liste de suggestions vide |
| Le routage, avant le démarrage du gestionnaire | `Interaction routing failed` | Non appelés | Le « This interaction failed » de Discord lui-même |

La dernière ligne est rare. Elle couvre ce qui tourne mal pendant que le
framework prépare le `ctx`. Un customId qu'il ne sait pas décoder
([`DJSBOT_E021`](#djsbot_e021)) n'en fait pas partie : il est traité comme un
gestionnaire qui échoue, la première ligne.

Un hook `afterInteraction` qui échoue est signalé mais ne devient jamais un
message d'erreur : le gestionnaire avait déjà réussi et répondu. Les échecs
pendant l'arrêt (un hook `onShutdown`, un `teardown` de plugin, un `dispose` de
service) sont journalisés et l'arrêt se poursuit.

Le démarrage fait exception à tout cela. Une erreur levée pendant le chargement
du bot (un fichier qui ne s'importe pas, un nom en double, un token manquant)
rejette `bot.start()` : un bot qui ne peut pas se charger ne doit pas tourner à
moitié configuré.

## Ce que voit l'utilisateur

La réponse par défaut est le message `error` du framework, envoyé avec
`ctx.reply.error()` : un embed rouge, visible seulement par l'utilisateur, qui
dit « Something went wrong. The team has been notified. »

- Pour le reformuler ou le traduire, définissez `messages.error` dans
  `defineBot`. Voir [Formulations et thème](/basics/wording-and-theme/).
- Si le gestionnaire avait déjà répondu, le message est envoyé en message de
  suivi.
- Si l'interaction a été différée, le message remplace l'état de chargement : il
  est donc aussi public que l'était le différé. Après un différé de type
  `update` sur un composant, il modifie le message auquel le composant est
  attaché. Voir [Différé automatique](/basics/automatic-deferral/).
- Si l'interaction a expiré, l'envoi échoue en silence. L'erreur est quand même
  journalisée et signalée.

Une garde qui refuse une interaction n'est pas une erreur : l'utilisateur reçoit
la raison, rien n'est journalisé au-dessus de `debug`, et aucun hook ne
s'exécute. Voir [Gardes](/commands/guards/).

## Gérer les erreurs globalement

`onError` dans `defineBot` est l'unique endroit qui voit toutes les erreurs que
le framework attrape. Servez-vous-en pour signaler à votre outil de supervision,
et, si vous le voulez, pour prendre la main sur la réponse.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";
import * as Sentry from "@sentry/node";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  onError(error, ctx) {
    // ctx est défini pour une interaction, absent pour un événement, un déclencheur ou une tâche.
    Sentry.captureException(error, {
      tags: { source: ctx ? "interaction" : "background", guild: ctx?.guildId },
    });
    // Rien n'est renvoyé : l'utilisateur reçoit quand même le message d'erreur par défaut.
  },
});

export default bot;
if (!process.env.DJSBOT_CLI) void bot.start();
```

Pour répondre vous-même à l'utilisateur, envoyez votre message et renvoyez une
valeur. Toute valeur autre que `undefined` marque l'erreur comme gérée et annule
le message par défaut.

```ts
async onError(error, ctx) {
  if (!ctx) return;
  await ctx.reply.error("That did not work. Try again in a minute.");
  return true; // géré : pas de message par défaut
}
```

:::caution[Renvoyez une valeur explicite]
`return ctx.reply.error("...")` ne marque pas l'erreur comme gérée :
`ctx.reply.error()` se résout en `undefined`, donc le message par défaut est
envoyé lui aussi. Attendez votre réponse avec `await`, puis faites `return true`.
:::

La valeur renvoyée ne compte que pour une interaction. Pour un événement, un
déclencheur ou une tâche planifiée, elle est ignorée. Si `onError` lève lui-même
une erreur, l'exception est avalée et le message par défaut est envoyé.

Un plugin enregistre le même genre de gestionnaire avec `app.hooks.onError`. Les
hooks s'exécutent avant `onError`, dans l'ordre d'enregistrement des plugins. Ils
sont faits pour le signalement : leur valeur de retour est ignorée et ils ne
peuvent pas annuler le message par défaut.

```ts title="src/features/monitoring/monitoring.plugin.ts"
import { definePlugin } from "@ix-xs/djs-bot";

export default definePlugin({
  name: "monitoring",
  setup(app) {
    app.hooks.onError((error, ctx) => {
      app.logger.warn({ err: error, guildId: ctx?.guildId }, "forwarded to monitoring");
    });
  },
});
```

Le plugin officiel `errorReporter` est ce hook, prêt à l'emploi. Voir
[Plugins et hooks](/architecture/plugins/).

## Lever vos propres erreurs

À chaque fois que quelque chose tourne mal dans un gestionnaire, choisissez
entre deux cas :

- **Une issue que vous attendez** (ticket inexistant, pas votre tour, rien à
  annuler) : répondez avec `ctx.reply.error()` et retournez. Rien n'est
  journalisé, ce qui garde les refus ordinaires hors de vos journaux.
- **Une vraie défaillance** (la base de données est en panne, une API a répondu
  500) : levez une erreur, ou laissez passer l'exception. La barrière la
  journalise et prévient l'utilisateur.

Au fond d'un service, loin du `ctx`, renvoyer un message est malcommode. Une
petite classe d'erreur à vous règle le problème : levez-la n'importe où, et
laissez `onError` la transformer en réponse.

```ts title="src/user-error.ts"
/** Une défaillance dont le message peut être montré à l'utilisateur sans risque. */
export class UserError extends Error {}
```

```ts
async onError(error, ctx) {
  if (error instanceof UserError && ctx) {
    await ctx.reply.error(error.message);
    return true;
  }
  // Tout le reste retombe sur le message par défaut.
}
```

La barrière journalise chaque erreur qu'elle attrape avant l'exécution de
`onError`, donc une `UserError` apparaît quand même dans les journaux.

`BotError` est réservée au catalogue du framework : son constructeur n'accepte
qu'un code de la [liste ci-dessous](#error-codes). Utilisez vos propres classes
pour vos propres défaillances.

## Intercepter les erreurs du framework

`isBotError()` distingue une erreur du framework de toute autre, et `error.code`
dit laquelle. Comparez les codes, jamais les messages : le code est stable d'une
version à l'autre, la formulation non.

```ts
import { isBotError } from "@ix-xs/djs-bot";

let button;
try {
  button = Publish.build({ draft: ctx.options.text });
} catch (error) {
  if (isBotError(error) && error.code === "DJSBOT_E020") {
    return ctx.reply.error("That text is too long to attach to a button.");
  }
  throw error;
}
```

La plupart des codes sont levés à la création d'une définition ou au chargement
du bot : vous les croisez donc dans le terminal, pas dans un `catch`. La CLI
affiche la forme en trois lignes montrée en haut de cette page. Dans les
journaux, le champ `err` de l'entrée contient `name`, `message`, `stack`, `code`,
`hint`, `docs` et `meta`.

## Référence

### `BotError`

```ts
new BotError(code, options?)
```

Une sous-classe de `Error`. `code` doit être l'un des [codes d'erreur](#error-codes).

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `detail` | `string` | aucun | Contexte ajouté au titre du catalogue : le message devient `"<title>: <detail>"`. |
| `hint` | `string` | la piste du catalogue | Remplace la piste de résolution pour cette occurrence. |
| `cause` | `unknown` | aucune | L'erreur sous-jacente, conservée dans `error.cause`. |
| `meta` | `Record<string, unknown>` | aucune | Données structurées pour les journaux. |

| Propriété | Type | Description |
| --- | --- | --- |
| `name` | `"BotError"` | Toujours `"BotError"`. |
| `code` | `ErrorCode` | Le code stable, par exemple `DJSBOT_E020`. |
| `message` | `string` | Le titre du catalogue, suivi du détail quand il y en a un. |
| `hint` | `string` | Une courte suggestion pour corriger le problème. |
| `docs` | `string` | L'URL de l'entrée du code sur cette page. |
| `meta` | `Record<string, unknown> \| undefined` | Ce que le framework a attaché, par exemple la chaîne d'un cycle de dépendances. |
| `cause` | `unknown` | L'erreur sous-jacente, quand il y en a une. |

`toString()` renvoie la forme en trois lignes : `BotError [code]: message`, puis
la piste de résolution, puis le lien vers la documentation.

Les types `ErrorCode` (l'union de tous les codes) et `BotErrorOptions` (les
options ci-dessus) sont exportés eux aussi.

### `isBotError(value)`

Un type guard : `true` quand `value` est une `BotError`. Dans le `if`, `value.code`
et `value.hint` sont typés.

### `ERROR_CATALOGUE`

La table derrière les codes : un objet indexé par code, chaque entrée contenant
un `title` et une `hint` par défaut. Lisez-la pour afficher ou traduire une
explication à l'exécution.

```ts
import { ERROR_CATALOGUE, isBotError } from "@ix-xs/djs-bot";

function explain(error: unknown): string {
  if (!isBotError(error)) return "Unexpected error";
  return `${ERROR_CATALOGUE[error.code].title} (${error.code})`;
}
```

### `onError(error, ctx?)`

Le champ `onError` de `defineBot`.

| Paramètre | Type | Description |
| --- | --- | --- |
| `error` | `unknown` | Ce qui a été levé. Pas toujours une `Error` : restreignez le type avant de lire des propriétés. |
| `ctx` | `BaseContext \| undefined` | Le contexte de l'interaction. Absent quand l'erreur vient d'un événement, d'un déclencheur, d'une tâche planifiée, d'un hook ou d'une exception non interceptée. |

Renvoyez toute valeur autre que `undefined` (y compris via une promesse) pour
annuler le message d'erreur par défaut d'une interaction. Pour une interaction, le
framework attend la promesse renvoyée avant de décider. Pour une erreur en
arrière-plan, il n'attend pas, et un rejet est ignoré.

### `app.hooks.onError(fn)`

Enregistre un hook d'erreur de plugin. `fn` a les mêmes paramètres que `onError`.
Il est appelé pour les mêmes erreurs, avant `onError`. Sa valeur de retour est
ignorée, et une exception qu'il lève est avalée.

## Codes d'erreur

Le titre de chaque code est son message, cité tel que le programme l'affiche,
en anglais. La piste qui l'accompagne dans le terminal est donnée ici en
français.

| Code | Titre | Levée |
| --- | --- | --- |
| [`DJSBOT_E001`](#djsbot_e001) | `Missing bot token` | Démarrage, déploiement |
| [`DJSBOT_E002`](#djsbot_e002) | `Missing application client id` | Déploiement |
| [`DJSBOT_E010`](#djsbot_e010) | `Duplicate command name` | Démarrage |
| [`DJSBOT_E011`](#djsbot_e011) | `Duplicate component id` | Démarrage |
| [`DJSBOT_E012`](#djsbot_e012) | `Invalid command or option name` | Définition |
| [`DJSBOT_E013`](#djsbot_e013) | `Invalid component id` | Définition |
| [`DJSBOT_E014`](#djsbot_e014) | `Invalid modal definition` | Définition |
| [`DJSBOT_E015`](#djsbot_e015) | `Invalid command definition` | Définition, déploiement |
| [`DJSBOT_E020`](#djsbot_e020) | `customId too long` | À la construction d'un composant |
| [`DJSBOT_E021`](#djsbot_e021) | `Invalid customId payload` | À l'utilisation d'un composant |
| [`DJSBOT_E030`](#djsbot_e030) | `Service resolution failed` | Démarrage |
| [`DJSBOT_E031`](#djsbot_e031) | `Unknown service` | Démarrage, exécution |
| [`DJSBOT_E040`](#djsbot_e040) | `Feature contract not satisfied` | Démarrage |
| [`DJSBOT_E041`](#djsbot_e041) | `Capability conflict` | Démarrage |
| [`DJSBOT_E050`](#djsbot_e050) | `Invalid option value` | Réservé |
| [`DJSBOT_E060`](#djsbot_e060) | `Loader error` | Démarrage |
| [`DJSBOT_E070`](#djsbot_e070) | `Privileged intent required` | Réservé |
| [`DJSBOT_E080`](#djsbot_e080) | `Invalid job schedule` | Définition |

« Définition » signifie que l'erreur est levée par l'appel `define*()` lui-même,
dès que le fichier est importé. Quand c'est le chargeur qui importe le fichier,
il signale l'échec sous le code [`DJSBOT_E060`](#djsbot_e060), avec l'erreur
d'origine en `cause` et le titre d'origine dans son message.

« Démarrage » couvre tout ce qui charge le bot : `bot.start()`, et les commandes
de la CLI qui l'inspectent (`deploy`, `clear`, `doctor`, `explain`).

### `DJSBOT_E001`

**`Missing bot token`** : fournissez `token` dans `defineBot()` ou définissez la
variable d'environnement `DISCORD_TOKEN`.

Levée par `bot.start()`, `bot.deploy()` et `bot.clear()` quand il n'y a ni
`token` dans la configuration ni variable `DISCORD_TOKEN`. Une valeur vide compte
comme manquante : cherchez une ligne `DISCORD_TOKEN=` oubliée dans `.env`.

Si votre fichier d'entrée lit le token avec `env("DISCORD_TOKEN")`, comme le fait
le projet de départ, `env()` échoue d'abord avec son propre message
(`Missing required environment variable "DISCORD_TOKEN"`), qui n'a pas de code.
La solution est la même.

### `DJSBOT_E002`

**`Missing application client id`** : définissez `clientId` dans `defineBot()`
ou la variable d'environnement `DISCORD_CLIENT_ID`. Il est nécessaire pour
déployer les commandes.

Levée par `bot.deploy()` et `bot.clear()`, donc par `djs-bot deploy` et
`djs-bot clear`. Le bot se connecte sans identifiant client, et le déploiement
automatique au démarrage lit l'identifiant depuis la connexion. Seul le
déploiement explicite en a besoin. Vous le trouvez sous **General Information**
dans le Developer Portal.

### `DJSBOT_E010`

**`Duplicate command name`** : deux commandes sont enregistrées sous le même
nom. Les noms de commande doivent être uniques.

Deux définitions de commande slash différentes partagent un nom, ou deux
commandes de menu contextuel sur un utilisateur, ou deux commandes de menu
contextuel sur un message. Le détail donne le type et le nom. Les causes
habituelles sont un fichier copié-collé dont le `name` n'a pas été changé, et une
ancienne copie du même fichier chargée depuis un second endroit (un dossier
`dist/` à côté des sources, par exemple).

Enregistrer deux fois le même objet est sans danger : une définition peut être
découverte depuis son propre fichier et aussi listée dans un `defineFeature`.
Lancez `npx djs-bot explain` pour voir tout ce qui a été chargé.

### `DJSBOT_E011`

**`Duplicate component id`** : deux composants partagent le même identifiant.
Les identifiants de bouton, de menu de sélection et de modale doivent être
uniques pour chaque type.

Deux boutons, deux menus de sélection ou deux modales partagent un `id`. Les
identifiants sont uniques par type, donc un bouton et une modale peuvent utiliser
le même. Mettez-les dans un espace de noms pour éviter les ennuis : `ticket:close`,
`poll:vote`.

### `DJSBOT_E012`

**`Invalid command or option name`** : les noms de commande slash, de
sous-commande, de groupe et d'option font de 1 à 32 caractères, en minuscules,
et n'utilisent que des lettres, des chiffres, `-` ou `_` (pas d'espace).

Levée par `defineCommand` pour la commande, ses sous-commandes, ses groupes et
ses options. Le détail nomme le fautif.

```ts
name: "My Command" // refusé : majuscules et espace
name: "my-command" // accepté
```

Les lettres de n'importe quelle écriture sont acceptées, tant qu'elles sont en
minuscules.

Les commandes de menu contextuel (`defineUserCommand`, `defineMessageCommand`)
peuvent contenir des espaces et des majuscules. Elles ne lèvent ce code que si le
nom est vide ou dépasse 32 caractères.

### `DJSBOT_E013`

**`Invalid component id`** : les identifiants de bouton, de menu de sélection et
de modale ne doivent pas être vides ni contenir `$` (réservé comme séparateur du
customId). Utilisez `:` ou `-` pour les préfixer.

Levée par `defineButton`, les définitions de menus de sélection et `defineModal`
quand l'`id` est vide, contient `$`, ou dépasse 100 caractères.

### `DJSBOT_E014`

**`Invalid modal definition`** : une modale contient de 1 à 5 composants. Un
menu de sélection prend de 1 à 25 options, un groupe de boutons radio de 2 à 10,
un groupe de cases à cocher de 1 à 10.

Levée par `defineModal`, donc une erreur échoue au démarrage et n'atteint jamais
un utilisateur. Le détail nomme la modale et le champ.

| Limite | Valeur |
| --- | --- |
| Composants dans une modale | 1-5 |
| Titre | 1-45 caractères |
| Libellé d'un champ | 1-45 caractères |
| Description d'un champ | 100 caractères |
| Texte indicatif (placeholder) | 100 caractères sur un champ de texte, 150 sur un menu de sélection ou un sélecteur |
| `value` pré-remplie d'un champ de texte | 4000 caractères |
| `minLength` / `maxLength` d'un champ de texte | 0-4000 / 1-4000 |
| Options de `field.select` / `field.radio` / `field.checkboxes` | 1-25 / 2-10 / 1-10 |
| Libellé, valeur et description d'une option | 100 caractères chacun |
| `minValues` / `maxValues` | 0-25 / 1-25 (0-10 / 1-10 sur `field.files`) |
| `fileTypes` de `field.files` | 10 entrées |

Un minimum supérieur à son maximum est refusé, de même qu'une entrée de
`fileTypes` qui n'est ni `"image"`, ni `"video"`, ni `"audio"`, ni une extension
comme `".pdf"`.

### `DJSBOT_E015`

**`Invalid command definition`** : les limites de Discord sont des descriptions
de 1 à 100 caractères, 25 options et 25 choix par commande, 8000 caractères au
total, et 100 commandes slash (15 de chaque type de menu contextuel) par portée.

Une commande enfreint une limite que Discord applique au déploiement. Levée par
`defineCommand`, là où l'API n'aurait répondu que `400 Invalid Form Body`. Le
détail nomme le champ exact.

| Limite | Valeur |
| --- | --- |
| Description (commande, sous-commande, groupe, option), localisation la plus longue comprise | 1-100 caractères |
| Options par commande ou sous-commande | 25 |
| Sous-commandes et groupes par commande, sous-commandes par groupe | 25 |
| Choix par option | 25 |
| Nom d'un choix | 1-100 caractères |
| Valeur texte d'un choix | 100 caractères |
| `minLength` / `maxLength` d'une option texte | 0-6000 / 1-6000 |
| `fileTypes` d'une option de pièce jointe | 10 entrées |
| Noms, descriptions et choix d'une commande, additionnés | 8000 caractères |
| Commandes par portée (globale, ou un serveur) | 100 slash, 15 utilisateur, 15 message |

Elle refuse aussi `choices` combiné avec `autocomplete`, un `min` supérieur à son
`max`, un `minLength` supérieur à son `maxLength`, et une entrée de `fileTypes`
qui n'est ni `"image"`, ni `"video"`, ni `"audio"`, ni une extension comme
`".pdf"`.

Le décompte par portée est l'unique vérification faite au déploiement, parce
qu'elle dépend du bot entier. Sa piste de résolution propose les deux issues :
regrouper les commandes proches en sous-commandes d'une seule commande, ou en
limiter certaines à des serveurs précis.

### `DJSBOT_E020`

**`customId too long`** : raccourcissez les paramètres, ou placez l'état
volumineux dans un store sous un identifiant court. La limite est de 100
caractères.

Levée par `.build()` sur un bouton, un menu de sélection ou une modale quand le
customId encodé (l'`id` plus les `params` encodés) dépasse la limite de 100
caractères de Discord. Le détail donne l'identifiant et la longueur produite.

Raccourcissez les paramètres, ou stockez la charge utile et ne gardez qu'une clé
courte :

```ts
const key = crypto.randomUUID().slice(0, 8);
await ctx.services.store.set(`draft:${key}`, bigObject, "10m");
Publish.build({ key });
```

### `DJSBOT_E021`

**`Invalid customId payload`** : la charge utile du composant n'a pas pu être
décodée. Elle a peut-être été produite par une version incompatible.

Levée quand un utilisateur clique sur un composant dont le customId a le bon
`id` mais une section de paramètres illisible. Cela arrive avec d'anciens
messages dont les composants ont été construits par un autre code, ou avec un
customId écrit à la main. Construisez toujours les composants avec `.build()`.

L'erreur est traitée comme celle d'un gestionnaire qui échoue, bien que `run` ne
soit jamais appelé. Elle est journalisée sous `Interaction handler failed` avec le
`correlationId`, les hooks `onError` des plugins et `onError` sont appelés avec le
`ctx`, elle est comptée dans `stats().errors`, et l'utilisateur reçoit le message
d'erreur. La solution est d'envoyer un message neuf, et `onError` peut le dire :

```ts
async onError(error, ctx) {
  if (ctx && isBotError(error) && error.code === "DJSBOT_E021") {
    await ctx.reply.error("This message is out of date. Run the command again.");
    return true; // géré : pas de message par défaut
  }
}
```

### `DJSBOT_E030`

**`Service resolution failed`** : des services dépendent les uns des autres en
boucle. Vérifiez les tableaux `deps` et cassez la boucle.

Levée au démarrage quand des services dépendent les uns des autres en cercle. Le
détail affiche la chaîne (`dependency cycle: a -> b -> a`) et `error.meta.chain`
la contient sous forme de tableau. Brisez le cycle en déplaçant la partie
commune dans un troisième service dont les deux dépendent.

Une dépendance qui n'existe pas du tout lève plutôt
[`DJSBOT_E031`](#djsbot_e031).

### `DJSBOT_E031`

**`Unknown service`** : un service qui n'a jamais été enregistré a été demandé.
Vérifiez le token, et les tableaux `deps` qui le nomment. Sur l'erreur
elle-même, la piste donne à la place la liste des services enregistrés.

Levée au démarrage quand un tableau `deps` nomme un token que personne n'a
enregistré, et à l'exécution quand un gestionnaire lit un `ctx.services.something`
qui n'existe pas. Cherchez une faute de frappe en comparant avec la liste de la
piste de résolution, et vérifiez que le fichier du `defineService` se trouve dans
votre dossier de features avec le suffixe `.service`. `npx djs-bot explain` liste
tous les tokens enregistrés.

### `DJSBOT_E040`

**`Feature contract not satisfied`** : une feature ou un plugin exige par
`requires` une capacité que rien ne fournit par `provides`.

Une feature ou un plugin liste une capacité dans `requires` et rien ne l'offre.
Une capacité est offerte par un service enregistré sous ce nom, par le
`provides` d'un plugin ou d'une feature, ou par la configuration :
`defineBot({ store })` satisfait `requires: ["store"]`, et il en va de même pour
`audit` et `flags`. Enregistrez ce qui manque, ou retirez l'exigence.

### `DJSBOT_E041`

**`Capability conflict`** : un plugin déclare dans `conflicts` une capacité que
quelque chose d'autre fournit. Chargez l'un ou l'autre.

Un plugin liste une capacité dans `conflicts`, et un service, un plugin ou une
feature fournit cette capacité. Le détail nomme le plugin et la capacité.
Retirez l'un des deux, ou renommez ce que l'autre fournit.

### `DJSBOT_E050`

**`Invalid option value`** : une option de commande a échoué à la validation à
l'exécution, à la frontière avec Discord.

Réservé. La version actuelle ne le lève jamais : Discord vérifie lui-même les
choix, les plages et les longueurs avant d'envoyer l'interaction au bot. Le code
reste dans le catalogue pour que son lien continue de fonctionner.

### `DJSBOT_E060`

**`Loader error`** : un fichier découvert n'a pas pu être importé, ou
n'exportait aucune définition valide.

Levée pendant le chargement du dossier de features. Le détail nomme le fichier.

- **Le fichier n'a pas pu être importé.** Le détail se termine par le message de
  la vraie erreur, et `error.cause` est cette erreur. C'est souvent une erreur de
  syntaxe ou un mauvais import, et c'est aussi ainsi qu'une erreur de définition
  remonte : un fichier dont le `defineCommand` lève
  [`DJSBOT_E012`](#djsbot_e012) est signalé sous `DJSBOT_E060`, avec le message
  `Loader error: failed to import <file>: Invalid command or option name: ...`.
- **Le fichier n'exporte aucune définition.** Son nom porte un suffixe reconnu,
  mais rien de ce qu'il exporte n'est le résultat d'un appel `define*()`. Exportez
  la définition, ou renommez le fichier s'il s'agit d'un utilitaire.
- **Un ancien build traîne à côté des sources.** Supprimez `dist/` et
  recompilez.

Pour voir l'erreur sous-jacente avec sa pile complète, importez le fichier
directement dans un script jetable. Voir [Structure du projet](/basics/project-layout/)
pour les suffixes que le chargeur reconnaît.

### `DJSBOT_E070`

**`Privileged intent required`** : un événement a besoin d'un intent privilégié.
Activez-le dans le Developer Portal, ou définissez `intents: "auto"`.

Réservé. La version actuelle ne le lève jamais. Quand la sélection automatique
des intents en inclut un privilégié, le framework journalise un avertissement au
chargement, et `djs-bot doctor` et `djs-bot explain` listent les intents
concernés. Si l'un d'eux n'est pas activé dans le Developer Portal, c'est la
connexion elle-même qui échoue, avec l'erreur discord.js `DisallowedIntents`.

Activez l'intent sous **Bot**, **Privileged Gateway Intents** :

| Intent | Nécessaire pour |
| --- | --- |
| `GuildMembers` | Les événements de membres comme `guildMemberAdd` et `guildMemberRemove`, la mise en cache des membres |
| `MessageContent` | Lire le texte des messages : les écouteurs `messageCreate` et tout `defineTrigger` |
| `GuildPresences` | `presenceUpdate` |

Une application de moins de 10 000 utilisateurs peut les activer librement. À
partir de 10 000 utilisateurs, Discord exige une demande pour chaque intent
privilégié, et l'accès doit être reconfirmé chaque année.

Si un écouteur n'a pas besoin de l'intent (un gestionnaire `messageCreate` qui ne
réagit qu'aux mentions, par exemple), retirez-le :

```ts
intents: { remove: [GatewayIntentBits.MessageContent] }
```

Voir [Événements et intents](/events/events-and-intents/).

### `DJSBOT_E080`

**`Invalid job schedule`** : utilisez une durée (`"30s"`, `"5m"`, `"1h"`), une
expression cron à 5 champs (`"0 3 * * *"`) ou une macro (`"@daily"`).

Levée par `defineJob`, au démarrage et non quand la tâche était due. Le détail
nomme la tâche et sa planification, et `error.cause` dit quelle partie est
fausse (`"61" is not a valid minute (expected 0-59)`). Un `timezone` qui n'est pas
un fuseau IANA connu la lève aussi, avec le détail `unknown timezone "X"`. Voir
[Tâches planifiées](/events/jobs/).

## Voir aussi

- [L'objet ctx](/basics/context/) pour `ctx.reply.error()` et le reste de l'API de réponse.
- [Formulations et thème](/basics/wording-and-theme/) pour reformuler le message d'erreur par défaut.
- [Plugins et hooks](/architecture/plugins/) pour `errorReporter` et les autres hooks.
- [Journalisation](/production/logging/) pour le logger et le `correlationId`.
- [CLI](/api/cli/) pour `doctor` et `explain`, qui attrapent la plupart des erreurs de démarrage avant que vous ne lanciez.
