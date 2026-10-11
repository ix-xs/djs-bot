---
title: "Différé automatique"
description: "Discord abandonne une interaction qui n'obtient pas de réponse en 3 secondes. L'option defer laisse le framework accuser réception à votre place pour les gestionnaires lents, et vous n'appelez plus ctx.reply.defer() à la main."
sidebar:
  order: 4
---

Une interaction doit recevoir une réponse, ou au moins un accusé de réception,
dans les 3 secondes. Passé ce délai, Discord affiche « L'application ne répond
pas » et la réponse que vous envoyez ensuite est rejetée. La solution habituelle
consiste à appeler `ctx.reply.defer()` en tête de chaque gestionnaire qui risque
d'être lent. Avec `defer`, c'est le framework qui s'en charge, et seulement
quand c'est nécessaire.

## L'activer

Une ligne dans le fichier d'entrée couvre tous les gestionnaires du bot :

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  defaults: { defer: true },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

Avec `true`, un gestionnaire qui n'a pas répondu au bout de 2 secondes est différé
en coulisses. La réponse qu'il envoie ensuite modifie cette réponse différée. Un
gestionnaire qui répond vite n'est jamais différé : rien ne change pour lui, et
activer l'option pour tout le bot ne coûte donc rien.

## Choisir par définition

Chaque définition peut fixer son propre `defer`, qui l'emporte sur la valeur par
défaut :

```ts title="src/features/reports/report.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "report",
  description: "Build a report",
  defer: "ephemeral",
  run: async (ctx) => {
    const report = await buildSlowReport();     // 8 secondes : aucun problème
    await ctx.reply.success(report.summary);    // modifie la réponse différée
  },
});
```

| Valeur | Comportement |
| --- | --- |
| `true` | Diffère publiquement, seulement s'il n'y a pas de réponse au bout de 2 s. |
| `"ephemeral"` | Pareil, avec un état de chargement visible par vous seul. |
| `"update"` | Pour les boutons et les menus de sélection : accuse réception sans message de chargement, puis utilisez `ctx.update(...)`. |
| `{ after: 0 }` | Diffère immédiatement. |
| `{ after: "1s", ephemeral: true }` | Choisit le délai et la visibilité. |
| `false` | Ne diffère jamais celle-ci, même quand une valeur par défaut est définie. |

`defer` est accepté par `defineCommand`, `subcommand`, `defineUserCommand`,
`defineMessageCommand`, `defineButton`, toutes les définitions de menus de
sélection et `defineModal`. Une sous-commande sans `defer` propre utilise celui
de sa commande parente, puis la valeur par défaut du bot.

:::caution[La visibilité est fixée au moment du différé]
Une réponse est publique ou éphémère dès qu'elle est différée. Après un différé
public, un `ctx.reply.error()` ou un `ctx.reply.ephemeral()` ultérieur est
public lui aussi. Utilisez `"ephemeral"` sur les définitions où cela compte.
:::

## Boutons et menus de sélection

Un composant modifie en général le message sur lequel il se trouve, et une
réponse « réfléchit... » sous ce message n'est pas ce que vous voulez.
`"update"` accuse réception du clic en silence :

```ts title="src/features/shop/refresh.button.ts"
import { defineButton } from "@ix-xs/djs-bot";

export default defineButton({
  id: "shop:refresh",
  label: "Refresh",
  defer: "update",
  run: async (ctx) => {
    const stock = await fetchStock();                       // peut prendre du temps
    await ctx.update({ content: `In stock: ${stock}` });    // modifie le message d'origine
  },
});
```

Avec un simple `true`, un composant lent est différé avec une nouvelle réponse de
chargement, et `ctx.update()` modifie alors cette réponse plutôt que le message
sur lequel se trouve le composant. Réglez `"update"` sur les composants qui
appellent `ctx.update`, y compris quand `defaults.defer` vaut `true`.

Sur tout ce qui n'est pas un bouton ou un menu de sélection, `"update"` se
comporte comme `true`.

## Gestionnaires qui ouvrent une modale

Une modale doit être la première réponse à une interaction. `ctx.showModal()`
annule le différé en attente : un gestionnaire qui ouvre sa modale tout de suite
n'a donc besoin de rien de spécial. En revanche, il ne peut pas annuler un
différé déjà parti : si un travail lent passe en premier, la modale est refusée.

Ouvrez la modale avant tout travail lent, ou désactivez le différé pour ce
gestionnaire :

