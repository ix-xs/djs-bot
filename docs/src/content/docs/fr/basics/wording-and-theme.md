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
[tableau des clés](/reference/framework-messages/) indique quelles variables chaque message
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

Chaque option, propriété et type, avec ce qu'il accepte et renvoie, est dans la référence de l'API :

- `FrameworkMessages` : La table de messages remplaçable acceptée par `defineBot({ messages })`.
- `defineBot()` : Crée un `Bot`.
- `MessageValue` : Un message : une chaîne modèle avec des `{placeholders}`, ou une fonction pour un contrôle total (traduction, pluralisation).
- `inGuild()` : Exige que l'interaction ait lieu dans un serveur.
- `dmOnly()` : Exige que l'interaction ait lieu en messages privés.
- `hasPermission()` : Exige que le membre qui invoque possède toutes les permissions données **dans le salon courant** (surcharges du salon incluses, telles que calculées par Discord).
- `botHasPermission()` : Exige que le *bot* possède toutes les permissions données **dans le salon courant** (surcharges du salon incluses, telles que calculées par Discord).
- `inChannel()` : Restreint l'usage à des identifiants de salon précis.
- `ownerOnly()` : Restreint l'usage à des identifiants d'utilisateur précis.
- `guildOwnerOnly()` : Restreint l'usage au propriétaire du serveur où l'interaction a lieu.
- `hasRole()` : Exige que le membre qui invoque possède **au moins un** des rôles donnés.
- `cooldown()` : Cooldown par invocation.
- `rateLimit()` : Une garde qui autorise `limit` utilisations par `window`, par portée (`"user"` par défaut).
- `antiSpam()` : Rejette les interactions d'un utilisateur qui dépasse une limite de débit par fenêtre : commandes, composants et formulaires.

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
