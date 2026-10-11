---
title: "Images et vocal"
description: "Obtenez l'URL d'un avatar, d'une bannière, d'une icône de serveur ou de l'image d'un émoji avec assets, et inspectez, déplacez, rendez muets ou déconnectez des membres dans les salons vocaux avec voice."
sidebar:
  order: 3
---

Deux petits groupes de helpers, tous deux de fines couches au-dessus de
discord.js. `assets` renvoie des URL d'images que vous pouvez mettre dans un
embed ou une galerie. `voice` lit qui se trouve dans quel salon vocal, et
déplace, rend muets ou déconnecte des membres. Il ne joue aucun son et ne
dépend pas de `@discordjs/voice`.

## Un premier avatar

```ts title="features/avatar/avatar.command.ts"
import { defineCommand, s, assets, EmbedBuilder } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "avatar",
  description: "Show an avatar and banner",
  options: {
    user: s.user({ description: "Whose avatar (yours by default)" }),
  },
  run: async (ctx) => {
    const user = ctx.options.user ?? ctx.user;

    const embed = new EmbedBuilder()
      .setTitle(user.username)
      .setThumbnail(assets.avatar(user, { size: 256 }));

    const banner = await assets.banner(user, { size: 1024 });
    if (banner) embed.setImage(banner);

    await ctx.reply({ embeds: [embed] });
  },
});
```

## Avatars et bannières

```ts
import { assets } from "@ix-xs/djs-bot";

assets.avatar(ctx.user, { size: 256 });           // l'avatar de l'utilisateur
assets.avatar(ctx.member, { extension: "png" });  // l'avatar de serveur du membre, s'il en a défini un
await assets.banner(ctx.user, { size: 1024 });    // string | null
```

`assets.avatar` accepte un utilisateur ou un membre de serveur et renvoie
toujours une URL. Avec un membre, l'avatar qu'il a choisi pour ce serveur
l'emporte sur son avatar global. Quelqu'un sans aucun avatar obtient l'image par
défaut de Discord. Passez `ctx.member ?? ctx.user` pour afficher l'avatar du
serveur quand il y en a un.

`assets.banner` est asynchrone et prend un utilisateur, pas un membre.
discord.js ne met pas les bannières en cache : le helper récupère donc
l'utilisateur chez Discord la première fois, puis construit l'URL. Il se résout
à `null` quand l'utilisateur n'a pas de bannière, testez donc le résultat avant
de le donner à `setImage`.

