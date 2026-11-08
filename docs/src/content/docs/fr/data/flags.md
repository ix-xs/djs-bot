---
title: "Feature flags"
description: "Activez et désactivez une fonctionnalité ou une commande pendant que le bot tourne, pour tout le monde ou pour un seul serveur, sans redéploiement. Les bascules sont gardées dans un store, elles survivent donc aux redémarrages."
sidebar:
  order: 4
---

Un feature flag est un interrupteur nommé. Vous déclarez son état par défaut,
vous protégez une commande avec une garde, puis vous le basculez plus tard
depuis une commande d'administration. Utilisez les flags pour une fonctionnalité
bêta activée dans quelques serveurs, ou pour couper ce qui dysfonctionne sans
arrêter le bot.

## Un premier flag

Déclarez les valeurs par défaut dans `defineBot`. Les surcharges sont
enregistrées automatiquement dans le [store](/data/store/) du bot : inutile de
le passer deux fois.

```ts title="src/index.ts"
import { defineBot, env, sqliteStore } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./features",
  store: sqliteStore("data/bot.sqlite"),
  flags: { defaults: { economy: true, beta: false } },
});
```

Protégez ensuite une commande avec la garde `featureEnabled` :

```ts title="features/economy/shop.command.ts"
import { defineCommand, featureEnabled } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "shop",
  description: "Open the shop",
  guards: [featureEnabled("economy")],
  run: (ctx) => ctx.reply.info("The shop is open."),
});
```

Dans un serveur où `economy` est désactivé, l'utilisateur est informé que la
fonctionnalité y est désactivée et le gestionnaire ne s'exécute pas. Partout
ailleurs la commande fonctionne normalement. La garde marche aussi sur les
boutons, les menus de sélection et les modales.

Configurer `flags` enregistre le service `flags` (`ctx.services.flags`) et
donne à la garde quelque chose à lire.

:::caution[Sans store, les bascules sont perdues]
Si ni `store` ni `flags.store` n'est défini, les surcharges sont gardées en
mémoire et disparaissent au prochain redémarrage. Les valeurs par défaut
s'appliquent toujours.
:::

## Comment un flag est résolu

`isEnabled(name, { guildId })` renvoie la première valeur trouvée, dans cet
ordre :

1. la surcharge du serveur, définie par `enable` ou `disable` avec un `guildId`
2. la surcharge globale, définie par `enable` ou `disable` sans portée
3. la valeur par défaut déclarée, venant de `defaults` ou de `setDefault`
4. `false`

Un flag inconnu est donc désactivé, une valeur par défaut peut être surchargée
pour tout le monde, et n'importe quel serveur peut la surcharger à son tour. En
message privé il n'y a pas de serveur, c'est donc la valeur globale qui
s'applique.

Les flags se résolvent par serveur, puis globalement, et rien d'autre. Le type
`FlagScope` a un champ `userId`, mais il est réservé : la résolution l'ignore,
donc un flag ne peut pas être activé pour un seul utilisateur.

## Basculer à l'exécution

Le service `flags` modifie les surcharges pendant que le bot tourne. Il est déjà
typé, aucun cast n'est nécessaire.

```ts
const flags = ctx.services.flags;

await flags.disable("economy", { guildId: ctx.guildId! });   // désactivé dans ce serveur
await flags.enable("beta");                                  // activé globalement
await flags.clear("economy", { guildId: ctx.guildId! });     // retour à la valeur globale
const effective = await flags.list(ctx.guildId!);            // { economy: true, beta: true }
```

Un gestionnaire de flags complet, réservé aux propriétaires du bot :

