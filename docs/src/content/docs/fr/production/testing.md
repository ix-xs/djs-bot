---
title: "Tests"
description: "Exécutez vos commandes, composants, modales, gestionnaires d'autocomplétion et tâches planifiées dans un lanceur de tests ordinaire, sans token, sans réseau et sans serveur de test. Le harnais appelle un gestionnaire, enregistre tout ce qu'il a envoyé et vous dit si les gardes l'ont laissé passer."
sidebar:
  order: 7
---

Les gestionnaires sont de simples fonctions, donc en tester un n'exige pas
Discord. Le harnais de test vit sur son propre point d'entrée,
`@ix-xs/djs-bot/testing`, et fonctionne avec n'importe quel lanceur de tests.
Les exemples de cette page utilisent Vitest.

## Un premier test

Prenons une commande :

```ts title="src/features/echo/echo.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "echo",
  description: "Repeat a message",
  options: { text: s.string({ description: "What to repeat", required: true }) },
  run: (ctx) => ctx.reply(ctx.options.text),
});
```

Créez un harnais, appelez la commande avec les options qu'un utilisateur
donnerait, et regardez ce qui est revenu :

```ts title="test/echo.test.ts"
import { expect, it } from "vitest";
import { createHarness } from "@ix-xs/djs-bot/testing";
import Echo from "../src/features/echo/echo.command.js";

const harness = createHarness();

it("repeats the text", async () => {
  const { replies, passedGuards } = await harness.command(Echo, { options: { text: "hello" } });

  expect(passedGuards).toBe(true);
  expect(replies).toEqual([{ type: "reply", content: "hello" }]);
});
```

`replies` liste, dans l'ordre, chaque appel que le gestionnaire a fait sur
`ctx.reply`, `ctx.update` et `ctx.showModal`. Chaque entrée a un `type` (quelle
méthode) et le `content` qui a été passé.

Le harnais exécute les gardes et le gestionnaire, rien de plus. Trois choses que
fait le vrai bot sont laissées de côté, volontairement :

- **Pas de barrière d'erreurs.** Un gestionnaire qui lève une erreur rejette la
  promesse, donc `await expect(harness.command(Broken)).rejects.toThrow()`
  fonctionne.
- **Pas de plugins.** Les middleware et les hooks ne s'exécutent pas, ni le
  [différé automatique](/basics/automatic-deferral/).
- **Pas de validation des entrées.** `options`, `params` et `fields` parviennent
  au gestionnaire exactement tels que vous les passez.

## Gardes et permissions

Par défaut, un test s'exécute sous l'utilisateur `test-user`, dans un message
privé, avec toutes les permissions. Les entrées partagées changent cela, une
garde à la fois. Prenons une commande de bannissement protégée ainsi :

```ts
guards: [
  inGuild(),
  hasPermission(PermissionFlagsBits.BanMembers),
  botHasPermission(PermissionFlagsBits.BanMembers),
],
```

```ts title="test/ban.test.ts"
import { expect, it } from "vitest";
import { createHarness } from "@ix-xs/djs-bot/testing";
import Ban from "../src/features/moderation/ban.command.js";

const harness = createHarness();
const target = { id: "42" };

it("refuses outside a server", async () => {
  const result = await harness.command(Ban, { options: { target } });

  expect(result.passedGuards).toBe(false);
  expect(result.rejectionReason).toMatch(/server/i);
  expect(result.replies).toHaveLength(0);   // le gestionnaire ne s'est jamais exécuté
});

it("requires the Ban Members permission", async () => {
  const result = await harness.command(Ban, { guildId: "g1", permissions: [], options: { target } });
  expect(result.rejectionReason).toBe("You need: Ban Members.");
});

it("says what the bot is missing", async () => {
  const result = await harness.command(Ban, { guildId: "g1", botPermissions: [], options: { target } });
  expect(result.rejectionReason).toBe("I need: Ban Members.");
});
```

| Pour tester | Passez |
| --- | --- |
| `inGuild()`, `dmOnly()` | `guildId`, ou rien pour un message privé |
| `hasPermission()` | `guildId` et `permissions` |
| `botHasPermission()` | `botPermissions` |
| `hasRole()` | `guildId` et `roles` |
| `inChannel()` | `channelId` |
| `ownerOnly()` | `owners` et `userId` |
| `cooldown()`, `rateLimit()` | le même `userId` deux fois |

