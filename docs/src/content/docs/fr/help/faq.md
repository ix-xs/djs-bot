---
title: "FAQ"
description: "Des réponses courtes aux questions qui se posent avant de commencer, et pendant que vous développez."
sidebar:
  order: 2
---

## Avant de commencer

### Faut-il connaître discord.js ?

Non, mais cela aide. Le framework se place **au-dessus** de discord.js et ne le
cache jamais : `ctx.interaction`, `ctx.client`, `ctx.guild` et `ctx.member` sont
les vrais objets de discord.js, donc tous les guides de discord.js restent
valables. Vous n'apprenez qu'une couche en plus, pas un remplacement.

### Puis-je l'ajouter à un bot discord.js existant ?

Oui. Enregistrez les définitions explicitement et gardez votre code client actuel
à côté pendant la migration :

```ts
export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: [MyNewCommand, MyNewEvent],
});
```

Déplacez une commande à la fois. Rien ne vous oblige à tout réécrire d'un coup.

### Que faut-il installer ?

Node **22.13 ou plus récent** (le store SQLite utilise `node:sqlite`), plus
`@ix-xs/djs-bot` et `discord.js` **14.27 ou plus récent**. `tsx` est facultatif :
il permet à `dev` et `start` d'exécuter du TypeScript sans étape de compilation.

### TypeScript est-il obligatoire ?

Pas strictement, mais tout l'intérêt du framework est dans le typage : options
typées, paramètres de customId typés, services typés. En JavaScript pur, tout
fonctionne et vous gardez le routage, les gardes, l'injection de dépendances et
la CLI, mais vous perdez la sécurité à la compilation.

## Commandes

### Commandes globales ou de serveur ?

| | Globale | De serveur |
| --- | --- | --- |
| Où | Tous les serveurs où se trouve le bot | Uniquement les serveurs listés |
| Propagation | Jusqu'à une heure | Instantanée |
| Se déclare avec | rien (par défaut) | `guilds: ["id"]` |

Utilisez des commandes de serveur pour les outils d'administration et pour le
développement, des commandes globales pour tout ce dont vos utilisateurs ont
besoin.

### Comment réserver une commande aux administrateurs ?

Avec les deux couches ensemble :

```ts
defaultMemberPermissions: PermissionFlagsBits.Administrator,   // Discord la masque
guards: [hasPermission(PermissionFlagsBits.Administrator)],    // votre bot l'applique
```

La première masque la commande dans l'interface, mais un administrateur du
serveur peut la remplacer dans les paramètres du serveur. La garde, elle, ne peut
pas être contournée.

### Combien d'options une commande peut-elle avoir ?

25 par commande ou par sous-commande, et Discord exige que les options
obligatoires viennent en premier (le framework les ordonne pour vous). Une
commande peut contenir 25 sous-commandes, et un groupe peut contenir 25
sous-commandes.

### Le bot peut-il répondre dans ma langue ?

Oui, à trois niveaux. Les noms de commandes sont localisés avec
`nameLocalizations`, vos propres réponses avec `ctx.t()`, et ce que dit le
framework lui-même (refus des gardes, erreur générique) avec
[`defineBot({ messages })`](/basics/wording-and-theme/).

### Dois-je encore appeler `defer()` ?

Non. `defineBot({ defaults: { defer: true } })` acquitte tout gestionnaire qui
n'a pas répondu au bout de 2 secondes, et laisse les gestionnaires rapides
tranquilles. Voir le [différé automatique](/basics/automatic-deferral/).

### Choix ou autocomplétion ?

`choices` pour une liste fixe d'au plus 25 valeurs, affichée par Discord
lui-même. `autocomplete` pour tout ce qui est dynamique, propre à
l'utilisateur ou plus long. Les deux s'excluent mutuellement.

## Composants

### Pourquoi encoder les paramètres dans le customId plutôt que d'utiliser une Map ?

Parce que votre bot redémarre. Une `Map` indexée par identifiant de message est
vide après un déploiement, et tous les anciens boutons deviennent morts. Le
customId voyage avec le message : un bouton publié il y a six mois fonctionne
toujours après n'importe quel nombre de redémarrages. Quand la charge utile est
trop grande pour 100 caractères, gardez une clé courte et stockez le reste.

