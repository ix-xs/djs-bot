---
title: "Référence FR - Introduction"
description: "Référence complète, en français, de @ix-xs/djs-bot : chaque fonction, chaque option, chaque méthode."
sidebar:
  label: "Introduction"
  order: 0
---

Bienvenue dans la **référence complète en français** de `@ix-xs/djs-bot`. Chaque
page documente une partie de l'API : toutes les fonctions, **toutes leurs
options**, tous les objets de contexte et toutes les méthodes, avec ce à quoi
chaque élément sert.

> La [Guide](/djs-bot/guide/basics/install-project-layout/) (en anglais) est un
> parcours pas à pas. Cette référence-ci est exhaustive et sert à retrouver
> rapidement « quelle option fait quoi ».

## Installation

```bash
npm install @ix-xs/djs-bot discord.js
# pour exécuter du TypeScript brut en dev (recommandé) :
npm install -D tsx typescript
```

Nécessite **Node 22 ou plus récent** (une dépendance utilise le module intégré
`node:sqlite`). `discord.js` est une **peer dependency** (`^14.16.0`) : tu
l'installes toi-même, `djs-bot` ne le masque jamais.

## Comment lire cette référence

- **`ctx`** désigne l'objet de contexte reçu par chaque handler (commande,
  bouton, événement…). Voir [Contexte & réponses](/djs-bot/reference-fr/contexte/).
- Une option notée `?` est **optionnelle**. `required: true` sur une option de
  commande rend la valeur **non optionnelle** dans `ctx.options`.
- Les durées acceptent un nombre de millisecondes **ou** une chaîne comme
  `"30s"`, `"5m"`, `"1h"`, `"1d"`.
- Toutes les erreurs du framework portent un code stable `DJSBOT_Exxx`. Voir
  [Codes d'erreur](/djs-bot/reference-fr/erreurs/).

## Plan de la référence

| Page | Contenu |
| --- | --- |
| [Configuration](/djs-bot/reference-fr/configuration/) | `defineBot` et **tous** les champs de configuration |
| [Définitions](/djs-bot/reference-fr/definitions/) | `defineCommand`, `defineEvent`, `defineButton`, `defineJob`, `defineFeature`… |
| [Options & schémas](/djs-bot/reference-fr/options-schemas/) | `s.*` (options), `p.*` (params customId), `field.*` (modals) |
| [Contexte & réponses](/djs-bot/reference-fr/contexte/) | `ctx`, `ctx.reply`, `ctx.update`, `ctx.audit`, `ctx.t`… |
| [Guards](/djs-bot/reference-fr/guards/) | `inGuild`, `hasPermission`, `cooldown`, `rateLimit`, `featureEnabled`… |
| [Composants UI](/djs-bot/reference-fr/composants-ui/) | `ui.*` (rows, boutons liens, Components V2) |
| [Formatage & médias](/djs-bot/reference-fr/formatage/) | `mention`, `emoji`, `timestamp`, `allowedMentions`, `assets`, `voice` |
| [Données & état](/djs-bot/reference-fr/donnees/) | `KVStore`, cache, i18n, feature flags, audit |
| [Production](/djs-bot/reference-fr/production/) | Déploiement, résilience, health, sharding, présence |
| [Codes d'erreur](/djs-bot/reference-fr/erreurs/) | Tous les `DJSBOT_Exxx` |
| [CLI](/djs-bot/reference-fr/cli/) | `dev`, `deploy`, `explain`, `doctor`, `generate`… |
| [Tests](/djs-bot/reference-fr/tests/) | Le harness `@ix-xs/djs-bot/testing` |
