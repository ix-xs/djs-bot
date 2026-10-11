---
title: "Mentions, horodatages et pings sûrs"
description: "Des helpers qui produisent le balisage exact que Discord transforme en mentions, en dates localisées et en émojis personnalisés, et les builders allowedMentions qui décident qui un message a le droit de notifier."
sidebar:
  order: 2
---

Discord affiche un balisage spécial dans le texte des messages : `<@id>` devient
une mention d'utilisateur, `<t:1767268800:R>` devient « dans 2 heures ». Les
helpers `mention`, `timestamp` et `emoji` écrivent ce balisage pour vous, sans
que vous ayez à le retenir. Ils renvoient de simples chaînes et fonctionnent
partout où va du texte : contenu d'un message, descriptions d'embeds, valeurs de
champs, texte Components V2.

## Un premier message formaté

Cette commande mentionne une personne à propos d'un événement qui commence plus
tard. La mention et le compte à rebours sont tous deux générés, et
`allowedMentions` garantit que seule cette personne est notifiée.

```ts title="features/remind/remind.command.ts"
import { defineCommand, s, mention, timestamp, allowedMentions, TimestampStyles } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "remind",
  description: "Tell someone when the event starts",
  options: {
    user: s.user({ description: "Who to remind", required: true }),
    minutes: s.integer({ description: "Minutes from now", required: true, min: 1 }),
  },
  run: async (ctx) => {
    const target = ctx.options.user.id;
    const when = Date.now() + ctx.options.minutes * 60_000;

    await ctx.reply({
      content: `${mention.user(target)} the event starts ${timestamp(when, TimestampStyles.RelativeTime)}.`,
      allowedMentions: allowedMentions.users(target),
    });
  },
});
```

## Mentions

Chaque helper prend un identifiant et renvoie le balisage que Discord affiche
comme une mention.

```ts
import { mention } from "@ix-xs/djs-bot";

mention.user("123");     // <@123>
mention.channel("456");  // <#456>
mention.role("789");     // <@&789>
mention.everyone;        // @everyone
mention.here;            // @here

await ctx.reply(`${mention.user(id)} please read ${mention.channel(rulesId)}`);
```

`mention.everyone` et `mention.here` sont des constantes, pas des fonctions.

Une mention de commande est un `/command` cliquable qui remplit la zone de
saisie de l'utilisateur quand il clique dessus :

```ts
mention.command("config", commandId);              // </config:id>
mention.command("config", commandId, "set");       // </config set:id>
mention.command("config", commandId, "roles add"); // </config roles add:id>
```

Le troisième argument est la sous-commande. Pour une sous-commande dans un
groupe, passez le groupe et la sous-commande séparés par une espace.

L'identifiant est celui que Discord a donné à la commande lors de son
déploiement. Dans le gestionnaire de la commande elle-même, c'est
`ctx.interaction.commandId`. Pour une autre commande, récupérez la liste
déployée :

```ts
const commands = await ctx.client.application.commands.fetch();
const config = commands.find((command) => command.name === "config");

if (config) await ctx.reply(`Try ${mention.command("config", config.id, "set")}`);
```

Cet appel liste les commandes globales. Une commande déployée dans un seul
serveur (ce qui arrive en développement avec un serveur de développement) a un
identifiant différent de sa version globale : récupérez-la plutôt avec
`ctx.guild.commands.fetch()`, et n'écrivez pas en dur un identifiant copié
depuis votre serveur de test. Le déploiement est traité dans
[Déployer les commandes](/production/deploying/).

## Horodatages

`timestamp` produit une date que chaque lecteur voit dans son propre fuseau
horaire et sa propre langue. C'est mieux que de formater une date vous-même, ce
qui vous obligerait à choisir un seul fuseau horaire pour tout le monde.

```ts
import { timestamp, TimestampStyles } from "@ix-xs/djs-bot";

timestamp(new Date());                                          // 20 avril 2021 à 16:20
timestamp(Date.now() + 3_600_000, TimestampStyles.RelativeTime); // dans une heure
timestamp(member.joinedAt, TimestampStyles.LongDate);           // 20 avril 2021
```

Sans style, Discord affiche la date avec une heure courte
(`LongDateShortTime`).

| Style | Lettre | Exemple |
| --- | --- | --- |
| `ShortTime` | `t` | 16:20 |
| `MediumTime` | `T` | 16:20:30 |
| `ShortDate` | `d` | 20/04/2021 |
| `LongDate` | `D` | 20 avril 2021 |
| `LongDateShortTime` | `f` | 20 avril 2021 à 16:20 |
| `FullDateShortTime` | `F` | mardi 20 avril 2021 à 16:20 |
| `ShortDateShortTime` | `s` | 20/04/2021, 16:20 |
| `ShortDateMediumTime` | `S` | 20/04/2021, 16:20:30 |
| `RelativeTime` | `R` | dans une heure, il y a 3 jours |

