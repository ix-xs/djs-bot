---
title: "L'objet ctx"
description: "Chaque gestionnaire reçoit un seul argument, ctx. Il porte l'interaction discord.js brute, qui l'a déclenchée et où, vos services, un logger, et des helpers de réponse qui choisissent pour vous le bon appel Discord."
sidebar:
  order: 3
---

Les commandes, les menus contextuels, les boutons, les menus de sélection et les
modales reçoivent tous un unique `ctx`. La partie commune est la même partout
(`BaseContext`) ; chaque type de gestionnaire y ajoute ce qui lui est propre,
comme `ctx.options` pour une commande ou `ctx.params` pour un bouton.

## Un premier gestionnaire

```ts title="src/features/moderation/warn.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "warn",
  description: "Warn a member",
  options: {
    target: s.user({ description: "Who to warn", required: true }),
    reason: s.string({ description: "Why" }),
  },
  run: async (ctx) => {
    const { target, reason } = ctx.options;   // typé : User, string | undefined

    ctx.logger.info({ target: target.id, by: ctx.user.id }, "warning issued");

    await ctx.reply.success(`${target} was warned: ${reason ?? "no reason given"}`, {
      title: "Warning",
    });
  },
});
```

`ctx.interaction` est l'interaction discord.js brute, et elle ne vous est jamais
cachée. Tout ce que le framework n'enveloppe pas, vous pouvez toujours le faire
là, ou via `ctx.client`.

## Répondre

`ctx.reply` est une fonction qui possède aussi des méthodes.

```ts
await ctx.reply("Plain text");
await ctx.reply({ embeds: [embed], components: [row] });   // InteractionReplyOptions complet

await ctx.reply.success("Saved.");                         // embed vert
await ctx.reply.info("FYI", { ephemeral: true });          // embed bleu
await ctx.reply.warn("Careful.", { title: "Heads up" });   // embed ambre
await ctx.reply.error("Not allowed.");                     // embed rouge, éphémère par défaut

await ctx.reply.ephemeral("Only you can see this.");       // n'importe quel contenu, visible par vous seul
await ctx.reply.followUp("Another message");
await ctx.reply.editReply("Updated");
const message = await ctx.reply.fetch();                   // le Message qui a été envoyé
await ctx.reply.delete();
```

Discord propose trois appels différents selon ce qu'il est déjà arrivé à
l'interaction, et utiliser le mauvais lève une erreur. `ctx.reply(...)` et les
quatre helpers sémantiques regardent l'état et choisissent pour vous :

| L'interaction est | Ils appellent |
| --- | --- |
| pas encore répondue | `interaction.reply()` |
| différée, pas encore répondue | `interaction.editReply()` |
| déjà répondue | `interaction.followUp()` |

Un second `ctx.reply()` dans le même gestionnaire envoie donc un second message
au lieu d'échouer avec `InteractionAlreadyReplied`.

Discord abandonne une interaction qui n'obtient pas de réponse en 3 secondes. Un
gestionnaire qui a besoin de plus de temps affiche d'abord un état de chargement,
puis répond quand il est prêt :

```ts
await ctx.reply.defer({ ephemeral: true });   // l'horloge de 3 secondes est arrêtée
const data = await slowApiCall();             // prenez tout le temps qu'il faut
await ctx.reply.success(`Found ${data.length} results`, { title: "Search" });
```

`ctx.reply.defer()` ne fait rien quand l'interaction a déjà reçu un accusé de
réception. Une réponse est publique ou éphémère dès qu'elle est différée : le
choix `ephemeral` d'une réponse ultérieure est ignoré. Plutôt que de différer à
la main dans chaque gestionnaire lent, laissez le framework le faire : voir
[Différé automatique](/basics/automatic-deferral/).

Utilisez `ctx.reply.error()` pour les refus attendus (« Vous ne pouvez pas
bannir de membres. »), et laissez les échecs inattendus lever une erreur. Le
framework intercepte ce qu'un gestionnaire lève, l'écrit dans les journaux avec
l'identifiant de corrélation et répond par une erreur générique éphémère : voir
[Erreurs](/api/errors/).

## Modifier le message d'origine

Les boutons et les menus de sélection vivent sur un message. Leurs gestionnaires
reçoivent `ctx.update`, qui modifie ce message au lieu d'en envoyer un nouveau.

```ts title="src/features/tickets/close.button.ts"
import { ButtonStyle, defineButton, p } from "@ix-xs/djs-bot";

export default defineButton({
  id: "ticket:close",
  params: { ticketId: p.string },
  label: "Close",
  style: ButtonStyle.Danger,
  run: async (ctx) => {
    await ctx.update.defer();                  // accuse réception, rien ne change à l'écran
    await closeTicket(ctx.params.ticketId);    // travail lent
    await ctx.update({ content: "Ticket closed.", components: [] });
  },
});
```

