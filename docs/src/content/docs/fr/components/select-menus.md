---
title: "Menus de sélection"
description: "Un menu de sélection est une liste déroulante placée sous un message. Utilisez un menu de chaînes pour votre propre liste d'options, ou un menu natif pour laisser Discord proposer des utilisateurs, des rôles, des salons ou des mentionnables et résoudre les choix à votre place."
sidebar:
  order: 2
---

Il existe cinq sortes de menus de sélection et une fabrique pour chacune. Ils ont
tous la même forme qu'un [bouton](/components/buttons/) : un `id` de routage, des
`params` typés facultatifs et un gestionnaire `run`. Ce qui diffère, c'est ce
dans quoi l'utilisateur choisit et ce que lit le gestionnaire.

## Un premier menu de sélection

Un menu de chaînes propose votre propre liste. La définition contient le
gestionnaire, et les options sont données quand le menu est construit : une même
définition peut donc afficher une liste différente à chaque fois.

```ts title="features/colours/colour.select.ts"
import { defineSelectMenu } from "@ix-xs/djs-bot";

export const ColourPicker = defineSelectMenu({
  id: "colour:pick",
  run: (ctx) => ctx.update({ content: `You chose ${ctx.values[0]}.`, components: [] }),
});
```

```ts title="features/colours/colour.command.ts"
import { defineCommand, ui } from "@ix-xs/djs-bot";
import { ColourPicker } from "./colour.select.js";

export default defineCommand({
  name: "colour",
  description: "Pick a colour",
  run: (ctx) => {
    const menu = ColourPicker.build(undefined, {
      placeholder: "Pick a colour",
      options: [
        { label: "Red", value: "red" },
        { label: "Blue", value: "blue", description: "The calm one", emoji: "🔵" },
      ],
    });
    return ctx.reply({ content: "Which colour?", components: [ui.row(menu)] });
  },
});
```

`build(params, visual)` prend les paramètres en premier. Ce menu n'en déclare
aucun, d'où le `undefined`. Le `label` est ce que l'utilisateur lit et la `value`
est ce que le gestionnaire reçoit dans `ctx.values`.

Un menu de sélection occupe une rangée entière à lui seul : `ui.row(menu)`. Les
fichiers qui se terminent par `.select.ts` sont chargés automatiquement, voir
[Structure du projet](/basics/project-layout/).

## Plusieurs choix et paramètres

`minValues` et `maxValues` transforment le menu en sélection multiple. Les deux
valent `1` par défaut. Avec `minValues: 0`, l'utilisateur peut effacer sa
sélection, et `ctx.values` est alors un tableau vide.

Les `params` fonctionnent exactement comme sur un bouton : ils sont encodés dans
le customId et reviennent typés dans `ctx.params`.

```ts title="features/roles/interests.select.ts"
import { defineSelectMenu, p, ui } from "@ix-xs/djs-bot";

export const InterestPicker = defineSelectMenu({
  id: "interests:pick",
  params: { ownerId: p.string },
  run: async (ctx) => {
    // ctx.values: string[]   ctx.params.ownerId: string
    if (ctx.user.id !== ctx.params.ownerId) {
      await ctx.reply.error("This menu belongs to someone else.");
      return;
    }
    const picked = ctx.values.join(", ") || "nothing";
    await ctx.reply.success(`You picked: ${picked}`, { ephemeral: true });
  },
});

export const interestRow = (ownerId: string) =>
  ui.row(
    InterestPicker.build(
      { ownerId },
      {
        placeholder: "Choose up to three",
        minValues: 0,
        maxValues: 3,
        options: [
          { label: "Dev", value: "dev", emoji: "💻" },
          { label: "Design", value: "design", description: "UI/UX" },
          { label: "Music", value: "music", default: true },
        ],
      },
    ),
  );
```

`default: true` sur une option la présélectionne. Les codecs, l'encodage et sa
limite de 100 caractères sont décrits dans [Boutons](/components/buttons/).

## Menus de sélection natifs

`defineUserSelect`, `defineRoleSelect`, `defineChannelSelect` et
`defineMentionableSelect` laissent Discord afficher le sélecteur à partir des
utilisateurs, rôles et salons du serveur lui-même. Vous ne donnez aucune option,
et Discord résout les choix en objets complets pour vous.

```ts title="features/setup/log-channel.select.ts"
import { defineChannelSelect, ChannelType, ui } from "@ix-xs/djs-bot";

export const LogChannelPicker = defineChannelSelect({
  id: "setup:log-channel",
  run: async (ctx) => {
    const channel = ctx.channels?.first(); // ctx.channels: Collection<string, GuildBasedChannel>
    if (!channel) return ctx.update.defer();
    await ctx.reply.success(`Log channel set to ${channel}`);
  },
});

export const logChannelRow = () =>
  ui.row(
    LogChannelPicker.build(undefined, {
      placeholder: "Pick a channel",
      channelTypes: [ChannelType.GuildText],
      maxValues: 1,
    }),
  );
```

