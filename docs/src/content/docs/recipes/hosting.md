---
title: "Hosting in production"
description: "systemd, pm2, Docker and a deploy pipeline, with health checks and graceful shutdown."
sidebar:
  order: 5
---

Your bot needs to run 24/7, restart on crash, restart on reboot, and deploy its
commands from CI rather than on every boot. Here is each option, complete.

## Before you deploy

```bash
npx djs-bot doctor          # token, intents, contracts, duplicate names
npx djs-bot deploy --dry-run
```

A production checklist:

- [ ] `NODE_ENV=production` (turns on JSON logs and turns off `autoDeploy`)
- [ ] Secrets in the environment, never in git
- [ ] A durable store path outside the deploy directory
- [ ] `health` enabled and monitored
- [ ] Privileged intents enabled in the Developer Portal
- [ ] Commands deployed from CI on release

## Project scripts

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

Compiling with `tsc` and running plain Node is the leanest production setup.
Running `djs-bot start` with `tsx` also works if you would rather not build.

## Option 1: systemd on a VPS

The simplest thing that is genuinely robust. No extra runtime, no daemon to
learn.

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

# Hardening
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

`KillSignal=SIGTERM` plus `TimeoutStopSec=30` is what gives the framework time
to drain jobs, run every `onShutdown` hook and disconnect cleanly.

## Option 2: pm2

Handy when you run several Node apps on one box.

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
Do **not** set `instances: "max"` or cluster mode. Two processes on one token
means every command runs twice. Use [sharding](/djs-bot/guide/ops/sharding-scaling/)
instead when you outgrow one process.
:::

## Option 3: Docker

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
      - ./data:/app/data          # keep the SQLite store outside the image
    ports:
      - "127.0.0.1:3000:3000"     # health, bound to localhost only
```

The volume matters: without it your store lives inside the container filesystem
and disappears on the next deploy.

## Graceful shutdown

The framework installs signal handlers, so `SIGTERM` drains running jobs, tears
down plugins and closes the gateway. What you must do is give it time: 30
seconds in systemd, pm2 and Docker as shown above. A `SIGKILL` after 5 seconds
truncates in-flight work.

Clean up your own resources in a plugin:

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

## Deploying commands from CI

Deploy on **release**, not on boot. Deploying on every restart burns rate limit
and makes a rollback ambiguous.

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

And on every pull request, show what a merge would change without touching
anything:

```yaml
- run: npx djs-bot deploy --dry-run
```

## Monitoring

```ts
export default defineBot({
  health: { port: 3000, host: "127.0.0.1" },
});
```

| Endpoint | Point it at |
| --- | --- |
| `/healthz` | Your process supervisor, to decide whether to restart |
| `/readyz` | Your uptime monitor, since it turns red exactly when Discord is not being answered |
| `/metrics` | Your dashboard |

Bind it to localhost and reach it through your reverse proxy if you need it
externally: `/metrics` exposes guild counts and internals.

## Logs

In production the logger emits one JSON object per line, which every log
pipeline understands:

```json
{"level":"info","time":"2026-01-01T12:00:00.000Z","msg":"interaction handled","correlationId":"8f3a"}
```

- systemd: `journalctl -u mybot -f`, then ship with `vector` or `promtail`
- Docker: `docker compose logs -f`, or a logging driver
- Anywhere: pipe stdout into your collector

Every line from one interaction shares a `correlationId`, so filter by it to see
a single request end to end.

## Backups

If you use `sqliteStore`, back the file up:

```bash
sqlite3 /srv/mybot/data/bot.sqlite ".backup '/srv/backups/bot-$(date +%F).sqlite'"
```

`.backup` is safe on a live database; copying the file while the bot is writing
is not.

## Updating

```bash
git pull
npm ci
npm run build
npx djs-bot doctor
sudo systemctl restart mybot     # or: docker compose up -d --build
```

Deploy commands only when they actually changed. `npx djs-bot deploy --dry-run`
tells you in one line whether they did.
