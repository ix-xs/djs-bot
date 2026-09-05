---
title: "Définitions - les fonctions define*"
description: "Toutes les fonctions define* et leurs options : commandes, événements, composants, jobs, services, plugins, features."
sidebar:
  label: "Définitions"
  order: 2
---

Tout bloc de construction est un objet simple créé par une fonction `define*()`,
étiqueté par un `kind`. Voici **chaque** fonction et **toutes** ses options.

## `defineCommand` - commande slash

| Option | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `name` | `string` | requis | Nom de la commande. **Minuscules**, 1-32 caractères, lettres/chiffres/`-`/`_` (sinon `DJSBOT_E012`). |
| `description` | `string` | requis | Description affichée dans le sélecteur Discord. |
| `options` | `OptionMap` | `{}` | Les options typées (voir [Options & schémas](/djs-bot/reference-fr/options-schemas/)). |
| `guards` | `Guard[]` | `[]` | Préconditions exécutées avant `run`. |
| `subcommands` | `Record<string, Subcommand>` | - | Sous-commandes (chacune avec ses options typées). |
| `groups` | `Record<string, { description, subcommands }>` | - | Groupes de sous-commandes. |
| `guilds` | `string[]` | - | Déploie la commande **uniquement** sur ces serveurs. Absent → commande **globale**. |
| `integrationTypes` | `("guild" \| "user")[]` | - | Installable sur serveur et/ou compte utilisateur. |
| `contexts` | `("guild" \| "botDm" \| "privateChannel")[]` | - | Contextes d'utilisation autorisés. |
| `nsfw` | `boolean` | - | Marque la commande comme NSFW. |
| `dmPermission` | `boolean` | - | Autorise/interdit l'usage en DM. |
| `defaultMemberPermissions` | `PermissionResolvable` | - | Permissions par défaut requises côté serveur. |
| `nameLocalizations` | `LocalizationMap` | - | Traductions du nom (par locale Discord). |
| `descriptionLocalizations` | `LocalizationMap` | - | Traductions de la description. |
| `run` | `(ctx) => unknown` | - | Le handler. Optionnel si `subcommands`/`groups` sont utilisés. |

```ts
export default defineCommand({
  name: "ban",
  description: "Bannir un membre",
  options: { target: s.user({ description: "Qui", required: true }) },
  guards: [inGuild(), hasPermission(PermissionFlagsBits.BanMembers)],
  run: async (ctx) => { await ctx.guild!.members.ban(ctx.options.target); },
});
```

### `subcommand`

| Option | Type | Rôle |
| --- | --- | --- |
| `description` | `string` | Description de la sous-commande. |
| `options` | `OptionMap` | Ses propres options typées. |
| `guards` | `Guard[]` | Guards spécifiques (exécutés **après** ceux de la commande parente). |
| `run` | `(ctx) => unknown` | Le handler. |

```ts
subcommands: {
  view: subcommand({ description: "Voir", run: (ctx) => ctx.reply.info("…") }),
  set:  subcommand({ description: "Définir", options: { clé: s.string({ required: true }) }, run: … }),
},
```

Le routage vers la bonne sous-commande et la résolution des options sont
**automatiques** - pas de `switch (getSubcommand())`.

## `defineUserCommand` / `defineMessageCommand` - menus contextuels

Commandes du clic droit → **Apps**. Pas de description ni d'options : elles
reçoivent une cible.

| Option | Type | Rôle |
| --- | --- | --- |
| `name` | `string` | Libellé du menu (majuscules et espaces autorisés, 1-32 car.). |
| `guards` | `Guard[]` | Préconditions. |
| `integrationTypes` / `contexts` | | Comme les commandes slash. |
| `guilds` | `string[]` | Scoping par serveur. |
| `nameLocalizations` | `LocalizationMap` | Traductions du nom. |
| `run` | `(ctx) => unknown` | Handler. `ctx.targetUser`/`ctx.targetMember` (user) ou `ctx.targetMessage` (message). |

## `defineEvent` - écouteur de passerelle

```ts
defineEvent("guildMemberAdd", async (member, ctx) => { … });
defineEvent("clientReady", (client, ctx) => { … }, { once: true });
```

| Paramètre | Type | Rôle |
| --- | --- | --- |
| `event` | `keyof ClientEvents` | Nom de l'événement discord.js (typé). |
| `run` | `(...args, ctx) => unknown` | Les arguments de l'événement, **puis** `ctx` en dernier. |
| `options.once` | `boolean` | `true` = ne se déclenche qu'une fois. |

L'autopilote d'intents active automatiquement les intents (et partials)
nécessaires à l'événement enregistré.

## `defineTrigger` - auto-répondeur de messages

| Option | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `name` | `string` | requis | Nom du trigger. |
| `pattern` | `string \| RegExp \| (message) => boolean` | requis | Mot-clé, expression régulière, ou prédicat. |
| `mode` | `"includes" \| "equals" \| "startsWith" \| "endsWith"` | `"includes"` | Mode de comparaison pour un mot-clé. |
| `caseInsensitive` | `boolean` | `true` | Insensible à la casse. |
| `ignoreBots` | `boolean` | `true` | Ignore les messages des bots. |
| `cooldown` | `string \| number` | - | Délai par auteur. |
| `run` | `(ctx) => unknown` | requis | Handler. `ctx.reply(...)`, `ctx.send(...)`, `ctx.match` (groupes regex). |