La formulation exacte dépend de la langue du lecteur. `RelativeTime` est le
style à utiliser pour les délais de récupération (cooldowns), les bannissements
et les rappels : il continue de compter dans le client sans aucune modification
de la part de votre bot.

Les anciens noms `LongTime`, `ShortDateTime` et `LongDateTime` fonctionnent
toujours. Ce sont des alias obsolètes de `MediumTime`, `LongDateShortTime` et
`FullDateShortTime`. L'argument de style accepte aussi la lettre elle-même :
`timestamp(date, "R")`.

Le premier argument peut être une `Date`, des millisecondes Unix ou des
secondes Unix. Un nombre supérieur à 1 000 000 000 000 est lu comme des
millisecondes, tout le reste comme des secondes, donc `Date.now()` et une
valeur stockée en secondes fonctionnent tous deux.

:::note[Valeurs en millisecondes très anciennes]
À cause de ce seuil, un horodatage en millisecondes antérieur à septembre 2001
serait lu comme des secondes. Pour des dates aussi anciennes, passez un objet
`Date`.
:::

## Émojis personnalisés

Les émojis Unicode sont des caractères ordinaires : tapez-les dans vos chaînes.
Les émojis personnalisés (ceux téléversés dans un serveur) demandent un
balisage qui contient leur nom et leur identifiant.

```ts
import { emoji } from "@ix-xs/djs-bot";

emoji.custom("check", "1234567890123456789");   // <:check:1234567890123456789>
emoji.custom("blob", "1234567890", true);       // <a:blob:1234567890> (animé)
emoji.format({ name: "blob", id: "123" });      // <:blob:123>
emoji.parse("<a:blob:123>");                    // { animated: true, name: "blob", id: "123" }
emoji.find(ctx.guild, "blob");                  // GuildEmoji | undefined
```

`emoji.find` cherche par nom dans les émojis du serveur déjà en cache et ne fait
aucune requête. Un `GuildEmoji` se transforme en son propre balisage quand il
est placé dans une chaîne, vous pouvez donc utiliser directement le résultat :

```ts
const check = ctx.guild ? emoji.find(ctx.guild, "check") : undefined;
await ctx.reply(`${check ?? "✅"} Done`);
```

`emoji.parse` est l'inverse de `emoji.custom`. La chaîne entière doit être un
seul émoji personnalisé (les espaces autour sont ignorés) ; il renvoie `null`
pour tout le reste, y compris un émoji Unicode ou un émoji au milieu d'une
phrase.

:::tip[Où trouver l'identifiant d'un émoji]
Dans Discord, tapez une barre oblique inverse avant l'émoji, comme
`\:check:`, et envoyez le message. Le balisage brut apparaît, identifiant
compris. Le bot doit partager un serveur avec l'émoji pour l'utiliser.
:::

Pour l'URL de l'image d'un émoji plutôt que son balisage, voir `assets.emoji`
dans [Images et vocal](/messages/assets-and-voice/).

## Pings sûrs

Afficher une mention et notifier quelqu'un sont deux choses différentes. Par
défaut Discord notifie toute personne mentionnée dans le contenu d'un message,
si bien qu'un bot qui répète ce que saisit un utilisateur peut être amené à
pinguer des gens, des rôles ou, quand il en a la permission, `@everyone`.
L'option `allowedMentions` d'un message limite qui peut être notifié. Les
mentions s'affichent quand même.

```ts
import { allowedMentions, mention } from "@ix-xs/djs-bot";

// Répéter le texte d'un utilisateur, ne notifier personne.
await ctx.reply({ content: userText, allowedMentions: allowedMentions.none() });

// Notifier un utilisateur.
await ctx.reply({
  content: `${mention.user(target)} you were warned`,
  allowedMentions: allowedMentions.users(target),
});

// Notifier un rôle.
await ctx.reply({
  content: `${mention.role(roleId)} heads up`,
  allowedMentions: allowedMentions.roles(roleId),
});
```

