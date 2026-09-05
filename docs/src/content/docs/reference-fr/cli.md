---
title: "CLI - djs-bot"
description: "Toutes les commandes du CLI et leurs options."
sidebar:
  label: "CLI"
  order: 11
---

```bash
npx djs-bot <commande> [entrée] [options]
```

L'**entrée** est ton fichier `defineBot` (détecté automatiquement, ex.
`src/index.ts`). Tu peux la passer explicitement.

## Commandes

| Commande | Rôle |
| --- | --- |
| `djs-bot dev [entrée]` | Démarre en **watch**, avec déploiement instantané sur le serveur de dev. |
| `djs-bot start [entrée]` | Démarre en mode **production** (`NODE_ENV=production`). |
| `djs-bot deploy [entrée]` | Compare et déploie les commandes (ajoute/met à jour/**retire**). |
| `djs-bot clear [entrée]` | Supprime **toutes** les commandes d'un scope. |
| `djs-bot doctor [entrée]` | Diagnostique jeton, intents privilégiés, permissions. |
| `djs-bot explain [entrée]` | Affiche tout ce qui est chargé **et** le plan de déploiement. |
| `djs-bot generate <type> <nom>` | Génère un fichier squelette. |
| `djs-bot init` | Crée un starter minimal. |
| `djs-bot help` / `djs-bot version` | Aide / version. |

## Options

| Option | S'applique à | Rôle |
| --- | --- | --- |
| `--dry-run` | `deploy`, `clear` | Affiche ce qui changerait **sans rien pousser**. |
| `--guild <id>` | `deploy` | Force **toutes** les commandes sur ce serveur (test rapide). |
| `--guild <id>` | `clear` | Vide les commandes de ce serveur. |
| `--global` | `clear` | Vide les commandes **globales**. |

```bash
npx djs-bot deploy --dry-run          # prévisualiser chaque cible
npx djs-bot deploy                    # global → global, ciblées → leurs serveurs
npx djs-bot deploy --guild 123…       # tout sur un seul serveur
npx djs-bot clear --guild 123…        # nettoyer le miroir de dev
npx djs-bot clear --global            # repartir de zéro en global
```

## `generate` - types disponibles

```bash
npx djs-bot generate command warn        # → features/warn/warn.command.ts
npx djs-bot generate trigger welcome     # → features/welcome/welcome.trigger.ts
npx djs-bot generate user "User info"    # → menu contextuel utilisateur
```

Types : `command`, `user`, `message`, `event`, `trigger`, `button`, `modal`,
`select`, `service`, `job`, `feature`.

## Modes d'exécution

- **`dev` / `start`** exécutent ton fichier d'entrée dans un processus enfant. Si
  `tsx` est installé, il est utilisé automatiquement : le TypeScript brut
  fonctionne sans build.
- **`deploy` / `clear` / `doctor` / `explain`** importent ton entrée en mode
  **introspection** (`DJSBOT_CLI=introspect`) : ils **ne se connectent jamais** à
  la passerelle. C'est pourquoi ton entrée doit garder le motif :

```ts
export default bot;
if (!process.env.DJSBOT_CLI) void bot.start();
```

## Lire la sortie de `deploy`

```
✓ global
  + help              (ajoutée)
  ~ ban               (modifiée)
  - vieille-commande  (retirée)
✓ guild 111…
  ~ announce
```

Un avertissement apparaît si ton serveur de dev contient encore le miroir des
commandes et que tu déploies en global (risque de **doublons**), avec la commande
exacte pour nettoyer.

## `explain` - comprendre ce qui est chargé

Affiche les intents (et lesquels sont privilégiés), les partials, toutes les
commandes/composants/événements/triggers/jobs/services/plugins/features, **et** le
plan de déploiement (ce qui part en global, ce qui part par serveur). C'est
l'outil de référence quand quelque chose ne se comporte pas comme prévu - sans
jamais toucher Discord.
