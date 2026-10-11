---
title: "Journal d'audit"
description: "Gardez une trace structurée et interrogeable de qui a fait quoi avec ctx.audit. Les entrées vont vers une ou plusieurs destinations (mémoire, un store, le logger), et chaque utilisation d'une commande peut être enregistrée pour vous."
sidebar:
  order: 5
---

Un bot de modération a besoin d'un journal d'audit, et tout bot en profite dès
la première fois que quelqu'un demande « qui a banni ce membre ? ». C'est le
registre propre au bot, conservé là où vous le décidez. Il est distinct du
journal d'audit que Discord tient pour chaque serveur.

## Une première entrée d'audit

Configurez `audit` avec au moins une destination (*sink*), l'endroit où les
entrées sont écrites :

```ts title="src/index.ts"
import { defineBot, env, loggerAuditSink, sqliteStore, storeAuditSink } from "@ix-xs/djs-bot";

const store = sqliteStore("data/bot.sqlite");

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./features",
  store,
  audit: {
    sinks: [storeAuditSink(store, { ttl: "90d" }), loggerAuditSink()],
  },
});
```

Appelez ensuite `ctx.audit` dans un gestionnaire. L'acteur (l'utilisateur à
l'origine de l'interaction) et le serveur sont renseignés pour vous, donc un
appel reste court :

```ts title="features/moderation/ban.command.ts"
import { defineCommand, hasPermission, inGuild, PermissionFlagsBits, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ban",
  description: "Ban a member",
  guards: [inGuild(), hasPermission(PermissionFlagsBits.BanMembers)],
  options: {
    target: s.user({ description: "Who to ban", required: true }),
    reason: s.string({ description: "Why" }),
  },
  run: async (ctx) => {
    await ctx.guild!.members.ban(ctx.options.target, { reason: ctx.options.reason });
    await ctx.audit("member.ban", {
      targetId: ctx.options.target.id,
      metadata: { reason: ctx.options.reason },
    });
    return ctx.reply.success("Banned.");
  },
});
```

Configurer `audit` enregistre aussi le service `audit`, qui sert à
[interroger le journal](#querying-the-trail). Quand `audit` n'est pas
configuré, `ctx.audit()` ne fait rien : les gestionnaires qui l'appellent ne
plantent jamais.

:::tip[Nommer les actions]
Utilisez `domaine.verbe` : `member.ban`, `ticket.close`, `config.update`. Le
filtre `action` compare le nom exact, donc des noms cohérents sont ce qui rend
les requêtes et le filtrage des journaux utiles.
:::

`ctx.audit` existe dans les gestionnaires d'interaction. Dans un événement, un
déclencheur ou une tâche planifiée, il n'y a aucune interaction d'où lire
l'acteur : écrivez donc par le service et donnez vous-même les champs :

```ts
await ctx.services.audit.record("member.join", {
  actorId: member.id,
  guildId: member.guild.id,
});
```

## Enregistrer les commandes automatiquement

Avec `autoRecordCommands: true`, chaque utilisation d'une commande slash est
enregistrée sous la forme `command:<name>`, sans aucun code dans vos
gestionnaires :

```ts
audit: {
  sinks: [storeAuditSink(store)],
  autoRecordCommands: true,
},
```

Ce qui est enregistré, précisément :

- Les commandes slash uniquement. Les menus contextuels, boutons, menus de
  sélection et modales ne sont pas enregistrés.
- Le nom de la commande de premier niveau. Une sous-commande est enregistrée
  sous sa commande parente (`command:config`, pas `command:config set`).
- L'acteur et le serveur. Ni cible, ni options, ni métadonnées.
- La tentative, pas le résultat : l'entrée est écrite avant l'exécution des
  gardes, donc une commande refusée ou en échec est enregistrée aussi.

Pour quelque chose de plus riche, appelez `ctx.audit` vous-même.

## Choisir les destinations

Une destination est l'endroit où vont les entrées. Indiquez-en plusieurs et
chaque entrée est écrite dans toutes, par exemple une destination durable et
une autre pour suivre le flux en direct.

| Destination | Durable | Interrogeable | Sert à |
| --- | --- | --- | --- |
| `memoryAuditSink(max?)` | Non | Oui | Les tests, le débogage de courte durée. Garde les 5000 dernières entrées par défaut. |
| `storeAuditSink(store, options?)` | Avec un store durable | Oui | Un vrai historique. Une clé de store par entrée. |
| `loggerAuditSink(logger?)` | Selon votre chaîne de journaux | Non | L'envoi vers Loki, Datadog ou CloudWatch. |

Sans aucune destination (`audit: {}`), les entrées vont dans un
`memoryAuditSink()`.

`storeAuditSink` écrit dans un espace de noms du [store](/data/store/), à
l'écart de vos autres clés, et un `ttl` donne une politique de rétention en une
seule option :

```ts
storeAuditSink(store, { namespace: "audit", ttl: "90d" })
```

`loggerAuditSink()` journalise chaque entrée au niveau `info`, avec le message
`audit: <action>` et l'entrée dans le champ `audit`. Il accepte un
[logger](/production/logging/) facultatif et en crée un sinon, ce qui permet de
l'écrire directement dans la configuration.

Tout objet ayant une fonction `record`, et éventuellement une fonction
`query`, est une destination :

```ts title="src/webhook-sink.ts"
import type { AuditSink } from "@ix-xs/djs-bot";

export const webhookSink = (url: string): AuditSink => ({
  async record(entry) {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `\`${entry.action}\` by <@${entry.actorId}>` }),
    });
  },
});
```

:::note[Les échecs sont contenus, et silencieux]
Une destination dont `record` lève une exception ou rejette ne casse jamais la
commande qui a enregistré l'entrée : les autres destinations la reçoivent
quand même, et l'erreur est écartée. Rien n'est journalisé à propos de
l'échec, donc associez une destination fragile à `loggerAuditSink()` pour être
sûr que l'entrée atterrisse quelque part.
:::

`ctx.audit` se résout une fois que toutes les destinations ont terminé. Une
destination lente, comme un webhook, retarde donc le gestionnaire qui l'attend.

## Interroger le journal

Relisez les entrées par le service `audit`. Il est déjà typé, aucun cast n'est
nécessaire.

```ts
const entries = await ctx.services.audit.query({
  action: "member.ban",
  guildId: ctx.guildId!,
  since: Date.now() - 7 * 24 * 3600_000,
  limit: 25,
});
```

Les résultats viennent de la première destination lisible, dans l'ordre où vous
les avez listées, de la plus récente à la plus ancienne. Une configuration
avec seulement `loggerAuditSink()` renvoie un tableau vide : ajoutez une
destination mémoire ou store pour interroger. Si vous listez une destination
mémoire avant une destination store, les requêtes ne voient que ce qui est en
mémoire.

Une commande d'historique pour les modérateurs :

```ts title="features/admin/audit.command.ts"
import {
  defineCommand,
  hasPermission,
  inGuild,
  mention,
  PermissionFlagsBits,
  s,
  timestamp,
  TimestampStyles,
} from "@ix-xs/djs-bot";

