---
title: "Pagination et confirmation"
description: "paginate() envoie un message de plusieurs pages avec ses propres boutons de navigation, et confirm() pose une question oui ou non et se résout en booléen. Les deux gèrent leurs boutons eux-mêmes : rien à définir, rien à enregistrer."
sidebar:
  order: 5
---

Les deux helpers prennent le `ctx` de n'importe quel gestionnaire d'interaction
(une commande, un menu contextuel, un bouton, un menu de sélection ou une
modale), envoient un message, et écoutent les clics sur ce message avec un
collecteur privé.

## Un premier message paginé

```ts title="features/levels/leaderboard.command.ts"
import { defineCommand, paginate, EmbedBuilder } from "@ix-xs/djs-bot";

const players = Array.from({ length: 45 }, (_, i) => `Player ${i + 1}`);

export default defineCommand({
  name: "leaderboard",
  description: "Top players",
  run: async (ctx) => {
    const pages: EmbedBuilder[] = [];
    for (let i = 0; i < players.length; i += 10) {
      pages.push(
        new EmbedBuilder()
          .setTitle(`Leaderboard - page ${pages.length + 1}`)
          .setDescription(players.slice(i, i + 10).join("\n")),
      );
    }
    await paginate(ctx, { pages, timeout: "5m" });
  },
});
```

Le message affiche la première page et une rangée de cinq boutons : premier,
précédent, un compteur `1 / 5`, suivant et dernier. Chaque clic modifie le
message sur place. Quand le délai expire, les boutons sont désactivés et le
message reste lisible.

`paginate` se résout dès que la première page est envoyée, pas quand
l'utilisateur a fini de naviguer. Avec une seule page, il envoie le message sans
aucun bouton.

## Pages paresseuses

Construire toutes les pages à l'avance est du gaspillage quand chacune demande
une requête. Passez plutôt une fonction et le nombre de pages :

```ts
await paginate(ctx, {
  count: totalPages,
  pages: async (index) => buildEmbed(await fetchPage(index)),
  timeout: "2m",
});
```

La fonction reçoit l'index de la page, à partir de `0`, et peut être asynchrone.
Elle est appelée à chaque affichage d'une page, y compris quand l'utilisateur
revient sur une page et une fois de plus quand les contrôles sont désactivés :
mettez le résultat en cache vous-même s'il est coûteux. `count` est obligatoire
sous cette forme.

## Messages complets et V2

Une page ne se limite pas à un embed. Ce peut être un message complet, et c'est
ainsi que l'on pagine des mises en page [Components V2](/components/components-v2/).
La rangée de navigation est ajoutée pour vous aux `components` de la page.

