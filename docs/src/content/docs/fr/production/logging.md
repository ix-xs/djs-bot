---
title: "Journalisation"
description: "Le logger structuré intégré : des lignes colorées et lisibles pendant le développement, un objet JSON par ligne en production, et un identifiant de corrélation sur chaque ligne pour suivre une interaction du début à la fin."
sidebar:
  order: 5
---

Chaque gestionnaire reçoit un logger sous la forme `ctx.logger`. Il est déjà
marqué d'un identifiant de corrélation propre à l'interaction, au déclencheur ou
à la tâche planifiée en cours de traitement, ce qui vous permet de retrouver
toutes les lignes écrites pour une requête sans rien transmettre vous-même. Le
framework écrit ses propres lignes (démarrage, erreurs, arrêt) à travers le même
logger.

## Une première ligne de journal

```ts title="features/moderation/ban.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ban",
  description: "Ban a member",
  options: {
    user: s.user({ description: "Who to ban", required: true }),
  },
  run: async (ctx) => {
    ctx.logger.info({ target: ctx.options.user.id }, "ban requested");
    await ctx.reply.success("Done.");
  },
});
```

En développement, cela affiche une ligne lisible. L'identifiant de corrélation
et l'identifiant de l'utilisateur ont été ajoutés pour vous :

```
14:22:07 INFO  ban requested correlationId=k3Fz-1a userId=111111111111111111 target=222222222222222222
```

Un appel de journalisation prend d'abord des champs structurés, puis un message.
Ce sont les champs qui rendent les journaux consultables par la suite : préférez
`{ userId }` avec un message fixe à un message dans lequel l'identifiant est
collé.

```ts
logger.info("started");                       // un message seul
logger.info({ userId, guildId }, "member joined"); // des champs, puis un message
logger.error(err);                            // une Error seule, stockée sous "err"
logger.error(err, "payment failed");          // une Error et un message
logger.error({ err, userId }, "payment failed"); // une Error parmi d'autres champs
```

Quand le premier argument est une chaîne, c'est le message, et un deuxième
argument est ignoré. Un premier argument qui n'est ni une chaîne, ni une `Error`,
ni un objet est ignoré.

## Choisir un niveau

Définissez le niveau minimal dans `defineBot`. Les lignes en dessous sont
écartées avant tout travail de formatage.

```ts title="src/index.ts"
import { defineBot, env, type LogLevel } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  logger: { level: (env.optional("LOG_LEVEL") ?? "info") as LogLevel },
});
```

Lire le niveau dans l'environnement vous permet d'activer `debug` sur un hôte en
fonctionnement en changeant une variable et en redémarrant, sans toucher au code.
La valeur par défaut est `"info"`.

| Niveau | À utiliser pour |
| --- | --- |
| `debug` | Les dumps de données, les accès au cache, tout ce que vous supprimeriez plus tard. Masqué par défaut. |
| `info` | Les événements métier : une commande a été exécutée, un membre a rejoint, une tâche planifiée s'est terminée. |
| `warn` | Les problèmes dont le bot s'est remis : une nouvelle tentative, une limite de débit, un paramètre facultatif manquant. |
| `error` | Quelque chose a échoué et un utilisateur l'a remarqué. |
| `silent` | Rien n'est écrit. Pensé pour les tests. |

Les propres lignes du framework suivent le même réglage. Au niveau `info`, vous
voyez `Ready` quand le bot se connecte et les messages d'arrêt ; au niveau
`debug`, vous voyez aussi des détails comme la durée de chaque exécution d'une
tâche planifiée.

## Journaliser les erreurs

Une `Error` ne survit pas à `JSON.stringify` : elle devient `{}`, et c'est ainsi
que les traces d'appels disparaissent des journaux de production. Le logger
convertit chaque `Error` qu'il rencontre, qu'elle soit passée seule ou comme
valeur d'un champ, en un objet simple avec `name`, `message` et `stack`, plus
toute propriété propre que porte l'erreur. Pour une `BotError`, cela ajoute
`code`, `hint`, `docs` et, s'il est défini, `meta`.

```ts
try {
  await charge(orderId);
} catch (err) {
  ctx.logger.error({ err, orderId }, "charge failed");
}
```