export default defineCommand({
  name: "audit",
  description: "Recent moderation actions",
  guards: [inGuild(), hasPermission(PermissionFlagsBits.ViewAuditLog)],
  options: {
    action: s.string({ description: "Filter by action, e.g. member.ban" }),
    user: s.user({ description: "Filter by moderator" }),
  },
  run: async (ctx) => {
    const entries = await ctx.services.audit.query({
      guildId: ctx.guildId!,
      action: ctx.options.action,
      actorId: ctx.options.user?.id,
      limit: 10,
    });

    if (entries.length === 0) return ctx.reply.info("Nothing recorded yet.");

    return ctx.reply.info(
      entries
        .map((entry) => {
          const when = timestamp(entry.timestamp, TimestampStyles.RelativeTime);
          const who = entry.actorId ? mention.user(entry.actorId) : "unknown";
          return `${when}: \`${entry.action}\` by ${who}`;
        })
        .join("\n"),
    );
  },
});
```

Une requête charge toutes les entrées de la destination, puis les filtre et les
trie en mémoire. C'est très bien pour des milliers d'entrées. Pour un long
historique, définissez un `ttl` sur `storeAuditSink`, ou écrivez une
destination dont `query` interroge une vraie base de données.

## Un journal d'audit sans bot

`createAuditLog` construit le même journal de façon autonome, pour un script ou
un test :

```ts title="tests/audit.test.ts"
import { createAuditLog, memoryAuditSink } from "@ix-xs/djs-bot";

const audit = createAuditLog({ sinks: [memoryAuditSink()] });

const entry = await audit.record("member.ban", { actorId: "1", targetId: "2" });
entry.id;          // généré
entry.timestamp;   // Date.now()