Chaque helper accepte les mêmes options d'image : une `size`, une `extension` et
`forceStatic`. Elles sont listées sous [`ImageOptions`](/messages/assets-and-voice/#imageoptions).

## Images de serveur et d'émoji

```ts
assets.guildIcon(guild, { size: 512 });   // string | null
assets.guildBanner(guild);                // string | null
assets.guildSplash(guild);                // string | null, l'arrière-plan d'invitation
assets.emoji("1234567890", { animated: true, size: 128 });
```

Les trois helpers de serveur renvoient `null` quand le serveur n'a pas défini
cette image. Dans un gestionnaire, `ctx.guild` vaut `null` en dehors d'un
serveur : vérifiez-le d'abord ou ajoutez la [garde](/commands/guards/)
`inGuild()`.

`assets.emoji` construit l'URL de l'image d'un émoji personnalisé à partir de
son seul identifiant, sans aucune recherche : un PNG, ou un GIF quand `animated`
vaut `true`. Pour écrire un émoji dans un message plutôt qu'afficher son image,
utilisez les helpers `emoji` de
[Mentions, horodatages et pings sûrs](/messages/formatting/).

## Lire l'état vocal

```ts
import { voice } from "@ix-xs/djs-bot";

voice.channelOf(member);    // VoiceBasedChannel | null
voice.isConnected(member);  // boolean
voice.membersIn(channel);   // Collection<string, GuildMember>
```

Ces helpers lisent ce que discord.js sait déjà. Ils ne font aucune requête et
répondent immédiatement.

:::caution[Ils ont besoin de l'intent GuildVoiceStates]
Discord ne dit au bot qui est en vocal que lorsque l'intent `GuildVoiceStates`
est activé. Sans lui, `voice.channelOf` renvoie `null` pour tout le monde et
`voice.membersIn` est vide. Avec `intents: "auto"`, l'intent n'est ajouté que
si vous enregistrez un événement `voiceStateUpdate`. Si vous n'utilisez les
helpers que depuis des commandes, ajoutez-le vous-même :
`intents: { add: [GatewayIntentBits.GuildVoiceStates] }`.
Voir [Événements et intents](/events/events-and-intents/).
:::

Pour réagir quand quelqu'un rejoint un salon, le quitte ou en change, écoutez
`voiceStateUpdate`. L'enregistrer active aussi l'intent.

```ts title="features/voice/voice-log.event.ts"
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("voiceStateUpdate", (oldState, newState, ctx) => {
  if (!oldState.channel && newState.channel) {
    ctx.logger.info({ user: newState.id, channel: newState.channel.id }, "joined voice");
  } else if (oldState.channel && !newState.channel) {
    ctx.logger.info({ user: newState.id }, "left voice");
  }
});
```

## Déplacer et rendre muets des membres

```ts
await voice.move(member, channel);              // déplacer vers un autre salon vocal
await voice.move(member, null);                 // null déconnecte
await voice.disconnect(member);                 // retirer du vocal
await voice.mute(member, true, "Too loud");     // mute serveur, avec une raison pour le journal d'audit
await voice.mute(member, false);                // rétablir le micro
await voice.deafen(member);                     // sourdine serveur (true par défaut)
```

Chaque appel est une requête vers Discord et se résout avec le membre mis à
jour. Le bot a besoin de la permission correspondante dans le serveur, et le
membre doit être connecté au vocal : sinon Discord refuse et la promesse est
rejetée.

Cette commande déplace tout le monde du salon vocal de l'appelant vers un autre.
Les gardes vérifient les permissions avant que quoi que ce soit s'exécute.

```ts title="features/voice/vcmove.command.ts"
import {
  defineCommand,
  s,
  voice,
  inGuild,
  hasPermission,
  botHasPermission,
  ChannelType,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";
import type { VoiceBasedChannel } from "discord.js";

export default defineCommand({
  name: "vcmove",
  description: "Move everyone in your voice channel to another one",
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.MoveMembers),
    botHasPermission(PermissionFlagsBits.MoveMembers),
  ],
  options: {
    to: s.channel({ description: "Destination", required: true, channelTypes: [ChannelType.GuildVoice] }),
  },
  run: async (ctx) => {
    const from = ctx.member ? voice.channelOf(ctx.member) : null;
    if (!from) return ctx.reply.error("You are not in a voice channel.");

    const members = voice.membersIn(from);
    for (const member of members.values()) await voice.move(member, ctx.options.to as VoiceBasedChannel);

    return ctx.reply.success(`Moved ${members.size} members.`);
  },
});
```

L'option est limitée aux salons vocaux par `channelTypes`, ce qui rend sûr le
cast vers `VoiceBasedChannel`.

## Référence

### `assets`

| Helper | Renvoie | Description |
| --- | --- | --- |
| `assets.avatar(userOrMember, options?)` | `string` | Le meilleur avatar : l'avatar de serveur pour un membre, sinon l'avatar global, sinon l'image par défaut. |
| `assets.banner(user, options?)` | `Promise<string \| null>` | La bannière de profil de l'utilisateur. Récupère l'utilisateur quand la bannière n'est pas encore connue. |
| `assets.guildIcon(guild, options?)` | `string \| null` | L'icône du serveur. |
| `assets.guildBanner(guild, options?)` | `string \| null` | La bannière du serveur. |
| `assets.guildSplash(guild, options?)` | `string \| null` | L'image d'arrière-plan d'invitation. |
| `assets.emoji(id, options?)` | `string` | L'image d'un émoji personnalisé. Options : `{ animated?: boolean; size?: ImageSize }`. |

`options` est un objet [`ImageOptions`](/messages/assets-and-voice/#imageoptions) partout,
sauf pour `assets.emoji`, qui n'accepte que `animated` et `size`.

### `ImageOptions`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `size` | `ImageSize` | La valeur par défaut de Discord | Une puissance de deux de 16 à 4096 : `16`, `32`, `64`, `128`, `256`, `512`, `1024`, `2048`, `4096`. |
| `extension` | `"webp" \| "png" \| "jpg" \| "jpeg" \| "gif"` | `"webp"` | Format de l'image. |
| `forceStatic` | `boolean` | `false` | Renvoie une image fixe même quand la ressource est animée. |

### `voice`

| Helper | Renvoie | Permission | Description |
| --- | --- | --- | --- |
| `voice.channelOf(member)` | `VoiceBasedChannel \| null` | aucune | Le salon vocal où se trouve le membre. |
| `voice.isConnected(member)` | `boolean` | aucune | Indique s'il est dans un salon vocal quelconque. |
| `voice.membersIn(channel)` | `Collection<string, GuildMember>` | aucune | Les membres actuellement dans un salon, par identifiant. |
| `voice.move(member, channel)` | `Promise<GuildMember>` | Déplacer des membres | Le déplace. `null` le déconnecte. |
| `voice.disconnect(member)` | `Promise<GuildMember>` | Déplacer des membres | Le retire du vocal. |
| `voice.mute(member, muted?, reason?)` | `Promise<GuildMember>` | Rendre muet des membres | Mute serveur. `muted` vaut `true` par défaut ; passez `false` pour rétablir le micro. |
| `voice.deafen(member, deafened?, reason?)` | `Promise<GuildMember>` | Mettre en sourdine des membres | Sourdine serveur. `deafened` vaut `true` par défaut ; passez `false` pour l'annuler. |

`reason` est consignée dans le journal d'audit du serveur. `voice.move` et
`voice.disconnect` n'acceptent pas de raison.

Tous les helpers prennent un `GuildMember`. Dans un gestionnaire, c'est
`ctx.member`, qui vaut `null` en dehors d'un serveur.

## Voir aussi

- [Embeds et pièces jointes](/messages/embeds-and-attachments/) pour les endroits où servent les URL d'images.
- [Événements et intents](/events/events-and-intents/) pour `voiceStateUpdate` et le pilote automatique des intents.
- [Gardes](/commands/guards/) pour `inGuild`, `hasPermission` et `botHasPermission`.
- [Cache et résolution d'entités](/data/cache/) pour récupérer des membres et des salons par identifiant.
