---
title: "Événements et intents"
description: "Écoutez tout ce que Discord envoie par la passerelle avec defineEvent. Le framework lit vos écouteurs et demande les intents et les partials de la passerelle dont ils ont besoin : un événement ne reste jamais silencieux parce qu'un intent a été oublié."
sidebar:
  order: 1
---

Les commandes slash, les boutons et les modales arrivent à votre bot sous forme
d'interactions, et le framework les route pour vous. Tout le reste (un membre qui
arrive, une réaction, un changement dans un salon vocal) arrive sous forme
d'événement de la passerelle (*gateway*). `defineEvent` enregistre un écouteur
pour l'un d'eux.

## Un premier événement

```ts title="src/features/welcome/welcome.event.ts"
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("guildMemberAdd", async (member, ctx) => {
  ctx.logger.info({ id: member.id }, "member joined");
  const channel = member.guild.systemChannel;
  if (channel) await channel.send(`Welcome ${member}.`);
});
```

Le premier argument est un nom d'événement discord.js. Il est typé : l'éditeur
complète le nom et connaît le type de chaque argument du gestionnaire.

Le gestionnaire reçoit les arguments propres à l'événement, dans l'ordre où
discord.js les donne, puis un `ctx` en **dernier** argument. `ctx` contient le
`client` connecté, vos `services` et un `logger` étiqueté avec le nom de
l'événement. Il n'y a pas de `ctx.reply` ici : un événement n'est pas une
interaction, donc vous répondez avec les objets que l'événement vous fournit
(`channel.send`, `member.send`...).

Comme `ctx` vient après tous les arguments de l'événement, listez-les tous,
même ceux que vous n'utilisez pas. En sauter un décale `ctx` à sa place :

```ts
defineEvent("voiceStateUpdate", (oldState, newState, ctx) => {
  /* ... */
});

// messageReactionAdd a trois arguments qui lui sont propres
defineEvent("messageReactionAdd", (reaction, user, _details, ctx) => {
  /* ... */
});
```

Le chargeur prend en compte tout fichier dont le nom se termine par `.event`
(voir [Structure du projet](/basics/project-layout/)). Plusieurs écouteurs
peuvent être enregistrés pour le même événement : ils s'exécutent tous.

## Exécuter un écouteur une seule fois

Passez `{ once: true }` en troisième argument. L'écouteur est retiré après son
premier appel.

```ts title="src/features/core/boot.event.ts"
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent(
  "clientReady",
  (client, ctx) => {
    ctx.logger.info({ tag: client.user.tag }, "online");
  },
  { once: true },
);
```

:::note
discord.js a renommé l'événement `ready` en `clientReady`. L'ancien nom
fonctionne encore en v14, mais affiche un avertissement de dépréciation.
:::

## Comment les intents sont choisis

Un intent est un abonnement. Quand le bot se connecte, il indique à Discord
quels groupes d'événements il veut, et Discord n'envoie que ceux-là. En oublier
un est la raison classique du « mon événement ne se déclenche jamais ».

Avec `intents: "auto"`, qui est la valeur par défaut, vous n'écrivez jamais cette
liste. Le framework la déduit des événements et des
[déclencheurs](/events/triggers/) que vous avez enregistrés :

| Vous écoutez | Intent demandé |
| --- | --- |
| `guildMemberAdd`, `guildMemberRemove` | `GuildMembers` (privilégié) |
| `messageCreate` | `GuildMessages` et `MessageContent` (privilégié) |
| `messageReactionAdd` | `GuildMessageReactions` |
| `voiceStateUpdate` | `GuildVoiceStates` |
| `presenceUpdate` | `GuildPresences` (privilégié) |