```json
{"level":"error","time":"2026-01-01T12:00:00.000Z","msg":"charge failed","correlationId":"k3Fz-1a","userId":"111111111111111111","err":{"name":"Error","message":"card declined","stack":"Error: card declined\n    at charge (...)"},"orderId":"A-42"}
```

:::tip[Nommez le champ err]
`err` est le nom que le logger utilise quand vous passez une `Error` seule, et
celui qu'attendent la plupart des outils de traitement de journaux. L'utiliser
partout garde vos requêtes simples.
:::

Vous n'avez pas besoin d'attraper une erreur uniquement pour la journaliser.
Quand un gestionnaire lève une erreur, la barrière d'erreurs journalise
`Interaction handler failed` avec l'erreur au niveau `error` via le même
`ctx.logger`, puis répond à l'utilisateur. Les tâches planifiées, déclencheurs et
événements en échec sont journalisés de la même façon. Voir [Erreurs](/api/errors/).

## Identifiants de corrélation

Chaque interaction, exécution de déclencheur et exécution de tâche planifiée
reçoit un court identifiant tel que `k3Fz-1a` : une étiquette aléatoire choisie
au démarrage du processus, puis un compteur. Il est exposé sous la forme
`ctx.correlationId` et déjà lié à `ctx.logger`. Filtrez vos journaux sur un
identifiant et vous obtenez tout ce qui a été écrit pour cette requête, y
compris les lignes des plugins, puisqu'ils journalisent via le même
`ctx.logger`.

Ce que porte chaque logger sur chaque ligne :

| Logger | Champs liés |
| --- | --- |
| `ctx.logger` dans une commande, un menu contextuel, un bouton, un menu de sélection ou une modale | `correlationId`, `userId` |
| `ctx.logger` dans un gestionnaire d'autocomplétion | `correlationId`, `autocomplete` (le nom de l'option) |
| `ctx.logger` dans un déclencheur de message | `trigger`, `correlationId` |
| `ctx.logger` dans une tâche planifiée | `job`, `correlationId` |
| `ctx.logger` dans un événement | `event` |
| `app.logger` dans le `setup` d'un plugin | `plugin` |
| `bot.logger` | rien : c'est le logger racine |

Les événements n'ont pas d'identifiant de corrélation, parce qu'un événement de
la passerelle (gateway) n'est pas une requête avec un début et une fin.

Pour obtenir une ligne de synthèse par interaction, avec sa durée, ajoutez le
plugin `commandLogger` de `@ix-xs/djs-bot/plugins`, décrit dans
[Plugins et hooks](/architecture/plugins/) :

```
14:22:07 INFO  interaction handled correlationId=k3Fz-1a userId=111111111111111111 kind=command name=ban guildId=333333333333333333 ms=143
```

## Loggers enfants

`child()` renvoie un nouveau logger qui ajoute des champs à chaque ligne.
Utilisez-le dans un service pour que ses lignes soient identifiables sans
répéter le contexte à chaque fois.

```ts title="features/tickets/tickets.service.ts"
import { defineService, createLogger, type Logger } from "@ix-xs/djs-bot";

export class TicketService {
  private readonly log: Logger;

  public constructor(logger: Logger) {
    this.log = logger.child({ service: "tickets" });
  }

  public open(userId: string): void {
    this.log.info({ userId }, "ticket opened"); // service=tickets est toujours présent
  }
}

export default defineService("tickets", {
  factory: () => new TicketService(createLogger()),
});
```

Les liaisons s'additionnent : `ctx.logger.child({ step: "validate" })` garde
l'identifiant de corrélation et ajoute l'étape. Un enfant hérite du niveau et du
format de sortie de son parent. En cas de collision de noms, le champ de
l'enfant remplace celui du parent, et un champ passé dans un appel de
journalisation remplace un champ lié.

`createLogger` construit un logger en dehors de tout gestionnaire, pour un
service comme celui ci-dessus, un script ou un processus worker :

```ts
import { createLogger } from "@ix-xs/djs-bot";

const logger = createLogger({ level: "debug", bindings: { app: "worker" } });
logger.info("started");
```

:::note[Un logger autonome a ses propres réglages]
`createLogger()` ne lit pas l'option `logger` de `defineBot`. Il part des valeurs
par défaut (`"info"`, joli format hors production) sauf si vous passez des
options. Pour journaliser avec les réglages du bot, utilisez `ctx.logger`, ou
`bot.logger` là où vous détenez l'instance du bot.
:::

## Formats de sortie

