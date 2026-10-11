---
title: "Options et autocomplétion"
description: "Les options sont les entrées d'une commande slash. Les constructeurs s les déclarent une seule fois, pour Discord et pour TypeScript, et un gestionnaire d'autocomplétion propose des valeurs pendant que l'utilisateur tape."
sidebar:
  order: 2
---

`s` est l'un de trois petits objets constructeurs. `s` décrit les options d'une commande (`ctx.options`), `p` décrit les paramètres portés par un [bouton](/components/buttons/) (`ctx.params`) et `field` décrit les composants d'une [modale](/components/modals/) (`ctx.fields`). Les trois fonctionnent de la même façon : ce que vous déclarez est ce que le gestionnaire reçoit, sans conversion de type.

## Une première option

```ts title="features/general/repeat.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "repeat",
  description: "Repeat a message",
  options: {
    text: s.string({ description: "What to repeat", required: true, maxLength: 200 }),
    times: s.integer({ description: "How many times", min: 1, max: 5 }),
  },
  run: (ctx) => {
    // ctx.options.text:  string               (obligatoire)
    // ctx.options.times: number | undefined   (facultative)
    const times = ctx.options.times ?? 1;
    return ctx.reply(Array(times).fill(ctx.options.text).join("\n"));
  },
});
```

La clé de chaque entrée est le nom d'option que voit l'utilisateur. Le framework lit la valeur dans l'interaction, la résout (un identifiant d'utilisateur devient un `User`, un identifiant de salon devient un salon) et la place dans `ctx.options` sous la même clé.

`required: true` rend la valeur non facultative dans `ctx.options`. Toute autre valeur la rend `T | undefined`. Ce seul indicateur pilote à la fois Discord et TypeScript.

## Tous les types d'option

| Constructeur | Type dans `ctx.options` | Réglages supplémentaires | Notes |
| --- | --- | --- | --- |
| `s.string()` | `string` | `minLength`, `maxLength`, `choices`, `autocomplete` | Du texte. |
| `s.integer()` | `number` | `min`, `max`, `choices`, `autocomplete` | Des nombres entiers. |
| `s.number()` | `number` | `min`, `max`, `choices`, `autocomplete` | Décimales autorisées. |
| `s.boolean()` | `boolean` | | Un interrupteur vrai/faux. |
| `s.user()` | `User` | | N'importe quel utilisateur, même s'il n'est pas dans le serveur. |
| `s.member()` | `GuildMember` | | L'utilisateur choisi, en tant que membre du serveur. |
| `s.channel()` | `GuildBasedChannel` | `channelTypes` | Un salon du serveur. |
| `s.role()` | `Role` | | |
| `s.mentionable()` | `Role \| User \| GuildMember` | | Ce que l'utilisateur choisit : un utilisateur ou un rôle. |
| `s.attachment()` | `Attachment` | `fileTypes` | Un fichier envoyé. |

