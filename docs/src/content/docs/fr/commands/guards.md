---
title: "Gardes"
description: "Une garde est une condition préalable vérifiée avant l'exécution d'un gestionnaire : une permission, un délai de récupération, un salon, ou n'importe quelle règle de votre cru. Quand l'une échoue, l'utilisateur est informé de la raison et le gestionnaire ne démarre jamais."
sidebar:
  order: 5
---

## Une première garde

```ts title="features/moderation/kick.command.ts"
import {
  defineCommand,
  s,
  inGuild,
  hasPermission,
  botHasPermission,
  cooldown,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";

export default defineCommand({
  name: "kick",
  description: "Kick a member",
  options: { target: s.member({ description: "Member", required: true }) },
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.KickMembers),      // le membre qui a lancé la commande
    botHasPermission(PermissionFlagsBits.KickMembers),   // le bot lui-même
    cooldown("10s"),                                     // par utilisateur
  ],
  run: async (ctx) => {
    await ctx.options.target.kick();
    await ctx.reply.success(`Kicked ${ctx.options.target}.`);
  },
});
```

`guards` est un tableau, accepté par tous les gestionnaires d'interaction : commandes slash, [sous-commandes](/commands/subcommands/), [menus contextuels](/commands/context-menus/), boutons, menus de sélection et modales.

- Les gardes s'exécutent dans l'ordre du tableau. Le tableau signifie déjà « toutes ».
- La première qui échoue arrête tout : sa raison est envoyée à l'utilisateur sous forme de réponse d'erreur éphémère, et le gestionnaire n'est pas appelé.
- Sur une sous-commande, les gardes de la commande parente s'exécutent d'abord, puis les siennes.

Comme les gestionnaires ne s'exécutent que si leurs conditions préalables sont remplies, `run` reste libre de toute vérification de permission et de tout retour anticipé.

Un refus est consigné au niveau `debug` avec le nom de la garde, et compté comme `guardRejections` dans les statistiques du bot : voir [Santé et métriques](/production/health/). Le middleware des plugins (`beforeInteraction`) s'exécute avant les gardes : un plugin de mode maintenance peut donc arrêter une interaction avant n'importe quelle garde, et un plugin de journalisation mesure ensemble la durée des gardes et celle du gestionnaire : voir [Plugins et hooks](/architecture/plugins/).

## Gardes intégrées

| Garde | Passe quand | Clé de message |
| --- | --- | --- |
| `inGuild()` | Utilisée dans un serveur | `guildOnly` |
| `dmOnly()` | Utilisée hors d'un serveur | `dmOnly` |
| `hasPermission(...perms)` | Le membre a toutes les permissions, dans ce salon | `missingPermissions` |
| `botHasPermission(...perms)` | Le bot a toutes les permissions, dans ce salon | `botMissingPermissions` |
| `hasRole(...roleIds)` | Le membre a au moins un des rôles | `missingRole` |
| `inChannel(...channelIds)` | Utilisée dans l'un des salons listés | `wrongChannel` |
| `ownerOnly(...userIds?)` | L'utilisateur est un propriétaire du bot | `ownerOnly` |
| `guildOwnerOnly()` | L'utilisateur est propriétaire du serveur | `guildOwnerOnly` |
| `cooldown(duration, options?)` | Le délai de récupération est écoulé | `cooldown` |
| `rateLimit({ limit, window, scope? })` | L'utilisateur est sous la limite. Voir [Résilience](/production/resilience/) | `rateLimited` |
| `featureEnabled(name)` | Le flag est activé pour ce serveur. Voir [Feature flags](/data/flags/) | `featureDisabled` |

La clé de message désigne la phrase affichée quand la garde refuse. Chacune peut être reformulée ou traduite dans `defineBot({ messages })` : voir [Formulations et thème](/basics/wording-and-theme/).

**Permissions.** `hasPermission` et `botHasPermission` acceptent tout `PermissionResolvable` : un membre de `PermissionFlagsBits`, une chaîne comme `"KickMembers"`, ou plusieurs d'entre eux. Toutes doivent être détenues.

```ts
guards: [hasPermission(PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads)]
```

Les deux vérifient les permissions telles que Discord les a calculées pour le salon où l'interaction a eu lieu, surcharges de salon comprises. Un membre qui est modérateur sur tout le serveur mais à qui l'accès est refusé dans un salon y sera refusé, tout comme un bot dont le rôle a perdu une permission à cause d'une surcharge. Le refus nomme uniquement ce qui manque, de façon lisible : `You need: Ban Members.`

`botHasPermission` est celle que l'on oublie. Elle transforme « la commande n'a rien fait » en un message clair, avant même que le gestionnaire démarre.

