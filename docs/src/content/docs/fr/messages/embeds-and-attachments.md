---
title: "Embeds et pièces jointes"
description: "Construisez des embeds riches avec EmbedBuilder, envoyez des fichiers avec AttachmentBuilder, affichez une image téléversée dans un embed, et lisez les fichiers que l'on envoie à votre bot."
sidebar:
  order: 1
---

Un embed est la carte encadrée que Discord affiche sous un message : un titre,
un bord coloré, des champs, des images. Une pièce jointe est un fichier envoyé
avec un message. Les deux viennent directement de discord.js : le framework
réexporte `EmbedBuilder`, `AttachmentBuilder` et `Colors`, donc un petit bot
n'a besoin que d'une ligne d'import.

## Un premier embed

Construisez l'embed, puis passez-le dans le tableau `embeds` d'une réponse.

```ts title="features/profile/profile.command.ts"
import { defineCommand, inGuild, assets, timestamp, EmbedBuilder, Colors } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  description: "Show your profile",
  guards: [inGuild()],
  run: async (ctx) => {
    const joined = ctx.member?.joinedAt;

    const embed = new EmbedBuilder()
      .setTitle("Profile")
      .setColor(Colors.Blurple)
      .setThumbnail(assets.avatar(ctx.member ?? ctx.user))
      .addFields({ name: "Joined", value: joined ? timestamp(joined) : "Unknown", inline: true })
      .setFooter({ text: `Requested by ${ctx.user.username}` })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] });
  },
});
```

`assets.avatar` est décrit dans [Images et vocal](/messages/assets-and-voice/)
et `timestamp` dans [Mentions, horodatages et pings sûrs](/messages/formatting/).