### Combien de temps les boutons restent-ils actifs ?

Les composants enregistrés (`defineButton`) fonctionnent **pour toujours**,
redémarrages compris. `paginate` et `confirm` utilisent leur propre collecteur et
s'arrêtent à leur `timeout` (2 minutes et 1 minute par défaut), en désactivant
les contrôles à la fin.

### Puis-je utiliser des embeds et Components V2 dans le même message ?

Non. Un message avec le drapeau `IsComponentsV2` ne peut pas porter de `content`
ni d'`embeds`. Choisissez l'un ou l'autre pour chaque message.

## Données

### Quel store dois-je utiliser ?

`memoryStore()` pour les tests et l'état éphémère, `sqliteStore()` pour tout ce
qui doit survivre à un redémarrage. Quand ils ne suffisent plus,
`createStore()` transforme quatre méthodes, sur le backend de votre choix, en un
store complet.

### Suis-je obligé d'utiliser le store intégré ?

Non. C'est juste une facilité. Enregistrez Prisma, Drizzle, Mongo ou un pool
brut comme service et utilisez-le à la place :

```ts
defineService("db", { factory: () => new PrismaClient() });
```

Le store existe pour que les petits bots n'aient besoin d'aucune base de
données, et pour que des fonctions comme les feature flags et l'audit aient un
endroit où écrire.

### Où ranger mes fichiers de données ?

N'importe où en dehors de votre arborescence source, par exemple
`data/bot.sqlite`, et ajoutez `data/` à `.gitignore`. Créez le dossier avant le
premier lancement.

## Production

### Comment l'héberger ?

Tout ce qui fait tourner Node 22 : un VPS avec systemd ou pm2, Docker, Fly,
Railway, Render. Voir [Passer en production](/tutorial/going-live/) pour un parcours
complet.

### Quand ai-je besoin du sharding ?

À **2500 serveurs**, seuil où Discord l'impose. En dessous, il ajoute de la
complexité pour rien. Une fois arrivé là, `sharding: "auto"` s'en occupe.

### Comment savoir si le bot est en bonne santé ?

Activez le serveur de contrôle de santé et pointez votre outil de supervision
dessus :

```ts
health: 3000,
```

`/healthz` pour la vivacité, `/readyz` pour la disponibilité, `/metrics` pour les
compteurs. Voir [Contrôles de santé](/production/health/).

### Dois-je lancer le déploiement à chaque démarrage ?

Non. En production, déployez depuis la CI à chaque version, pas au démarrage.
`autoDeploy` est activé par défaut en développement et désactivé en production
pour cette raison précise : déployer à chaque redémarrage gaspille de la limite
de débit et rend les retours en arrière confus.

## Le framework

### En quoi est-ce différent d'un dépôt modèle ?

Un modèle est un instantané que vous copiez puis maintenez pour toujours. Ici,
c'est une dépendance que vous mettez à jour. Le routage, la comparaison au
déploiement, le calcul des intents, la barrière d'erreurs, l'injection de
dépendances et la CLI sont maintenus en amont au lieu d'être copiés-collés dans
votre projet.

### Est-ce que cela m'enferme ?

Toutes les portes de sortie restent ouvertes : `ctx.interaction` et `ctx.client`
sont du discord.js brut, les définitions sont de simples objets, les services
sont à vous, et vous pouvez toujours redescendre à `client.on(...)` via un
`defineEvent`. Il n'y a pas de runtime propriétaire à démonter.

### Est-il prêt pour la production ?

C'est la version 1.0.0, stable au sens de semver, avec une API publique typée, un
catalogue d'erreurs et une suite de tests. La version 1.x ne cassera pas votre
code.

### Où signaler un bug ou demander une fonctionnalité ?

[Issues](https://github.com/ix-xs/djs-bot/issues) pour les bugs,
[Discussions](https://github.com/ix-xs/djs-bot/discussions) pour les questions et
les idées. Indiquez le code d'erreur et la sortie de `npx djs-bot explain`.