await audit.query({ action: "member.ban" });   // [entry]
```

## Référence

### `audit` dans `defineBot`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `sink` | `AuditSink` | aucun | Une seule destination. |
| `sinks` | `AuditSink[]` | aucun | Plusieurs destinations. Toutes reçoivent chaque entrée. |
| `autoRecordCommands` | `boolean` | `false` | Enregistre chaque utilisation d'une commande slash sous la forme `command:<name>`. |

`sink` et `sinks` peuvent se combiner : `sink` passe en premier. Avec aucun des
deux, un `memoryAuditSink()` est utilisé.

### `ctx.audit(action, details?)`

```ts
ctx.audit(action: string, details?: {
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>
```

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `action` | `string` | obligatoire | Ce qui s'est passé, par exemple `"member.ban"`. |
| `details.targetId` | `string` | aucun | L'identifiant de ce sur quoi l'action a porté : un utilisateur, un message, un salon. |
| `details.metadata` | `Record<string, unknown>` | aucun | Tout ce qui mérite d'être gardé en plus, par exemple `{ reason }`. |

`actorId` est l'identifiant de l'utilisateur à l'origine de l'interaction et
`guildId` celui de son serveur (`null` en message privé).

### `AuditEntry`

| Champ | Type | Description |
| --- | --- | --- |
| `id` | `string` | Identifiant unique, généré pour vous. |
| `timestamp` | `number` | Millisecondes Unix. |
| `action` | `string` | Ce qui s'est passé, par exemple `"member.ban"` ou `"command:ban"`. |
| `actorId` | `string?` | Qui l'a fait. |
| `targetId` | `string?` | Qui ou quoi a subi l'action. |
| `guildId` | `string \| null?` | Où. |
| `metadata` | `Record<string, unknown>?` | Tout contexte structuré. |

### `memoryAuditSink(max)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `max` | `number` | `5000` | Le nombre d'entrées conservées. Au-delà, la plus ancienne est supprimée. |

### `storeAuditSink(store, options)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `store` | `KVStore` | obligatoire | Le store où sont écrites les entrées, une clé par entrée (l'identifiant de l'entrée). |
| `options.namespace` | `string` | `"audit"` | L'espace de noms du store sous lequel vivent les entrées. |
| `options.ttl` | `number \| string` | aucun | La durée de conservation d'une entrée, en millisecondes ou sous forme de durée comme `"90d"`. Pour toujours par défaut. |

### `loggerAuditSink(logger)`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `logger` | `Logger` | `createLogger()` | Le logger où les entrées sont écrites. En écriture seule : cette destination ne peut pas être interrogée. |

### `AuditSink`

| Méthode | Obligatoire | Description |
| --- | --- | --- |
| `record(entry)` | Oui | Stocke une `AuditEntry`. Peut être asynchrone. |
| `query()` | Non | Renvoie toutes les entrées stockées, dans n'importe quel ordre. Sa présence rend la destination lisible par `AuditLog.query`. |

### `AuditLog`

Le type de `ctx.services.audit` et de la valeur renvoyée par `createAuditLog`.

| Méthode | Renvoie | Description |
| --- | --- | --- |
| `record(action, data?)` | `Promise<AuditEntry>` | Écrit une entrée dans chaque destination et la renvoie. `data` accepte tout champ d'`AuditEntry` sauf `action`. `id` et `timestamp` sont générés sauf si vous les passez. |
| `query(filter?)` | `Promise<AuditEntry[]>` | Lit les entrées, de la plus récente à la plus ancienne, dans la première destination qui a une fonction `query`. Un tableau vide si aucune n'en a. |

### `AuditFilter`

Chaque champ est facultatif, et les champs se combinent avec « et ».

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `action` | `string` | tous | Seulement les entrées portant exactement ce nom d'action. |
| `actorId` | `string` | tous | Seulement les entrées déclenchées par cet identifiant d'utilisateur. |
| `guildId` | `string` | tous | Seulement les entrées enregistrées dans ce serveur. |
| `since` | `number` | aucun | Seulement les entrées à partir de ce moment, en millisecondes Unix. |
| `limit` | `number` | pas de limite | Le nombre maximal d'entrées, en comptant depuis la plus récente. |

### `createAuditLog(options)`

```ts
createAuditLog(options?: AuditLogOptions): AuditLog
```

`AuditLogOptions` a les champs `sink` et `sinks` décrits plus haut.
`autoRecordCommands` appartient à `defineBot` uniquement.

## Voir aussi

- [Store](/data/store/) : le support de `storeAuditSink`.
- [Journalisation](/production/logging/) : là où écrit `loggerAuditSink`.
- [L'objet ctx](/basics/context/) : les autres helpers à côté de `ctx.audit`.
- [Feature flags](/data/flags/) : une commande d'administration qui audite chaque bascule.
- [Tests](/production/testing/) : dans le harnais de test, `ctx.audit` ne fait rien.