```ts
await ctx.update("New content");   // modifie le message sur lequel se trouve le composant
await ctx.update.disable();        // désactive tous les composants de ce message
await ctx.update.defer();          // accuse réception sans rien changer
```

Les trois fonctionnent avant comme après `ctx.update.defer()`. Une fois
l'interaction acquittée, elles modifient le message au lieu d'appeler une seconde
fois le `update()` de Discord, ce qui serait refusé. `ctx.update.disable()` est
la façon habituelle de fermer un menu qui ne doit pas servir deux fois.

Après un `ctx.reply.defer()`, qui ouvre une nouvelle réponse, `ctx.update()`
modifie cette réponse et non le message d'origine. Sur un composant, différez
avec `ctx.update.defer()`.

`ctx.reply` reste disponible sur les composants, pour envoyer un nouveau message
en réponse au clic.

## Ouvrir une modale

Les commandes, les menus contextuels, les boutons et les menus de sélection
peuvent répondre par une modale (un formulaire dans une boîte de dialogue).
`ctx.showModal` prend une définition `defineModal()`, suivie de ses paramètres
s'il en a :

```ts title="src/features/feedback/feedback.command.ts"
import { defineCommand, defineModal, field } from "@ix-xs/djs-bot";

export const FeedbackModal = defineModal({
  id: "feedback",
  title: "Send feedback",
  fields: { message: field.paragraph({ label: "Your message", required: true }) },
  run: (ctx) => ctx.reply.success(`Received: ${ctx.fields.message}`),
});

export default defineCommand({
  name: "feedback",
  description: "Send feedback to the team",
  run: (ctx) => ctx.showModal(FeedbackModal),
});
```

```ts
await ctx.showModal(EditModal, { ticketId: "42" });   // les paramètres sont vérifiés par le typage
```

Elle prend les mêmes arguments que le `build()` de la modale : un paramètre
manquant ou du mauvais type est donc une erreur de compilation. Tout objet doté
d'une méthode `build()` qui renvoie un `ModalBuilder` de discord.js est accepté.

:::caution[Une modale doit être la première réponse]
Discord n'accepte une modale que comme première réponse à une interaction.
Appelez `ctx.showModal()` avant toute réponse ou tout différé. C'est aussi la
raison pour laquelle les gestionnaires de modales n'ont pas de `showModal` : une
modale soumise ne peut pas en ouvrir une autre.
:::

La déclaration des champs et leur lecture sont décrites dans
[Modales](/components/modals/).

## Le reste de ctx

Au-delà des réponses, `ctx` donne à un gestionnaire tout ce dont il a besoin sans
rien importer de global.

```ts
run: async (ctx) => {
  // Où et qui. guild et member valent null hors d'un serveur où se trouve le bot.
  if (!ctx.guild) return ctx.reply.error(ctx.say("guildOnly"));

  // Vos services, typés via ServiceMap.
  const balance = await ctx.services.store.get(`coins:${ctx.user.id}`);

  // Un logger lié à cette interaction : chaque ligne porte le même correlationId.
  ctx.logger.info({ balance }, "balance read");

  // Vos traductions, dans la langue Discord de l'utilisateur.
  await ctx.reply(ctx.t("balance.current", { balance }));

  // Le journal d'audit. actorId et guildId sont renseignés pour vous.
  await ctx.audit("balance:read", { targetId: ctx.user.id });
}
```

- `ctx.t(key, vars?)` traduit vos propres messages pour `ctx.locale`. Sans
  configuration `i18n`, elle renvoie la clé inchangée. Voir
  [Internationalisation](/data/i18n/).
- `ctx.say(key, vars?)` produit l'une des phrases du framework, celles que les
  gardes et la barrière d'erreurs affichent. Voir
  [Formulations et thème](/basics/wording-and-theme/).
- `ctx.audit(action, details?)` enregistre une entrée, et ne fait rien quand
  `audit` n'est pas configuré. Voir [Journal d'audit](/data/audit/).
- `ctx.services` contient ce que vous avez enregistré, plus `store`, `audit` et
  `flags` quand ils sont configurés. Voir [Services](/architecture/services/).

Pour vos propres journaux et métriques, `describeInteraction` transforme
n'importe quelle interaction en un type et un nom lisible :

```ts title="src/plugins/request-logger.plugin.ts"
import { definePlugin, describeInteraction } from "@ix-xs/djs-bot";

export default definePlugin({
  name: "request-logger",
  setup(app) {
    app.hooks.afterInteraction((ctx, { durationMs }) => {
      const { kind, name } = describeInteraction(ctx.interaction);
      // { kind: "command", name: "config set" }
      // { kind: "button",  name: "ticket:close" }
      ctx.logger.info({ kind, name, durationMs }, "handled");
    });
  },
});
```

