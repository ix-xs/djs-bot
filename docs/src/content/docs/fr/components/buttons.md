---
title: "Boutons"
description: "Un bouton est un composant cliquable placé sous un message. Définissez-le une fois avec un identifiant de routage et des paramètres typés, construisez-le partout où vous envoyez un message, et le clic arrive dans votre gestionnaire avec ces paramètres décodés."
sidebar:
  order: 1
---

Discord donne à un composant une seule donnée qui survit jusqu'au clic : son
`customId`, une chaîne d'au plus 100 caractères. Au lieu de coller des valeurs
dans cette chaîne puis de les redécouper, vous déclarez des paramètres typés sur
le bouton et le framework fait les deux sens pour vous.

## Un premier bouton

Un bouton a deux moitiés : la définition, qui contient le gestionnaire, et un
appel à `build()` à l'endroit où vous envoyez le message.

```ts title="features/hello/wave.button.ts"
import { defineButton, ButtonStyle } from "@ix-xs/djs-bot";

export const WaveButton = defineButton({
  id: "hello:wave",
  label: "Wave back",
  style: ButtonStyle.Success,
  run: (ctx) => ctx.reply(`${ctx.user} waves back.`),
});
```

```ts title="features/hello/hello.command.ts"
import { defineCommand, ui } from "@ix-xs/djs-bot";
import { WaveButton } from "./wave.button.js";

export default defineCommand({
  name: "hello",
  description: "Say hello",
  run: (ctx) => ctx.reply({ content: "Hello.", components: [ui.row(WaveButton.build())] }),
});
```

L'`id` est la clé de routage : quand quelqu'un clique, le framework la lit dans
le customId et appelle le `run` du bouton enregistré sous cette clé. Elle doit
rester la même tant que des messages portant le bouton existent. Choisissez donc
un nom avec espace de noms, comme `ticket:close`, et ne le renommez pas ensuite.

Les boutons vivent dans des rangées. `ui.row(...)` en regroupe jusqu'à cinq, voir
[Components V2](/components/components-v2/) pour les helpers `ui`. Les fichiers
qui se terminent par `.button.ts` sont chargés automatiquement, voir
[Structure du projet](/basics/project-layout/).

## Paramètres typés

Déclarez `params` avec les codecs `p`. `build()` exige alors ces valeurs, et
`ctx.params` vous les rend avec les mêmes types.

```ts title="features/tickets/close.button.ts"
import { defineButton, p, ButtonStyle } from "@ix-xs/djs-bot";

export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, ownerId: p.string },
  label: "Close",
  style: ButtonStyle.Danger,
  emoji: "🔒",
  run: async (ctx) => {
    // ctx.params: { ticketId: string; ownerId: string }
    if (ctx.user.id !== ctx.params.ownerId) {
      await ctx.reply.error("Not your ticket.");
      return;
    }
    await ctx.services.tickets.close(ctx.params.ticketId); // votre propre service
    await ctx.update.disable();
    await ctx.reply.success("Ticket closed 🔒", { ephemeral: true });
  },
});
```

```ts title="features/tickets/ticket.command.ts"
import { defineCommand, ui } from "@ix-xs/djs-bot";
import { CloseTicket } from "./close.button.js";

export default defineCommand({
  name: "ticket",
  description: "Open a ticket",
  run: async (ctx) => {
    const ticketId = crypto.randomUUID().slice(0, 8);
    const button = CloseTicket.build({ ticketId, ownerId: ctx.user.id });
    await ctx.reply({ content: "🎫 Ticket opened", components: [ui.row(button)] });
  },
});
```

Un paramètre manquant ou mal orthographié dans `build()` ne compile pas : les
deux moitiés ne peuvent donc pas se désynchroniser.

| Codec | Type dans `ctx.params` | Stocké sous la forme |
| --- | --- | --- |
| `p.string` | `string` | la chaîne elle-même |
| `p.number` | `number` | son texte décimal |
| `p.boolean` | `boolean` | `"1"` ou `"0"` |
| `p.oneOf("a", "b")` | `"a" \| "b"` | la chaîne elle-même |

