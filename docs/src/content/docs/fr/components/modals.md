---
title: "Modales"
description: "Une modale est un formulaire en fenêtre contextuelle : champs de texte, listes déroulantes, sélecteurs, envois de fichiers, boutons radio et cases à cocher. Déclarez ses champs une fois et le gestionnaire reçoit chaque valeur soumise déjà typée."
sidebar:
  order: 3
---

Utilisez une modale quand vous avez besoin de plus que ce que les options d'une
commande peuvent porter : un long texte, plusieurs réponses à la fois, ou un
fichier. Vous déclarez les champs avec les builders `field`, et `ctx.fields` est
typé d'après ce que vous avez déclaré.

## Une première modale

```ts title="features/feedback/feedback.modal.ts"
import { defineModal, field } from "@ix-xs/djs-bot";

export const FeedbackModal = defineModal({
  id: "feedback:submit",
  title: "Send feedback",
  fields: {
    subject: field.short({ label: "Subject", required: true, maxLength: 80 }),
    body: field.paragraph({ label: "Your feedback", required: true }),
  },
  run: (ctx) => ctx.reply.success(`Thanks for "${ctx.fields.subject}".`, { ephemeral: true }),
});
```

```ts title="features/feedback/feedback.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";
import { FeedbackModal } from "./feedback.modal.js";

export default defineCommand({
  name: "feedback",
  description: "Send feedback to the team",
  run: (ctx) => ctx.showModal(FeedbackModal),
});
```

La commande ouvre le formulaire, et le `run` de la modale est appelé quand
l'utilisateur le soumet. Ce sont deux interactions distinctes : il ne se passe
rien de votre côté si l'utilisateur ferme le formulaire. La clé de chaque champ
(`subject`, `body`) est le nom sous lequel vous le relisez.

Les fichiers qui se terminent par `.modal.ts` sont chargés automatiquement, voir
[Structure du projet](/basics/project-layout/).

## Types de champs

Une modale contient de 1 à 5 composants. Chaque composant interactif est dessiné
dans un bloc étiqueté, donc chacun prend un `label` et une `description`
facultative.

| Builder | Affiche | `ctx.fields.x` |
| --- | --- | --- |
| `field.short(config)` | Un champ de texte sur une ligne | `string` |
| `field.paragraph(config)` | Un champ de texte sur plusieurs lignes | `string` |
| `field.select(config)` | Une liste déroulante de vos propres options (1-25) | `string[]` |
| `field.users(config)` | Un sélecteur d'utilisateurs | `Collection<string, User>` |
| `field.roles(config)` | Un sélecteur de rôles | `Collection<string, Role>` |
| `field.channels(config)` | Un sélecteur de salons | `Collection<string, GuildBasedChannel>` |
| `field.mentionables(config)` | Un sélecteur d'utilisateurs et de rôles ensemble | `{ users, members, roles }` |
| `field.files(config)` | Un envoi de fichiers | `Collection<string, Attachment>` |
| `field.radio(config)` | Des boutons radio, un choix parmi 2-10 | `string`, ou `string \| undefined` quand il est facultatif |
| `field.checkboxes(config)` | Des cases à cocher, plusieurs choix parmi 1-10 | `string[]` |
| `field.checkbox(config)` | Une seule case à cocher | `boolean` |
| `field.text(content)` | Un bloc de markdown entre les champs | absent |