```ts
it("refuses on cooldown", async () => {
  await harness.command(Daily, { userId: "u1", guildId: "g1" });
  const second = await harness.command(Daily, { userId: "u1", guildId: "g1" });
  expect(second.passedGuards).toBe(false);
});
```

Un délai de récupération (*cooldown*) ou une limite de débit garde ses compteurs
dans la définition, que les tests d'un même fichier partagent. Utilisez un
`userId` différent dans chaque test pour les garder indépendants.

:::note[Un refus n'envoie rien]
Quand une garde refuse, le vrai bot répond avec la raison sous forme de message
d'erreur. Le harnais la rapporte dans `rejectionReason` et laisse `replies`
vide, ce qui vous permet de distinguer un refus d'une erreur envoyée par le
gestionnaire lui-même.
:::

Pour tester un gestionnaire sans ses gardes, passez `runGuards: false`. Pour
vérifier un refus reformulé, passez le même objet `messages` que vous donnez à
`defineBot`. Les gardes elles-mêmes sont décrites sur la page [Gardes](/commands/guards/).

## Sous-commandes et autocomplétion

Nommez la sous-commande à exécuter, et son groupe quand elle en a un. Les gardes
de la commande parente s'exécutent d'abord, puis celles de la sous-commande,
comme en production.

```ts
it("sets a config key", async () => {
  const result = await harness.command(Config, {
    subcommand: "set",              // ajoutez group: "role" pour une sous-commande groupée
    guildId: "g1",
    options: { key: "prefix", value: "!" },
  });
  expect(result.replies[0]?.type).toBe("success");
});
```

`harness.autocomplete` exécute le gestionnaire d'autocomplétion d'une option et
se résout avec les suggestions, exactement comme le bot les enverrait :
converties en `{ name, value }`, rendues valides pour Discord et limitées à 25.
`value` est ce que l'utilisateur a saisi jusque-là, `options` ce que les autres
options contiennent déjà.

```ts
it("suggests matching songs", async () => {
  const choices = await harness.autocomplete(Play, {
    option: "song",
    value: "bo",
    services: { music: fakeMusic },
  });
  expect(choices).toEqual([{ name: "Bohemian Rhapsody", value: "s1" }]);
});

it("suggests the items of the chosen category", async () => {
  const choices = await harness.autocomplete(Buy, {
    option: "item",
    value: "sw",
    options: { category: "weapons" },
  });
  expect(choices.map((choice) => choice.value)).toEqual(["sword", "switchblade"]);
});
```

Les deux appels lèvent une `Error` simple quand la cible n'existe pas : une
sous-commande inconnue, ou une option sans gestionnaire d'autocomplétion.

## Composants et modales

Un composant reçoit ses `params` déjà décodés, donc passez-les sous la forme de
l'objet que le gestionnaire lit. Rien n'est encodé dans un customId en chemin.

```ts
it("only lets the owner close the ticket", async () => {
  const result = await harness.button(CloseTicket, {
    userId: "someone-else",
    params: { ticketId: "t1", ownerId: "owner" },
  });
  expect(result.replies[0]?.type).toBe("error");
});

it("reads the picked values", async () => {
  const result = await harness.select(ColourMenu, { values: ["red", "blue"] });
  expect(result.replies[0]).toEqual({ type: "update", content: "Picked 2 colours" });
});
```

Une commande qui ouvre une modale enregistre une entrée `modal`, dont le
`content` est le `ModalBuilder` construit. Le gestionnaire de la modale se teste
séparément, avec les valeurs soumises :

```ts
it("opens the feedback form", async () => {
  const result = await harness.command(FeedbackCommand);
  expect(result.replies[0]?.type).toBe("modal");
});

it("reads the submitted fields", async () => {
  const result = await harness.modal(Feedback, {
    fields: { subject: "Bug", kind: ["bug"], body: "It broke", shots: new Collection() },
  });
  expect(result.replies[0]?.type).toBe("success");
});
```

Donnez à chaque champ la forme que le gestionnaire va lire : une chaîne pour un
champ de texte, un tableau pour un menu de sélection, une `Collection` pour un
sélecteur ou un envoi de fichiers, un booléen pour une case à cocher. Les types
de champs sont listés sur la page [Modales](/components/modals/).

## Tâches planifiées et faux services

`harness.job` exécute une tâche planifiée une fois, tout de suite, quelle que
soit sa planification.

```ts
it("purges old rows", async () => {
  await harness.job(NightlyCleanup, { services: { db: fakeDb } });
  expect(fakeDb.purged).toBe(true);
});
```

Les services sont injectés, donc un faux service est un objet ordinaire avec les
méthodes que le gestionnaire appelle :

```ts
const fakeDb = {
  users: new Map<string, { xp: number }>(),
  async addXp(id: string, amount: number) {
    const user = this.users.get(id) ?? { xp: 0 };
    user.xp += amount;
    this.users.set(id, user);
  },
};

await harness.command(Rank, { services: { db: fakeDb } });
```

Pour tout ce qui ressemble à un store, les vraies implémentations conviennent
déjà aux tests :

```ts
import { memoryStore, sqliteStore } from "@ix-xs/djs-bot";

const store = memoryStore();               // rapide, isolé pour chaque test
const durable = sqliteStore(":memory:");   // le même chemin de code qu'en production
```

`ctx.client` est un objet vide dans le harnais et ne peut pas être remplacé. Un
gestionnaire qui parle directement à Discord est difficile à tester. Un
gestionnaire qui passe par un [service](/architecture/services/) ne l'est pas :
vous lui donnez un faux.

## Vérifier tout le bot

`bot.load()` découvre les fonctionnalités, construit les services et valide les
contrats, sans se connecter à Discord. Un seul test détecte donc les noms en
double, les services manquants, les planifications invalides et les contrats
cassés. Passer le bot chargé à `createHarness` exécute ensuite les gestionnaires
avec ses vrais services, ses propriétaires et ses messages personnalisés.

```ts title="test/bot.test.ts"
import { beforeAll, expect, it } from "vitest";
import type { Bot } from "@ix-xs/djs-bot";
import { createHarness } from "@ix-xs/djs-bot/testing";
import Ping from "../src/features/ping/ping.command.js";

let bot: Bot;

beforeAll(async () => {
  // Le fichier d'entrée appelle bot.start() sauf si ceci est défini : définissez-le avant l'import.
  process.env.DJSBOT_CLI = "introspect";
  bot = (await import("../src/index.js")).default;
  await bot.load();
});

it("loads cleanly", async () => {
  const description = await bot.describe();
  expect(description.commands).toContain("ping");
});

it("answers with the real services", async () => {
  const result = await createHarness(bot).command(Ping);
  expect(result.passedGuards).toBe(true);
});
```

:::caution[Importer le fichier d'entrée l'exécute]
Le fichier d'entrée est évalué comme en production : les variables qu'il lit avec
`env()` doivent exister (n'importe quelle valeur convient pour le token, rien ne
se connecte), et `bot.load()` exécute vos vraies fabriques de services, donc un
service qui ouvre une base de données l'ouvre aussi dans le test.
:::

La même validation s'exécute en dehors de la suite de tests avec
`npx djs-bot doctor`, décrit sur la page [CLI](/api/cli/).

## Référence

### `createHarness(bot)`

Renvoie un `Harness`. `bot` est facultatif : passez un `Bot` pour lequel
`bot.load()` est terminé afin d'utiliser ses services, ses `owners` et ses
`messages` comme valeurs par défaut. Sans lui, injectez ce dont chaque appel a
besoin.

Chaque méthode ci-dessous prend une définition et un objet d'entrée facultatif,
et (sauf `autocomplete` et `job`) se résout avec un
[`HarnessResult`](/production/testing/#harnessresult). L'entrée accepte les
[champs partagés](/production/testing/#shared-input) plus ceux listés pour la
méthode.

### `harness.command(def, input)`

Exécute une commande slash, ou l'une de ses sous-commandes.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `options` | `Record<string, unknown>` | `{}` | Les valeurs des options, par nom : ce que contient `ctx.options`. |
| `subcommand` | `string` | aucun | La sous-commande à exécuter. |
| `group` | `string` | aucun | Le groupe auquel appartient cette sous-commande. |

### `harness.userCommand(def, input)`

Exécute une commande de menu contextuel utilisateur.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `targetUser` | `unknown` | `{ id: "target-user" }` | Ce que contient `ctx.targetUser`. |
| `targetMember` | `unknown` | `null` | Ce que contient `ctx.targetMember`. |

### `harness.messageCommand(def, input)`

Exécute une commande de menu contextuel message.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `targetMessage` | `unknown` | `{ id: "target-message", content: "" }` | Ce que contient `ctx.targetMessage`. |

### `harness.button(def, input)`

Exécute un gestionnaire de bouton.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `params` | `Record<string, unknown>` | `{}` | Ce que contient `ctx.params`. |

### `harness.select(def, input)`

Exécute un gestionnaire de menu de sélection, texte ou natif.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `params` | `Record<string, unknown>` | `{}` | Ce que contient `ctx.params`. |
| `values` | `string[]` | `[]` | Les valeurs ou identifiants choisis : `ctx.values`. |
| `resolved` | `{ users?, members?, roles?, channels? }` | aucun | Ce qu'un menu natif a résolu : `ctx.users` et `ctx.members` pour un menu d'utilisateurs ou de mentionnables, `ctx.roles` pour un menu de rôles ou de mentionnables, `ctx.channels` pour un menu de salons. |

L'entrée partagée `roles` garde son sens habituel ici : les identifiants de rôles
du membre qui invoque, pour `hasRole()`. Les rôles choisis dans le menu vont dans
`resolved.roles`. `users`, `members` et `channels` sont encore acceptés au niveau
supérieur, mais ils sont dépréciés : utilisez `resolved`.

### `harness.modal(def, input)`

Exécute un gestionnaire de modale. Il n'y a ni `ctx.update` ni `ctx.showModal`
ici, comme dans une vraie soumission de modale.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `fields` | `Record<string, unknown>` | `{}` | Les valeurs soumises, par nom de champ : `ctx.fields`. |
| `params` | `Record<string, unknown>` | `{}` | Ce que contient `ctx.params`. |

### `harness.autocomplete(def, input)`

Exécute le gestionnaire d'autocomplétion d'une option d'une commande slash. Se
résout avec les `AutocompleteChoice[]` que le bot enverrait. Les gardes ne
s'exécutent pas pour l'autocomplétion. Parmi les champs partagés, seuls `userId`,
`guildId`, `channelId`, `services` et `locale` s'appliquent.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `option` | `string` | requis | Le nom de l'option en cours de saisie. |
| `value` | `string` | `""` | Ce que l'utilisateur a saisi jusque-là : `ctx.value`. |
| `options` | `AutocompleteOptions` | `{}` | Ce que contiennent les autres options : `ctx.options`. L'option ciblée y est ajoutée. |
| `subcommand` | `string` | aucun | La sous-commande à laquelle appartient l'option. |
| `group` | `string` | aucun | Le groupe de cette sous-commande. |

### `harness.job(def, input)`

Exécute une tâche planifiée une fois et se résout sans valeur. Une erreur levée
par la tâche rejette la promesse.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `services` | `Partial<ServiceMap>` | ceux du bot, ou `{}` | Ce que contient `ctx.services`. |
| `signal` | `AbortSignal` | un signal qui n'est jamais interrompu | Ce que contient `ctx.signal`, pour tester la réaction d'une tâche à un arrêt. |

### Entrée partagée

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `userId` | `string` | `"test-user"` | L'identifiant de l'utilisateur qui invoque. |
| `guildId` | `string` | aucun (un message privé) | Un faux identifiant de serveur. Sans lui, `ctx.guild` et `ctx.member` valent `null`. |
| `channelId` | `string` | aucun | Un faux identifiant de salon. |
| `services` | `Partial<ServiceMap>` | ceux du bot, ou `{}` | Ce que contient `ctx.services`. Il remplace les services du bot, il n'est pas fusionné avec eux. |
| `locale` | `string` | `"en"` | `ctx.locale`. |
| `owners` | `string[]` | ceux du bot, ou `[]` | `ctx.owners`, pour `ownerOnly()`. |
| `permissions` | `PermissionResolvable[]` | toutes les permissions | Ce que possède le membre, pour `hasPermission()`. Exige `guildId`. |
| `botPermissions` | `PermissionResolvable[]` | toutes les permissions | Ce que possède le bot, pour `botHasPermission()`. |
| `roles` | `string[]` | `[]` | Identifiants de rôles que possède le membre, pour `hasRole()`. Exige `guildId`. |
| `messages` | `FrameworkMessages` | ceux du bot | Messages personnalisés, comme dans `defineBot({ messages })`. |
| `interaction` | `Record<string, unknown>` | `{}` | Champs supplémentaires fusionnés dans le faux `ctx.interaction`. |
| `runGuards` | `boolean` | `true` | Passez `false` pour sauter les gardes et tester le gestionnaire seul. |

### `HarnessResult`

| Champ | Type | Description |
| --- | --- | --- |
| `replies` | `CapturedReply[]` | Tout ce que le gestionnaire a envoyé, dans l'ordre. |
| `passedGuards` | `boolean` | Indique si toutes les gardes sont passées. Le gestionnaire ne s'exécute que si la valeur est `true`. |
| `rejectionReason` | `string?` | La raison donnée par la garde qui a refusé, si elle en a donné une. |

### `CapturedReply`

Un objet `{ type, content? }`. `content` est le premier argument de l'appel. Les
options d'une réponse sémantique (`{ ephemeral: true }`, un titre) ne sont pas
enregistrées.

| `type` | Enregistré par |
| --- | --- |
| `reply` | `ctx.reply(...)` |
| `success`, `error`, `info`, `warn` | `ctx.reply.success(...)` et ses variantes |
| `ephemeral` | `ctx.reply.ephemeral(...)` |
| `defer` | `ctx.reply.defer()` ou `ctx.update.defer()` |
| `followUp` | `ctx.reply.followUp(...)` |
| `editReply` | `ctx.reply.editReply(...)` |
| `delete` | `ctx.reply.delete()` |
| `update` | `ctx.update(...)` |
| `update:disable` | `ctx.update.disable()` |
| `modal` | `ctx.showModal(...)`. `content` est le `ModalBuilder` construit. |

`ctx.reply.fetch()` n'enregistre rien et se résout avec `{ id: "test-reply" }`.

### Le faux `ctx`

Ce qu'un gestionnaire trouve sur son contexte sous le harnais. Le vrai est décrit
sur la page [L'objet ctx](/basics/context/).

| Propriété | Valeur |
| --- | --- |
| `ctx.user` | `{ id, username, tag }` construit à partir de `userId`. S'affiche comme une mention. |
| `ctx.guild`, `ctx.guildId` | `{ id }` et l'identifiant quand `guildId` est donné, `null` sinon. Le faux serveur n'a pas de propriétaire, donc `guildOwnerOnly()` refuse toujours. |
| `ctx.member` | L'identifiant, les `permissions` et les `roles` quand `guildId` est donné, `null` sinon. |
| `ctx.channel`, `ctx.channelId` | `{ id }` et l'identifiant quand `channelId` est donné, `null` sinon. |
| `ctx.interaction` | Les deux ensembles de permissions, plus ce que vous passez dans `interaction`. |
| `ctx.client` | Un objet vide. |
| `ctx.services` | L'entrée `services`, sinon les services du bot, sinon un objet vide. |
| `ctx.logger` | Un logger silencieux. |
| `ctx.correlationId` | `"test"` |
| `ctx.t(key)` | Renvoie la clé, même quand le bot a des traductions. |
| `ctx.say(key, vars)` | La formulation du framework, avec les messages personnalisés de `messages`. |
| `ctx.audit(...)` | Ne fait rien. |

## Voir aussi

- [Gardes](/commands/guards/) : les préconditions que les entrées partagées exercent.
- [Services](/architecture/services/) : la jointure qui rend un gestionnaire testable.
- [Store](/data/store/) : `memoryStore()` et `sqliteStore(":memory:")` dans les tests.
- [L'objet ctx](/basics/context/) : ce que le faux contexte remplace.
- [CLI](/api/cli/) : `djs-bot doctor`, les mêmes vérifications depuis la ligne de commande.
