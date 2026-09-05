---
title: "Contexte & réponses - ctx"
description: "Toutes les propriétés et méthodes de ctx, pour chaque type de handler."
sidebar:
  label: "Contexte & réponses"
  order: 4
---

Chaque handler reçoit un unique objet `ctx`. Il regroupe l'interaction brute
discord.js et des raccourcis pratiques - il ne **cache** jamais discord.js :
`ctx.interaction` et `ctx.client` sont toujours accessibles.

## Contexte de base (`BaseContext`)

Présent dans **tous** les handlers d'interaction (commandes, boutons, menus,
modales, menus contextuels).

| Propriété | Type | Rôle |
| --- | --- | --- |
| `interaction` | l'interaction discord.js | Accès complet à l'API réelle. |
| `client` | `Client<true>` | Le client connecté. |
| `user` | `User` | L'utilisateur qui a déclenché l'interaction. |
| `guild` | `Guild \| null` | Le serveur, si applicable. |
| `guildId` | `string \| null` | L'id du serveur. |
| `channel` | `TextBasedChannel \| null` | Le salon d'origine. |
| `member` | `GuildMember \| null` | Le membre, en serveur. |
| `services` | `ServiceMap` | Les services injectés (typés via `ServiceMap`). |
| `logger` | `Logger` | Logger portant un `correlationId`. |
| `correlationId` | `string` | Identifiant unique reliant toutes les lignes de log de cette interaction. |
| `locale` | `string` | Langue du client Discord de l'utilisateur (`"fr"`, `"en-US"`…). |
| `owners` | `readonly string[]` | Les ids de `defineBot({ owners })`. |
| `t(clé, vars?)` | `string` | Traduit dans la locale de l'utilisateur (voir i18n). |
| `audit(action, détails?)` | `Promise<void>` | Enregistre une entrée d'audit (acteur et serveur remplis automatiquement). |
| `reply` | `ReplyFn` | Helper de réponse (voir ci-dessous). |

### Champs supplémentaires selon le handler

| Handler | Champs en plus |
| --- | --- |
| Commande slash | `options` (typé depuis `options`) |
| Sous-commande | `options` (typé depuis les options **de la sous-commande**) |
| Menu contextuel **user** | `targetUser: User`, `targetMember: GuildMember \| null` |
| Menu contextuel **message** | `targetMessage: Message` |
| Bouton | `params` (décodé), `update` |
| Menu de sélection (string) | `values: string[]`, `params`, `update` |
| Menu natif user/mentionable | `users`, `members`, `params`, `update` |
| Menu natif role/mentionable | `roles`, `params`, `update` |
| Menu natif channel | `channels`, `params`, `update` |
| Modale | `fields` (typé), `params` |

## `ctx.reply` - répondre

`reply` est **conscient de l'état** : si l'interaction a été différée, il édite ;
si elle a déjà répondu, il enchaîne un follow-up ; sinon il répond. Tu n'as rien
à suivre toi-même.

| Méthode | Rôle |
| --- | --- |
| `ctx.reply(contenu)` | Répond avec du texte ou un objet `InteractionReplyOptions` complet. |
| `ctx.reply.success(msg, opts?)` | Embed vert de succès. |
| `ctx.reply.error(msg, opts?)` | Embed rouge d'erreur - **éphémère par défaut**. |
| `ctx.reply.info(msg, opts?)` | Embed bleu d'information. |
| `ctx.reply.defer(opts?)` | Diffère la réponse (handlers > 2,5 s). |
| `ctx.reply.followUp(contenu)` | Envoie un message supplémentaire. |
| `ctx.reply.editReply(contenu)` | Édite la réponse (différée ou envoyée). |

Les options `opts` des helpers sémantiques : `{ ephemeral?: boolean, title?: string }`.

```ts
await ctx.reply.defer({ ephemeral: true });
const data = await longueRequete();
await ctx.reply.editReply({ embeds: [monEmbed] });
```

## `ctx.update` - éditer le message d'origine

Disponible sur les **composants** (boutons, menus).

| Méthode | Rôle |
| --- | --- |
| `ctx.update(contenu)` | Édite le message qui porte le composant. |
| `ctx.update.disable()` | Désactive **tous** les composants de ce message. |
| `ctx.update.defer()` | Accuse réception sans rien changer. |

## `ctx.audit` - journaliser une action

```ts
await ctx.audit("member.ban", {
  targetId: ctx.options.user.id,
  metadata: { reason: ctx.options.reason },
});
```

| Paramètre | Type | Rôle |
| --- | --- | --- |
| `action` | `string` | Ce qui s'est passé, ex. `"member.ban"`. |
| `details.targetId` | `string` | La cible de l'action. |
| `details.metadata` | `Record<string, unknown>` | Données libres. |

No-op si `audit` n'est pas configuré. Un sink défaillant **ne casse jamais** la
commande (les erreurs de sink sont avalées).

## `ctx.t` - traduire

```ts
await ctx.reply.success(ctx.t("economy.claimed", { n: 100 }));
```

Utilise `ctx.locale`. Sans configuration `i18n`, renvoie simplement la clé (no-op
sûr). Voir [Données & état](/djs-bot/reference-fr/donnees/).

## Contextes hors interaction

### Événements (`defineEvent`)

| Champ | Rôle |
| --- | --- |
| `client` | Le client connecté. |
| `services` | Les services injectés. |
| `logger` | Logger. |

Les arguments de l'événement viennent **avant** `ctx` :
`(member, ctx) => …`.

### Jobs (`defineJob`)

| Champ | Rôle |
| --- | --- |
| `client`, `services`, `logger` | Comme ci-dessus. |
| `signal` | `AbortSignal` déclenché à l'arrêt du bot - les jobs longs doivent l'observer. |

### Triggers (`defineTrigger`)

| Champ | Rôle |
| --- | --- |
| `message` | Le message déclencheur. |
| `author`, `member`, `guild`, `channel` | Raccourcis. |
| `match` | `RegExpMatchArray \| null` - les groupes capturés si le pattern était une RegExp. |
| `services`, `logger` | Comme ailleurs. |
| `ctx.reply(contenu)` | **Répond** au message déclencheur. |
| `ctx.send(contenu)` | Envoie un **nouveau** message dans le salon. |