`p.oneOf` restreint une chaîne à un ensemble fixe : un même gestionnaire peut
servir plusieurs boutons et TypeScript connaît tous les cas.

```ts title="features/requests/decide.button.ts"
import { defineButton, p, ui, ButtonStyle } from "@ix-xs/djs-bot";

export const Decide = defineButton({
  id: "request:decide",
  params: { requestId: p.string, action: p.oneOf("approve", "reject") },
  run: async (ctx) => {
    // ctx.params.action: "approve" | "reject"
    const verdict = ctx.params.action === "approve" ? "approved" : "rejected";
    await ctx.update({ content: `Request ${ctx.params.requestId} ${verdict}.`, components: [] });
  },
});

export const decisionRow = (requestId: string) =>
  ui.row(
    Decide.build({ requestId, action: "approve" }, { label: "Approve", style: ButtonStyle.Success }),
    Decide.build({ requestId, action: "reject" }, { label: "Reject", style: ButtonStyle.Danger }),
  );
```

Si une valeur absente de l'ensemble revient, elle est décodée en la première
valeur (`"approve"` ici), jamais en une chaîne inattendue.

:::caution[Les paramètres viennent du client]
Un customId transite par le client Discord de l'utilisateur et il est seulement
encodé, ni chiffré ni signé. N'importe qui peut le lire, et un client modifié
peut en envoyer un autre. N'y mettez aucun secret, et décidez qui a le droit
d'agir dans le gestionnaire ou avec une [garde](/commands/guards/), pas à partir
d'un paramètre comme `isAdmin`.
:::

## Libellé, style et état

`label`, `emoji` et `style` sur la définition sont des valeurs par défaut. Le
second argument de `build()` les remplace pour un seul bouton, et c'est le seul
endroit où l'on peut le désactiver.

```ts
CloseTicket.build(
  { ticketId, ownerId: ctx.user.id },
  { label: "Close now", style: ButtonStyle.Secondary, disabled: locked },
);
```

Le style retombe sur `ButtonStyle.Primary`. Un bouton sans libellé ni emoji
affiche son `id`, car Discord refuse un bouton vide.

Un bouton qui ouvre une URL, ou qui vend l'un de vos SKU, n'a ni gestionnaire ni
customId. Construisez-les avec `ui.linkButton(label, url, emoji?)` et
`ui.premiumButton(skuId)`, décrits dans
[Components V2](/components/components-v2/).

## Répondre à un clic

Un clic est une interaction comme une commande : `ctx.reply` fonctionne comme
d'habitude et envoie un nouveau message. Le contexte d'un bouton ajoute trois
choses :

| Appel | Ce qu'il fait |
| --- | --- |
| `ctx.update(content)` | Modifie le message sur lequel se trouve le bouton. |
| `ctx.update.disable()` | Désactive tous les composants de ce message. |
| `ctx.showModal(modal)` | Ouvre une [modale](/components/modals/) comme réponse. |