## Ce qu'ajoute chaque gestionnaire

| Gestionnaire | Type de contexte | Ajouté à `BaseContext` |
| --- | --- | --- |
| `defineCommand`, `subcommand` | `CommandContext<Options>` | `options`, `showModal` |
| `defineUserCommand` | `UserCommandContext` | `targetUser`, `targetMember`, `showModal` |
| `defineMessageCommand` | `MessageCommandContext` | `targetMessage`, `showModal` |
| `defineButton` | `ButtonContext<Params>` | `params`, `update`, `showModal` |
| `defineSelectMenu` et les menus natifs | `SelectMenuContext<Params>` | `params`, `values`, `users`, `members`, `roles`, `channels`, `update`, `showModal` |
| `defineModal` | `ModalContext<Fields>` | `fields`, `params` |

Les paramètres de type sont déduits de la définition : vous ne les écrivez jamais.

```ts
options: { target: s.user({ required: true }), reason: s.string() },
run(ctx) {
  ctx.options.target;   // User
  ctx.options.reason;   // string | undefined
}
```

Le gestionnaire `autocomplete` d'une option reçoit un `AutocompleteContext`, qui
ne peut pas répondre : il renvoie les suggestions. Voir
[Options et autocomplétion](/commands/options/).

Les événements, les déclencheurs et les tâches ne sont pas des interactions : leur
contexte n'a donc ni helper `reply` ni `interaction` :

