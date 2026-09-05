---
title: "Options & schémas - s, p, field"
description: "Toutes les options de commande, tous les codecs de customId et tous les champs de modale."
sidebar:
  label: "Options & schémas"
  order: 3
---

Trois constructeurs de schémas, tous entièrement typés :

- **`s`** - options de commande slash → `ctx.options`
- **`p`** - paramètres de customId → `ctx.params`
- **`field`** - champs de modale → `ctx.fields`

## `s` - options de commande

Chaque constructeur renvoie une option typée. **`required: true` rend la valeur
non optionnelle** dans `ctx.options` (sinon elle est `T | undefined`).

| Constructeur | Type dans `ctx.options` | Options spécifiques |
| --- | --- | --- |
| `s.string()` | `string` | `minLength`, `maxLength`, `choices`, `autocomplete` |
| `s.integer()` | `number` | `min`, `max`, `choices`, `autocomplete` |
| `s.number()` | `number` | `min`, `max`, `choices`, `autocomplete` |
| `s.boolean()` | `boolean` | - |
| `s.user()` | `User` | - |
| `s.member()` | `GuildMember` | - |
| `s.channel()` | `GuildBasedChannel` | `channelTypes` |
| `s.role()` | `Role` | - |
| `s.mentionable()` | `User \| Role \| GuildMember` | - |
| `s.attachment()` | `Attachment` | - |

### Options communes à tous

| Option | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `description` | `string` | `"No description provided."` | Description affichée par Discord. |
| `required` | `boolean` | `false` | Rend l'option obligatoire **et** non optionnelle en TypeScript. |
| `nameLocalizations` | `LocalizationMap` | - | Traductions du nom de l'option. |
| `descriptionLocalizations` | `LocalizationMap` | - | Traductions de la description. |

> Le **nom** d'une option est la clé de l'objet `options`. Il doit respecter les
> règles Discord : minuscules, 1-32 caractères, lettres/chiffres/`-`/`_`
> (sinon `DJSBOT_E012`).

### Options spécifiques

| Option | S'applique à | Rôle |
| --- | --- | --- |
| `minLength` / `maxLength` | `string` | Longueur min/max du texte. |
| `min` / `max` | `integer`, `number` | Bornes numériques. |
| `choices` | `string`, `integer`, `number` | Liste fermée : `[{ name, value }]`. L'utilisateur choisit dans un menu. |
| `channelTypes` | `channel` | Restreint les types de salons, ex. `[ChannelType.GuildText]`. |
| `autocomplete` | `string`, `integer`, `number` | `true`, ou un **handler asynchrone** de suggestions. |

```ts
options: {
  count:   s.integer({ description: "Combien", min: 1, max: 100, required: true }),
  channel: s.channel({ description: "Où", channelTypes: [ChannelType.GuildText] }),
  format:  s.string({ description: "Format", choices: [{ name: "Court", value: "court" }] }),
  file:    s.attachment({ description: "Fichier" }),
}
```

### Autocomplétion

Le handler reçoit un contexte dédié et renvoie **jusqu'à 25** suggestions (la
liste est tronquée automatiquement).

```ts
name: s.string({
  description: "Fruit",
  required: true,
  autocomplete: async (ac) => {
    // ac.value   : ce que l'utilisateur a tapé
    // ac.focused : le nom de l'option en cours
    return FRUITS.filter((f) => f.startsWith(ac.value.toLowerCase()))
      .map((f) => ({ name: f, value: f }));
  },
}),
```

| Champ du contexte d'autocomplétion | Rôle |
| --- | --- |
| `value` | Le texte saisi (toujours une `string`). |
| `focused` | Le nom de l'option actuellement ciblée. |
| `interaction`, `client`, `user`, `guild` | Accès brut pour des suggestions dynamiques. |
| `services` | Les services injectés (suggestions issues d'une base, par ex.). |
| `logger` | Logger corrélé. |

La valeur de retour accepte `{ name, value }[]`, ou simplement `string[]` /
`number[]`. Une erreur dans le handler est capturée : une liste vide est
renvoyée, la commande n'est jamais cassée.

## `p` - paramètres de customId

Un composant ne peut round-tripper que son `customId` (**100 caractères max**).
`p` encode des paramètres typés dedans, et les décode en `ctx.params`.

| Codec | Type | Encodage |
| --- | --- | --- |
| `p.string` | `string` | tel quel |
| `p.number` | `number` | `String(v)` |
| `p.boolean` | `boolean` | `"1"` / `"0"` |

```ts
params: { ticketId: p.string, page: p.number, admin: p.boolean }
// → ctx.params: { ticketId: string; page: number; admin: boolean }
```

Si le customId encodé dépasse 100 caractères, tu obtiens une erreur **`DJSBOT_E020`**
plutôt qu'un bug silencieux : stocke l'état volumineux ailleurs (un store) et ne
garde qu'une clé courte.

## `field` - champs de modale

| Constructeur | Rendu |
| --- | --- |
| `field.short({...})` | Saisie sur **une ligne**. |
| `field.paragraph({...})` | Saisie **multi-lignes**. |

| Option | Type | Rôle |
| --- | --- | --- |
| `label` | `string` | Libellé affiché au-dessus du champ (requis). |
| `required` | `boolean` | Champ obligatoire côté Discord. |
| `placeholder` | `string` | Texte d'aide affiché à vide. |
| `minLength` / `maxLength` | `number` | Bornes de longueur. |
| `value` | `string` | Valeur pré-remplie. |

```ts
fields: {
  subject: field.short({ label: "Sujet", required: true, maxLength: 80 }),
  body:    field.paragraph({ label: "Détails", minLength: 10, maxLength: 1000 }),
}
// → ctx.fields: { subject: string; body: string }
```

> `ctx.fields` expose **toujours** des `string`. Un champ non rempli renvoie une
> chaîne vide (`""`), pas `undefined`.
