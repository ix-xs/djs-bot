---
title: "Guards - préconditions"
description: "Tous les guards intégrés et comment écrire les tiens."
sidebar:
  label: "Guards"
  order: 5
---

Un **guard** est une précondition composable exécutée avant le handler. S'il
échoue, la chaîne est interrompue et la raison est renvoyée à l'utilisateur.

```ts
guards: [inGuild(), hasPermission(PermissionFlagsBits.BanMembers), cooldown("10s")]
```

Ordre d'exécution : les guards de la **commande** d'abord, puis ceux de la
**sous-commande**.

## Guards intégrés

| Guard | Signature | Rôle |
| --- | --- | --- |
| `inGuild()` | `()` | Exige que l'interaction ait lieu dans un serveur. |
| `dmOnly()` | `()` | Exige que l'interaction ait lieu en messages privés. |
| `hasPermission(...perms)` | `(...PermissionResolvable)` | Le **membre** doit avoir **toutes** ces permissions. |
| `botHasPermission(...perms)` | `(...PermissionResolvable)` | Le **bot** doit avoir toutes ces permissions dans le serveur. |
| `inChannel(...ids)` | `(...string)` | Restreint l'usage à ces salons. |
| `ownerOnly(...ids)` | `(...string)` | Restreint aux ids donnés. **Sans argument**, utilise `defineBot({ owners })`. |
| `cooldown(durée, opts?)` | `(string \| number, { scope? })` | Un usage par durée. |
| `rateLimit(opts)` | `({ limit, window, scope? })` | N usages par fenêtre (plus expressif que `cooldown`). |
| `featureEnabled(nom)` | `(string)` | Bloque si le feature flag est désactivé ici. **Fail-open** si `flags` n'est pas configuré. |

### Portées (`scope`) de `cooldown` et `rateLimit`

| Valeur | Limite par |
| --- | --- |
| `"user"` *(défaut)* | Utilisateur |
| `"guild"` | Serveur |
| `"channel"` | Salon |
| `"global"` | Tout le bot |

```ts
guards: [
  cooldown("10s"),                              // 1 usage / 10 s / utilisateur
  cooldown("1m", { scope: "guild" }),           // 1 usage / minute / serveur
  rateLimit({ limit: 5, window: "1m" }),        // 5 usages / minute / utilisateur
  rateLimit({ limit: 100, window: "1h", scope: "global" }),
]
```

## Écrire un guard

```ts
import { guard, pass, fail } from "@ix-xs/djs-bot";

export const isPremium = guard("isPremium", async (ctx) =>
  (await ctx.services.billing.isPremium(ctx.guildId)) ? pass() : fail("Réservé aux membres premium."),
);
```

| Fonction | Rôle |
| --- | --- |
| `guard(nom, fn)` | Crée un guard nommé. `fn` reçoit `ctx` et renvoie un `GuardResult` (sync ou async). |
| `pass()` | Le guard réussit. |
| `fail(raison)` | Le guard échoue ; `raison` est le message montré à l'utilisateur. |

Le `ctx` d'un guard est le **contexte de base** : tu as accès à `ctx.user`,
`ctx.member`, `ctx.guildId`, `ctx.services`, `ctx.owners`, etc.

## Exemple complet

```ts
export default defineCommand({
  name: "kick",
  description: "Expulser un membre",
  options: { member: s.member({ description: "Qui", required: true }) },
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.KickMembers),    // l'appelant
    botHasPermission(PermissionFlagsBits.KickMembers), // le bot
    cooldown("10s"),
    isPremium,
  ],
  run: async (ctx) => {
    await ctx.options.member.kick();
    await ctx.reply.success(`${ctx.options.member} expulsé.`);
  },
});
```