Utilisez les collections résolues dans le gestionnaire, pas les identifiants
bruts :

```ts title="features/roles/assign.select.ts"
import { defineRoleSelect } from "@ix-xs/djs-bot";

export const AssignRoles = defineRoleSelect({
  id: "roles:assign",
  run: async (ctx) => {
    for (const role of ctx.roles?.values() ?? []) await ctx.member?.roles.add(role);
    await ctx.update({ content: "Roles updated.", components: [] });
  },
});
```

| Fabrique | L'utilisateur choisit | Le gestionnaire lit | Options de `build` en plus |
| --- | --- | --- | --- |
| `defineSelectMenu` | parmi vos options | `ctx.values` | `options` |
| `defineUserSelect` | des utilisateurs | `ctx.users`, `ctx.members` | `defaultValues` |
| `defineRoleSelect` | des rôles | `ctx.roles` | `defaultValues` |
| `defineChannelSelect` | des salons | `ctx.channels` | `channelTypes`, `defaultValues` |
| `defineMentionableSelect` | des utilisateurs et des rôles | `ctx.users`, `ctx.members`, `ctx.roles` | aucune |

Les cinq acceptent aussi `placeholder`, `minValues`, `maxValues` et `disabled`.
Sur un menu natif, `build()` n'a besoin d'aucun argument : `Picker.build()`.

:::note[Pourquoi les collections sont facultatives]
Un seul type de contexte sert les cinq sortes, donc `ctx.users`, `ctx.members`,
`ctx.roles` et `ctx.channels` sont typés comme pouvant être `undefined`. Chacun
est toujours défini pour les sortes qui lui correspondent dans le tableau, donc
`?.` ou `!` y est sans risque. `ctx.values` est toujours défini, et contient des
identifiants sur un menu natif.
:::

## Répondre à une sélection