Avec `pretty: true`, chaque ligne est l'heure locale, le niveau en couleur, le
message, puis les champs sous la forme `key=value`. Les valeurs d'objet sont
affichées en JSON.

```
14:22:07 INFO  member joined userId=123 guildId=456
14:22:08 WARN  rate limited userId=123
14:22:09 ERROR command failed correlationId=k3Fz-1b err={"name":"TypeError","message":"..."}
```

Avec `pretty: false`, chaque ligne est un objet JSON, prêt pour n'importe quelle
chaîne de traitement de journaux :

```json
{"level":"info","time":"2026-01-01T12:00:00.000Z","msg":"member joined","userId":"123"}
```

`level`, `time` (ISO 8601, UTC) et `msg` viennent en premier, puis les champs
liés, puis les champs de l'appel.

`pretty` vaut `true` par défaut sauf si `NODE_ENV` vaut `production`, donc un bot
déployé passe de lui-même en JSON. Définissez-le explicitement pour changer ce
comportement. Les lignes au format lisible contiennent toujours des codes de
couleur : si vous redirigez la sortie de développement vers un fichier, utilisez
`pretty: false`.

Les deux formats n'utilisent pas les mêmes flux :

| Format | `debug`, `info` | `warn`, `error` |
| --- | --- | --- |
| Lisible (pretty) | stdout | stderr |
| JSON | stdout | stdout |

:::caution[Gardez des champs sérialisables]
Dans la sortie JSON, ne nommez pas un champ `level`, `time` ou `msg` : il
écraserait celui de l'enregistrement. Évitez les valeurs que `JSON.stringify` ne
sait pas traiter, comme une structure circulaire ou un `bigint` : en sortie JSON,
l'appel de journalisation lève une erreur, et en sortie lisible les champs sont
remplacés par `[unserialisable]`. Journalisez un identifiant plutôt qu'un objet
discord.js entier.
:::

Le logger écrit sur les flux du processus et nulle part ailleurs. Pour envoyer
les journaux vers un fichier ou un service, capturez la sortie du processus, ce
que font déjà les plateformes d'hébergement et les gestionnaires de processus.

## Référence

### `defineBot({ logger })`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `level` | `LogLevel` | `"info"` | Le niveau le moins sévère qui est écrit. |
| `pretty` | `boolean` | `true` sauf si `NODE_ENV=production` | Des lignes colorées et lisibles au lieu de JSON. |

### `createLogger(options?)`

```ts
createLogger(options?: LoggerOptions): Logger
```

Crée un logger racine. `new Logger(options)` fait la même chose.

### `LoggerOptions`

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `level` | `LogLevel` | `"info"` | Le niveau le moins sévère qui est écrit. |
| `pretty` | `boolean` | `true` sauf si `NODE_ENV=production` | Forcer la sortie lisible (`true`) ou JSON (`false`). |
| `bindings` | `Record<string, unknown>` | `{}` | Champs fusionnés dans chaque ligne. |

### `Logger`

| Méthode | Description |
| --- | --- |
| `debug(obj, msg?)` | Détail verbeux. Masqué au niveau par défaut. |
| `info(obj, msg?)` | Fonctionnement normal. |
| `warn(obj, msg?)` | Quelque chose de suspect que le bot a surmonté. |
| `error(obj, msg?)` | Un échec. |
| `child(bindings)` | Un nouveau logger qui inclut aussi `bindings` sur chaque ligne. |

`obj` est une chaîne de message, une `Error`, ou un objet de champs. `msg` est
une chaîne de message facultative. Le niveau et le format d'un logger ne peuvent
pas être modifiés après sa création.

### `LogLevel`

```ts
type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
```

Classés du plus verbeux au moins verbeux. Un logger écrit son propre niveau et
tous ceux qui suivent ; `silent` n'écrit rien.

## Voir aussi

- [L'objet ctx](/basics/context/) pour `ctx.logger` et `ctx.correlationId`.
- [Erreurs](/api/errors/) pour la barrière d'erreurs et `BotError`.
- [Plugins et hooks](/architecture/plugins/) pour `commandLogger` et `errorReporter`.
- [Santé et métriques](/production/health/) pour les compteurs et le temps de fonctionnement plutôt que des lignes de texte.
- [Tests](/production/testing/) pour le harnais, dont les contextes journalisent au niveau `silent`.
