---
title: "Components V2"
description: "Components V2 est le nouveau format de message de Discord : au lieu de content et d'embeds, un message est un arbre de conteneurs, de textes, de sections, de galeries et de rangées. Les helpers ui construisent cet arbre, ainsi que les rangées classiques et les sondages, en quelques appels courts."
sidebar:
  order: 4
---

Chaque helper `ui` renvoie un vrai builder de discord.js (`ContainerBuilder`,
`ActionRowBuilder`, `ButtonBuilder`, etc.). Tout ce que vous savez de ces classes
reste valable, et vous pouvez continuer à appeler leurs méthodes sur le
résultat.

## Un premier message V2

```ts title="features/profile/card.command.ts"
import { defineCommand, ui, MessageFlags } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "card",
  description: "Show your profile card",
  run: async (ctx) => {
    const card = ui.container(
      ui.text("# Profile card\nA **Components V2** message."),
      ui.separator({ divider: true, spacing: "large" }),
      ui.section({
        text: [`User: ${ctx.user}`, "Status: online"],
        accessory: ui.thumbnail(ctx.user.displayAvatarURL()),
      }),
    );

    await ctx.reply({ flags: MessageFlags.IsComponentsV2, components: [card] });
  },
});
```

Le message active ce format avec le drapeau `IsComponentsV2`, et tout son corps
va dans `components`.

:::caution[Règles du V2]
Un message qui utilise `IsComponentsV2` ne peut pas porter en plus `content` ni
`embeds`. Chaque morceau de texte doit être un `ui.text` ou un `ui.section`, et
un fichier envoyé doit être référencé sous la forme `attachment://filename`.
Envoyez-le avec un `ctx.reply({ ... })` brut : `ctx.reply.success`, `error`,
`info` et `warn` construisent un embed, ils ne peuvent donc pas produire un
message V2.
:::

## Blocs de mise en page

Un conteneur regroupe des composants d'affichage en un seul bloc visuel. À
l'intérieur, vous empilez du texte, des séparateurs, des sections, des galeries,
des fichiers et des rangées, dans l'ordre où ils doivent apparaître.

```ts title="features/tickets/summary.command.ts"
import { defineCommand, ui, AttachmentBuilder, Colors, MessageFlags } from "@ix-xs/djs-bot";
import { CloseTicket } from "./close.button.js";

export default defineCommand({
  name: "summary",
  description: "Show the ticket summary",
  run: async (ctx) => {
    const transcript = new AttachmentBuilder(Buffer.from("12:00 Hello\n12:01 Hi"), { name: "transcript.txt" });

    await ctx.reply({
      flags: MessageFlags.IsComponentsV2,
      files: [transcript],
      components: [
        ui.container(
          { accent: Colors.Blurple },
          ui.text(`## Ticket #42\nOpened by ${ctx.user}`),
          ui.separator(),
          ui.section({
            text: "Close this ticket when you are done.",
            accessory: CloseTicket.build({ ticketId: "42", ownerId: ctx.user.id }),
          }),
          ui.gallery("https://example.com/a.png", "https://example.com/b.png"),
          ui.file("attachment://transcript.txt"),
          ui.row(ui.linkButton("Docs", "https://example.com/docs", "📘")),
        ),
      ],
    });
  },
});
```

- **`ui.container`** prend ses enfants en arguments. Passez d'abord un objet
  d'options, `{ accent, spoiler }`, pour lui donner un bord gauche coloré ou pour
  le masquer derrière un spoiler.
- **`ui.text`** est un bloc de markdown, titres compris.
- **`ui.separator`** est un espace entre deux blocs, avec un trait sauf si vous
  passez `divider: false`.
- **`ui.section`** place du texte à gauche et un accessoire à droite : un
  `ui.thumbnail(url)` ou un bouton. `text` est un bloc de markdown, ou un tableau
  de trois au plus.
- **`ui.gallery`** affiche des images ou des vidéos à partir de leur URL. Elle
  accepte `attachment://name` pour un fichier envoyé avec le même message.
- **`ui.file`** affiche un fichier envoyé avec le même message.
- **`ui.row`** contient des boutons ou un menu de sélection, exactement comme dans
  un message classique.

`CloseTicket` est le bouton de [Boutons](/components/buttons/). L'envoi de
fichiers est traité dans [Embeds et pièces jointes](/messages/embeds-and-attachments/).

## Rangées et boutons de lien

`ui.row` n'est pas propre au V2. Tous les boutons et menus de sélection, dans
n'importe quel message, se trouvent dans une rangée :

```ts
const row = ui.row(
  CloseTicket.build({ ticketId: "42", ownerId: ctx.user.id }),
  ui.linkButton("Docs", "https://example.com/docs", "📘"),
);

await ctx.reply({ content: "Ticket #42", components: [row] });
```

Une rangée contient jusqu'à 5 boutons, ou 1 menu de sélection. Un message
contient jusqu'à 5 rangées.

Deux sortes de boutons n'ont ni gestionnaire ni customId, on les construit donc
ici et non avec `defineButton` :

- `ui.linkButton(label, url, emoji?)` ouvre une URL.
- `ui.premiumButton(skuId)` ouvre le parcours d'achat d'un des SKU de votre
  application. Discord fournit le libellé.