Le gestionnaire répond comme celui d'un bouton : `ctx.reply` envoie un nouveau
message, `ctx.update(content)` modifie le message sur lequel se trouve le menu,
`ctx.update.disable()` désactive ses composants, et `ctx.showModal(modal)` ouvre
une [modale](/components/modals/). [L'objet ctx](/basics/context/) les décrit.

Comme toute interaction, une sélection doit recevoir un accusé de réception dans
les trois secondes, sinon l'utilisateur voit « This interaction failed ». Quand
il n'y a rien à dire, `ctx.update.defer()` accuse réception sans rien changer.
Mettre `defer: "update"` sur la définition le fait à votre place, voir
[Différé automatique](/basics/automatic-deferral/).

Les conditions préalables vont dans `guards`, comme sur une commande. Voir
[Gardes](/commands/guards/).

## Référence

### `defineSelectMenu(input)`

Un menu de sélection de chaînes. `defineUserSelect(input)`,
`defineRoleSelect(input)`, `defineChannelSelect(input)` et
`defineMentionableSelect(input)` prennent la même entrée, un
`SelectMenuInput` :

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `id` | `string` | requis | Clé de routage stable, par exemple `"settings:language"`. 1-100 caractères, sans `$`. |
| `params` | `ParamMap` | `{}` | Valeurs typées encodées dans le customId, construites avec `p`. Voir [Boutons](/components/buttons/). |
| `guards` | `Guard[]` | `[]` | Conditions préalables vérifiées avant `run`. Voir [Gardes](/commands/guards/). |
| `defer` | `DeferOption` | le `defaults.defer` du bot | Accuse réception de la sélection à votre place. Voir [Différé automatique](/basics/automatic-deferral/). |
| `run` | `(ctx: SelectMenuContext) => unknown` | requis | Le gestionnaire. `ctx.values` contient ce qui a été choisi, `ctx.params` les paramètres décodés. |

Chaque fabrique renvoie son propre type de définition (`SelectMenuDefinition`,
`UserSelectDefinition`, `RoleSelectDefinition`, `ChannelSelectDefinition`,
`MentionableSelectDefinition`, ensemble `AnySelectDefinition`). Toutes étendent
`SelectRoutable` : `kind: "select"`, un `selectType` (`SelectType`, l'une des
valeurs `"string"`, `"user"`, `"role"`, `"channel"`, `"mentionable"`), et les
`id`, `params`, `guards`, `defer` et `run` que vous avez passés. Chacune ajoute
son propre `build()`.

### `build(params, visual)`

Sur un menu de chaînes. Renvoie un `StringSelectMenuBuilder` de discord.js dont
le customId encode `params`. Les deux arguments sont positionnels : passez
`undefined` pour `params` quand le menu n'en déclare aucun. `visual` est un
`SelectVisualOptions` :

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `options` | `Array<SelectMenuComponentOptionData \| APISelectMenuOption>` | requis | Les choix, de 1 à 25 : `{ label, value, description?, emoji?, default? }`. `emoji` est un emoji unicode, un balisage d'emoji personnalisé ou un objet `{ id, name }`. |
| `placeholder` | `string` | - | Texte grisé affiché tant que rien n'est choisi, jusqu'à 150 caractères. |
| `minValues` | `number` | `1` | Nombre minimal d'options que l'utilisateur doit choisir. |
| `maxValues` | `number` | `1` | Nombre maximal d'options que l'utilisateur peut choisir. |
| `disabled` | `boolean` | `false` | Grisé, impossible à ouvrir. |

### `build(params?, visual?)`

Sur un menu natif. Renvoie un `UserSelectMenuBuilder`, `RoleSelectMenuBuilder`,
`ChannelSelectMenuBuilder` ou `MentionableSelectMenuBuilder`. `visual` est un
`NativeSelectVisualOptions` :

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `placeholder` | `string` | - | Texte grisé affiché tant que rien n'est choisi, jusqu'à 150 caractères. |
| `minValues` | `number` | `1` | Nombre minimal d'entrées que l'utilisateur doit choisir. |
| `maxValues` | `number` | `1` | Nombre maximal d'entrées que l'utilisateur peut choisir. |
| `disabled` | `boolean` | `false` | Grisé, impossible à ouvrir. |
| `defaultValues` | `string[]` | - | Identifiants sélectionnés à l'apparition du menu. Menus d'utilisateurs, de rôles et de salons uniquement. |
| `channelTypes` | `ChannelType[]` | - | Ne propose que les salons de ces types. Menus de salons uniquement. |

Une option qui ne s'applique pas à la sorte de menu est ignorée.

### `SelectMenuContext<Params>`

Ce que reçoit `run`, en plus du [contexte de base](/basics/context/) :

| Propriété | Type | Présente pour |
| --- | --- | --- |
| `params` | `Params` | tous les menus |
| `values` | `string[]` | tous les menus : les valeurs des options pour un menu de chaînes, des identifiants pour un menu natif |
| `users` | `Collection<string, User>` | menus d'utilisateurs et de mentionnables |
| `members` | `Collection<string, GuildMember>` | menus d'utilisateurs et de mentionnables, dans un serveur |
| `roles` | `Collection<string, Role>` | menus de rôles et de mentionnables |
| `channels` | `Collection<string, GuildBasedChannel>` | menus de salons |
| `update` | `UpdateFn` | tous les menus |
| `showModal` | `ShowModalFn` | tous les menus |

`ctx.interaction` est l'interaction de sélection brute de discord.js.

## Limites et erreurs

| Limite | Valeur |
| --- | --- |
| Options dans un menu de chaînes | 1 à 25 |
| Placeholder | 150 caractères |
| customId, clé et paramètres ensemble | 100 caractères |
| Menus de sélection dans une rangée | 1 |
| Rangées dans un message | 5 |

| Code | Quand |
| --- | --- |
| [`DJSBOT_E013`](/api/errors/#djsbot_e013) | L'`id` est vide, contient `$` ou dépasse 100 caractères. Levée par la fabrique. |
| [`DJSBOT_E011`](/api/errors/#djsbot_e011) | Deux menus de sélection partagent un `id`. Les cinq sortes partagent un seul espace de noms : un menu de rôles et un menu de chaînes ne peuvent donc pas utiliser le même `id`. Levée au démarrage. |
| [`DJSBOT_E020`](/api/errors/#djsbot_e020) | Le customId encodé dépasse 100 caractères. Levée par `build()`. |
| [`DJSBOT_E021`](/api/errors/#djsbot_e021) | Une sélection est arrivée avec des paramètres impossibles à décoder. `run` n'est pas appelé, et l'utilisateur reçoit le message d'erreur, comme pour un gestionnaire qui échoue. |

Une sélection dont la clé de routage ne correspond à aucun menu enregistré est
ignorée, afin qu'un collecteur de votre cru puisse la traiter.

## Voir aussi

- [Boutons](/components/buttons/) pour `p`, l'encodage du customId et ses limites
- [Modales](/components/modals/), où les mêmes sélecteurs existent comme champs de formulaire
- [Options et autocomplétion](/commands/options/) quand le choix a sa place dans la commande elle-même
- [Un menu de rôles en libre-service](/recipes/role-menu/), un exemple complet
