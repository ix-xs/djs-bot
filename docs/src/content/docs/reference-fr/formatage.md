---
title: "Formatage & médias"
description: "mention, emoji, timestamp, allowedMentions, assets et voice - toutes les méthodes."
sidebar:
  label: "Formatage & médias"
  order: 7
---

## `mention` - mentions

| Méthode | Rend | Rôle |
| --- | --- | --- |
| `mention.user(id)` | `<@id>` | Mentionne un utilisateur. |
| `mention.channel(id)` | `<#id>` | Mentionne un salon. |
| `mention.role(id)` | `<@&id>` | Mentionne un rôle. |
| `mention.everyone` | `@everyone` | Constante. |
| `mention.here` | `@here` | Constante. |
| `mention.command(nom, id, sous?)` | `</nom:id>` | Mention **cliquable** d'une commande slash. |

```ts
mention.command("config", commandId);          // </config:123>
mention.command("config", commandId, "set");   // </config set:123>
```

## `timestamp` - horodatages

```ts
timestamp(new Date());                                // <t:…>
timestamp(Date.now(), TimestampStyles.RelativeTime);  // « dans 2 heures »
```

| Paramètre | Type | Rôle |
| --- | --- | --- |
| `date` | `Date \| number` | Une `Date`, un timestamp en **ms** ou en **secondes** (détecté automatiquement). |
| `style` | `TimestampStylesString` | Style d'affichage (voir ci-dessous). |

Styles courants (`TimestampStyles`) : `ShortTime`, `LongTime`, `ShortDate`,
`LongDate`, `ShortDateTime`, `LongDateTime`, `RelativeTime`. Discord localise
l'affichage dans la langue de **chaque** utilisateur.

## `emoji` - emojis personnalisés

| Méthode | Rôle |
| --- | --- |
| `emoji.custom(nom, id, animé?)` | Construit `<:nom:id>` ou `<a:nom:id>`. |
| `emoji.format({ name, id, animated? })` | Idem depuis un objet emoji partiel. |
| `emoji.parse(chaîne)` | Analyse `<a:blob:123>` → `{ animated, name, id }`, ou `null`. |
| `emoji.find(guild, nom)` | Cherche un emoji du serveur par nom (dans le cache). |

## `allowedMentions` - pings sûrs

Contrôle **qui** un message peut réellement notifier. Essentiel dès que tu
renvoies du texte saisi par un utilisateur.

| Méthode | Effet |
| --- | --- |
| `allowedMentions.none()` | Ne ping **personne** (par défaut sûr). |
| `allowedMentions.all()` | Autorise `everyone`, utilisateurs et rôles. |
| `allowedMentions.users(...ids)` | Ne ping que ces utilisateurs. |
| `allowedMentions.roles(...ids)` | Ne ping que ces rôles. |
| `allowedMentions.repliedUser(bool)` | Ping (ou non) l'auteur du message auquel on répond. |

```ts
await ctx.reply({ content: texteUtilisateur, allowedMentions: allowedMentions.none() });
```

## `assets` - URLs d'images

| Méthode | Renvoie | Rôle |
| --- | --- | --- |
| `assets.avatar(userOuMembre, opts?)` | `string` | Meilleur avatar (avatar **de serveur** pour un membre). |
| `assets.banner(user, opts?)` | `Promise<string \| null>` | Bannière (fetch l'utilisateur : les bannières ne sont pas en cache). |
| `assets.guildIcon(guild, opts?)` | `string \| null` | Icône du serveur. |
| `assets.guildBanner(guild, opts?)` | `string \| null` | Bannière du serveur. |
| `assets.guildSplash(guild, opts?)` | `string \| null` | Splash d'invitation. |
| `assets.emoji(id, { animated?, size? })` | `string` | URL de l'image d'un emoji. |

**`ImageOptions`** : `size` (puissance de 2, 16-4096), `extension`
(`"webp" \| "png" \| "jpg" \| "jpeg" \| "gif"`), `forceStatic` (force une image
fixe même pour un asset animé).

## `voice` - états vocaux

Inspection et modération vocale via la passerelle/REST. **Aucune lecture audio**
(donc pas de dépendance `@discordjs/voice`).

| Méthode | Rôle |
| --- | --- |
| `voice.channelOf(membre)` | Le salon vocal du membre, ou `null`. |
| `voice.isConnected(membre)` | `true` si connecté à un salon vocal. |
| `voice.membersIn(salon)` | Les membres présents dans le salon. |
| `voice.move(membre, salon)` | Déplace le membre (ou `null` pour déconnecter). |
| `voice.disconnect(membre)` | Déconnecte le membre du vocal. |
| `voice.mute(membre, muté?, raison?)` | Coupe/rétablit le micro (mute serveur). |
| `voice.deafen(membre, sourd?, raison?)` | Rend sourd / rétablit (deafen serveur). |

## Embeds & pièces jointes

Les embeds viennent de discord.js ; `EmbedBuilder` et `AttachmentBuilder` sont
**réexportés** par commodité.

```ts
import { EmbedBuilder, AttachmentBuilder } from "@ix-xs/djs-bot";

const embed = new EmbedBuilder().setTitle("Titre").setColor(0x5865f2);
const image = new AttachmentBuilder("./chart.png", { name: "chart.png" });

// Référencer une pièce jointe dans un embed :
await ctx.reply({ embeds: [embed.setImage("attachment://chart.png")], files: [image] });
```

Pour **recevoir** un fichier, utilise l'option `s.attachment()` : `ctx.options.file`
est un `Attachment` (avec `name`, `url`, `size`, `contentType`).