La liste complète se trouve dans la
[correspondance événement-intent](#event-to-intent-map). `Guilds` est toujours
inclus, afin que les interactions de serveur soient livrées et que `ctx.guild`
soit renseigné.

Il en va de même pour les **partials**. discord.js ignore un événement qui
concerne un objet absent de son cache, comme une réaction sur un message envoyé
avant le démarrage du bot, sauf si le partial correspondant est activé. Le
framework active les partials dont vos événements ont besoin (voir la
[correspondance événement-partial](#event-to-partial-map)). Un objet partiel ne
porte que son identifiant : récupérez-le (*fetch*) avant de lire quoi que ce
soit d'autre :

```ts title="src/features/stars/star.event.ts"
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("messageReactionAdd", async (reaction, user, _details, ctx) => {
  // Une réaction sur un message hors cache arrive sous forme de partial.
  if (reaction.partial) await reaction.fetch();
  if (reaction.emoji.name !== "⭐") return;
  ctx.logger.info({ messageId: reaction.message.id, userId: user.id }, "message starred");
});
```

Pour voir ce qui a été déduit sans vous connecter, lancez `npx djs-bot explain` :
la commande affiche les intents, les partials et les intents privilégiés
utilisés (voir [CLI](/api/cli/)).

## Ajuster la sélection

Le pilote automatique ne peut pas tout deviner. Gardez-le et corrigez son
résultat avec un objet : `add` pour ce qu'il ne suppose pas, `remove` pour ce
dont vous pouvez vous passer.

```ts title="src/index.ts"
import { defineBot, GatewayIntentBits } from "@ix-xs/djs-bot";

export default defineBot({
  intents: {
    add: [GatewayIntentBits.DirectMessages],     // recevoir aussi les messages privés
    remove: [GatewayIntentBits.MessageContent],  // ce bot ne réagit qu'aux mentions
  },
});
```

Deux cas reviennent souvent :

- **Messages privés.** Un écouteur `messageCreate` ne demande que les intents de
  serveur. Ajoutez `DirectMessages` pour recevoir aussi les messages privés. Le
  partial `Channel` dont ils ont besoin est alors activé pour vous.
- **`MessageContent`.** Un écouteur `messageCreate` le demande parce que la
  plupart des écouteurs lisent le texte. Sans lui, Discord envoie quand même
  l'événement, mais le contenu est vide, sauf si le message mentionne le bot ou
  est un message privé. Si cela vous suffit, retirez-le et évitez un intent
  privilégié.

`add` est appliqué en premier, puis `remove`.

Pour garder le contrôle total, passez un tableau. Il est utilisé exactement tel
que vous l'avez écrit :

```ts
intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
```

Les partials supplémentaires vont dans `partials`. En mode automatique, ils sont
fusionnés avec ceux qui sont déduits :

```ts title="src/index.ts"
import { defineBot, Partials } from "@ix-xs/djs-bot";

export default defineBot({
  partials: [Partials.User],
});
```

## Intents privilégiés

Trois intents donnent accès à des données sensibles, et Discord les garde
désactivés tant que vous ne les activez pas dans le Developer Portal, sous
**Bot > Privileged Gateway Intents** :

| Intent | Nécessaire pour |
| --- | --- |
| `GuildMembers` | Arrivées, départs et mises à jour de membres, `userUpdate` |
| `MessageContent` | Lire le texte des messages, donc chaque écouteur `messageCreate` et chaque déclencheur |
| `GuildPresences` | `presenceUpdate` |

Quand la liste déduite en contient un, le bot écrit un avertissement au
démarrage qui le nomme, et `npx djs-bot doctor` vous le rappelle aussi.

Une application de moins de 10 000 utilisateurs peut les activer librement. À
partir de 10 000 utilisateurs, Discord exige une demande pour chaque intent
privilégié, et l'accès doit être reconfirmé chaque année. C'est une bonne raison
de retirer celui que vous n'utilisez pas vraiment.

:::caution[L'interrupteur doit correspondre]
Si le bot demande un intent privilégié qui n'est pas activé dans le portail,
Discord refuse la connexion (`Used disallowed intents`). Activez-le, ou retirez-le
avec `intents: { remove: [...] }`.
:::

## Référence

### `defineEvent(event, run, options?)`

| Argument | Type | Défaut | Description |
| --- | --- | --- | --- |
| `event` | `keyof ClientEvents` | - | N'importe quel nom d'événement discord.js. |
| `run` | `(...args, ctx: EventContext) => unknown` | - | L'écouteur. Reçoit les arguments propres à l'événement, puis le contexte. Peut être asynchrone. |
| `options.once` | `boolean` | `false` | Ne s'exécute que pour la première occurrence. |

Renvoie un `EventDefinition` (`kind: "event"`, `event`, `once`, `run`), à
exporter depuis un fichier `.event` ou à lister dans une
[feature](/architecture/features/).

### `EventContext`

| Propriété | Type | Description |
| --- | --- | --- |
| `client` | `Client<true>` | Le client connecté. |
| `services` | `ServiceMap` | Vos [services](/architecture/services/), typés. |
| `logger` | `Logger` | Un logger étiqueté avec le nom de l'événement. |

### `intents`

Le champ `intents` de `defineBot`.

| Valeur | Effet |
| --- | --- |
| `"auto"` (par défaut) | Déduit les intents et les partials de vos événements et déclencheurs. `Guilds` est toujours inclus. Avertit quand un intent privilégié est utilisé. |
| `{ add?, remove? }` | Même déduction, puis ajustée. Voir `IntentAdjustments`. |
| `GatewayIntentBits[]` | Utilisé exactement tel quel. Rien n'est déduit ni ajouté, pas même `Guilds`, aucun partial n'est déduit et aucun avertissement n'est écrit. |

### `IntentAdjustments`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `add` | `GatewayIntentBits[]` | `[]` | Intents à demander en plus de ceux qui sont déduits, par exemple `DirectMessages`. |
| `remove` | `GatewayIntentBits[]` | `[]` | Intents déduits à retirer. Typiquement `MessageContent`, quand un écouteur `messageCreate` ne lit pas le texte. Appliqué après `add`. |

### `partials`

Le champ `partials` de `defineBot`.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `partials` | `Partials[]` | déduits | Partials supplémentaires. Fusionnés avec ceux qui sont déduits en mode automatique. Avec un tableau `intents`, ce sont les seuls partials activés. |

### Correspondance événement-intent

Tous les événements que connaît le pilote automatique, regroupés par l'intent
qu'ils demandent.

| Intent | Événements |
| --- | --- |
| `Guilds` | `guildCreate`, `guildDelete`, `guildUpdate`, `guildAvailable`, `guildUnavailable`, `channelCreate`, `channelDelete`, `channelUpdate`, `channelPinsUpdate`, `roleCreate`, `roleDelete`, `roleUpdate`, `threadCreate`, `threadDelete`, `threadUpdate`, `threadListSync`, `threadMemberUpdate`, `threadMembersUpdate`, `stageInstanceCreate`, `stageInstanceDelete`, `stageInstanceUpdate` |
| `GuildMembers` (privilégié) | `guildMemberAdd`, `guildMemberRemove`, `guildMemberUpdate`, `guildMemberAvailable`, `guildMembersChunk`, `userUpdate` |
| `GuildModeration` | `guildBanAdd`, `guildBanRemove`, `guildAuditLogEntryCreate` |
| `GuildExpressions` | `emojiCreate`, `emojiDelete`, `emojiUpdate`, `stickerCreate`, `stickerDelete`, `stickerUpdate`, `guildSoundboardSoundCreate`, `guildSoundboardSoundDelete`, `guildSoundboardSoundUpdate`, `guildSoundboardSoundsUpdate` |
| `GuildIntegrations` | `guildIntegrationsUpdate` |
| `GuildWebhooks` | `webhooksUpdate` |
| `GuildInvites` | `inviteCreate`, `inviteDelete` |
| `GuildVoiceStates` | `voiceStateUpdate`, `voiceChannelEffectSend` |
| `GuildPresences` (privilégié) | `presenceUpdate` |
| `GuildMessages` et `MessageContent` (privilégié) | `messageCreate` |
| `GuildMessages` | `messageUpdate`, `messageDelete`, `messageDeleteBulk` |
| `GuildMessageReactions` | `messageReactionAdd`, `messageReactionRemove`, `messageReactionRemoveAll`, `messageReactionRemoveEmoji` |
| `GuildMessagePolls` | `messagePollVoteAdd`, `messagePollVoteRemove` |
| `GuildMessageTyping` | `typingStart` |
| `GuildScheduledEvents` | `guildScheduledEventCreate`, `guildScheduledEventUpdate`, `guildScheduledEventDelete`, `guildScheduledEventUserAdd`, `guildScheduledEventUserRemove` |
| `AutoModerationConfiguration` | `autoModerationRuleCreate`, `autoModerationRuleDelete`, `autoModerationRuleUpdate` |
| `AutoModerationExecution` | `autoModerationActionExecution` |

Enregistrer au moins un [déclencheur](/events/triggers/) ajoute `GuildMessages`,
`MessageContent` et `DirectMessages`.

### Correspondance événement-partial

| Événements | Partials activés |
| --- | --- |
| `messageReactionAdd`, `messageReactionRemove`, `messageReactionRemoveEmoji` | `Message`, `Channel`, `Reaction` |
| `messageReactionRemoveAll`, `messagePollVoteAdd`, `messagePollVoteRemove` | `Message`, `Channel` |
| `messageDelete`, `messageUpdate` | `Message` |
| `guildMemberRemove` | `GuildMember` |
| `guildScheduledEventUserAdd`, `guildScheduledEventUserRemove` | `GuildScheduledEvent` |
| `typingStart` | `Channel` |

Deux règles de plus s'appliquent une fois les événements lus :

- enregistrer au moins un déclencheur active `Channel` et `Message` ;
- quand la liste finale contient `DirectMessages` ou `DirectMessageReactions`,
  `Channel` est activé, car un salon de messages privés n'est jamais mis en cache
  à l'avance.

### `computeIntents(events, options?)`

La fonction qui se cache derrière le pilote automatique, exportée pour que vous
puissiez vérifier un ensemble d'événements dans un script ou un test.

| Argument | Type | Défaut | Description |
| --- | --- | --- | --- |
| `events` | `EventDefinition[]` | - | Les écouteurs à analyser. |
| `options.hasTriggers` | `boolean` | `false` | Demande aussi ce dont les déclencheurs de messages ont besoin. |
| `options.add` | `GatewayIntentBits[]` | `[]` | Comme `IntentAdjustments`. |
| `options.remove` | `GatewayIntentBits[]` | `[]` | Comme `IntentAdjustments`. |

Elle renvoie un objet `ComputedIntents` :

| Propriété | Type | Description |
| --- | --- | --- |
| `intents` | `GatewayIntentBits[]` | Les intents avec lesquels se connecter. |
| `partials` | `Partials[]` | Les partials à activer. |
| `privileged` | `string[]` | Les noms des intents privilégiés présents dans la liste. |

```ts title="scripts/check-intents.ts"
import { computeIntents, defineEvent, GatewayIntentBits } from "@ix-xs/djs-bot";

const { intents, partials, privileged } = computeIntents(
  [defineEvent("guildMemberRemove", () => {})],
  { add: [GatewayIntentBits.DirectMessages] },
);

console.log(intents.map((intent) => GatewayIntentBits[intent]));
// ["Guilds", "GuildMembers", "DirectMessages"]
console.log(partials.length, privileged);
// 2 ["GuildMembers"]
```

## Limites et erreurs

- **Un écouteur qui lève une erreur n'arrête jamais le bot.** Qu'il lève une
  exception ou renvoie une promesse rejetée, l'erreur est journalisée avec le
  nom de l'événement, puis transmise à chaque hook `onError` des plugins et au
  `onError` de `defineBot`, sans `ctx`. Voir [Erreurs](/api/errors/).
- **Les événements absents de la correspondance n'ajoutent aucun intent.** La
  plupart n'en demandent aucun (`clientReady`, `interactionCreate`, `debug`...).
  Pour les autres, comme les événements de messages privés, utilisez
  `intents: { add: [...] }`.
- **Vous n'avez pas besoin d'un écouteur `interactionCreate`.** Le framework
  l'écoute lui-même pour router les commandes et les composants.
- **Un tableau `intents` désactive entièrement le pilote automatique.** Rien
  n'est ajouté pour les déclencheurs non plus : listez vous-même
  `GuildMessages`, `MessageContent` et les partials.
- Un intent privilégié demandé mais non activé fait échouer la connexion. La
  solution est décrite sous [`DJSBOT_E070`](/api/errors/#djsbot_e070).

## Voir aussi

- [Déclencheurs de messages](/events/triggers/) : répondre aux messages sans écrire d'écouteur `messageCreate`.
- [Tâches planifiées](/events/jobs/) : exécuter du code selon une planification plutôt que sur un événement.
- [Configuration](/basics/configuration/) : chaque champ de `defineBot`.
- [Cycle de vie](/basics/lifecycle/) : quand les intents sont calculés et les écouteurs attachés.
- [Tests](/production/testing/) : exercer les gestionnaires sans se connecter à Discord.