**Rôles et salons.** `hasRole` et `inChannel` prennent des identifiants. Une seule correspondance suffit :

```ts
guards: [hasRole(MOD_ROLE_ID, ADMIN_ROLE_ID), inChannel(STAFF_CHANNEL_ID)]
```

**Propriétaires.**

```ts
ownerOnly()                 // les identifiants de defineBot({ owners: [...] })
ownerOnly("123", "456")     // ces identifiants, sans tenir compte de la config
guildOwnerOnly()            // le propriétaire du serveur où la commande s'exécute
```

## Délais de récupération

`cooldown` laisse passer une utilisation, puis refuse jusqu'à ce que la durée soit écoulée. Le refus indique à l'utilisateur combien de secondes il reste.

```ts
guards: [cooldown("10s"), cooldown("1m", { scope: "guild" })]
```

| Portée | Un délai partagé par |
| --- | --- |
| `"user"` (par défaut) | Chaque utilisateur |
| `"guild"` | Chaque serveur |
| `"channel"` | Chaque salon |
| `"global"` | Tout le monde, sur l'ensemble du bot |

- La durée est une chaîne comme `"5s"`, `"2m"`, `"1h"` ou `"1h30m"`, ou un nombre de millisecondes.
- Chaque appel à `cooldown()` possède ses propres minuteurs : la limite s'applique donc à la commande ou au composant auquel il est attaché. Deux commandes ne partagent jamais un délai, sauf si vous leur donnez la même instance de garde.
- Le délai démarre quand cette garde passe. Placez-la après les gardes susceptibles de refuser, comme dans le premier exemple, pour qu'un utilisateur refusé ne déclenche pas aussi un délai.
- Les minuteurs vivent en mémoire. Un redémarrage les remet à zéro et ils ne sont pas partagés entre les shards.
- Les entrées expirées sont balayées à mesure que la garde s'exécute : un bot qui tourne longtemps ne garde donc pas une entrée par utilisateur pour toujours.

Pour « 5 utilisations par minute » plutôt que « une utilisation toutes les 10 secondes », utilisez `rateLimit`, décrit dans [Résilience](/production/resilience/).

## Combiner des gardes

```ts title="features/admin/purge.command.ts"
import {
  defineCommand,
  anyOf,
  not,
  ownerOnly,
  hasPermission,
  inChannel,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";

const SPAM_CHANNEL_ID = "123456789012345678";

export default defineCommand({
  name: "purge",
  description: "Delete recent messages",
  guards: [
    // Passe quand au moins une passe. Affiche la dernière raison si toutes échouent.
    anyOf(ownerOnly(), hasPermission(PermissionFlagsBits.ManageGuild)),
    // Passe quand la garde interne échoue. La chaîne est le message de refus.
    not(inChannel(SPAM_CHANNEL_ID), "Not in this channel, please."),
  ],
  run: (ctx) => ctx.reply.success("Done."),
});
```

Les gardes sont de simples valeurs : un ensemble que vous utilisez souvent peut donc vivre dans une constante :

```ts
export const modOnly = [inGuild(), hasPermission(PermissionFlagsBits.ModerateMembers)];

// dans une commande
guards: [...modOnly, cooldown("3s")]
```

## Écrire les vôtres

Une garde est un nom et une fonction qui reçoit `ctx` et renvoie `pass()` ou `fail(reason)`. Elle peut être `async`, et elle dispose du [`ctx`](/basics/context/) complet : services, journaliseur, utilisateur, serveur.

```ts title="features/billing/guards.ts"
import { guard, pass, fail } from "@ix-xs/djs-bot";

export const isPremium = guard("isPremium", async (ctx) => {
  if (!ctx.guildId) return fail(ctx.say("guildOnly"));
  const subscription = await ctx.services.billing.subscription(ctx.guildId);
  return subscription?.active ? pass() : fail("This command requires a premium server.");
});
```

Utilisez-la ensuite comme une garde intégrée : `guards: [inGuild(), isPremium]`.

- La `reason` passée à `fail()` est ce que l'utilisateur lit : écrivez-la pour lui.
- `ctx.say("guildOnly")` renvoie l'une des phrases du framework, avec vos reformulations et traductions appliquées. Utilisez-le pour rester cohérent avec les gardes intégrées.
- Le nom apparaît dans les journaux et dans les résultats de test. Le harnais décrit dans [Tests](/production/testing/) indique si les gardes ont passé et, sinon, la raison.

:::caution[Refus après un différé public]
Un refus est éphémère, sauf si l'interaction a déjà été différée publiquement. Cela arrive quand une définition a un `defer` public et qu'une garde est assez lente pour que le différé se déclenche d'abord, ou quand `defer` utilise `after: 0`. Le refus remplace alors l'état de chargement et tout le monde le voit. Utilisez `defer: "ephemeral"` sur ces définitions : voir [Différé automatique](/basics/automatic-deferral/).
:::