Les boutons qui exécutent votre code viennent de
[`defineButton`](/components/buttons/), et les menus de sélection de
[`defineSelectMenu`](/components/select-menus/) et de ses variantes natives.

## Sondages

`ui.poll` construit un sondage Discord natif. Un sondage n'est pas un composant :
il se place dans le champ `poll` d'un message.

```ts title="features/events/vote.command.ts"
import { defineCommand, ui } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "vote",
  description: "Vote for the next event",
  run: (ctx) =>
    ctx.reply({
      poll: ui.poll("Next event?", ["Game night", { text: "Movie", emoji: "🎬" }], { hours: 48 }),
    }),
});
```

Une réponse est une chaîne, ou `{ text, emoji? }`. Le sondage reste ouvert 24
heures sauf si vous passez `hours`, et accepte une réponse par personne sauf si
vous passez `multiple: true`.

Pour réagir aux votes, écoutez les événements `messagePollVoteAdd` et
`messagePollVoteRemove`. Avec `intents: "auto"`, l'intent `GuildMessagePolls` est
ajouté pour vous, voir [Événements et intents](/events/events-and-intents/).

## Référence

### `ui`

| Helper | Renvoie | Description |
| --- | --- | --- |
| `ui.row(...components)` | `ActionRowBuilder` | Une rangée de boutons, ou un seul menu de sélection. |
| `ui.linkButton(label, url, emoji?)` | `ButtonBuilder` | Un bouton qui ouvre une URL. Pas de gestionnaire, pas de customId. |
| `ui.premiumButton(skuId)` | `ButtonBuilder` | Un bouton qui ouvre le parcours d'achat d'un des SKU de votre application. Discord fournit le libellé, et aucun gestionnaire ne s'exécute de votre côté. |
| `ui.container(...children)` | `ContainerBuilder` | Regroupe des composants d'affichage en un seul bloc visuel. |
| `ui.container(options, ...children)` | `ContainerBuilder` | Pareil, avec une couleur d'accent ou derrière un spoiler. |
| `ui.text(content)` | `TextDisplayBuilder` | Un bloc de texte markdown. |
| `ui.separator(options?)` | `SeparatorBuilder` | Un espace, avec ou sans trait de séparation. |
| `ui.section(options)` | `SectionBuilder` | Du texte à gauche, une vignette ou un bouton à droite. |
| `ui.thumbnail(url, description?)` | `ThumbnailBuilder` | Une vignette en accessoire d'une section, avec une description facultative de l'image. |
| `ui.gallery(...urls)` | `MediaGalleryBuilder` | Une galerie d'images ou de vidéos. Accepte `attachment://name`. |
| `ui.file(attachmentUrl)` | `FileBuilder` | Un composant d'affichage de fichier. Prend une référence `attachment://name`. |
| `ui.poll(question, answers, options?)` | `PollData` | Un sondage natif, pour le champ `poll` d'un message. |

### `ui.container(options?, ...children)`

`options` est un `ContainerOptions`. Il est reconnu parce que c'est un objet
simple, alors que chaque enfant est un builder.

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `accent` | `number` | - | Couleur de la barre sur le bord gauche, par exemple `0x5865f2` ou `Colors.Blurple`. |
| `spoiler` | `boolean` | `false` | Masque tout le conteneur derrière un spoiler. |

Un enfant est un `ContainerChild` : le résultat de `ui.text`, `ui.separator`,
`ui.section`, `ui.gallery`, `ui.file` ou `ui.row`.

### `ui.separator(options?)`

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `divider` | `boolean` | `true` | Indique si un trait visible est dessiné. |
| `spacing` | `"small" \| "large"` | `"small"` | La quantité d'espace vide que prend le séparateur. |

### `ui.section(options)`

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `text` | `string \| string[]` | requis | Le texte à gauche : un bloc de markdown, ou trois au plus. |
| `accessory` | `ThumbnailBuilder \| ButtonBuilder` | requis | Ce qui se trouve à droite : `ui.thumbnail(url)` ou un bouton. |

### `ui.poll(question, answers, options?)`

`answers` est un tableau de chaînes ou d'objets `{ text: string; emoji?: string }`.
`options` est un `PollOptions` :

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `hours` | `number` | `24` | Durée pendant laquelle le sondage reste ouvert, de 1 à 768. |
| `multiple` | `boolean` | `false` | Permet de choisir plusieurs réponses. |

## Limites et erreurs

| Limite | Valeur |
| --- | --- |
| Rangées dans un message | 5 |
| Boutons dans une rangée | 5 |
| Menus de sélection dans une rangée | 1 |
| Blocs de texte dans une section | 3 |
| Durée d'un sondage | 1 à 768 heures |

Les helpers `ui` n'ajoutent aucune vérification. Un message qui enfreint une
règle, comme `content` à côté du drapeau `IsComponentsV2`, est rejeté à l'envoi,
et l'erreur atteint la [barrière d'erreurs](/api/errors/) comme n'importe quel
autre échec dans un gestionnaire.

## Voir aussi

- [Boutons](/components/buttons/) et [Menus de sélection](/components/select-menus/) pour les composants qu'une rangée contient
- [Pagination et confirmation](/components/pagination/), dont les pages peuvent être des messages V2
- [Embeds et pièces jointes](/messages/embeds-and-attachments/) pour le format classique et l'envoi de fichiers
- [Événements et intents](/events/events-and-intents/) pour les événements de vote des sondages