```ts title="features/shop/catalogue.command.ts"
import { defineCommand, paginate, ui, MessageFlags } from "@ix-xs/djs-bot";

const cards = [
  { title: "Sword", image: "https://example.com/sword.png" },
  { title: "Shield", image: "https://example.com/shield.png" },
];

export default defineCommand({
  name: "catalogue",
  description: "Browse the shop",
  run: (ctx) =>
    paginate(ctx, {
      pages: cards.map((card) => ({
        flags: MessageFlags.IsComponentsV2,
        components: [ui.container(ui.text(`# ${card.title}`), ui.gallery(card.image))],
      })),
      timeout: "5m",
    }),
});
```

Une page est soit un `EmbedBuilder`, soit un objet avec `content`, `embeds`,
`components`, `files` et `flags`. Gardez toutes les pages d'un même message dans
le même format : un message envoyé avec `IsComponentsV2` ne peut pas revenir à
`content` ou `embeds`. Une page classique avec ses propres rangées peut en avoir
quatre au plus, car la navigation prend la cinquième.

## Contrôles et public

Par défaut, seul l'utilisateur qui a lancé la commande peut tourner les pages, et
le message est public. Les options changent qui le voit, qui le pilote et quels
boutons il a :

```ts
await paginate(ctx, {
  pages,
  startPage: 2,                              // ouvrir sur la troisième page
  ephemeral: true,                           // seul l'invocateur voit le message
  allowedUsers: [ctx.user.id, moderatorId],  // qui peut cliquer
  showFirstLast: false,                      // précédent et suivant uniquement
  showCounter: false,                        // pas de bouton "3 / 5"
});
```

Un clic d'une personne absente de `allowedUsers` n'est pas traité, et cette
personne voit le message « This interaction failed » de Discord.

:::note[Pourquoi les boutons n'atteignent jamais vos gestionnaires]
Les contrôles portent un préfixe aléatoire que seul cet appel connaît, et le
routeur du framework ignore tout customId pour lequel il n'a pas de définition.
Un bouton de pagination ou de confirmation n'est donc jamais intercepté par vos
propres boutons, et jamais traité deux fois.
:::

## Demander une confirmation

`confirm` affiche une question avec deux boutons et se résout en `true` ou
`false`.

```ts title="features/admin/wipe.command.ts"
import { defineCommand, confirm } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "wipe",
  description: "Delete all data",
  run: async (ctx) => {
    const yes = await confirm(ctx, {
      content: "⚠️ Delete everything?",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });
    if (!yes) {
      await ctx.reply.info("Cancelled.", { ephemeral: true });
      return;
    }
    await ctx.services.store.clear();
    await ctx.reply.success("Done.", { ephemeral: true });
  },
});
```

Il renvoie `false` à l'annulation et aussi à l'expiration du délai : ne rien
faire est donc la voie sûre. Seul l'utilisateur qui a déclenché l'interaction
peut répondre. Une fois qu'il l'a fait, ou une fois le temps écoulé, les deux
boutons sont désactivés.

La question est éphémère sauf si vous passez `ephemeral: false`. Elle est
envoyée avec `ctx.reply`, donc l'interaction a reçu sa réponse quand `confirm`
revient, et le `ctx.reply` suivant est un message de suivi.

Sans `confirmLabel` ni `cancelLabel`, les boutons utilisent les messages
`confirm` et `cancel` du framework (« Confirm » et « Cancel »), que vous pouvez
reformuler ou traduire une seule fois pour tout le bot. Voir
[Formulations et thème](/basics/wording-and-theme/).

## Référence

### `paginate(ctx, options)`

Renvoie une `Promise<void>` qui se résout une fois la première page envoyée.
`options` est un `PaginateOptions` :

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `pages` | `Page[] \| (index: number) => Page \| Promise<Page>` | requis | Les pages : un tableau, ou un constructeur appelé avec l'index de la page. |
| `count` | `number` | - | Nombre total de pages. Obligatoire quand `pages` est une fonction. |
| `startPage` | `number` | `0` | Page sur laquelle ouvrir. Ramenée dans la plage si elle en sort. |
| `timeout` | `string \| number` | `"2m"` | Durée pendant laquelle les contrôles restent actifs : une durée comme `"5m"`, ou des millisecondes. |
| `ephemeral` | `boolean` | `false` | Envoie un message que seul l'invocateur voit. |
| `showFirstLast` | `boolean` | `true` | Affiche les boutons premier et dernier. |
| `showCounter` | `boolean` | `true` | Affiche le bouton compteur `page / total`. |
| `allowedUsers` | `string[]` | l'utilisateur qui invoque | Identifiants des utilisateurs qui peuvent se servir des contrôles. |

### `Page`

`EmbedBuilder | PagePayload`. Un `EmbedBuilder` est envoyé comme
`embeds: [page]`. Un `PagePayload` est :

| Propriété | Type | Description |
| --- | --- | --- |
| `content` | `string` | Le texte du message. |
| `embeds` | embeds | Comme dans n'importe quel message. |
| `components` | rangées ou builders V2 | La rangée de navigation est ajoutée après eux. |
| `files` | pièces jointes | Comme dans n'importe quel message. |
| `flags` | `number` | Drapeaux du message, par exemple `MessageFlags.IsComponentsV2`. |

### `confirm(ctx, options?)`

Renvoie une `Promise<boolean>` : `true` si l'utilisateur a confirmé, `false`
s'il a annulé ou n'a pas répondu à temps. `options` est un `ConfirmOptions`, et
chaque champ est facultatif :

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `content` | `string` | - | La question. |
| `embed` | `EmbedBuilder` | - | Un embed à afficher à la place du texte, ou avec lui. |
| `confirmLabel` | `string` | le message `confirm`, `"Confirm"` | Libellé du bouton vert de confirmation. |
| `cancelLabel` | `string` | le message `cancel`, `"Cancel"` | Libellé du bouton rouge d'annulation. |
| `timeout` | `string \| number` | `"1m"` | Durée d'attente : une durée comme `"30s"`, ou des millisecondes. |
| `ephemeral` | `boolean` | `true` | Seul l'invocateur voit la question. |

## Limites et erreurs

- **Au moins une page.** `paginate` lève `paginate() needs at least one page.`
  pour un tableau vide, et pour une fonction sans `count`.
- **Ils fonctionnent après une première réponse.** Quand l'interaction a déjà
  reçu une réponse, le message de l'un ou l'autre helper part comme message de
  suivi et ses boutons écoutent ce message de suivi. Un `confirm` suivi d'un
  `paginate` dans un même gestionnaire fonctionne, tout comme un différé placé
  avant eux.
- **Le collecteur vit en mémoire.** Après un redémarrage, ou une fois le délai
  écoulé, les boutons d'un ancien message ne font rien. Pour des contrôles qui
  doivent survivre à un redémarrage, écrivez les vôtres avec
  [`defineButton`](/components/buttons/) et un numéro de page dans ses
  paramètres.
- **Ils ont besoin d'une interaction.** Les événements, les déclencheurs et les
  tâches planifiées n'ont pas de `ctx` avec lequel répondre, donc aucun des deux
  helpers n'y fonctionne.

## Voir aussi

- [Boutons](/components/buttons/) pour une navigation qui survit à un redémarrage
- [Components V2](/components/components-v2/) pour les mises en page qu'une page peut contenir
- [Embeds et pièces jointes](/messages/embeds-and-attachments/) pour construire les embeds
- [Formulations et thème](/basics/wording-and-theme/) pour les libellés de boutons par défaut
- [L'objet ctx](/basics/context/) pour le comportement de `ctx.reply` une fois l'interaction répondue
