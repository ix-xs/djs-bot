---
title: "Tests - le harness"
description: "Tester tes handlers sans jeton et sans réseau."
sidebar:
  label: "Tests"
  order: 12
---

Le harness invoque tes handlers **sans jeton et sans réseau**, et capture toutes
les réponses. Import depuis le sous-chemin `@ix-xs/djs-bot/testing`.

```ts
import { createHarness } from "@ix-xs/djs-bot/testing";
import Profil from "../src/features/profil/profil.command.js";

const h = createHarness();

test("répond", async () => {
  const { replies } = await h.command(Profil, { options: { target: {} } });
  expect(replies[0].type).toBe("info");
});
```

## Méthodes

| Méthode | Invoque |
| --- | --- |
| `h.command(def, input?)` | Une commande slash. `input.options` correspond au schéma. |
| `h.button(def, input?)` | Un bouton. `input.params` correspond aux `params`. |
| `h.select(def, input?)` | Un menu de sélection. `input.values` / params. |
| `h.modal(def, input?)` | Une modale. `input.fields` correspond aux `fields`. |

`createHarness(bot?)` accepte optionnellement un `Bot` pour réutiliser **ses
services** réels.

## Options d'entrée

| Option | Défaut | Rôle |
| --- | --- | --- |
| `userId` | `"test-user"` | Id de l'utilisateur appelant. |
| `guildId` | aucun (contexte DM) | Simule un serveur. Fournit aussi un `member`. |
| `services` | ceux du bot, sinon `{}` | Injecte des services factices. |
| `locale` | `"en"` | Valeur de `ctx.locale`. |
| `owners` | `[]` | Valeur de `ctx.owners` (pour tester `ownerOnly()`). |
| `runGuards` | `true` | Exécute (ou non) les guards avant le handler. |
| `options` / `params` / `values` / `fields` | - | Les entrées typées du handler. |

## Résultat

| Champ | Rôle |
| --- | --- |
| `replies` | Toutes les réponses capturées, dans l'ordre. |
| `passedGuards` | `false` si un guard a bloqué l'exécution. |
| `rejectionReason` | La raison renvoyée par le guard qui a échoué. |

Chaque entrée de `replies` a une **forme** : `type` (`"reply"`, `"success"`,
`"error"`, `"info"`, `"defer"`, `"followUp"`, `"editReply"`, `"update"`,
`"update:disable"`) et un `content`.

## Exemples

```ts
test("un guard bloque hors serveur", async () => {
  const { passedGuards, rejectionReason } = await h.command(CommandeServeurUniquement);
  expect(passedGuards).toBe(false);
  expect(rejectionReason).toMatch(/serveur|server/i);
});

test("les params du bouton sont décodés", async () => {
  const { replies } = await h.button(CloseTicket, {
    userId: "quelqu-un-dautre",
    params: { ticketId: "t1", ownerId: "proprietaire" },
  });
  expect(replies[0].type).toBe("error"); // pas son ticket
});

test("ownerOnly respecte les owners", async () => {
  const ok = await h.command(CommandeAdmin, { userId: "42", owners: ["42"] });
  expect(ok.passedGuards).toBe(true);
});
```

## Ce que le harness ne fait pas

Il ne simule **pas** l'API Discord : `ctx.interaction` n'est pas une vraie
interaction. Il est conçu pour tester **ta logique** - branches, guards, réponses,
appels aux services. Pour la logique métier pure (calculs, dépôts, migrations),
teste directement tes modules, sans harness.