Enregistrer un trigger active `GuildMessages` + `MessageContent` (**privilégié**)
+ `DirectMessages`.

## `defineButton` - bouton + customId typé

| Option | Type | Rôle |
| --- | --- | --- |
| `id` | `string` | Clé de routage stable (ex. `"ticket:close"`). Non vide, sans `$` (sinon `DJSBOT_E013`). |
| `params` | `ParamMap` | Paramètres typés encodés dans le customId. |
| `guards` | `Guard[]` | Préconditions. |
| `run` | `(ctx) => unknown` | Handler. `ctx.params` décodé et typé. |

**Construction** : `Bouton.build(params, options)` où `options` accepte
`{ label, style, emoji, disabled }`.

```ts
export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, ownerId: p.string },
  run: (ctx) => { /* ctx.params.ticketId, ctx.params.ownerId */ },
});

const bouton = CloseTicket.build(
  { ticketId, ownerId: ctx.user.id },
  { label: "Fermer", style: ButtonStyle.Danger, emoji: "🔒" },
);
```

## Menus de sélection

| Fonction | Champs de contexte | Options de `build` supplémentaires |
| --- | --- | --- |
| `defineSelectMenu` | `ctx.values: string[]` | `options: [...]` |
| `defineUserSelect` | `ctx.users`, `ctx.members` | `defaultValues` |
| `defineRoleSelect` | `ctx.roles` | `defaultValues` |
| `defineChannelSelect` | `ctx.channels` | `channelTypes`, `defaultValues` |
| `defineMentionableSelect` | `ctx.users`, `ctx.roles`, `ctx.members` | |

Toutes acceptent `id`, `params`, `guards`, `run`. `build(params, options)` accepte
`{ placeholder, minValues, maxValues, disabled }` (+ les colonnes ci-dessus).

## `defineModal` - modale (formulaire)

| Option | Type | Rôle |
| --- | --- | --- |
| `id` | `string` | Clé de routage (règles du customId). |
| `title` | `string` | Titre de la modale. |
| `fields` | `FieldMap` | Champs texte (voir [Options & schémas](/djs-bot/reference-fr/options-schemas/)). |
| `params` | `ParamMap` | Paramètres typés (optionnel). |
| `guards` | `Guard[]` | Préconditions. |
| `run` | `(ctx) => unknown` | Handler. `ctx.fields` typé. |

Ouverture : `ctx.interaction.showModal(MaModale.build())` (jamais après un
`reply`/`defer` - une modale doit être la **première** réponse).

## `defineService` - service injectable

```ts
defineService("db", { factory: () => createDb() });
defineService("tickets", { deps: ["db"], factory: ({ db }) => new Tickets(db) });
```

| Paramètre | Type | Rôle |
| --- | --- | --- |
| `name` | `string` | Jeton d'injection unique. |
| `input.deps` | `string[]` | Noms des services injectés dans `factory`. |
| `input.factory` | `(deps) => T \| Promise<T>` | Construit l'instance à partir des dépendances résolues. |

Type ton `ctx.services` de bout en bout en augmentant `ServiceMap` :

```ts
declare module "@ix-xs/djs-bot" {
  interface ServiceMap { db: Db; tickets: TicketsService }
}
```

## `defineJob` - tâche planifiée

| Option | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `name` | `string` | requis | Nom du job. |
| `schedule` | `string` | requis | Cron 5 champs (`"0 3 * * *"`) **ou** durée (`"30s"`, `"5m"`, `"1h"`). |
| `timezone` | `string` | système | Fuseau horaire (cron), ex. `"Europe/Paris"`. |
| `concurrency` | `number` | `1` | Exécutions simultanées max (1 = pas de chevauchement). |
| `runOnStart` | `boolean` | `false` | Exécute une fois au démarrage. |
| `run` | `(ctx) => unknown` | requis | Handler. `ctx.signal` (AbortSignal, déclenché à l'arrêt). |

## `definePlugin` - plugin transverse

| Option | Type | Rôle |
| --- | --- | --- |
| `name` | `string` | Nom du plugin. |
| `version` | `string` | Version (informative). |
| `requires` | `string[]` | Capacités nécessaires (validées au boot). |
| `provides` | `string[]` | Capacités exposées. |
| `conflicts` | `string[]` | Capacités incompatibles (→ `DJSBOT_E041`). |
| `setup` | `(app) => void` | Enregistre middleware et hooks via la façade `app`. |

La façade `app` : `app.hooks.beforeInteraction/afterInteraction/onError/onReady/onShutdown`,
et `app.services.register(token, valeur)` / `app.services.has(token)`.

## `defineFeature` - pack réutilisable

Regroupe commandes, événements, composants, services et jobs en une unité fermée
et publiable, avec un contrat.

| Option | Type | Rôle |
| --- | --- | --- |
| `name` | `string` | Nom de la feature. |
| `requires` | `string[]` | Capacités que l'hôte doit fournir (ex. `["store"]`). |
| `provides` | `string[]` | Capacités exposées. |
| `commands`, `userCommands`, `messageCommands`, `events`, `triggers`, `buttons`, `selectMenus`, `modals`, `services`, `jobs`, `plugins` | tableaux | Les définitions incluses. |
