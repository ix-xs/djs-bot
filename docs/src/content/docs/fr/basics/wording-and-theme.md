---
title: "Formulations et thème"
description: "Reformulez ou traduisez chaque phrase que le framework affiche lui-même aux utilisateurs (refus des gardes, erreur générique, boutons de confirmation) et changez les couleurs des réponses sémantiques."
sidebar:
  order: 6
---

Certains messages ne viennent pas de vos gestionnaires. Quand une garde refuse une
commande, quand un gestionnaire lève une erreur, quand `confirm()` affiche ses
deux boutons, le texte est celui du framework. Tout passe par une seule table de
messages, en anglais par défaut, que vous pouvez redéfinir clé par clé.

## Reformuler un message

Passez à `messages` les phrases que vous voulez changer. Les clés que vous
omettez gardent leur formulation par défaut.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  messages: {
    error: "Une erreur est survenue. L'équipe a été prévenue.",
    guildOnly: "Cette commande s'utilise sur un serveur.",
    missingPermissions: "Il te manque : {permissions}.",
    cooldown: "Patiente {seconds}s avant de recommencer.",
    confirm: "Confirmer",
    cancel: "Annuler",
  },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

Une valeur est un modèle : `{seconds}`, `{permissions}` et les autres
espaces réservés sont remplacés par les variables de ce message. Le
[tableau des clés](#frameworkmessages) indique quelles variables chaque message
reçoit. Pour un bot qui ne parle qu'une langue, de simples chaînes suffisent.

## Traduire selon l'utilisateur

Une valeur peut aussi être une fonction. Elle reçoit les variables et, quand il y
en a un, le `ctx` de l'interaction : elle peut donc utiliser votre traducteur et
répondre à chaque utilisateur dans sa propre langue Discord :

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const resources = {
  en: {
    framework: {
      error: "Something went wrong.",
      guildOnly: "This can only be used in a server.",
      cooldown: "Please wait {seconds}s.",
    },
  },
  fr: {
    framework: {
      error: "Une erreur est survenue.",
      guildOnly: "Cette commande s'utilise sur un serveur.",
      cooldown: "Patiente {seconds}s avant de recommencer.",
    },
  },
};

export default defineBot({
  token: env("DISCORD_TOKEN"),
  i18n: { defaultLocale: "en", resources },
  messages: {
    error: (_vars, ctx) => ctx?.t("framework.error") ?? "Something went wrong.",
    guildOnly: (_vars, ctx) => ctx?.t("framework.guildOnly") ?? "Server only.",
    cooldown: (vars, ctx) => ctx?.t("framework.cooldown", vars) ?? `Wait ${vars.seconds}s.`,
  },
});
```

Une fonction est aussi l'endroit pour tout ce qu'un modèle ne sait pas exprimer,
comme un pluriel :

```ts
messages: {
  cooldown: ({ seconds }) => `Wait ${seconds} second${seconds === 1 ? "" : "s"}.`,
}
```

La mise en place de `i18n` et de `ctx.t` est décrite dans
[Internationalisation](/data/i18n/).

## Réutiliser les formulations

`ctx.say(key, vars?)` produit l'un de ces messages depuis votre propre code, avec
vos redéfinitions appliquées. Une garde personnalisée peut refuser avec la même
phrase que les gardes intégrées :

```ts title="src/features/moderation/guards.ts"
import { fail, guard, pass } from "@ix-xs/djs-bot";

/** Passe pour les membres arrivés sur le serveur il y a plus d'une semaine. */
export const establishedMember = guard("establishedMember", (ctx) => {
  if (!ctx.member) return fail(ctx.say("guildOnly"));

  const joined = ctx.member.joinedTimestamp ?? Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - joined > week ? pass() : fail(ctx.say("guardDenied"));
});
```

La clé et ses variables sont vérifiées par le typage : `ctx.say("cooldown", { seconds: 5 })`
compile, alors qu'une clé mal orthographiée ou une variable manquante ne compile
pas.

`DEFAULT_MESSAGES` est exporté si vous voulez lire les modèles anglais intégrés,
par exemple pour initialiser un fichier de traduction.

## Changer les couleurs

`ctx.reply.success`, `ctx.reply.error`, `ctx.reply.info` et `ctx.reply.warn`
envoient un embed avec une couleur d'accent. `theme` change ces quatre couleurs
pour tout le bot. Ne renseignez que celles que vous voulez remplacer :

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  theme: { success: 0x57f287, error: 0xed4245, info: 0x5865f2, warn: 0xfee75c },
});
```

Une couleur est un nombre, le plus souvent écrit sous forme de littéral
hexadécimal. Les helpers eux-mêmes sont décrits dans
[L'objet ctx](/basics/context/).

## Référence

### `FrameworkMessages`

Le type de `messages` dans [`defineBot`](/basics/configuration/#botconfig). Chaque
clé est facultative et contient une [`MessageValue`](#messagevalue).

| Clé | Variables | Texte par défaut | Affiché quand |
| --- | --- | --- | --- |
| `error` | aucune | `Something went wrong. The team has been notified.` | Un gestionnaire a levé une erreur et rien ne l'a traitée. |
| `unknownCommand` | `{name}` | `Unknown command.` | Une commande slash ou de menu contextuel non enregistrée est arrivée au bot. |
| `unknownSubcommand` | `{name}` | `Unknown subcommand.` | Une sous-commande non enregistrée est arrivée au bot. `name` inclut le groupe, s'il y en a un. |
| `guardDenied` | aucune | `You can't do that.` | Une garde a échoué sans donner de raison. |
| `guildOnly` | aucune | `This can only be used in a server.` | `inGuild()` a échoué, ou une garde de permission s'est exécutée hors d'un serveur. |
| `dmOnly` | aucune | `This can only be used in DMs.` | `dmOnly()` a échoué. |
| `missingPermissions` | `{permissions}` | `You need: {permissions}.` | `hasPermission()` a échoué. |
| `botMissingPermissions` | `{permissions}` | `I need: {permissions}.` | `botHasPermission()` a échoué. |
| `wrongChannel` | aucune | `This can't be used in this channel.` | `inChannel()` a échoué. |
| `ownerOnly` | aucune | `You can't use this.` | `ownerOnly()` a échoué. |
| `guildOwnerOnly` | aucune | `Only the server owner can use this.` | `guildOwnerOnly()` a échoué. |
| `missingRole` | aucune | `You don't have the role required for this.` | `hasRole()` a échoué. |
| `cooldown` | `{seconds}` | `Please wait {seconds}s before doing that again.` | `cooldown()` a échoué. |
| `rateLimited` | `{seconds}` | `Rate limit reached. Try again in {seconds}s.` | `rateLimit()` a échoué. |
| `slowDown` | `{seconds}` | `You're doing that too fast - please slow down.` | Le plugin `antiSpam` a refusé une interaction. |
| `featureDisabled` | `{feature}` | `This feature is currently disabled here.` | `featureEnabled()` a échoué. |
| `notAMember` | `{option}` | `That user is not a member of this server.` | Une option `s.member()` obligatoire a reçu un utilisateur qui n'est pas membre du serveur, ou la commande s'est exécutée hors d'un serveur. |
| `confirm` | aucune | `Confirm` | Libellé du bouton de confirmation de `confirm()`. |
| `cancel` | aucune | `Cancel` | Libellé du bouton d'annulation de `confirm()`. |

Les variables :

| Variable | Type | Valeur |
| --- | --- | --- |
| `name` | `string` | La commande reçue, ou la sous-commande avec son groupe. |
| `permissions` | `string` | Les permissions manquantes, lisibles et séparées par des virgules : `Ban Members, Kick Members`. |
| `seconds` | `number` | L'attente restante, en secondes entières, arrondie à l'entier supérieur. |
| `feature` | `string` | Le nom du feature flag désactivé. |
| `option` | `string` | Le nom de l'option de type membre. |

Tous les messages sauf `confirm` et `cancel` sont envoyés avec `ctx.reply.error` :
un embed éphémère dans la couleur `error` du thème.

### `MessageValue`

```ts
type MessageValue<K extends MessageKey = MessageKey> =
  | string
  | ((vars: MessageVars[K], ctx?: BaseContext) => string);
```

| Forme | Comportement |
| --- | --- |
| `string` | Un modèle. Chaque `{placeholder}` qui désigne une variable du message est remplacé par sa valeur. Les autres espaces réservés restent tels qu'écrits. |
| fonction | Appelée avec les variables et le `ctx`, quand il y en a un. Sa valeur de retour est utilisée telle quelle, sans remplacement d'espaces réservés. |

`MessageKey` est l'union des dix-neuf clés ci-dessus, et `MessageVars` associe
chaque clé au type de ses variables.

### `ctx.say(key, vars?)`

```ts
say<K extends MessageKey>(key: K, vars?: MessageVars[K]): string
```

Produit un message en appliquant les redéfinitions de `defineBot({ messages })`,
et retombe sur la valeur anglaise par défaut pour une clé que vous n'avez pas
renseignée.

### `DEFAULT_MESSAGES`

La formulation anglaise intégrée : un objet avec une chaîne modèle par clé, aux
textes du tableau ci-dessus.

### `Theme`

Le type derrière `theme`, qui accepte un `Partial<Theme>`.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `success` | `number` | `0x22c55e` | Couleur de `ctx.reply.success`. |
| `error` | `number` | `0xef4444` | Couleur de `ctx.reply.error`, et donc de tous les refus du framework. |
| `info` | `number` | `0x3b82f6` | Couleur de `ctx.reply.info`. |
| `warn` | `number` | `0xf59e0b` | Couleur de `ctx.reply.warn`. |

`DEFAULT_THEME` est exporté et contient ces quatre valeurs par défaut.

## Limites et erreurs

- **Un texte plus spécifique l'emporte.** Une garde qui échoue avec sa propre
  raison affiche cette raison. `antiSpam({ message })` remplace `slowDown`, et
  les options `confirmLabel` et `cancelLabel` de `confirm()` remplacent `confirm`
  et `cancel` pour une seule boîte de dialogue.
- **Cinq textes par défaut ignorent leur variable.** Les phrases anglaises
  `unknownCommand`, `unknownSubcommand`, `slowDown`, `featureDisabled` et
  `notAMember` ne mentionnent pas `{name}`, `{seconds}`, `{feature}` ni
  `{option}`. Votre propre formulation, elle, peut le faire.
- **`error` n'est pas affiché quand vous traitez l'erreur.** Un `onError` qui
  renvoie une valeur supprime la réponse par défaut : voir [Erreurs](/api/errors/).
- **`messages` ne concerne que les phrases du framework.** Le texte envoyé par
  vos propres gestionnaires se traduit avec `ctx.t`.

## Voir aussi

- [Gardes](/commands/guards/) : les gardes intégrées derrière la plupart de ces messages.
- [Internationalisation](/data/i18n/) : `ctx.t`, les langues et les fichiers de traduction.
- [Pagination et confirmation](/components/pagination/) : la boîte de dialogue `confirm()`.
- [L'objet ctx](/basics/context/) : les helpers de réponse sémantique qui utilisent le thème.
- [Erreurs](/api/errors/) : quand le message générique `error` est envoyé.