[L'objet ctx](/basics/context/) les décrit en détail. Un bouton qui modifie son
propre message peut se reconstruire avec de nouveaux paramètres, et c'est ainsi
que l'état passe d'un clic au suivant :

```ts title="features/counter/counter.button.ts"
import { defineButton, p, ui } from "@ix-xs/djs-bot";

export const Counter = defineButton({
  id: "counter:add",
  params: { count: p.number },
  label: "+1",
  defer: "update",
  run: async (ctx) => {
    const count = ctx.params.count + 1;
    await ctx.update({
      content: `Clicked ${count} times.`,
      components: [ui.row(Counter.build({ count }))],
    });
  },
});
```

Lancez-le avec `Counter.build({ count: 0 })`. Les conditions préalables vont dans
`guards`, comme sur une commande : un clic rejeté reçoit une erreur éphémère et
`run` n'est pas appelé. Voir [Gardes](/commands/guards/).

## Comment l'identifiant est encodé

Le customId est la clé de routage seule, ou la clé, un `$`, puis les
paramètres :

```text
ticket:close
ticket:close$WyI0MiIsIjEiXQ
```

Chaque valeur est transformée en texte par son codec, les textes sont placés dans
un tableau JSON dans l'ordre où l'objet `params` les déclare, et le tableau est
écrit en base64url. Le `$` n'apparaît ni en base64url ni dans une clé de routage
valide, donc la séparation est sans ambiguïté. C'est pour cela qu'un `id` ne peut
pas contenir `$`.

Deux conséquences sont bonnes à connaître :

- **Les noms ne sont pas stockés, les positions le sont.** Renommer un paramètre
  est sans risque. Réordonner ou supprimer un paramètre change le sens de tous
  les boutons déjà envoyés. Ajoutez les nouveaux paramètres à la fin : sur un
  ancien bouton, ils sont décodés à partir d'un texte vide, ce qui donne `""`,
  `0`, `false`, ou la première valeur d'un `p.oneOf`. Un bouton envoyé avant que
  la définition n'ait des paramètres arrive avec un `ctx.params` vide.
- **Le base64 ajoute un tiers à la longueur.** Avec la clé `ticket:close`, deux
  identifiants Discord produisent déjà 73 des 100 caractères.

### Quand 100 caractères ne suffisent pas

Stockez les données et gardez une clé courte dans le bouton :

```ts
const key = crypto.randomUUID().slice(0, 8);
await ctx.services.store.set(`draft:${key}`, draft, "15m");

const row = ui.row(Publish.build({ key }));
```

Le gestionnaire les relit avec `ctx.services.store.get(...)` et traite une valeur
absente comme un bouton expiré. Voir [Store](/data/store/).

## Référence

### `defineButton(input)`

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `id` | `string` | requis | Clé de routage stable, par exemple `"ticket:close"`. 1-100 caractères, sans `$`. |
| `params` | `ParamMap` | `{}` | Valeurs typées encodées dans le customId, construites avec `p`. |
| `guards` | `Guard[]` | `[]` | Conditions préalables vérifiées avant `run`. Voir [Gardes](/commands/guards/). |
| `style` | `ButtonStyle` | `ButtonStyle.Primary` | Couleur par défaut utilisée par `build()`. |
| `label` | `string` | - | Texte par défaut utilisé par `build()`. |
| `emoji` | `string` | - | Emoji par défaut utilisé par `build()`. |
| `defer` | `DeferOption` | le `defaults.defer` du bot | Accuse réception du clic à votre place. `"update"` convient à un bouton qui modifie son message. Voir [Différé automatique](/basics/automatic-deferral/). |
| `run` | `(ctx: ButtonContext) => unknown` | requis | Le gestionnaire. `ctx.params` est décodé et typé. |

Renvoie un `ButtonDefinition` : les `id`, `params`, `guards`, `defer` et `run` que
vous avez passés, une étiquette `kind: "button"` sur laquelle le chargeur
s'appuie pour router, et `build()`. `ButtonInput`, `ButtonDefinition` et
`ButtonVisualOptions` sont des types exportés.

### `build(params?, visual?)`

Renvoie un `ButtonBuilder` de discord.js dont le customId encode `params`.
Omettez `params` quand le bouton n'en déclare aucun. `visual` est un
`ButtonVisualOptions` :

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `label` | `string` | le `label` de la définition | Le texte du bouton, jusqu'à 80 caractères. |
| `emoji` | `string` | l'`emoji` de la définition | Affiché avant le libellé : un emoji unicode ou `<:name:id>`. |
| `style` | `ButtonStyle` | le `style` de la définition | La couleur du bouton. |
| `disabled` | `boolean` | `false` | Grisé, impossible à cliquer. |

Le résultat est un vrai builder : `.setDisabled(true)` et ses autres méthodes
restent utilisables.

### `p`

Les codecs de paramètres : `p.string`, `p.number`, `p.boolean` et
`p.oneOf(...values)`, listés dans
[Paramètres typés](/components/buttons/#typed-params). `oneOf` est aussi exporté
seul. Les menus de sélection et les modales acceptent les mêmes `params`.

### `ParamCodec<T>`

Un codec est un simple objet, vous pouvez donc écrire les vôtres. Le type est
exporté depuis `"@ix-xs/djs-bot"` :

```ts
const date: ParamCodec<Date> = {
  type: "number",
  encode: (d) => String(d.getTime()),
  decode: (raw) => new Date(Number(raw)),
};
```

| Membre | Type | Description |
| --- | --- | --- |
| `type` | `"string" \| "number" \| "boolean"` | Le type d'exécution en lequel le paramètre est décodé. |
| `encode` | `(value: T) => string` | Transforme une valeur en texte. |
| `decode` | `(raw: string) => T` | Relit le texte. |

`ParamMap` est un enregistrement de codecs, la forme de `params`.
`InferParams<M>` est le type de `ctx.params` pour un `ParamMap`.

### `encodeCustomId(key, schema, values)`

Construit un customId à partir d'une clé de routage, d'un `ParamMap` et des
valeurs. Renvoie la clé seule quand le schéma est vide. Lève
[`DJSBOT_E020`](/api/errors/#djsbot_e020) au-delà de 100 caractères. `build()` l'appelle
pour vous. `encodeCustomId`, `decodeCustomId` et `customIdKey` sont exportés pour
le code qui manipule lui-même les customId.

```ts
const schema = { ticketId: p.string, notify: p.boolean };
const id = encodeCustomId("ticket:close", schema, { ticketId: "42", notify: true });
decodeCustomId(id, schema); // { key: "ticket:close", params: { ticketId: "42", notify: true } }
```

### `decodeCustomId(raw, schema)`

Renvoie `{ key, params }`. Lève [`DJSBOT_E021`](/api/errors/#djsbot_e021) quand la
partie après `$` ne peut pas être décodée. Le routeur l'appelle avant chaque
gestionnaire.

### `customIdKey(raw)`

Renvoie la clé de routage d'un customId sans décoder ses paramètres.

## Limites et erreurs

| Limite | Valeur |
| --- | --- |
| customId, clé et paramètres ensemble | 100 caractères, exporté sous le nom `CUSTOM_ID_MAX_LENGTH` |
| Libellé | 80 caractères |
| Boutons dans une rangée | 5 |
| Rangées dans un message | 5 |

| Code | Quand |
| --- | --- |
| [`DJSBOT_E013`](/api/errors/#djsbot_e013) | L'`id` est vide, contient `$` ou dépasse 100 caractères. Levée par `defineButton`. |
| [`DJSBOT_E011`](/api/errors/#djsbot_e011) | Deux boutons partagent un `id`. Levée au démarrage. |
| [`DJSBOT_E020`](/api/errors/#djsbot_e020) | Le customId encodé dépasse 100 caractères. Levée par `build()`, dans le gestionnaire qui envoie le message : l'erreur est visible dès la première exécution de ce code. |
| [`DJSBOT_E021`](/api/errors/#djsbot_e021) | Un clic est arrivé avec des données impossibles à décoder. `run` n'est pas appelé, et le clic est traité comme un gestionnaire qui échoue : l'utilisateur reçoit le message d'erreur et `onError` est appelé. |

Un clic dont la clé de routage ne correspond à aucun bouton enregistré est
ignoré, et non traité comme une erreur : il peut appartenir à un collecteur,
comme ceux qui se trouvent derrière
[`paginate` et `confirm`](/components/pagination/). Si l'un de vos propres boutons
ne fait rien, vérifiez que son fichier est chargé et que l'`id` n'a pas été
renommé.

## Voir aussi

- [Menus de sélection](/components/select-menus/) et [Modales](/components/modals/), qui transportent des paramètres de la même façon
- [Components V2](/components/components-v2/) pour les rangées, les boutons de lien et les mises en page
- [L'objet ctx](/basics/context/) pour `ctx.reply`, `ctx.update` et `ctx.showModal`
- [Un système de tickets](/recipes/ticket-system/), un flux complet construit sur des boutons et une modale
