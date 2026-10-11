---
title: "Services"
description: "Un service est un objet partagé dont vos gestionnaires ont besoin : un client de base de données, une enveloppe d'API, un morceau de logique métier. Définissez-le une fois avec defineService et lisez-le depuis ctx.services partout, entièrement typé, sans variable globale ni import circulaire."
sidebar:
  order: 1
---

Les services sont tenus par un petit conteneur explicite. Il n'y a ni décorateurs
ni `reflect-metadata` : un service a un nom (son token), liste les tokens dont il
dépend, et est construit une seule fois au démarrage du bot.

## Un premier service

```ts title="src/features/db/db.service.ts"
import { defineService, env } from "@ix-xs/djs-bot";
import { Pool } from "pg";

export default defineService("db", {
  factory: async () => {
    const pool = new Pool({ connectionString: env("DATABASE_URL") });
    await pool.query("select 1"); // échouer au démarrage si la base est injoignable
    return pool;
  },
  dispose: (pool) => pool.end(),
});
```

Le premier argument est le token. `factory` construit l'instance et peut être
asynchrone. Le chargeur prend en compte tout fichier dont le nom se termine par
`.service` (voir [Structure du projet](/basics/project-layout/)).

L'instance est ensuite disponible sous `ctx.services.db` :

```ts title="src/features/tickets/count.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "tickets",
  description: "How many tickets are open",
  run: async (ctx) => {
    const { rows } = await ctx.services.db.query("select count(*) from tickets where open");
    await ctx.reply(`Open tickets: ${rows[0].count}`);
  },
});
```

Chaque `ctx` porte les mêmes `services` : commandes, menus contextuels, boutons,
menus de sélection, modales, événements, déclencheurs, tâches planifiées, gardes
et gestionnaires d'autocomplétion. Les hooks des plugins reçoivent aussi ce
`ctx`.

Chaque service est un singleton. Tous sont construits au démarrage, avant que le
bot se connecte : une base de données injoignable arrête donc le lancement, et
non la première commande qui en a besoin.

## Dépendre d'autres services

Listez dans `deps` les tokens dont un service a besoin. Ils sont construits en
premier et passés à `factory` sous la forme d'un seul objet, indexé par token.

```ts title="src/features/tickets/tickets.service.ts"
import { defineService } from "@ix-xs/djs-bot";
import { TicketService } from "./ticket-service.js";

export default defineService("tickets", {
  deps: ["db", "store"],
  factory: ({ db, store }) => new TicketService(db, store),
});
```