```ts title="features/report/report.modal.ts"
import { defineModal, field } from "@ix-xs/djs-bot";

export const ReportModal = defineModal({
  id: "report:submit",
  title: "Report a problem",
  fields: {
    intro: field.text("Tell us what happened. Screenshots help a lot."),
    category: field.select({
      label: "Category",
      required: true,
      options: [
        { label: "Bug", value: "bug", emoji: "🐛" },
        { label: "Abuse", value: "abuse", description: "Someone broke the rules" },
      ],
    }),
    details: field.paragraph({ label: "Details", description: "Be specific", maxLength: 1000 }),
    proof: field.files({ label: "Screenshots", maxValues: 3, fileTypes: ["image"] }),
    urgent: field.checkbox({ label: "This is urgent" }),
  },
  run: async (ctx) => {
    const { category, details, proof, urgent } = ctx.fields;
    // category: string[]   details: string   proof: Collection<string, Attachment>   urgent: boolean
    ctx.logger.info({ category, urgent, files: proof.size, length: details.length }, "report received");
    await ctx.reply.success(`Reported as ${category[0]}.`, { ephemeral: true });
  },
});
```

Un bloc `field.text` sert uniquement à l'affichage. Il compte parmi les cinq
composants, et il est absent de `ctx.fields`.

`fileTypes` restreint ce qui peut être envoyé : `"image"`, `"video"`, `"audio"`,
ou une extension comme `".pdf"`. Vérifiez aussi le `contentType` de la pièce
jointe quand le type compte vraiment.

## Lire les valeurs

Ce que contient `ctx.fields` dépend uniquement du genre de chaque champ :

```ts title="features/staff/apply.modal.ts"
import { defineModal, field } from "@ix-xs/djs-bot";

export const ApplyModal = defineModal({
  id: "staff:apply",
  title: "Staff application",
  fields: {
    why: field.paragraph({ label: "Why you?", required: true, maxLength: 800 }),
    availability: field.radio({
      label: "Availability",
      required: true,
      options: [
        { label: "Weekdays", value: "week" },
        { label: "Weekends", value: "weekend", default: true },
      ],
    }),
    teams: field.checkboxes({
      label: "Teams you would join",
      maxValues: 2,
      options: [
        { label: "Moderation", value: "mod" },
        { label: "Events", value: "events" },
        { label: "Support", value: "support" },
      ],
    }),
    referee: field.users({ label: "Who can vouch for you?", maxValues: 1 }),
    cv: field.files({ label: "CV", description: "PDF or image", maxValues: 1, fileTypes: ["image", ".pdf"] }),
  },
  run: async (ctx) => {
    const { why, availability, teams, referee, cv } = ctx.fields;
    // why: string            availability: string (requis, donc jamais undefined)
    // teams: string[]        referee: Collection<string, User>
    // cv: Collection<string, Attachment>
    const voucher = referee.first();
    ctx.logger.info({ availability, teams, words: why.split(/\s+/).length, cv: cv.first()?.url }, "application");
    await ctx.reply.success(
      voucher ? `Application received. We will ask ${voucher.username}.` : "Application received.",
      { ephemeral: true },
    );
  },
});
```

- **Aucun `null` à vérifier.** Un champ de texte laissé vide vaut `""`. Les
  sélecteurs et les envois de fichiers donnent toujours une collection, vide si
  rien n'a été choisi. `select` et `checkboxes` donnent un tableau, éventuellement
  vide. Seul un `radio` facultatif peut valoir `undefined`.
- **`required` détermine le type d'un groupe radio.** Avec `required: true`, la
  valeur est un `string`, sinon `string | undefined`.
- **`field.mentionables` sépare ses choix** : `{ users, members, roles }`, trois
  collections. `members` contient les mêmes utilisateurs en tant que membres du
  serveur quand la modale a été ouverte dans un serveur.
- **Les valeurs de texte sont de simples chaînes.** Analysez-les et validez-les
  vous-même.
- **Un champ absent de la soumission prend sa valeur vide** et ne lève pas
  d'erreur. Cela arrive quand la définition a changé alors qu'un utilisateur
  avait encore le formulaire ouvert.

## Ouvrir une modale