Chaque constructeur accepte aussi `description`, `required` et les deux tables de localisation : voir la [référence](#reference).

Deux choses sont gérées pour vous :

- **Ordre.** Discord rejette une commande dont les options facultatives précèdent les options obligatoires. Les options obligatoires sont envoyées en premier au déploiement : l'ordre dans lequel vous les écrivez n'a donc jamais d'importance.
- **Description.** Une option sans `description` est déployée avec `"No description provided."`. Écrivez-en une quand même : c'est la seule aide que l'utilisateur reçoit dans le sélecteur.

:::note[`s.member()` et les utilisateurs qui ne sont pas membres]
Discord n'a pas de type d'option « membre » : `s.member()` est donc déployée comme une option d'utilisateur, puis résolue en membre ensuite. Quand l'utilisateur choisi n'est pas dans le serveur, ou que la commande s'exécute hors d'un serveur, une option obligatoire refuse la commande avant l'exécution du gestionnaire, avec le [message](/basics/wording-and-theme/) `notAMember` (« That user is not a member of this server. »). Un membre obligatoire n'est donc jamais `undefined` dans le gestionnaire. Un `s.member()` facultatif vaut `undefined` dans ce cas.
:::

## Choix et plages

Discord peut refuser la plupart des saisies invalides avant qu'elles n'atteignent votre gestionnaire.

```ts title="features/shop/subscribe.command.ts"
import { defineCommand, s, ChannelType } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "subscribe",
  description: "Subscribe a channel to a plan",
  options: {
    plan: s.string({
      description: "Subscription plan",
      required: true,
      choices: [
        { name: "Free", value: "free" },
        { name: "Pro", value: "pro" },
      ],
    }),
    seats: s.integer({ description: "How many seats", min: 1, max: 100 }),
    channel: s.channel({ description: "Where to post", channelTypes: [ChannelType.GuildText] }),
    logo: s.attachment({ description: "Your logo", fileTypes: ["image"] }),
    contract: s.attachment({ description: "The signed contract", fileTypes: [".pdf", ".docx"] }),
  },
  run: (ctx) => ctx.reply.success(`Plan: ${ctx.options.plan}, seats: ${ctx.options.seats ?? 1}`),
});
```

- `choices` est une liste fixe d'au plus 25 valeurs que Discord affiche lui-même. L'utilisateur voit `name`, votre gestionnaire reçoit `value`. Le type reste `string` ou `number` : il n'est pas restreint aux valeurs listées.
- `min` et `max` bornent un nombre. `minLength` et `maxLength` bornent un texte.
- `channelTypes` limite le sélecteur de salon aux types que vous listez.
- `fileTypes` limite ce qui peut être joint : `"image"`, `"video"`, `"audio"`, ou une extension comme `".pdf"`. Discord filtre le sélecteur de fichiers et refuse tout le reste. La comparaison se fait sur l'extension du fichier uniquement : vérifiez donc aussi `contentType` si le type compte vraiment. La lecture du fichier envoyé est traitée dans [Embeds et pièces jointes](/messages/embeds-and-attachments/).

:::tip[Les chaînes peuvent tenir sur plusieurs lignes]
Depuis septembre 2026, les utilisateurs peuvent taper des sauts de ligne dans une option de type chaîne. Si une valeur finit à un endroit qui tient sur une seule ligne (un titre d'embed, un nom de salon), retirez-les : `value.replace(/\s+/g, " ")`.
:::

## Autocomplétion

Une liste de `choices` s'arrête à 25 valeurs et ne peut pas changer. Quand la liste est longue, vient d'une base de données ou dépend de la personne qui tape, donnez plutôt à l'option un gestionnaire `autocomplete`. Il est appelé à chaque frappe et renvoie les suggestions à afficher. Il fonctionne sur `s.string`, `s.integer` et `s.number`, dans les commandes et dans les [sous-commandes](/commands/subcommands/). Une option prend soit `choices`, soit `autocomplete`, jamais les deux.

```ts title="features/fruit/fruit.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

const FRUITS = ["apple", "apricot", "banana", "cherry"];

export default defineCommand({
  name: "fruit",
  description: "Pick a fruit",
  options: {
    name: s.string({
      description: "Fruit",
      required: true,
      autocomplete: (ctx) => FRUITS.filter((fruit) => fruit.startsWith(ctx.value.toLowerCase())),
    }),
  },
  run: (ctx) => ctx.reply.success(`You picked ${ctx.options.name}`),
});
```

`ctx.value` est ce que l'utilisateur a tapé jusqu'ici. Le `ctx` d'un gestionnaire d'autocomplétion est typé, sans rien à annoter, et ce n'est pas un contexte de commande : il n'y a pas de `ctx.reply`, le gestionnaire renvoie les suggestions à la place. Ses propriétés sont listées sous [`AutocompleteContext`](#autocompletecontext).

Le gestionnaire peut renvoyer l'une de ces formes, directement ou sous forme de promesse :

| Retour | Affiché comme | Envoyé à votre commande comme |
| --- | --- | --- |
| `["apple", "banana"]` | `apple`, `banana` | le même texte |
| `[10, 20]` | `10`, `20` | le même nombre |
| `[{ name: "Apple (3 left)", value: "apple" }]` | `Apple (3 left)` | `"apple"` |

Pour que les suggestions dépendent d'une option que l'utilisateur a déjà remplie, lisez-la dans `ctx.options` :

```ts
options: {
  category: s.string({ description: "Category", required: true, choices: CATEGORIES }),
  item: s.string({
    description: "Item",
    required: true,
    autocomplete: async (ctx) => {
      const items = await ctx.services.shop.search(ctx.options.category, ctx.value);
      return items.map((item) => ({ name: `${item.label} - ${item.price} coins`, value: item.id }));
    },
  }),
}
```

Pendant que l'utilisateur tape, Discord n'a encore rien résolu. `ctx.options` contient le texte, les nombres et les booléens tels quels, et seulement l'**identifiant** d'un utilisateur, d'un rôle, d'un salon, d'un mentionnable ou d'une pièce jointe.

Pour tester un gestionnaire sans Discord, appelez `h.autocomplete(command, { option, value, options })` depuis le harnais décrit dans [Tests](/production/testing/).

## Règles de l'autocomplétion

Une seule suggestion invalide fait que Discord refuse toute la liste : le framework rend donc chaque suggestion valide avant de l'envoyer :

| Règle de Discord | Ce que fait le framework |
| --- | --- |
| Au plus 25 suggestions | Envoie les 25 premières. |
| Un nom de 1 à 100 caractères | Coupe un nom trop long, écarte un nom vide. |
| La valeur a le type de l'option | La convertit : un nombre pour `s.integer` et `s.number`, du texte pour `s.string`. Écarte ce qui ne peut pas être converti, comme `"abc"` pour un nombre. |
| Une valeur texte d'au plus 100 caractères | Écarte la suggestion. |
| Une réponse en moins de 3 secondes, sans possibilité de différer | Rien : cette partie est à vous. |

Les suggestions qu'il a fallu écarter sont signalées dans les journaux, une fois par option plutôt qu'à chaque frappe.

Trois choses restent de votre responsabilité :

- **Soyez rapide.** Discord attend 3 secondes au plus et une réponse d'autocomplétion ne peut pas être différée. Interrogez un index ou un cache, pas une API lente. `TTLCache`, décrit dans [Cache et résolution d'entités](/data/cache/), est fait pour cela.
- **Les échecs sont silencieux pour l'utilisateur.** Si le gestionnaire lève une exception, l'erreur est consignée et une liste vide est affichée : une recherche qui échoue ne casse donc jamais la commande.
- **Une suggestion n'est pas une validation.** L'utilisateur peut ignorer la liste et envoyer ce qu'il a tapé. Vérifiez à nouveau la valeur dans `run`.

## Référence

### `s`

L'objet qui contient les dix constructeurs listés dans [Tous les types d'option](#every-option-type). Chacun prend un objet de configuration facultatif et renvoie un descripteur d'option (`OptionDef`). Ces réglages sont acceptés par tous les constructeurs :

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `description` | `string` | `"No description provided."` | Affichée sous l'option dans le sélecteur. 1-100 caractères. |
| `required` | `boolean` | `false` | Indique si l'utilisateur doit renseigner l'option. Pilote le type déduit. |
| `nameLocalizations` | `LocalizationMap` | - | Nom de l'option par langue. Voir [Noms localisés](/commands/slash-commands/#localized-names). |
| `descriptionLocalizations` | `LocalizationMap` | - | Description par langue. |

`s.boolean`, `s.user`, `s.member`, `s.role` et `s.mentionable` n'acceptent rien d'autre.

### `s.string(config?)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `minLength` | `number` | - | Texte le plus court accepté, 0-6000. |
| `maxLength` | `number` | - | Texte le plus long accepté, 1-6000. |
| `choices` | `{ name: string; value: string }[]` | - | Une liste fixe d'au plus 25 valeurs. Exclut `autocomplete`. |
| `autocomplete` | `AutocompleteHandler \| boolean` | - | Un gestionnaire qui renvoie des suggestions. `true` ne fait que marquer l'option, voir [`toAutocompleteChoices`](#toautocompletechoicesresult-kind). |

### `s.integer(config?)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `min` | `number` | - | Plus petite valeur acceptée. |
| `max` | `number` | - | Plus grande valeur acceptée. |
| `choices` | `{ name: string; value: number }[]` | - | Une liste fixe d'au plus 25 valeurs. Exclut `autocomplete`. |
| `autocomplete` | `AutocompleteHandler \| boolean` | - | Comme pour `s.string`. `ctx.value` reste du texte, les suggestions sont envoyées sous forme de nombres. |

### `s.number(config?)`

Les mêmes réglages que `s.integer`. La valeur peut avoir des décimales.

### `s.channel(config?)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `channelTypes` | `ChannelType[]` | tous les types | Ne propose que les salons de ces types, par exemple `[ChannelType.GuildText]`. |

### `s.attachment(config?)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `fileTypes` | `FileType[]` | tout fichier | Jusqu'à 10 entrées, chacune étant `"image"`, `"video"`, `"audio"` ou une extension précédée d'un point comme `".pdf"`. |

### `AutocompleteContext`

Ce que reçoit un gestionnaire `autocomplete`.

| Propriété | Type | Description |
| --- | --- | --- |
| `value` | `string` | Ce que l'utilisateur a tapé jusqu'ici, toujours sous forme de texte. `""` quand le champ vient d'être ouvert. |
| `focused` | `string` | Le nom de l'option en cours de saisie. |
| `options` | `AutocompleteOptions` | Ce qui est renseigné jusqu'ici, par nom d'option, y compris l'option en cours de saisie. Le texte, les nombres et les booléens tels quels, l'identifiant d'un utilisateur, d'un rôle, d'un salon, d'un mentionnable ou d'une pièce jointe. Une option laissée vide est absente. Dans une sous-commande, ce sont les options de cette sous-commande. |
| `user` | `User` | Qui est en train de taper. |
| `guild` | `Guild \| null` | Le serveur, quand il est en cache. |
| `guildId` | `string \| null` | L'identifiant du serveur. `null` en message privé. |
| `channelId` | `string \| null` | L'identifiant du salon. |
| `services` | `ServiceMap` | Vos services, comme dans une commande. |
| `logger` | `Logger` | Étiqueté avec l'identifiant de corrélation et le nom de l'option. |
| `client` | `Client<true>` | Le client connecté. |
| `locale` | `string` | La langue Discord de l'utilisateur. |
| `t(key, vars?)` | `string` | Traduit pour cette langue, afin de localiser les noms des suggestions. Renvoie la clé quand l'i18n n'est pas configurée. |
| `interaction` | `AutocompleteInteraction` | L'interaction discord.js brute. |

Un gestionnaire a le type `AutocompleteHandler`. Il renvoie un `AutocompleteResult`, c'est-à-dire `AutocompleteChoice[]` (`{ name, value }`), `string[]` ou `number[]`, directement ou sous forme de promesse.

### `toAutocompleteChoices(result, kind?)`

La fonction qui applique les [règles de l'autocomplétion](#autocomplete-rules). Elle est exportée pour le bot, rare, qui répond lui-même à l'autocomplétion : passer `autocomplete: true` ne fait que marquer l'option, le framework s'écarte alors et vous répondez depuis votre propre écouteur `interactionCreate`.

```ts title="features/search/search-autocomplete.event.ts"
import { defineEvent, toAutocompleteChoices } from "@ix-xs/djs-bot";

export default defineEvent("interactionCreate", async (interaction, ctx) => {
  if (!interaction.isAutocomplete() || interaction.commandName !== "search") return;

  const rows = await ctx.services.library.search(interaction.options.getFocused());
  const { choices, dropped } = toAutocompleteChoices(rows, "string");
  if (dropped > 0) ctx.logger.warn({ dropped }, "suggestions left out");
  await interaction.respond(choices);
});
```

| Paramètre | Type | Défaut | Description |
| --- | --- | --- | --- |
| `result` | `unknown` | obligatoire | Ce qu'un gestionnaire a renvoyé. Tout ce qui n'est pas un tableau donne une liste vide. |
| `kind` | `"string" \| "integer" \| "number"` | `"string"` | Le genre de l'option en cours de complétion. Décide du type des valeurs. |

Elle renvoie un `NormalizedChoices` : `choices` (au plus 25, prêtes pour `interaction.respond`) et `dropped` (le nombre de suggestions écartées). Un nom de plus de 100 caractères est coupé et se termine par `...`. Une suggestion sans `name` utilise sa valeur comme nom. Pour `"integer"`, une valeur avec des décimales est écartée.

### Helpers de types

Rarement nécessaires directement, mais exportés pour construire vos propres abstractions.

| Type | Usage |
| --- | --- |
| `InferOptions<M>` | La forme de `ctx.options` pour une table d'options. |
| `OptionMap` | Une table de nom d'option vers descripteur, telle que passée à `options`. |
| `OptionDef` | Un descripteur d'option, tel que renvoyé par un constructeur `s`. |
| `OptionKind` | Les dix genres d'option : `"string"`, `"integer"` et ainsi de suite. |
| `FileType` | Une entrée d'un filtre `fileTypes`. |
| `AutocompleteHandler`, `AutocompleteResult`, `AutocompleteChoice` | Le gestionnaire, ce qu'il renvoie, et une suggestion. |
| `AutocompleteOptions` | Le type de `ctx.options` dans un gestionnaire d'autocomplétion. |
| `NormalizedChoices` | Ce que renvoie `toAutocompleteChoices`. |

```ts title="features/moderation/ban-options.ts"
import { s, type InferOptions, type OptionMap } from "@ix-xs/djs-bot";

export const banOptions = {
  target: s.user({ description: "Who to ban", required: true }),
  reason: s.string({ description: "Why" }),
} satisfies OptionMap;

export function formatBan(options: InferOptions<typeof banOptions>): string {
  return `${options.target.tag}: ${options.reason ?? "no reason"}`;
}
```

## Limites et erreurs

Ces règles sont vérifiées quand la commande est définie, et lèvent une erreur qui nomme la commande et l'option.

| Règle | Limite | Erreur |
| --- | --- | --- |
| Nom d'option | 1-32 caractères, minuscules, lettres, chiffres, `-` et `_` | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| Description d'option, localisation la plus longue comprise | 1-100 caractères | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Options par commande ou sous-commande | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Choix par option | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Nom d'un choix | 1-100 caractères | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Valeur d'un choix, quand c'est du texte | 100 caractères | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| `choices` avec `autocomplete` | interdit | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| `minLength` / `maxLength` | 0-6000 / 1-6000, et `minLength` pas au-dessus de `maxLength` | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| `min` / `max` | `min` pas au-dessus de `max` | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| `fileTypes` | 10 entrées, chacune une catégorie ou une extension | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |

Les noms, descriptions et choix d'options comptent aussi dans les 8000 caractères autorisés pour une commande entière : voir [Commandes slash](/commands/slash-commands/#limits-and-errors).

L'autocomplétion n'a pas d'erreurs à la définition. Ses limites (25 suggestions, noms de 1-100 caractères, 3 secondes pour répondre) sont gérées à l'exécution comme décrit dans [Règles de l'autocomplétion](#autocomplete-rules).

## Voir aussi

- [Commandes slash](/commands/slash-commands/)
- [Sous-commandes](/commands/subcommands/)
- [Cache et résolution d'entités](/data/cache/)
- [Embeds et pièces jointes](/messages/embeds-and-attachments/)
- [Tests](/production/testing/)