## Gardes et permissions Discord

`defaultMemberPermissions` sur une commande et la garde `hasPermission()` se ressemblent. Elles résolvent des problèmes différents et sont mieux utilisées ensemble.

| | `defaultMemberPermissions` | Garde `hasPermission()` |
| --- | --- | --- |
| Appliquée par | Discord, dans l'interface | Votre bot, à l'exécution |
| Effet | La commande est masquée aux membres qui n'ont pas la permission | La commande répond par un refus clair |
| Les administrateurs du serveur peuvent-ils la modifier ? | Oui, dans Paramètres du serveur > Intégrations | Non |
| Disponible sur | Commandes et menus contextuels | Tous les gestionnaires, composants compris |

Déclarez `defaultMemberPermissions` pour que la commande ne soit même pas visible, et gardez la garde pour qu'un changement fait par un administrateur ne puisse pas contourner vos propres règles.

## Référence

### `guard(name, run)`

Crée une `Guard`.

| Paramètre | Type | Description |
| --- | --- | --- |
| `name` | `string` | Affiché dans les journaux et dans les résultats de test. |
| `run` | `(ctx: BaseContext) => GuardResult \| Promise<GuardResult>` | La vérification. Son type est exporté sous le nom `GuardFn`. |

### `pass()`

Renvoie `{ ok: true }` : le gestionnaire peut s'exécuter. Aussi disponible sous `guard.pass`.

### `fail(reason)`

Renvoie `{ ok: false, reason }`. `reason` est le texte montré à l'utilisateur. Aussi disponible sous `guard.fail`.

### `anyOf(...guards)`

Passe dès qu'une des gardes passe, sans exécuter celles qui suivent. Quand toutes échouent, la raison de la dernière est affichée.

### `not(inner, reason?)`

Passe quand `inner` échoue. `reason` est affichée quand `inner` passe. Sans elle, l'utilisateur reçoit le message générique `guardDenied`.

### `inGuild()`

Passe quand l'interaction a un identifiant de serveur. Cela inclut un serveur dont le bot n'est pas membre, ce qui arrive avec les commandes installées sur un compte utilisateur.

### `dmOnly()`

Passe quand l'interaction n'a pas d'identifiant de serveur : les messages privés du bot et les autres salons privés.

### `hasPermission(...permissions)`

Exige que le membre qui invoque la commande détienne toutes les permissions dans le salon courant. Quand Discord ne fournit pas de permissions pour le membre (en message privé), elle refuse avec le message `guildOnly`.

### `botHasPermission(...permissions)`

La même vérification pour le bot, avec le message `botMissingPermissions`.

### `hasRole(...roleIds)`

Passe quand le membre a au moins un des rôles. Elle échoue s'il n'y a pas de membre : en message privé, et dans un serveur où le bot n'est pas présent.

### `inChannel(...channelIds)`

Passe quand l'interaction vient de l'un des salons.

### `ownerOnly(...userIds)`

Passe quand l'utilisateur est dans la liste. Sans argument, la liste est `defineBot({ owners })`. Avec des arguments, la config est ignorée. Sans l'un ni l'autre, personne ne passe.

### `guildOwnerOnly()`

Passe quand l'utilisateur est propriétaire du serveur. Elle échoue hors d'un serveur, et dans un serveur où le bot n'est pas présent.

### `cooldown(duration, options?)`

| Paramètre | Type | Défaut | Description |
| --- | --- | --- | --- |
| `duration` | `string \| number` | obligatoire | Une durée comme `"5s"`, ou des millisecondes. Une chaîne illisible ne donne aucun délai. |
| `options.scope` | `CooldownScope` | `"user"` | Ce qui partage un même délai : `"user"`, `"guild"`, `"channel"` ou `"global"`. En message privé, `"guild"` se rabat sur l'utilisateur. |

### Types

| Type | Description |
| --- | --- |
| `Guard` | `{ kind: "guard", name, run }`. Ce que renvoie chacune des fonctions ci-dessus. |
| `GuardFn` | La fonction de vérification d'une garde. |
| `GuardResult` | `{ ok: boolean, reason?: string }`. Un échec sans raison affiche le message `guardDenied`. |
| `CooldownScope` | `"user" \| "guild" \| "channel" \| "global"`. Aussi utilisé par `rateLimit`. |

## Voir aussi

- [Commandes slash](/commands/slash-commands/)
- [Formulations et thème](/basics/wording-and-theme/)
- [Résilience](/production/resilience/)
- [Feature flags](/data/flags/)
- [Plugins et hooks](/architecture/plugins/)