:::danger[Définissez-le toujours sur un texte fourni par l'utilisateur]
Envoyer un texte écrit par un utilisateur sans `allowedMentions`, c'est ainsi
qu'un bot finit par pinguer tout un serveur. Utilisez `allowedMentions.none()`
dès que le contenu n'est pas entièrement le vôtre, et autorisez des
identifiants précis quand vous voulez vraiment un ping.
:::

Chaque helper renvoie un objet simple qui ne contient que sa propre clé, et ce
qui n'est pas listé n'est pas notifié : `allowedMentions.users(id)` pingue cet
utilisateur et aucun rôle. Pour autoriser plusieurs types à la fois,
fusionnez-les avec l'opérateur de décomposition :

```ts
allowedMentions: { ...allowedMentions.users(target), ...allowedMentions.roles(roleId) }
```

`repliedUser` compte quand le bot répond à un message avec la fonction de
réponse de Discord, comme le fait un [déclencheur de message](/events/triggers/).
Il décide si l'auteur de ce message est notifié par la réponse :

```ts title="features/fun/thanks.trigger.ts"
import { defineTrigger, allowedMentions } from "@ix-xs/djs-bot";

export default defineTrigger({
  name: "thanks",
  pattern: "thank you",
  run: (ctx) =>
    ctx.reply({
      content: "You are welcome.",
      allowedMentions: allowedMentions.repliedUser(false), // répondre sans ping
    }),
});
```

Pour définir une valeur par défaut pour tous les messages que le bot envoie,
passez-la une fois par l'option `client` de `defineBot`, décrite dans
[Configuration](/basics/configuration/). Un message qui définit son propre
`allowedMentions` remplace entièrement cette valeur par défaut.

```ts
defineBot({
  client: { allowedMentions: allowedMentions.none() },
});
```

## Référence

### `mention`

| Membre | Renvoie | S'affiche comme |
| --- | --- | --- |
| `mention.user(id)` | `<@id>` | @nomdutilisateur |
| `mention.channel(id)` | `<#id>` | #salon |
| `mention.role(id)` | `<@&id>` | @rôle |
| `mention.everyone` | `@everyone` | @everyone |
| `mention.here` | `@here` | @here |
| `mention.command(name, id, subcommand?)` | `</name:id>` ou `</name subcommand:id>` | Un `/command` cliquable |

Tous les identifiants sont des chaînes.

### `timestamp(date, style?)`

```ts
timestamp(date: Date | number, style?: TimestampStylesString): string
```

| Paramètre | Type | Défaut | Description |
| --- | --- | --- | --- |
| `date` | `Date \| number` | obligatoire | Une `Date`, des millisecondes Unix ou des secondes Unix. |
| `style` | `TimestampStylesString` | aucun | Une valeur de `TimestampStyles` ou sa lettre. Sans lui, Discord utilise `f`. |

Renvoie `<t:seconds>` ou `<t:seconds:style>`. Les fractions de seconde sont
supprimées.

### `TimestampStyles`

La constante de discord.js, réexportée. Ses valeurs sont listées dans
[Horodatages](/messages/formatting/#timestamps).

### `emoji`

| Membre | Renvoie | Description |
| --- | --- | --- |
| `emoji.custom(name, id, animated?)` | `string` | `<:name:id>`, ou `<a:name:id>` quand `animated` vaut `true`. `false` par défaut. |
| `emoji.format(e)` | `string` | Le même résultat à partir d'un objet `{ name, id, animated? }`. |
| `emoji.parse(input)` | `{ animated, name, id } \| null` | Relit le balisage d'un émoji personnalisé pour en retrouver les parties. |
| `emoji.find(guild, name)` | `GuildEmoji \| undefined` | Trouve un émoji personnalisé d'un serveur par son nom, depuis le cache. |

### `allowedMentions`

| Membre | Renvoie | Effet |
| --- | --- | --- |
| `allowedMentions.none()` | `{ parse: [] }` | Ne notifie personne. |
| `allowedMentions.all()` | `{ parse: ["everyone", "users", "roles"] }` | Notifie tout ce qui est mentionné : `@everyone`, `@here`, utilisateurs et rôles. |
| `allowedMentions.users(...ids)` | `{ users: ids }` | Ne notifie que ces utilisateurs. |
| `allowedMentions.roles(...ids)` | `{ roles: ids }` | Ne notifie que ces rôles. |
| `allowedMentions.repliedUser(ping)` | `{ repliedUser: ping }` | Indique si une réponse notifie l'auteur du message auquel on répond. |

Le résultat va dans la propriété `allowedMentions` de tout ce qui envoie un
message : `ctx.reply`, `ctx.update`, `channel.send`, `message.reply`.

## Voir aussi

- [Embeds et pièces jointes](/messages/embeds-and-attachments/) pour l'endroit où finit le plus souvent le texte formaté.
- [Images et vocal](/messages/assets-and-voice/) pour les URL d'avatars, de bannières et d'émojis.
- [L'objet ctx](/basics/context/) pour `ctx.reply` et ses options.
- [Configuration](/basics/configuration/) pour l'option `client` et les valeurs par défaut du bot entier.