```ts title="features/admin/flags.command.ts"
import { defineCommand, ownerOnly, s, subcommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "flags",
  description: "Manage feature flags",
  guards: [ownerOnly()],
  subcommands: {
    list: subcommand({
      description: "Show the effective flags here",
      run: async (ctx) => {
        const all = await ctx.services.flags.list(ctx.guildId ?? undefined);
        const body = Object.entries(all)
          .map(([name, on]) => `\`${name}\`: ${on ? "on" : "off"}`)
          .join("\n");
        return ctx.reply.info(body || "No flags declared.");
      },
    }),

    set: subcommand({
      description: "Toggle a flag in this server",
      options: {
        name: s.string({ description: "Flag name", required: true }),
        enabled: s.boolean({ description: "On or off", required: true }),
      },
      run: async (ctx) => {
        const { name, enabled } = ctx.options;
        const scope = { guildId: ctx.guildId ?? undefined };
        await (enabled ? ctx.services.flags.enable(name, scope) : ctx.services.flags.disable(name, scope));
        await ctx.audit("flag.set", { metadata: { name, enabled } });
        return ctx.reply.success(`\`${name}\` is now ${enabled ? "enabled" : "disabled"} here.`);
      },
    }),

    reset: subcommand({
      description: "Remove this server's override",
      options: { name: s.string({ description: "Flag name", required: true }) },
      run: async (ctx) => {
        await ctx.services.flags.clear(ctx.options.name, { guildId: ctx.guildId ?? undefined });
        return ctx.reply.success(`\`${ctx.options.name}\` now follows the global setting.`);
      },
    }),
  },
});
```

`ownerOnly()` lit les propriétaires dans `defineBot({ owners })`, et
`ctx.audit` ne fait rien tant que le [journal d'audit](/data/audit/) n'est pas
configuré. Utilisées en message privé, `set` et `reset` n'ont pas de serveur et
modifient donc la surcharge globale.

## Vérifier dans un gestionnaire

Le service est disponible partout où `ctx.services` l'est, donc un flag peut
protéger une branche et pas seulement une commande entière :

```ts
run: async (ctx) => {
  if (await ctx.services.flags.isEnabled("newEmbedStyle", { guildId: ctx.guildId })) {
    return ctx.reply({ embeds: [newStyle()] });
  }
  return ctx.reply({ embeds: [oldStyle()] });
}
```

`isEnabled` accepte un identifiant de serveur `null`, donc `ctx.guildId` peut
être passé tel quel. `enable`, `disable` et `clear` veulent une chaîne ou rien.

Lire `ctx.services.flags` quand `flags` n'est pas configuré lève
[`DJSBOT_E031`](/api/errors/#djsbot_e031). La garde `featureEnabled` est plus
indulgente : sans `flags`, elle laisse passer. Oublier de configurer les flags
ne désactive rien, cela retire seulement l'interrupteur.

## Des flags sans bot

`createFeatureFlags` est une fonction autonome. Elle est pratique dans les tests,
ou quand vous ne voulez pas du service sur le bot :

```ts title="tests/flags.test.ts"
import { createFeatureFlags, memoryStore } from "@ix-xs/djs-bot";

const flags = createFeatureFlags({ store: memoryStore(), defaults: { economy: true } });
await flags.disable("economy", { guildId: "123" });

await flags.isEnabled("economy", { guildId: "123" });   // false
await flags.isEnabled("economy", { guildId: "456" });   // true
await flags.isEnabled("unknown");                       // false
```

## Flag ou mode maintenance

| Besoin | À utiliser |
| --- | --- |
| Désactiver une fonctionnalité, éventuellement dans un seul serveur | Un feature flag |
| Désactiver tout le bot pendant une migration | Le plugin `maintenance`, voir [Plugins et hooks](/architecture/plugins/) |

Le plugin bloque toutes les interactions, sauf pour une liste d'utilisateurs
autorisés. Son option `enabled` accepte un booléen ou une fonction synchrone,
elle ne peut donc pas attendre un flag directement : gardez une simple variable
qu'une commande d'administration bascule, comme dans
`maintenance({ enabled: () => downForMigration })`.

## Référence

Chaque option, propriété et type, avec ce qu'il accepte et renvoie, est dans la référence de l'API :

- `FeatureFlagsOptions` : Options de `createFeatureFlags`.
- `defineBot()` : Crée un `Bot`.
- `createFeatureFlags()` : Crée un service `FeatureFlags`.
- `KVStore` : Un store clé-valeur asynchrone.
- `featureEnabled()` : Une garde qui bloque une commande/un composant lorsqu'un feature flag est désactivé pour le serveur.
- `FeatureFlags` : Un service de drapeaux de fonctionnalité à l'exécution.
- `FlagScope` : Une portée pour lire ou écrire un drapeau.

## Voir aussi

- [Gardes](/commands/guards/) : les autres gardes, et comment les combiner.
- [Store](/data/store/) : là où les surcharges sont conservées.
- [Plugins et hooks](/architecture/plugins/) : le plugin `maintenance`.
- [Journal d'audit](/data/audit/) : enregistrer qui a basculé quoi.