Appelez `ctx.showModal(Modal)` depuis une commande, un menu contextuel, un bouton
ou un menu de sélection. [L'objet ctx](/basics/context/) décrit `showModal` en
détail.

:::caution[Une modale doit être la première réponse]
Discord n'accepte une modale que comme première réponse à une interaction.
Appelez `showModal` avant tout `ctx.reply` ou différé. Pour la même raison, le
gestionnaire d'une modale n'a pas de `ctx.showModal` : une modale ne peut pas en
ouvrir une autre. Si le [différé automatique](/basics/automatic-deferral/) est
activé, ouvrez la modale avant tout travail lent, ou mettez `defer: false` sur la
définition qui l'ouvre.
:::

Une modale peut porter des `params` typés dans son customId, comme un
[bouton](/components/buttons/). Ils sont passés en second argument de
`showModal`, vérifiés à la compilation, et reviennent dans `ctx.params` :

```ts title="features/tickets/rename.modal.ts"
import { defineButton, defineModal, field, p } from "@ix-xs/djs-bot";

export const RenameTicket = defineModal({
  id: "ticket:rename",
  title: "Rename ticket",
  params: { ticketId: p.string },
  fields: {
    subject: field.short({ label: "New subject", required: true, maxLength: 80 }),
  },
  run: async (ctx) => {
    await ctx.services.store.set(`ticket:${ctx.params.ticketId}:subject`, ctx.fields.subject);
    await ctx.reply.success("Subject updated.", { ephemeral: true });
  },
});

export const RenameButton = defineButton({
  id: "ticket:rename-open",
  params: { ticketId: p.string },
  label: "Rename",
  run: (ctx) => ctx.showModal(RenameTicket, { ticketId: ctx.params.ticketId }),
});
```

C'est ainsi qu'un formulaire se souvient de ce dont il parle : le bouton connaît
le ticket, et le transmet à la modale. Le gestionnaire d'une modale répond avec
`ctx.reply`. Il n'a pas de `ctx.update`.

Les champs sont figés quand la modale est définie. Une `value` préremplie, un
`default` ou des `defaultValues` sont donc identiques pour tous ceux qui
l'ouvrent.

## Traduire une modale

Une modale est déclarée une seule fois, dans une seule langue. Pour l'afficher
dans la langue de la personne qui l'ouvre, donnez ses textes au moment de
l'ouvrir : le troisième argument de `ctx.showModal` remplace le titre et les
textes des champs qu'il nomme.

```ts title="features/report/report.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";
import { Report } from "./report.modal.js";

export default defineCommand({
  name: "report",
  description: "Report a problem",
  run: (ctx) =>
    ctx.showModal(Report, undefined, {
      title: ctx.t("report.title"),
      fields: {
        details: { label: ctx.t("report.details"), placeholder: ctx.t("report.hint") },
      },
    }),
});
```

Les champs qui ne sont pas nommés gardent le texte de leur déclaration : une
modale peut donc être traduite champ par champ. Ces textes passent les mêmes
contrôles que ceux de la déclaration : un titre ou un libellé trop long lève
`DJSBOT_E014` à l'ouverture de la modale. Les libellés des options d'un
`field.select`, d'un `field.radio` ou d'un `field.checkboxes` restent ceux
de la déclaration.

`ctx.t` est décrit dans [Internationalisation](/data/i18n/).

## Référence

### `defineModal(input)`

| Option | Type | Par défaut | Description |
| --- | --- | --- | --- |
| `id` | `string` | requis | Clé de routage stable, par exemple `"feedback:submit"`. 1-100 caractères, sans `$`. |
| `title` | `string` | requis | Affiché en haut de la boîte de dialogue. 1-45 caractères. |
| `fields` | `FieldMap` | requis | 1 à 5 composants indexés par nom, construits avec `field`. |
| `params` | `ParamMap` | `{}` | Valeurs typées encodées dans le customId, construites avec `p`. Voir [Boutons](/components/buttons/). |
| `guards` | `Guard[]` | `[]` | Conditions préalables vérifiées avant `run`, à la soumission. Voir [Gardes](/commands/guards/). |
| `defer` | `DeferOption` | le `defaults.defer` du bot | Accuse réception de la soumission à votre place. Voir [Différé automatique](/basics/automatic-deferral/). |
| `run` | `(ctx: ModalContext) => unknown` | requis | Appelé à la soumission. `ctx.fields` et `ctx.params` sont typés. |

Renvoie un `ModalDefinition` : ce que vous avez passé, une étiquette
`kind: "modal"` sur laquelle le chargeur s'appuie pour router, et `build()`.
`ModalInput` et `ModalDefinition` sont des types exportés.

Le gestionnaire reçoit un `ModalContext<Fields>`, qui ajoute `fields` au
[contexte de base](/basics/context/), ainsi que `params`.

### `build(params?)`

Renvoie un `ModalBuilder` de discord.js construit à partir des champs déclarés,
avec un customId qui encode `params`. Un deuxième argument, un
[`ModalTextOptions`](#modaltextoptions), remplace le titre et les textes des
champs qu'il nomme. `ctx.showModal(Modal, params, text)` l'appelle pour vous. Ne l'utilisez directement que si vous avez besoin du builder brut, et
notez que `showModal` accepte n'importe quel objet doté d'un `build()`
compatible.

### `ModalTextOptions`

Le deuxième argument de `build`, et le troisième de `ctx.showModal`.

| Champ | Type | Description |
| --- | --- | --- |
| `title` | `string` | Affiché en haut de la fenêtre à la place du titre déclaré. 1-45 caractères. |
| `fields` | `Record<name, FieldText>` | Le texte de chaque champ, sous le nom qu'il porte dans `fields`. Nommer un champ que la modale n'a pas lève `DJSBOT_E014`. |

Un `FieldText` contient au choix `label`, `description` et `placeholder`.
Pour un `field.text`, `label` est le texte lui-même.

### `field`

Les builders sont listés dans
[Types de champs](/components/modals/#field-types). Chacun prend un seul objet de
configuration, sauf `field.text(content)`, qui prend le markdown à afficher.

| Option | Type | Par défaut | S'applique à | Description |
| --- | --- | --- | --- | --- |
| `label` | `string` | requis | tous sauf `text` | Affiché au-dessus du composant. 1-45 caractères. |
| `description` | `string` | - | tous sauf `text` | Texte d'aide plus petit sous le libellé. Jusqu'à 100 caractères. |
| `required` | `boolean` | `false` | tous sauf `checkbox`, `text` | Indique si le champ doit être rempli. |
| `placeholder` | `string` | - | `short`, `paragraph`, `select`, `users`, `roles`, `channels`, `mentionables` | Texte grisé affiché tant que le champ est vide. Jusqu'à 100 caractères sur un champ de texte, 150 sur un sélecteur. |
| `minLength` | `number` | - | `short`, `paragraph` | Texte le plus court accepté, 0-4000. |
| `maxLength` | `number` | - | `short`, `paragraph` | Texte le plus long accepté, 1-4000. |
| `value` | `string` | - | `short`, `paragraph` | Une valeur préremplie, jusqu'à 4000 caractères. |
| `options` | `FieldChoice[]` | requis | `select`, `radio`, `checkboxes` | Les choix : 1-25 pour `select`, 2-10 pour `radio`, 1-10 pour `checkboxes`. |
| `minValues` | `number` | celle de Discord | `select`, `users`, `roles`, `channels`, `mentionables`, `checkboxes`, `files` | Nombre minimal d'éléments à choisir : 0-25, ou 0-10 fichiers. |
| `maxValues` | `number` | celle de Discord | les mêmes | Nombre maximal d'éléments à choisir : 1-25, ou 1-10 fichiers. |
| `defaultValues` | `string[]` | - | `users`, `roles`, `channels` | Identifiants sélectionnés à l'ouverture de la modale. |
| `channelTypes` | `ChannelType[]` | - | `channels` | Ne propose que les salons de ces types. |
| `fileTypes` | `FileType[]` | - | `files` | Ce qui peut être envoyé. Jusqu'à 10 entrées. |
| `default` | `boolean` | `false` | `checkbox` | Indique si la case est cochée au départ. |

### `FieldChoice`

Une entrée de `options` d'un champ `select`, `radio` ou `checkboxes`.

| Propriété | Type | Description |
| --- | --- | --- |
| `label` | `string` | Ce que l'utilisateur lit. Jusqu'à 100 caractères. |
| `value` | `string` | Ce que reçoit votre gestionnaire. Jusqu'à 100 caractères. |
| `description` | `string` | Texte supplémentaire sous le libellé. Jusqu'à 100 caractères. |
| `default` | `boolean` | Présélectionné à l'ouverture de la modale. |
| `emoji` | `string` | Un emoji à côté du libellé. `select` uniquement. |

### `InferFields<M>`

Le type de `ctx.fields` pour un `FieldMap`, utile quand vous construisez votre
propre abstraction au-dessus des modales. Les types exportés associés :

| Type | Usage |
| --- | --- |
| `FieldMap` | Un enregistrement de descripteurs de champs, la forme de `fields`. |
| `FieldDef` | Un descripteur de champ, ce que renvoie un builder `field`. |
| `FieldKind` | Les douze genres : `"short"`, `"paragraph"`, `"select"`, `"users"`, `"roles"`, `"channels"`, `"mentionables"`, `"files"`, `"radio"`, `"checkboxes"`, `"checkbox"`, `"text"`. |
| `FieldOutput` | La valeur en laquelle chaque genre est résolu. |
| `FileType` | Une entrée de `fileTypes` : `"image"`, `"video"`, `"audio"` ou `` `.${string}` ``. |

## Limites et erreurs

Une modale qui enfreint l'une des règles de Discord échoue dès sa définition,
avec [`DJSBOT_E014`](/api/errors/#djsbot_e014), et non avec une erreur HTTP 400
la première fois qu'un utilisateur l'ouvre. Le message nomme la modale et le
champ.

| Règle | Limite |
| --- | --- |
| Composants dans une modale, blocs `field.text` compris | 1 à 5 |
| Titre | 1-45 caractères |
| Libellé | 1-45 caractères |
| Description | 100 caractères |
| Placeholder | 100 caractères sur un champ de texte, 150 sur un sélecteur |
| `minLength`, `maxLength`, `value` préremplie | 0-4000, 1-4000, 4000 caractères, et `minLength` ne dépasse pas `maxLength` |
| Options | 1-25 pour `select`, 2-10 pour `radio`, 1-10 pour `checkboxes` |
| Libellé, valeur et description d'une option | 100 caractères chacun |
| `minValues`, `maxValues` | 0-25 et 1-25, ou 0-10 et 1-10 pour `files`, et `minValues` ne dépasse pas `maxValues` |
| `fileTypes` | 10 entrées, chacune `"image"`, `"video"`, `"audio"` ou une extension de lettres et de chiffres comme `".pdf"` |

Les autres erreurs sont celles de tous les composants : un `id` invalide est
[`DJSBOT_E013`](/api/errors/#djsbot_e013), deux modales avec le même `id` sont
[`DJSBOT_E011`](/api/errors/#djsbot_e011), et un customId de plus de 100
caractères est [`DJSBOT_E020`](/api/errors/#djsbot_e020), levée à l'ouverture de
la modale.

:::note
Ces composants demandent discord.js 14.27 ou plus récent.
:::

## Voir aussi

- [L'objet ctx](/basics/context/) pour `ctx.showModal` et `ctx.reply`
- [Boutons](/components/buttons/) pour `p` et la façon dont les paramètres voyagent dans le customId
- [Menus de sélection](/components/select-menus/) pour les mêmes sélecteurs sous un message
- [Options et autocomplétion](/commands/options/) quand quelques options de commande suffisent
- [Un système de tickets](/recipes/ticket-system/), qui ouvre une modale depuis un bouton
