---
title: "Déclencheurs de messages"
description: "Un déclencheur répond aux messages ordinaires qui correspondent à un mot-clé, à une expression régulière ou à un test de votre cru. Utilisez-le pour des réponses automatiques, sans écrire d'écouteur messageCreate ni de table de délais de récupération."
sidebar:
  order: 2
---

Un déclencheur est une petite réponse automatique : quand un nouveau message
correspond à son motif, son gestionnaire s'exécute. Le framework s'occupe de
l'écoute, de la correspondance, du délai de récupération (*cooldown*) par auteur
et de la gestion des erreurs.

## Un premier déclencheur

```ts title="src/features/fun/ping.trigger.ts"
import { defineTrigger } from "@ix-xs/djs-bot";

export default defineTrigger({
  name: "ping-pong",
  pattern: "ping",
  cooldown: "5s",
  run: (ctx) => ctx.reply("pong 🏓"),
});
```

Tout message qui contient « ping », quelle que soit la casse, reçoit une
réponse. Le même auteur n'obtient au plus qu'une réponse toutes les cinq
secondes. Le chargeur prend en compte tout fichier dont le nom se termine par
`.trigger` (voir [Structure du projet](/basics/project-layout/)).

:::caution[Intent privilégié]
Enregistrer un déclencheur fait demander `MessageContent` au bot, qui est un
intent privilégié. Activez-le dans le Developer Portal, sous **Bot > Privileged
Gateway Intents**, sinon le bot ne peut pas se connecter. Voir
[Événements et intents](/events/events-and-intents/#privileged-intents).
:::

## Correspondre à un mot-clé

Un motif de type chaîne est comparé au texte du message. `mode` choisit comment,
et `caseInsensitive` (activé par défaut) ignore la casse.

```ts title="src/features/fun/keywords.trigger.ts"
import { defineTrigger } from "@ix-xs/djs-bot";

// Le message entier doit être "hello", quelle que soit la casse
export const hello = defineTrigger({
  name: "hello",
  pattern: "hello",
  mode: "equals",
  run: (ctx) => ctx.reply("Hello."),
});

// Une ancienne commande à préfixe
export const legacyHelp = defineTrigger({
  name: "legacy-help",
  pattern: "!help",
  mode: "startsWith",
  run: (ctx) => ctx.reply("Commands are slash commands now. Type / to see them."),
});

// Casse exacte uniquement
export const urgent = defineTrigger({
  name: "urgent",
  pattern: "URGENT",
  caseInsensitive: false,
  run: (ctx) => ctx.send("A moderator has been notified."),
});
```

| `mode` | Correspond quand le message |
| --- | --- |
| `"includes"` (par défaut) | contient le motif n'importe où |
| `"equals"` | est exactement le motif |
| `"startsWith"` | commence par le motif |
| `"endsWith"` | se termine par le motif |

Un motif de type chaîne ne sait rien des mots : avec `"includes"`, `"ping"`
correspond aussi à « shipping ». Pour correspondre à un mot entier, utilisez une
expression régulière comme `/\bping\b/i`.

## Expressions régulières et prédicats

Une `RegExp` vous donne des limites de mots, des alternatives et des groupes de
capture. Le résultat de la correspondance est disponible dans `ctx.match`. Une
fonction vous donne un contrôle total : elle reçoit le `Message` de discord.js et
renvoie `true` pour exécuter le déclencheur.

```ts title="src/features/fun/smart.trigger.ts"
import { defineTrigger } from "@ix-xs/djs-bot";

// RegExp : les groupes de capture sont dans ctx.match
export const greet = defineTrigger({
  name: "greet",
  pattern: /\bgood (morning|night)\b/i,
  run: (ctx) =>
    ctx.reply(ctx.match?.[1]?.toLowerCase() === "morning" ? "☀️ Morning." : "🌙 Night."),
});

// Prédicat : tout ce que vous pouvez lire sur le message
export const wallOfText = defineTrigger({
  name: "wall-of-text",
  pattern: (message) => message.content.length > 500,
  run: (ctx) => ctx.reply("That is a lot of text. A thread may be easier to read."),
});
```

Trois choses à savoir :

- `mode` et `caseInsensitive` ne s'appliquent qu'aux motifs de type chaîne. Une
  `RegExp` utilise ses propres drapeaux (`i` pour la casse).
- `ctx.match` vaut `null` pour un motif de type chaîne et pour un prédicat.
- Le drapeau `g` ne change rien : `ctx.match` reste la première correspondance,
  avec ses groupes de capture.

Un prédicat s'exécute pour chaque message que le bot voit : gardez-le léger. Il
doit répondre de façon synchrone : une promesse compte toujours comme une
correspondance.

## Répondre ou envoyer

Le gestionnaire reçoit un `ctx` construit autour du message :

- `ctx.reply(content)` répond au message déclencheur ;
- `ctx.send(content)` publie un nouveau message dans le même salon.

Les deux acceptent une chaîne ou un objet d'options discord.js, et se résolvent
avec le message qui a été envoyé.

```ts title="src/features/support/invite.trigger.ts"
import { defineTrigger } from "@ix-xs/djs-bot";

export default defineTrigger({
  name: "faq-invite",
  pattern: /\bhow do i invite\b/i,
  cooldown: "1m",
  run: async (ctx) => {
    if (!ctx.guild) return; // ignorer les messages privés
    await ctx.reply({
      content: "Use the **Add App** button on my profile.",
      allowedMentions: { repliedUser: false }, // répondre sans mentionner l'auteur
    });
    ctx.logger.info({ authorId: ctx.author.id }, "faq answered");
  },
});
```

Les déclencheurs reçoivent aussi les messages privés. Dans ce cas, `ctx.guild` et
`ctx.member` valent `null` : testez donc d'abord `ctx.guild` quand un
déclencheur n'a de sens que sur un serveur.

Un déclencheur n'est pas une interaction. `ctx.reply` est ici une simple
fonction : elle n'a pas de variante `ctx.reply.success` ni `ctx.reply.error`,
rien n'est éphémère, et les gardes, les middlewares des plugins et le différé
automatique ne s'appliquent pas.

## Délais de récupération et bots

`cooldown` est compté par auteur et par déclencheur. Il accepte une chaîne de
durée (`"5s"`, `"1m"`) ou un nombre de millisecondes. Il démarre quand le
déclencheur correspond, et un message correspondant qui arrive pendant le délai
est ignoré sans réponse.

Les messages écrits par des bots, y compris votre propre bot, sont ignorés par
défaut. Passez `ignoreBots: false` pour leur répondre aussi.

:::caution[Boucles]
Avec `ignoreBots: false`, le bot voit aussi ses propres réponses. Si une réponse
correspond au motif, le déclencheur se répond à lui-même. Comparez
`ctx.author.id` à `ctx.client.user.id` dans le gestionnaire, ou donnez-lui un
délai de récupération.
:::

## Référence

### `defineTrigger(input)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | Un nom unique, utilisé dans les journaux et par `djs-bot explain`. |
| `pattern` | `string \| RegExp \| (message) => boolean` | - | Ce à quoi correspondre : un mot-clé, une expression régulière, ou un prédicat sur le `Message`. |
| `mode` | `"includes" \| "equals" \| "startsWith" \| "endsWith"` | `"includes"` | Comment un motif de type chaîne est comparé au contenu. |
| `caseInsensitive` | `boolean` | `true` | Ignore la casse d'un motif de type chaîne. |
| `ignoreBots` | `boolean` | `true` | Ignore les messages envoyés par des bots, y compris celui-ci. |
| `cooldown` | `string \| number` | aucun | Délai minimal entre deux exécutions pour le même auteur : une durée (`"5s"`) ou des millisecondes. Une chaîne qui n'est pas une durée signifie aucun délai de récupération. |
| `run` | `(ctx: TriggerContext) => unknown` | - | Le gestionnaire. Peut être asynchrone. |

Renvoie un `TriggerDefinition` (`kind: "trigger"`), à exporter depuis un fichier
`.trigger` ou à lister dans une [feature](/architecture/features/). Les types de
motifs sont exportés sous les noms `TriggerPattern` et `TriggerMode`.

### `TriggerContext`

| Propriété | Type | Description |
| --- | --- | --- |
| `message` | `Message` | Le message qui correspond. |
| `client` | `Client<true>` | Le client connecté. |
| `author` | `User` | Qui a envoyé le message. |
| `member` | `GuildMember \| null` | L'auteur en tant que membre du serveur. `null` en message privé ou quand il n'est pas en cache. |
| `guild` | `Guild \| null` | Le serveur dans lequel le message a été envoyé. `null` en message privé. |
| `channel` | `Message["channel"]` | Le salon dans lequel le message a été envoyé. |
| `services` | `ServiceMap` | Vos [services](/architecture/services/), typés. |
| `logger` | `Logger` | Un logger étiqueté avec le nom du déclencheur et le `correlationId` de cette exécution. |
| `correlationId` | `string` | Un identifiant unique pour cette exécution. Chaque ligne journalisée via `logger` le porte. |
| `match` | `RegExpMatchArray \| null` | Le résultat de la correspondance quand le motif est une `RegExp`, sinon `null`. |
| `reply(content)` | `(content: string \| MessageReplyOptions) => Promise<Message>` | Répond au message déclencheur. |
| `send(content)` | `(content: string \| MessageCreateOptions) => Promise<Message>` | Envoie un nouveau message dans le même salon. |

## Limites et erreurs

- **Intents.** Avec les intents automatiques, enregistrer au moins un
  déclencheur demande `GuildMessages`, `MessageContent` (privilégié) et
  `DirectMessages`, et active les partials `Channel` et `Message`. Si vous
  passez un tableau `intents`, rien n'est ajouté : listez-les vous-même. Les
  détails sont dans [Événements et intents](/events/events-and-intents/).
- **Nouveaux messages uniquement.** Les déclencheurs s'exécutent sur
  `messageCreate`. Un message modifié n'est pas testé à nouveau.
- **Chaque déclencheur est testé sur chaque message.** Quand plusieurs
  correspondent au même message, ils s'exécutent tous, l'un après l'autre, dans
  l'ordre où ils ont été enregistrés.
- **Un contenu vide ne correspond jamais à un mot-clé.** Un message qui ne
  contient qu'une pièce jointe ou un sticker n'a pas de texte. Utilisez un
  prédicat pour ceux-là.
- **Un gestionnaire qui lève une erreur n'arrête pas le bot.** L'erreur est
  journalisée avec le nom du déclencheur, puis transmise à chaque hook `onError`
  des plugins et au `onError` de `defineBot`, sans `ctx`. Les autres
  déclencheurs s'exécutent quand même. Voir [Erreurs](/api/errors/).
- **Les délais de récupération vivent en mémoire.** Ils sont réinitialisés au
  redémarrage du bot, et sur un bot shardé chaque shard garde les siens.

## Voir aussi

- [Événements et intents](/events/events-and-intents/) : écouter `messageCreate` vous-même, et gérer les intents.
- [Commandes slash](/commands/slash-commands/) : le meilleur choix quand l'utilisateur demande quelque chose volontairement.
- [Mentions, horodatages et pings sûrs](/messages/formatting/) : contrôler qui une réponse mentionne.
- [Embeds et pièces jointes](/messages/embeds-and-attachments/) : envoyer plus que du texte.
- [Tâches planifiées](/events/jobs/) : agir selon une planification plutôt que sur un message.
