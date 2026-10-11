# Examples

| Folder | What it is | Run |
| --- | --- | --- |
| [`minimal/`](./minimal) | A small bot in TypeScript | `npx djs-bot dev examples/minimal/bot.ts` |
| [`javascript/`](./javascript) | The same in plain CommonJS | `node examples/javascript/bot.js` |
| [`production/`](./production) | The full stack wired together: sharding, store, audit, flags, i18n | reference |
| [`playground/`](./playground) | A bot that exercises every feature and checks itself as you click | `npm run playground` |

## The playground

Fill `.env` with `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and `DISCORD_DEV_GUILD`,
then:

```bash
npm run live         # automated: deploy diff, gateway, message payloads, against the real API
npm run playground   # interactive: run /selftest panel in your test server
```

`npm run live` needs no clicking. It temporarily replaces the commands of the
test server and restores them, and, when `DISCORD_TEST_CHANNEL` is set, sends
and deletes one message per kind of payload.

In the playground every step verifies what it received (the shape of each modal
field, the typed params, the automatic deferral) and answers with a checklist.

> Inside this repo the examples import the framework from a relative source path
> so they run without publishing. In **your** project, import it by name:
> `import { defineBot } from "@ix-xs/djs-bot"` (or `require(...)` in JS).

## Using it in your own project

```bash
npm install @ix-xs/djs-bot discord.js
# optional, only to run raw .ts in dev:
npm install -D tsx typescript
```

Create a `.env` with `DISCORD_TOKEN` (and `DISCORD_DEV_GUILD` for instant dev
deploys), then:

```bash
npx djs-bot dev        # watch + instant guild deploy
npx djs-bot explain    # see everything that's loaded
npx djs-bot doctor     # diagnose config, intents, permissions
```

### TypeScript

```ts
import { defineBot, defineCommand, s, env } from "@ix-xs/djs-bot";

export default defineBot({ token: env("DISCORD_TOKEN"), features: "./src/features" })
  .use(defineCommand({
    name: "ping",
    description: "Ping",
    options: { user: s.user({ required: true }) },   // ctx.options.user is a User (non-optional)
    run: (ctx) => ctx.reply.success(`Hi ${ctx.options.user}`),
  }));
```

Everything is fully typed - `ctx.options`, `ctx.params`, `ctx.fields`,
`ctx.services`. `required: true` makes an option non-optional.

### JavaScript (CommonJS)

```js
const { defineBot, defineCommand, env } = require("@ix-xs/djs-bot");

const bot = defineBot({ token: env("DISCORD_TOKEN"), features: `${__dirname}/features` });
bot.use(defineCommand({ name: "ping", description: "Ping", run: (ctx) => ctx.reply.success("Pong!") }));
module.exports = bot;
if (!process.env.DJSBOT_CLI) bot.start();
```

The package ships `.d.ts` declarations, so JS editors still give you full
autocomplete and inline docs - no TypeScript required.

See the [documentation](https://ix-xs.github.io/djs-bot/) for the complete guide.