Pour un message coloré d'une ligne, vous n'avez pas besoin d'un builder du tout :
`ctx.reply.success`, `ctx.reply.info`, `ctx.reply.warn` et `ctx.reply.error`
construisent pour vous un petit embed. Ils sont traités dans
[L'objet ctx](/basics/context/), et leurs couleurs dans
[Formulations et thème](/basics/wording-and-theme/). Prenez `EmbedBuilder`
quand vous voulez un contrôle complet.

## Toutes les parties d'un embed

Chaque setter renvoie le builder, les appels s'enchaînent donc. Toutes les
parties sont facultatives, mais un embed a besoin d'au moins une partie visible
(un titre, une description, un champ, une image, etc.).

```ts
import { EmbedBuilder } from "@ix-xs/djs-bot"; // ou depuis "discord.js", c'est la même classe

const embed = new EmbedBuilder()
  .setColor(0x5865f2)
  .setTitle("Title")
  .setURL("https://example.com")
  .setDescription("A **markdown** description.")
  .setAuthor({ name: ctx.user.username, iconURL: ctx.user.displayAvatarURL() })
  .setThumbnail("https://example.com/thumb.png")
  .addFields(
    { name: "Field 1", value: "value", inline: true },
    { name: "Field 2", value: "value", inline: true },
  )
  .setImage("https://example.com/image.png")
  .setFooter({ text: "Footer" })
  .setTimestamp();

await ctx.reply({ embeds: [embed] });
```

La description et les valeurs des champs acceptent le markdown de Discord, les
mentions et les horodatages. Une mention dans un embed s'affiche comme une
mention mais ne notifie jamais personne, ce qui fait des embeds un endroit sûr
pour afficher des noms d'utilisateurs.

`embeds` est un tableau : un message peut porter plusieurs embeds (voir
[Limites et erreurs](/messages/embeds-and-attachments/#limits-and-errors)).

## Envoyer des fichiers

Enveloppez les données dans un `AttachmentBuilder` et passez-le dans le tableau
`files`.

```ts title="features/export/export.command.ts"
import { defineCommand, AttachmentBuilder } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "export",
  description: "Export your notes as a text file",
  run: async (ctx) => {
    const file = new AttachmentBuilder(Buffer.from("hello"), { name: "note.txt" });
    await ctx.reply({ content: "Here you go:", files: [file] });
  },
});
```

Le premier argument est le contenu : un `Buffer`, un chemin local, une URL ou un
flux lisible. Le second donne son nom au fichier et, pour les images, une
description facultative utilisée comme texte alternatif.

```ts
new AttachmentBuilder("./chart.png", { name: "chart.png", description: "Sales this week" });
new AttachmentBuilder(createReadStream("./backup.zip"), { name: "backup.zip" });
new AttachmentBuilder(buffer, { name: "answer.png" }).setSpoiler(true); // masqué jusqu'au clic
```

Donnez toujours un `name` quand le contenu est un buffer ou un flux : Discord se
sert de l'extension pour décider d'afficher le fichier comme une image, une
vidéo ou un simple téléchargement.

## Images dans les embeds

L'image d'un embed est normalement une URL publique. Pour montrer un fichier que
vous téléversez dans le même message, désignez-le avec le schéma `attachment://`
suivi de son nom.

```ts
const chart = new AttachmentBuilder("./chart.png", { name: "chart.png" });
const embed = new EmbedBuilder().setTitle("This week").setImage("attachment://chart.png");

await ctx.reply({ embeds: [embed], files: [chart] });
```

Le fichier n'apparaît alors que dans l'embed, pas une seconde fois sous le
message. `setThumbnail`, l'`iconURL` de l'auteur et l'`iconURL` du pied de page
acceptent le même schéma.

:::caution[Le nom doit correspondre exactement]
`attachment://chart.png` ne fonctionne que si un fichier nommé `chart.png` se
trouve dans les `files` du même message. Limitez les noms aux lettres, chiffres,
points, tirets et tirets bas : Discord réécrit les autres caractères, et la
référence ne pointe alors sur rien.
:::

Le schéma fonctionne aussi dans une galerie Components V2, décrite dans
[Components V2](/components/components-v2/) :

```ts
await ctx.reply({
  flags: MessageFlags.IsComponentsV2,
  files: [chart],
  components: [ui.container(ui.gallery("attachment://chart.png"))],
});
```

## Recevoir des fichiers

Une commande slash reçoit un fichier par une option `s.attachment`. La valeur
dans `ctx.options` est un `Attachment` de discord.js.

```ts title="features/scan/scan.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "scan",
  description: "Scan an uploaded file",
  options: {
    file: s.attachment({ description: "File to scan", required: true, fileTypes: ["image", ".pdf"] }),
  },
  run: async (ctx) => {
    const file = ctx.options.file; // Attachment
    await ctx.reply.info(
      `Got **${file.name}** (${file.contentType ?? "unknown type"}, ${file.size} bytes)\n${file.url}`,
    );
  },
});
```

`fileTypes` restreint ce que le sélecteur de fichiers accepte ; il est expliqué
avec les autres réglages d'options dans
[Options et autocomplétion](/commands/options/). Une modale collecte des
fichiers avec un téléversement `field.files`, décrit dans
[Modales](/components/modals/) ; la valeur y est une collection des mêmes
objets `Attachment`.

C'est Discord qui stocke le fichier, pas votre bot. Pour lire son contenu,
téléchargez-le depuis `url` :

```ts
const response = await fetch(file.url);
const bytes = Buffer.from(await response.arrayBuffer());
```

L'URL est un lien signé qui cesse de fonctionner au bout d'un moment :
téléchargez donc ce que vous voulez garder au lieu d'enregistrer l'URL. Pour
renvoyer un fichier reçu, passez l'`Attachment` lui-même dans `files`.

## Référence

### `EmbedBuilder`

La classe de discord.js, réexportée telle quelle. `Colors` (des constantes de
couleurs nommées comme `Colors.Blurple`) est réexporté aussi.

| Méthode | Argument | Description |
| --- | --- | --- |
| `setTitle(title)` | `string` | Titre en gras. Devient un lien quand une URL est définie. |
| `setURL(url)` | `string` | Rend le titre cliquable. |
| `setDescription(text)` | `string` | Texte principal, markdown autorisé. |
| `setColor(color)` | nombre, chaîne hexadécimale, `Colors.*` | Couleur du bord gauche. |
| `setAuthor(author)` | `{ name, iconURL?, url? }` | Petite ligne au-dessus du titre. |
| `setThumbnail(url)` | `string` | Petite image dans le coin supérieur droit. |
| `setImage(url)` | `string` | Grande image sous les champs. |
| `addFields(...fields)` | `{ name, value, inline? }` | Ajoute des champs. `inline` place les champs côte à côte. |
| `setFields(...fields)` | idem | Remplace tous les champs. |
| `spliceFields(index, deleteCount, ...fields)` | idem | Supprime ou insère des champs à une position. |
| `setFooter(footer)` | `{ text, iconURL? }` | Petite ligne en bas. |
| `setTimestamp(date?)` | `Date \| number` | Heure affichée à côté du pied de page, dans le fuseau horaire du lecteur. Maintenant si omise. |
| `EmbedBuilder.from(embed)` | un embed existant | Copie un embed pour que vous puissiez le modifier, par exemple `message.embeds[0]`. |

### `AttachmentBuilder`

La classe de discord.js, réexportée telle quelle.

```ts
new AttachmentBuilder(content, data?)
```

| Argument | Type | Description |
| --- | --- | --- |
| `content` | `Buffer \| string \| Stream` | Les octets, un chemin local, une URL, ou un flux lisible. |
| `data.name` | `string` | Nom du fichier avec son extension. Utilisé par `attachment://name`. |
| `data.description` | `string` | Texte alternatif lu par les lecteurs d'écran. |

| Méthode | Description |
| --- | --- |
| `setName(name)` | Définit le nom du fichier. |
| `setDescription(text)` | Définit le texte alternatif. |
| `setSpoiler(spoiler?)` | Masque le fichier derrière un spoiler. `true` par défaut. |
| `setFile(content, name?)` | Remplace le contenu, et éventuellement le nom. |

`files` accepte aussi directement un chemin, une URL ou un `Buffer`. Le builder
permet de choisir le nom, le texte alternatif et l'état de spoiler.

### `Attachment`

Ce que vous donnent `s.attachment` et `field.files`. Les propriétés les plus
utiles :

| Propriété | Type | Description |
| --- | --- | --- |
| `id` | `string` | L'identifiant de la pièce jointe. |
| `name` | `string` | Nom du fichier. |
| `contentType` | `string \| null` | Type MIME, par exemple `image/png`. |
| `size` | `number` | Taille en octets. |
| `url` | `string` | Lien de téléchargement signé. |
| `proxyURL` | `string` | Le même fichier via le proxy média de Discord. |
| `width`, `height` | `number \| null` | Dimensions, pour les images et les vidéos. |
| `description` | `string \| null` | Texte alternatif, si l'expéditeur en a écrit un. |
| `spoiler` | `boolean` | Indique s'il a été marqué comme spoiler. |
| `ephemeral` | `boolean` | Indique si Discord supprimera le fichier au bout d'un moment. |

## Limites et erreurs

Discord impose ces limites. En dépasser une fait échouer l'envoi, donc tronquez
le texte fourni par les utilisateurs avant de le mettre dans un embed.

| Quoi | Limite |
| --- | --- |
| Embeds par message | 10 |
| Caractères au total dans tous les embeds d'un message | 6000 |
| Titre | 256 caractères |
| Description | 4096 caractères |
| Champs par embed | 25 |
| Nom d'un champ | 256 caractères |
| Valeur d'un champ | 1024 caractères |
| Texte du pied de page | 2048 caractères |
| Nom de l'auteur | 256 caractères |
| Fichiers par message | 10 |
| Taille par fichier | 20 Mio par défaut |

La limite de taille des fichiers augmente avec le niveau de boost du serveur.
Dans un gestionnaire, `ctx.interaction.attachmentSizeLimit` donne la limite
exacte en octets pour l'utilisateur et le serveur courants.

Un message portant le drapeau `IsComponentsV2` ne peut pas du tout contenir
d'`embeds` : voir [Components V2](/components/components-v2/).

## Voir aussi

- [L'objet ctx](/basics/context/) pour `ctx.reply` et les raccourcis colorés.
- [Mentions, horodatages et pings sûrs](/messages/formatting/) pour ce qui va dans le texte d'un embed.
- [Images et vocal](/messages/assets-and-voice/) pour les URL d'avatars, de bannières et d'icônes.
- [Options et autocomplétion](/commands/options/) pour `s.attachment` et `fileTypes`.
- [Components V2](/components/components-v2/) pour le format de message sans embed.