L'ordre des fichiers n'a pas d'importance : le conteneur trie lui-même le graphe.
Un token qui n'existe pas, ou deux services qui dépendent l'un de l'autre,
arrêtent le démarrage avec une erreur claire (voir
[Limites et erreurs](#limits-and-errors)).

Dans cet exemple, `store` est l'un des trois tokens que le framework enregistre
lui-même, quand l'option correspondante de `defineBot` est définie :

| Token | Enregistré quand | Type | Page |
| --- | --- | --- | --- |
| `store` | `defineBot({ store })` | `KVStore` | [Store](/data/store/) |
| `audit` | `defineBot({ audit })` | `AuditLog` | [Journal d'audit](/data/audit/) |
| `flags` | `defineBot({ flags })` | `FeatureFlags` | [Feature flags](/data/flags/) |

Un [plugin](/architecture/plugins/) peut enregistrer d'autres tokens avec
`app.services.register(token, value)`. Les plugins sont initialisés avant la
construction des services : un service peut donc lister un tel token dans ses
`deps`.

## Typer vos services

Par défaut, un token que vous avez défini vous-même est `unknown`, donc rien
n'est jamais `any` en silence. Déclarez vos tokens une seule fois en augmentant
l'interface `ServiceMap` :

```ts title="src/types.d.ts"
import type { Pool } from "pg";
import type { TicketService } from "./features/tickets/ticket-service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap {
    db: Pool;
    tickets: TicketService;
  }
}
```

Dès lors, `ctx.services.tickets.open(...)` est complété et vérifié partout, et
l'objet qu'une fabrique reçoit est typé de la même façon :

```ts
defineService("tickets", {
  deps: ["db", "store"],
  factory: ({ db, store }) => new TicketService(db, store), // db: Pool, store: KVStore
});
```

`store`, `audit` et `flags` sont déclarés par le framework. Vous obtenez
`ctx.services.store` typé sans rien écrire.

:::caution[Gardez un import dans ce fichier]
Le fichier qui augmente `ServiceMap` doit contenir au moins un `import` ou un
`export`. Sans cela, TypeScript lit `declare module` comme un remplacement de
tout le paquet, et tous les autres imports depuis `"@ix-xs/djs-bot"` cassent.
:::

## Libérer à l'arrêt

`dispose` reçoit l'instance quand le bot s'arrête proprement. Utilisez-le pour
fermer un pool de connexions ou vider un tampon.

```ts
defineService("db", {
  factory: () => new Pool({ connectionString: env("DATABASE_URL") }),
  dispose: (pool) => pool.end(),
});
```

Les services sont libérés dans l'ordre inverse de leur création : un service est
donc toujours libéré avant ceux dont il dépend, `tickets` d'abord, puis `db`. Un
`dispose` qui lève une erreur est journalisé et les autres s'exécutent quand
même. La séquence complète de l'arrêt est sur la page
[Cycle de vie](/basics/lifecycle/).

Seuls les services construits par une `factory` sont libérés de cette façon. Une
valeur enregistrée par un plugin est libérée par le `teardown` de ce plugin, et
le framework ferme lui-même le `store`.

## Contrats de capacités

Une [feature](/architecture/features/) ou un [plugin](/architecture/plugins/)
peut déclarer ce dont il a besoin et ce qu'il offre, sous forme de simples
chaînes appelées capacités. Par convention, une capacité est un token de service.

```ts
defineFeature({ name: "tickets", requires: ["db"], commands: [Open] });

definePlugin({
  name: "postgres",
  provides: ["db"],
  setup: (app) => app.services.register("db", pool),
});
```

Les contrats sont vérifiés au démarrage, avant qu'un plugin soit initialisé,
qu'un service soit construit ou que le bot se connecte. Une pièce manquante
arrête donc le lancement, au lieu d'échouer plus tard à la première interaction.

Une entrée de `requires` est satisfaite par l'un de ces éléments :

- le token d'un `defineService` ;
- une entrée dans le `provides` de n'importe quel plugin ou feature ;
- un token intégré dont l'option est définie : `defineBot({ store })` satisfait
  `requires: ["store"]`.

Sinon le démarrage échoue avec [`DJSBOT_E040`](/api/errors/#djsbot_e040), qui
nomme la feature ou le plugin et la capacité manquante.

Deux détails découlent du moment de la vérification :

- Une valeur qu'un plugin enregistre dans `setup` ne compte pas à elle seule,
  car `setup` ne s'est pas encore exécuté. Le plugin doit aussi lister le token
  dans `provides`.
- `provides` est une déclaration. Le framework ne vérifie pas qu'un service de ce
  nom est enregistré ensuite.

Un plugin peut aussi lister des capacités dans `conflicts`. Le démarrage échoue
alors avec [`DJSBOT_E041`](/api/errors/#djsbot_e041) si l'une d'elles est le
token d'un `defineService` ou apparaît dans un `provides`. Deux plugins qui
fournissent la même capacité ne sont pas un conflit en soi : déclarez
`conflicts` pour l'interdire.

## Référence

### `defineService(token, options)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `token` | `string` | - | Le nom utilisé pour résoudre et injecter le service. Premier argument. |
| `deps` | `string[]` | `[]` | Tokens des services dont celui-ci a besoin. Ils sont résolus en premier. |
| `factory` | `(deps) => T \| Promise<T>` | - | Construit l'instance. `deps` est un objet indexé par les tokens que vous avez listés, typé à partir de `ServiceMap` (`unknown` pour un token non déclaré). |
| `dispose` | `(instance: T) => unknown` | aucun | Appelé avec l'instance pendant l'arrêt propre. Peut être asynchrone. |

Renvoie un `ServiceDefinition<T>` (`kind: "service"`, `name`, `deps`, `factory`,
`dispose`), à exporter depuis un fichier `.service` ou à lister dans une
[feature](/architecture/features/).

### `ServiceMap`

L'interface derrière `ctx.services`. Elle déclare `store: KVStore`,
`audit: AuditLog` et `flags: FeatureFlags`, et tout autre token comme `unknown`.
Augmentez-la comme indiqué dans [Typer vos services](#type-your-services).

`ctx.services` est une vue vivante et en lecture seule du conteneur :

| Opération | Résultat |
| --- | --- |
| `ctx.services.db` | L'instance. Lève [`DJSBOT_E031`](/api/errors/#djsbot_e031) si le token n'est pas enregistré, y compris un token intégré dont l'option n'est pas définie. |
| `"db" in ctx.services` | `true` quand le token est enregistré. À utiliser pour un service facultatif. |
| `Object.keys(ctx.services)` | Les tokens enregistrés. |

### `Container`

Le conteneur qui se trouve derrière tout cela est exposé sous `bot.container`.
Vous en aurez rarement besoin, mais rien n'est caché.

| Méthode | Renvoie | Description |
| --- | --- | --- |
| `register(def)` | `void` | Enregistre un `ServiceDefinition`. |
| `registerValue(token, value)` | `void` | Enregistre une valeur déjà construite. C'est ce qu'appelle `app.services.register`. |
| `has(token)` | `boolean` | Indique si un token est connu, comme définition ou comme valeur. |
| `tokens()` | `string[]` | Chaque token enregistré. |
| `resolve(token)` | `Promise<unknown>` | Résout un service, en construisant ses dépendances à la demande. Lève `DJSBOT_E031` pour un token inconnu et `DJSBOT_E030` en cas de cycle. |
| `resolveAll()` | `Promise<void>` | Construit chaque définition. Appelé une fois au démarrage. |
| `disposeAll(onError?)` | `Promise<void>` | Exécute chaque `dispose`, le plus récemment construit en premier. Un échec est transmis à `onError(error, token)` et n'arrête pas les autres. Appelé à l'arrêt. |
| `view()` | `ServiceMap` | La vue en lecture seule exposée sous `ctx.services`. |

```ts
await bot.load(); // découvre les fichiers et construit les services, sans se connecter
console.log(bot.container.tokens()); // ["db", "tickets", "store"]
const db = await bot.container.resolve("db");
```

## Limites et erreurs

- **Token inconnu.** Une faute de frappe dans `deps` arrête le démarrage avec
  [`DJSBOT_E031`](/api/errors/#djsbot_e031). Lire sur `ctx.services` un token qui
  n'existe pas lève la même erreur à ce moment-là. Le message liste les tokens
  qui existent, ce qui révèle en général la faute de frappe :

  ```text
  BotError [DJSBOT_E031]: Unknown service: service "databse"
    ↳ Requested a service that was never registered. Known services: db, tickets, store.
  ```

- **Cycle.** Deux services qui dépendent l'un de l'autre, directement ou non,
  arrêtent le démarrage avec [`DJSBOT_E030`](/api/errors/#djsbot_e030). Le
  message nomme la chaîne (`a -> b -> a`).
- **Une factory qui lève une erreur** arrête le démarrage avec sa propre erreur.
- **Un token en double est un avertissement, pas une erreur.** Si deux
  définitions utilisent le même token, la dernière enregistrée remplace l'autre,
  et le bot écrit `Two services share this token; the one registered last is used`
  au démarrage.
- **Mon service est-il enregistré ?** `npx djs-bot explain` affiche chaque
  définition chargée et les tokens de services, sans se connecter. Voir
  [CLI](/api/cli/).

## Voir aussi

- [Plugins et hooks](/architecture/plugins/) : enregistrer une ressource partagée avec des hooks.
- [Features](/architecture/features/) : regrouper des services avec les commandes qui les utilisent.
- [L'objet ctx](/basics/context/) : tout le reste de ce qu'un gestionnaire reçoit.
- [Store](/data/store/) : le service clé-valeur intégré.
- [Tests](/production/testing/) : remplacer un service par un faux dans un test.