| Contexte | Contient | Page |
| --- | --- | --- |
| `EventContext` | `client`, `services`, `logger`. Passé après les arguments bruts de l'événement discord.js. | [Événements et intents](/events/events-and-intents/) |
| `TriggerContext` | `message`, `author`, `member`, `guild`, `channel`, `client`, `services`, `logger`, `correlationId`, `match`, plus `reply(content)` et `send(content)`. | [Déclencheurs de messages](/events/triggers/) |
| `JobContext` | `client`, `services`, `logger`, `correlationId`, `signal` (interrompu à l'arrêt). | [Tâches planifiées](/events/jobs/) |

## Référence

### `BaseContext`

Partagé par tous les gestionnaires d'interactions.

| Propriété | Type | Description |
| --- | --- | --- |
| `interaction` | l'interaction brute | L'interaction discord.js, typée pour le gestionnaire (une `ButtonInteraction` dans un bouton, et ainsi de suite). |
| `client` | `Client<true>` | Le client discord.js connecté. |
| `user` | `User` | Qui a déclenché l'interaction. |
| `guild` | `Guild \| null` | Le serveur, ou `null` en message privé et dans les serveurs où le bot n'est pas présent. |
| `guildId` | `string \| null` | L'identifiant du serveur. Renseigné même quand le bot n'en est pas membre (applications installées par l'utilisateur). |
| `channel` | `TextBasedChannel \| null` | Le salon d'origine, quand il est résolvable. |
| `channelId` | `string \| null` | L'identifiant du salon d'origine. |
| `member` | `GuildMember \| null` | Le membre, dans un serveur où se trouve le bot. `null` en message privé et pour les applications installées par l'utilisateur utilisées ailleurs. |
| `services` | `ServiceMap` | Les services injectés. |
| `logger` | `Logger` | Un logger enfant lié à `correlationId` et à l'identifiant de l'utilisateur. |
| `correlationId` | `string` | Unique par interaction. Chaque ligne de journal de ce gestionnaire le porte. |
| `locale` | `string` | La langue du client Discord de l'utilisateur, par exemple `"fr"` ou `"en-US"`. |
| `owners` | `readonly string[]` | Les identifiants de `defineBot({ owners })`. |
| `reply` | `ReplyFn` | Le helper de réponse. |

| Méthode | Retourne | Description |
| --- | --- | --- |
| `t(key, vars?)` | `string` | Traduit l'un de vos messages pour `locale`. Renvoie la clé quand i18n n'est pas configuré. |
| `say(key, vars?)` | `string` | Produit l'un des messages du framework, en respectant `defineBot({ messages })`. La clé et ses variables sont vérifiées par le typage. |
| `audit(action, details?)` | `Promise<void>` | Enregistre une entrée d'audit. `details` est `{ targetId?: string; metadata?: Record<string, unknown> }`. |

### `ReplyFn`

Le type de `ctx.reply`. `content` est un `ReplyContent` : une chaîne, ou les
`InteractionReplyOptions` complètes de discord.js.

| Appel | Comportement |
| --- | --- |
| `ctx.reply(content)` | Répond, modifie la réponse différée, ou envoie un message de suivi, selon l'état de l'interaction. |
| `ctx.reply.success(message, options?)` | Embed vert. Public par défaut. |
| `ctx.reply.info(message, options?)` | Embed bleu. Public par défaut. |
| `ctx.reply.warn(message, options?)` | Embed ambre. Public par défaut. |
| `ctx.reply.error(message, options?)` | Embed rouge. Éphémère par défaut. |
| `ctx.reply.ephemeral(content)` | N'importe quel contenu, visible uniquement par l'utilisateur qui a lancé l'interaction. |
| `ctx.reply.defer(options?)` | Affiche l'état de chargement. `options` est `{ ephemeral?: boolean }`. Ne fait rien si l'interaction a déjà reçu un accusé de réception. |
| `ctx.reply.followUp(content)` | Envoie toujours un message supplémentaire. |
| `ctx.reply.editReply(content)` | Modifie toujours la réponse en cours, différée ou envoyée. |
| `ctx.reply.fetch()` | Se résout avec le `Message` envoyé comme réponse. |
| `ctx.reply.delete()` | Supprime la réponse. |

Chaque appel renvoie une promesse. Toutes se résolvent sans valeur, sauf `fetch()`.

### `SemanticReplyOptions`

Accepté par `success`, `info`, `warn` et `error`. Le message devient la
description de l'embed. Les couleurs viennent du thème : voir
[Formulations et thème](/basics/wording-and-theme/).

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `ephemeral` | `boolean` | `false`, `true` pour `error` | Seul l'utilisateur qui a lancé l'interaction voit le message. |
| `title` | `string` | aucun | Un titre affiché au-dessus du message. |

### `UpdateFn`

Le type de `ctx.update`, présent uniquement dans les contextes de boutons et de
menus de sélection.

| Appel | Comportement |
| --- | --- |
| `ctx.update(content)` | Remplace le contenu, les embeds ou les composants du message sur lequel se trouve le composant. |
| `ctx.update.defer()` | Accuse réception en silence. Ne fait rien si l'interaction a déjà reçu un accusé de réception. |
| `ctx.update.disable()` | Désactive tous les composants du message d'origine. |

### `ShowModalFn`

Le type de `ctx.showModal`, présent dans les contextes de commandes, de menus
contextuels, de boutons et de menus de sélection.

```ts
type ShowModalFn = <Args extends unknown[]>(
  modal: { build(...args: Args): ModalBuilder },
  ...args: Args
) => Promise<void>;
```

### `CommandContext<Options>`

| Propriété | Type | Description |
| --- | --- | --- |
| `options` | `Options` | Les options résolues, typées à partir de la table `options` de la commande. Les options obligatoires ne sont pas nullables, les facultatives sont `T \| undefined`. |
| `showModal` | `ShowModalFn` | Ouvre une modale comme réponse. |

### `ButtonContext<Params>`

| Propriété | Type | Description |
| --- | --- | --- |
| `params` | `Params` | Les valeurs typées décodées depuis le customId. Voir [Boutons](/components/buttons/). |
| `update` | `UpdateFn` | Modifie le message d'origine. |
| `showModal` | `ShowModalFn` | Ouvre une modale en réponse au clic. |

### `ModalContext<Fields>`

| Propriété | Type | Description |
| --- | --- | --- |
| `fields` | `Fields` | Les valeurs soumises, indexées par nom de champ et typées selon le type de chaque champ. Voir [Modales](/components/modals/). |
| `params` | typé d'après la modale | Les paramètres décodés depuis le customId de la modale. |

Les contextes des menus de sélection et des menus contextuels sont décrits avec
leurs définitions : [`SelectMenuContext`](/components/select-menus/),
[`UserCommandContext` et `MessageCommandContext`](/commands/context-menus/).

### `describeInteraction(interaction)`

```ts
function describeInteraction(interaction: RepliableInteraction): InteractionSummary
```

| Champ | Type | Description |
| --- | --- | --- |
| `kind` | `"command" \| "userCommand" \| "messageCommand" \| "button" \| "select" \| "modal" \| "other"` | Le type de l'interaction. |
| `name` | `string` | Le nom de la commande avec son groupe et sa sous-commande (`"config set"`), ou l'identifiant de routage d'un composant ou d'une modale, sans ses paramètres encodés. |

Elle ne lève jamais d'erreur : une interaction qu'elle ne reconnaît pas, y compris
une interaction construite à la main dans un test, donne
`{ kind: "other", name: "unknown" }`.

## Voir aussi

- [Différé automatique](/basics/automatic-deferral/) : arrêtez d'appeler `ctx.reply.defer()` à la main.
- [Formulations et thème](/basics/wording-and-theme/) : `ctx.say` et les couleurs des réponses sémantiques.
- [Options et autocomplétion](/commands/options/) : ce qui se retrouve dans `ctx.options`.
- [Embeds et pièces jointes](/messages/embeds-and-attachments/) : un contenu plus riche pour `ctx.reply`.
- [Erreurs](/api/errors/) : ce qui se passe quand un gestionnaire lève une erreur.