```ts title="src/features/tickets/edit.button.ts"
import { defineButton, p } from "@ix-xs/djs-bot";
import { EditModal } from "./edit.modal.js";

export default defineButton({
  id: "ticket:edit",
  params: { ticketId: p.string },
  defer: false,                                   // ce gestionnaire répond avec une modale
  run: async (ctx) => {
    const ticket = await loadTicket(ctx.params.ticketId);
    await ctx.showModal(EditModal, { ticketId: ticket.id });
  },
});
```

`defer: false` supprime seulement l'accusé de réception automatique. La limite de
3 secondes de Discord s'applique toujours à la modale elle-même : gardez donc
court ce qui s'exécute avant elle.

## Comment ça marche

1. Quand une interaction arrive au bot, un minuteur est armé pour la durée du
   délai (2 secondes, sauf si vous en avez choisi un autre). Le temps passé dans
   les plugins et les gardes (*guards*) compte, car ils s'exécutent dans la même
   fenêtre.
2. Toute réponse du gestionnaire annule le minuteur : `ctx.reply` et toutes ses
   méthodes, `ctx.update` et ses méthodes, `ctx.showModal`. La fin du
   gestionnaire aussi.
3. Si le minuteur se déclenche en premier, le framework diffère au nom du
   gestionnaire.
4. Le prochain `ctx.reply()` du gestionnaire voit que l'interaction est différée
   et modifie la réponse différée au lieu de répondre.

Toutes les réponses d'une même interaction passent par une seule file. Le différé
et la réponse du gestionnaire ne peuvent donc jamais entrer en collision : celui
qui arrive en second voit que l'interaction a déjà fait l'objet d'un accusé de
réception.

:::caution[Restez sur ctx.reply et ctx.update]
Un appel direct à `ctx.interaction.reply()` contourne cette file. Si le différé
est parti un instant plus tôt, discord.js lève une erreur parce que l'interaction
a déjà reçu un accusé de réception. Utilisez `ctx.reply` et `ctx.update`, qui
gèrent les deux cas.
:::

Différer à la main fonctionne toujours : `ctx.reply.defer()` et
`ctx.update.defer()` annulent le différé automatique en attente, comme toute
autre réponse.

## Référence

### `DeferOption`

Le type de `defer` sur une définition et de `defaults.defer` dans
[`defineBot`](/basics/configuration/#botconfig).

| Valeur | Accuse réception avec | Après |
| --- | --- | --- |
| `true` | Un état de chargement public. | 2 s |
| `"ephemeral"` | Un état de chargement visible par vous seul. | 2 s |
| `"update"` | Aucun message de chargement, sur les composants. Un état de chargement public ailleurs. | 2 s |
| `{ after?, ephemeral?, update? }` | Ce que disent les champs. | `after` |
| `false` | Rien : jamais différé. | - |
| non défini | Le `defer` de la commande parente, puis `defaults.defer`, puis rien. | - |

La forme objet :

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `after` | `number \| string` | `2000` | Combien de temps le gestionnaire peut s'exécuter avant l'envoi du différé : des millisecondes, ou une durée sous forme de chaîne comme `"1s"`. `0` diffère immédiatement. Une chaîne qui ne peut pas être interprétée retombe sur la valeur par défaut. |
| `ephemeral` | `boolean` | `false` | Rend l'état de chargement, et avec lui la réponse finale, visible uniquement par l'utilisateur qui a lancé l'interaction. |
| `update` | `boolean` | `false` | Sur un bouton ou un menu de sélection, accuse réception sans message de chargement, pour modifier le message d'origine. Prend le pas sur `ephemeral` dans ce cas. |

## Limites et erreurs

| Situation | Ce qui se passe |
| --- | --- |
| Le gestionnaire se termine sans répondre | Rien n'est différé une fois le gestionnaire terminé. Discord affiche « L'application ne répond pas » : un gestionnaire doit toujours répondre. |
| Le gestionnaire lève une erreur après un différé | Le message d'erreur générique modifie la réponse différée, avec la visibilité choisie au moment du différé. Voir [Erreurs](/api/errors/). |
| `ctx.showModal()` après le départ du différé | Discord refuse la modale. Ouvrez-la d'abord, ou réglez `defer: false`. |
| L'interaction a disparu quand le minuteur se déclenche | Le différé échoué est ignoré. |
| Autocomplétion | Ne peut pas être différée : Discord attend 3 secondes au maximum. Voir [Options et autocomplétion](/commands/options/). |

## Voir aussi

- [L'objet ctx](/basics/context/) : `ctx.reply`, `ctx.update` et `ctx.showModal`.
- [Configuration](/basics/configuration/) : où `defaults` est défini.
- [Boutons](/components/buttons/) et [Modales](/components/modals/) : les définitions qui ont le plus souvent besoin de `"update"` ou de `false`.
