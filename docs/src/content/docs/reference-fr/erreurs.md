---
title: "Codes d'erreur"
description: "Tous les codes DJSBOT_Exxx, quand ils surviennent et comment les corriger."
sidebar:
  label: "Codes d'erreur"
  order: 10
---

Chaque erreur du framework porte un **code stable**, un **conseil actionnable** et
un lien vers la documentation. C'est l'inverse d'un `throw new Error("oops")`
anonyme : tu peux les grepper dans tes logs et les traiter par code.

```ts
import { BotError, isBotError } from "@ix-xs/djs-bot";

try { /* … */ } catch (e) {
  if (isBotError(e)) console.error(e.code, e.hint, e.docs);
}
```

## Propriétés d'une `BotError`

| Propriété | Rôle |
| --- | --- |
| `code` | Le code stable, ex. `"DJSBOT_E012"`. |
| `message` | Titre du catalogue + détail contextuel. |
| `hint` | Suggestion concrète de correction. |
| `docs` | Lien profond vers la documentation du code. |
| `meta` | Métadonnées structurées éventuelles (ex. la chaîne d'un cycle de dépendances). |
| `cause` | L'erreur sous-jacente, si elle existe. |
| `toString()` | Rendu multi-ligne lisible par un développeur. |

## Catalogue complet

### Démarrage & identifiants

| Code | Signification | Quand / correction |
| --- | --- | --- |
| `DJSBOT_E001` | Jeton du bot manquant | Au démarrage, aucun `token` en config **ni** `DISCORD_TOKEN` en environnement. |
| `DJSBOT_E002` | Client id manquant | Au déploiement, aucun `clientId` **ni** `DISCORD_CLIENT_ID`. Requis pour publier les commandes. |

### Définitions & enregistrement

| Code | Signification | Quand / correction |
| --- | --- | --- |
| `DJSBOT_E010` | Nom de commande en double | Deux commandes portent le même nom. Les noms doivent être uniques. |
| `DJSBOT_E011` | Id de composant en double | Deux composants du **même type** partagent un `id`. |
| `DJSBOT_E012` | Nom de commande/option invalide | Un nom de commande, sous-commande, groupe ou option ne respecte pas Discord : **minuscules**, 1-32 caractères, lettres/chiffres/`-`/`_`, **sans espace**. Détecté à la définition, pas au déploiement. |
| `DJSBOT_E013` | Id de composant invalide | Id vide, trop long, ou contenant `$` (réservé comme séparateur de customId). Utilise `:` ou `-` pour préfixer. |

### customId

| Code | Signification | Quand / correction |
| --- | --- | --- |
| `DJSBOT_E020` | customId trop long | Le customId encodé dépasse la limite de **100 caractères** de Discord. Stocke l'état volumineux ailleurs et ne garde qu'une clé courte. |
| `DJSBOT_E021` | Charge utile de customId invalide | Le payload n'a pas pu être décodé (souvent produit par une version incompatible). |

### Services & contrats

| Code | Signification | Quand / correction |
| --- | --- | --- |
| `DJSBOT_E030` | Échec de résolution de service | Une dépendance manque ou forme un **cycle**. Vérifie les tableaux `deps`. `meta.chain` donne la chaîne. |
| `DJSBOT_E031` | Service inconnu | Accès à un service jamais enregistré (via `ctx.services.x` ou `deps`). |
| `DJSBOT_E040` | Contrat de feature/plugin non satisfait | Un `requires` n'est fourni par personne. Vérifié **au boot**, avant la connexion. Les services de configuration (`store`, `audit`, `flags`) comptent comme fournis. |
| `DJSBOT_E041` | Conflit de capacité | Deux plugins déclarent des capacités incompatibles (`conflicts`). |

### Exécution

| Code | Signification | Quand / correction |
| --- | --- | --- |
| `DJSBOT_E050` | Valeur d'option invalide | Une option a échoué la validation à la frontière Discord. |
| `DJSBOT_E060` | Erreur du loader | Un fichier découvert n'a pas pu être importé, ou n'exporte **aucun** résultat de `define*()`. Vérifie que le fichier exporte bien une définition. |
| `DJSBOT_E070` | Intent privilégié requis | Un événement nécessite un intent privilégié (`GuildMembers`, `MessageContent`, `GuildPresences`). Active-le dans le **Developer Portal**. |

## Comportement de la frontière d'erreur

- **Chaque interaction est encapsulée.** Un handler qui lève est journalisé (avec
  son `correlationId`) et l'utilisateur reçoit un message - jamais
  « This application did not respond ».
- Le processus **reste en vie** après une erreur d'interaction.
- Personnalise via `onError` (configuration) ou `app.hooks.onError` (plugin).
  Renvoyer une valeur depuis `onError` marque l'erreur comme **traitée** et
  supprime le message par défaut.

```ts
onError: (err, ctx) => {
  logger.error({ err }, "erreur d'interaction");
  return ctx?.reply.error("Un souci est survenu, on est dessus.");
},
```
