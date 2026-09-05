---
title: "Composants UI - ui, paginate, confirm"
description: "Les constructeurs ui (rows, Components V2) et les helpers interactifs paginate/confirm."
sidebar:
  label: "Composants UI"
  order: 6
---

## `ui` - constructeurs de composants

Chaque fonction renvoie un **vrai builder discord.js** : tu gardes accès à toutes
ses méthodes.

| Fonction | Construit |
| --- | --- |
| `ui.row(...composants)` | Une action row (boutons ou un menu de sélection). |
| `ui.linkButton(label, url, emoji?)` | Un bouton lien (pas de handler). |
| `ui.container(...enfants)` | Un **conteneur Components V2**. |
| `ui.text(markdown)` | Un bloc de texte (V2). |
| `ui.separator({ divider?, spacing? })` | Un séparateur (`spacing`: `"small"` \| `"large"`). |
| `ui.section({ text, accessory })` | Texte à gauche + accessoire (miniature ou bouton) à droite. |
| `ui.thumbnail(url, description?)` | Une miniature, pour l'`accessory` d'une section. |
| `ui.gallery(...urls)` | Une galerie média (accepte `attachment://nom`). |
| `ui.file(attachmentUrl)` | Un composant fichier. |

Le type `ContainerChild` liste ce qu'un `ui.container` accepte : `ui.text`,
`ui.separator`, `ui.section`, `ui.gallery`, `ui.file`, et une action row.

### Components V2 - règle importante

> Un message Components V2 utilise `flags: MessageFlags.IsComponentsV2` et ne
> peut **pas** contenir `content` ni `embeds`. Utilise `ctx.reply({...})` brut,
> jamais `ctx.reply.success` (qui construit un embed).

```ts
import { ui, MessageFlags } from "@ix-xs/djs-bot";

const carte = ui.container(
  ui.text("# Profil\nUn message **Components V2**."),
  ui.separator({ divider: true, spacing: "large" }),
  ui.section({
    text: [`Utilisateur : ${ctx.user}`, "Statut : en ligne"],
    accessory: ui.thumbnail(ctx.user.displayAvatarURL()),
  }),
  ui.gallery("https://…/a.png", "https://…/b.png"),
  ui.row(ui.linkButton("Docs", "https://ix-xs.github.io/djs-bot/", "📖")),
);

await ctx.reply({ flags: MessageFlags.IsComponentsV2, components: [carte] });
```

## `paginate` - message paginé

`paginate` gère **ses propres boutons et son collecteur** : aucun composant à
enregistrer.

```ts
await paginate(ctx, { pages: [embed1, embed2, embed3], timeout: "5m" });
```

| Option | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `pages` | `Page[] \| (index) => Page` | requis | Les pages, ou un **constructeur paresseux** appelé avec l'index. |
| `count` | `number` | - | Nombre total de pages (**requis** si `pages` est une fonction). |
| `startPage` | `number` | `0` | Page de départ. |
| `timeout` | `string \| number` | `"2m"` | Durée pendant laquelle les contrôles restent actifs. |
| `ephemeral` | `boolean` | `false` | Envoie en message éphémère. |
| `showFirstLast` | `boolean` | `true` | Affiche les boutons ⏮ / ⏭. |
| `showCounter` | `boolean` | `true` | Affiche le compteur `page x / y`. |
| `allowedUsers` | `string[]` | l'appelant | Qui peut utiliser les contrôles. |

### Le type `Page`

Une page est **soit** un `EmbedBuilder`, **soit** une charge utile complète :

| Champ de `PagePayload` | Rôle |
| --- | --- |
| `content` | Texte du message. |
| `embeds` | Embeds. |
| `components` | Action rows **ou** composants V2. La barre de navigation est ajoutée automatiquement. |
| `files` | Pièces jointes. |
| `flags` | Drapeaux, ex. `MessageFlags.IsComponentsV2`. |

```ts
// Pagination d'un message Components V2
await paginate(ctx, {
  pages: cartes.map((c) => ({
    flags: MessageFlags.IsComponentsV2,
    components: [ui.container(ui.text(`# ${c.titre}`), ui.gallery(c.image))],
  })),
});

// Pages paresseuses (gros jeux de données)
await paginate(ctx, { count: 100, pages: (i) => construireEmbed(i), timeout: "2m" });
```

À l'expiration du délai, les contrôles sont **désactivés** automatiquement.

## `confirm` - dialogue oui/non

Affiche une confirmation et renvoie un **booléen** (`false` en cas d'expiration).

```ts
if (await confirm(ctx, { content: "⚠️ Tout supprimer ?", confirmLabel: "Supprimer", cancelLabel: "Garder" })) {
  await ctx.services.db.wipe();
}
```

| Option | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `content` | `string` | - | Le texte de la question. |
| `embed` | `EmbedBuilder` | - | Un embed à afficher à la place / en plus. |
| `confirmLabel` | `string` | `"Confirm"` | Libellé du bouton de confirmation. |
| `cancelLabel` | `string` | `"Cancel"` | Libellé du bouton d'annulation. |
| `timeout` | `string \| number` | `"1m"` | Délai d'attente. |
| `ephemeral` | `boolean` | `true` | Éphémère par défaut. |

Seul l'utilisateur qui a lancé l'interaction peut répondre. Les boutons sont
désactivés après le choix (ou l'expiration).
