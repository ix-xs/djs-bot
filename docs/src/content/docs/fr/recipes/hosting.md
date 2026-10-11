---
title: "Héberger en production"
description: "systemd, pm2, Docker et un pipeline de déploiement, avec contrôles de santé et arrêt propre."
sidebar:
  order: 5
---

Votre bot doit tourner 24 h/24 et 7 j/7, redémarrer après un plantage, redémarrer après
un redémarrage de la machine, et déployer ses commandes depuis la CI plutôt qu'à chaque
démarrage. Voici chaque option, complète.

## Avant de déployer

```bash
npx djs-bot doctor          # token, intents, contrats, noms en double
npx djs-bot deploy --dry-run
```

Une liste de contrôle pour la production :

- [ ] `NODE_ENV=production` (active les journaux JSON et désactive `autoDeploy`)
- [ ] Les secrets dans l'environnement, jamais dans git
- [ ] Un chemin de store durable en dehors du dossier de déploiement
- [ ] `health` activé et surveillé
- [ ] Les intents privilégiés activés dans le Developer Portal
- [ ] Les commandes déployées depuis la CI à chaque release

## Scripts du projet

```json title="package.json"
{
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "djs-bot dev",
    "build": "tsc",
    "start": "node dist/index.js",
    "deploy": "djs-bot deploy",
    "doctor": "djs-bot doctor"
  }
}
```

Compiler avec `tsc` et lancer Node tout simplement est la configuration de production la
plus légère. Lancer `djs-bot start` avec `tsx` fonctionne aussi si vous préférez ne pas
compiler.

## Option 1 : systemd sur un VPS

Le plus simple qui soit réellement robuste. Aucun environnement d'exécution en plus, aucun
démon à apprendre.

```ini title="/etc/systemd/system/mybot.service"
[Unit]
Description=My Discord bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=bot
WorkingDirectory=/srv/mybot
EnvironmentFile=/srv/mybot/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30

# Durcissement
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/srv/mybot/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mybot
sudo journalctl -u mybot -f
```

`KillSignal=SIGTERM` associé à `TimeoutStopSec=30` est ce qui laisse au framework le temps
de vider les tâches en cours, d'exécuter chaque hook `onShutdown` et de se déconnecter
proprement.

## Option 2 : pm2

Pratique quand vous faites tourner plusieurs applications Node sur une même machine.

```js title="ecosystem.config.cjs"
module.exports = {
  apps: [
    {
      name: "mybot",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      kill_timeout: 30000,
      env: { NODE_ENV: "production" },
    },
  ],
};
```

```bash
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
pm2 logs mybot
```

:::caution
Ne définissez **pas** `instances: "max"` et n'utilisez pas le mode cluster. Deux processus
sur un même token signifient que chaque commande s'exécute deux fois. Utilisez plutôt le
[sharding](/production/sharding/) quand un seul processus ne suffit plus.
:::

## Option 3 : Docker

```dockerfile title="Dockerfile"
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "dist/index.js"]
```

```yaml title="compose.yaml"
services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    stop_grace_period: 30s
    volumes:
      - ./data:/app/data          # garde le store SQLite en dehors de l'image
    ports:
      - "127.0.0.1:3000:3000"     # contrôle de santé, accessible uniquement depuis localhost
```

Le volume compte : sans lui, votre store vit dans le système de fichiers du conteneur et
disparaît au prochain déploiement.

## Arrêt propre

Le framework installe des gestionnaires de signaux : `SIGTERM` vide donc les tâches en cours,
démonte les plugins et ferme la passerelle (*gateway*). Ce que vous devez faire, c'est lui
laisser du temps : 30 secondes dans systemd, pm2 et Docker, comme montré plus haut. Un
`SIGKILL` au bout de 5 secondes interrompt le travail en cours.

Nettoyez vos propres ressources dans un plugin :

```ts
definePlugin({
  name: "db",
  setup(app) {
    app.hooks.onShutdown(async () => {
      await pool.end();
      app.logger.info("database pool closed");
    });
  },
});
```

## Déployer les commandes depuis la CI

Déployez à la **release**, pas au démarrage. Déployer à chaque redémarrage consomme de la
limite de débit et rend un retour en arrière ambigu.

```yaml title=".github/workflows/deploy.yml"
name: Deploy
on:
  release:
    types: [published]

jobs:
  commands:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx djs-bot doctor
      - run: npx djs-bot deploy
        env:
          DISCORD_TOKEN: ${{ secrets.DISCORD_TOKEN }}
          DISCORD_CLIENT_ID: ${{ secrets.DISCORD_CLIENT_ID }}
```

Et sur chaque pull request, montrez ce qu'une fusion changerait sans rien toucher :

```yaml
- run: npx djs-bot deploy --dry-run
```

## Surveillance

```ts
export default defineBot({
  health: { port: 3000, host: "127.0.0.1" },
});
```

| Point d'accès | À relier à |
| --- | --- |
| `/healthz` | Votre superviseur de processus, pour décider s'il faut redémarrer |
| `/readyz` | Votre moniteur de disponibilité, puisqu'il passe au rouge exactement quand Discord n'obtient plus de réponse |
| `/metrics` | Votre tableau de bord |

Liez-le à localhost et passez par votre reverse proxy si vous en avez besoin de
l'extérieur : `/metrics` expose le nombre de serveurs et des éléments internes.

## Journaux

En production, le logger émet un objet JSON par ligne, ce que comprend n'importe quel
pipeline de journaux :

```json
{"level":"info","time":"2026-01-01T12:00:00.000Z","msg":"interaction handled","correlationId":"8f3a"}
```

- systemd : `journalctl -u mybot -f`, puis expédiez avec `vector` ou `promtail`
- Docker : `docker compose logs -f`, ou un pilote de journalisation
- N'importe où : envoyez la sortie standard vers votre collecteur

Toutes les lignes issues d'une même interaction partagent un `correlationId` : filtrez
dessus pour suivre une requête de bout en bout.

## Sauvegardes

Si vous utilisez `sqliteStore`, sauvegardez le fichier :

```bash
sqlite3 /srv/mybot/data/bot.sqlite ".backup '/srv/backups/bot-$(date +%F).sqlite'"
```

`.backup` est sûr sur une base en service ; copier le fichier pendant que le bot écrit
ne l'est pas.

## Mettre à jour

```bash
git pull
npm ci
npm run build
npx djs-bot doctor
sudo systemctl restart mybot     # ou : docker compose up -d --build
```

Ne déployez les commandes que lorsqu'elles ont réellement changé. `npx djs-bot deploy --dry-run`
vous le dit en une ligne.
