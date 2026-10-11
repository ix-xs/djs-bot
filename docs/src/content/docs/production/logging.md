---
title: "Logging"
description: "The built-in structured logger: readable coloured lines while you develop, one JSON object per line in production, and a correlation id on every line so one interaction can be followed from start to finish."
sidebar:
  order: 5
---

Every handler receives a logger as `ctx.logger`. It is already tagged with a
correlation id that is unique to the interaction, trigger or job being handled,
so you can find every line written for one request without passing anything
around yourself. The framework writes its own lines (startup, errors, shutdown)
through the same logger.

## A first log line

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

In development this prints one readable line. The correlation id and the user
id were added for you:

```
14:22:07 INFO  ban requested correlationId=k3Fz-1a userId=111111111111111111 target=222222222222222222
```

A log call takes structured fields first, then a message. Fields are what make
logs searchable later, so prefer `{ userId }` plus a fixed message over a
message with the id pasted into it.

```ts
logger.info("started");                       // a message alone
logger.info({ userId, guildId }, "member joined"); // fields, then a message
logger.error(err);                            // an Error alone, stored under "err"
logger.error(err, "payment failed");          // an Error and a message
logger.error({ err, userId }, "payment failed"); // an Error among other fields
```

When the first argument is a string it is the message, and a second argument is
ignored. A first argument that is neither a string, an `Error` nor an object is
ignored.

## Choosing a level

Set the minimum level in `defineBot`. Lines below it are dropped before any
formatting work is done.

```ts title="src/index.ts"
import { defineBot, env, type LogLevel } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  logger: { level: (env.optional("LOG_LEVEL") ?? "info") as LogLevel },
});
```

Reading the level from the environment lets you turn on `debug` on a running
host by changing a variable and restarting, without touching the code. The
default is `"info"`.

| Level | Use it for |
| --- | --- |
| `debug` | Payload dumps, cache hits, anything you would delete later. Hidden by default. |
| `info` | Business events: a command ran, a member joined, a job finished. |
| `warn` | Problems the bot recovered from: a retry, a rate limit, a missing optional setting. |
| `error` | Something failed and a user noticed. |
| `silent` | Nothing is written. Meant for tests. |

The framework's own lines follow the same setting. At `info` you see `Ready`
when the bot connects and the shutdown messages; at `debug` you also see
details such as the duration of each job run.

## Logging errors

An `Error` does not survive `JSON.stringify`: it becomes `{}`, which is how
stack traces disappear from production logs. The logger converts every `Error`
it finds, whether passed alone or as the value of a field, into a plain object
with `name`, `message` and `stack`, plus any own property the error carries.
For a `BotError` that adds `code`, `hint`, `docs` and, when set, `meta`.

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

:::tip[Name the field err]
`err` is the name the logger uses when you pass an `Error` alone, and the one
most log processors expect. Using it everywhere keeps your queries simple.
:::

You do not have to catch an error only to log it. When a handler throws, the
error boundary logs `Interaction handler failed` with the error at `error`
level through the same `ctx.logger`, then answers the user. Failed jobs,
triggers and events are logged the same way. See [Errors](/api/errors/).

## Correlation ids

Each interaction, trigger run and job run gets a short id such as `k3Fz-1a`: a
random tag chosen when the process starts, then a counter. It is exposed as
`ctx.correlationId` and already bound to `ctx.logger`. Filter your logs on one
id and you have everything written for that request, including lines from
plugins, since they log through the same `ctx.logger`.

What each logger carries on every line:

| Logger | Bound fields |
| --- | --- |
| `ctx.logger` in a command, context menu, button, select menu or modal | `correlationId`, `userId` |
| `ctx.logger` in an autocomplete handler | `correlationId`, `autocomplete` (the option name) |
| `ctx.logger` in a message trigger | `trigger`, `correlationId` |
| `ctx.logger` in a scheduled job | `job`, `correlationId` |
| `ctx.logger` in an event | `event` |
| `app.logger` in a plugin's `setup` | `plugin` |
| `bot.logger` | nothing: this is the root logger |

Events have no correlation id because one gateway event is not a request with a
beginning and an end.

To get one summary line per interaction, with its duration, add the
`commandLogger` plugin from `@ix-xs/djs-bot/plugins`, described in
[Plugins and hooks](/architecture/plugins/):

```
14:22:07 INFO  interaction handled correlationId=k3Fz-1a userId=111111111111111111 kind=command name=ban guildId=333333333333333333 ms=143
```

## Child loggers

`child()` returns a new logger that adds fields to every line. Use it in a
service so its lines are identifiable without repeating the context each time.

```ts title="features/tickets/tickets.service.ts"
import { defineService, createLogger, type Logger } from "@ix-xs/djs-bot";

export class TicketService {
  private readonly log: Logger;

  public constructor(logger: Logger) {
    this.log = logger.child({ service: "tickets" });
  }

  public open(userId: string): void {
    this.log.info({ userId }, "ticket opened"); // service=tickets is always present
  }
}

export default defineService("tickets", {
  factory: () => new TicketService(createLogger()),
});
```

Bindings add up: `ctx.logger.child({ step: "validate" })` keeps the correlation
id and adds the step. A child inherits the level and the output format of its
parent. When names collide, the child's field replaces the parent's, and a
field passed in a log call replaces a bound one.

`createLogger` builds a logger outside of any handler, for a service like the
one above, a script or a worker process:

```ts
import { createLogger } from "@ix-xs/djs-bot";

const logger = createLogger({ level: "debug", bindings: { app: "worker" } });
logger.info("started");
```

:::note[A standalone logger has its own settings]
`createLogger()` does not read the `logger` option of `defineBot`. It starts
from the defaults (`"info"`, pretty outside production) unless you pass options.
To log with the bot's settings, use `ctx.logger`, or `bot.logger` where you hold
the bot instance.
:::

## Output formats

With `pretty: true` each line is the local time, the level in colour, the
message, then the fields as `key=value`. Object values are printed as JSON.

```
14:22:07 INFO  member joined userId=123 guildId=456
14:22:08 WARN  rate limited userId=123
14:22:09 ERROR command failed correlationId=k3Fz-1b err={"name":"TypeError","message":"..."}
```

With `pretty: false` each line is one JSON object, ready for any log pipeline:

```json
{"level":"info","time":"2026-01-01T12:00:00.000Z","msg":"member joined","userId":"123"}
```

`level`, `time` (ISO 8601, UTC) and `msg` come first, then the bound fields,
then the fields of the call.

`pretty` defaults to `true` unless `NODE_ENV` is `production`, so a deployed bot
switches to JSON on its own. Set it explicitly to override that. Pretty lines
always contain colour codes: if you redirect development output to a file, use
`pretty: false`.

The two formats do not use the same streams:

| Format | `debug`, `info` | `warn`, `error` |
| --- | --- | --- |
| Pretty | stdout | stderr |
| JSON | stdout | stdout |

:::caution[Keep fields serialisable]
In JSON output, do not name a field `level`, `time` or `msg`: it would overwrite
the record's own. Avoid values `JSON.stringify` cannot handle, such as a
circular structure or a `bigint`: in JSON output the log call throws, and in
pretty output the fields are replaced by `[unserialisable]`. Log an id rather
than a whole discord.js object.
:::

The logger writes to the process streams and nowhere else. To send logs to a
file or a service, capture the output of the process, which is what hosting
platforms and process managers already do.

## Reference

### `defineBot({ logger })`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `level` | `LogLevel` | `"info"` | The least severe level that is written. |
| `pretty` | `boolean` | `true` unless `NODE_ENV=production` | Coloured, readable lines instead of JSON. |

### `createLogger(options?)`

```ts
createLogger(options?: LoggerOptions): Logger
```

Creates a root logger. `new Logger(options)` does the same thing.

### `LoggerOptions`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `level` | `LogLevel` | `"info"` | The least severe level that is written. |
| `pretty` | `boolean` | `true` unless `NODE_ENV=production` | Force pretty (`true`) or JSON (`false`) output. |
| `bindings` | `Record<string, unknown>` | `{}` | Fields merged into every line. |

### `Logger`

| Method | Description |
| --- | --- |
| `debug(obj, msg?)` | Verbose detail. Hidden at the default level. |
| `info(obj, msg?)` | Normal operation. |
| `warn(obj, msg?)` | Something suspicious that the bot survived. |
| `error(obj, msg?)` | A failure. |
| `child(bindings)` | A new logger that also includes `bindings` on every line. |

`obj` is a message string, an `Error`, or an object of fields. `msg` is an
optional message string. The level and format of a logger cannot be changed
after it is created.

### `LogLevel`

```ts
type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
```

Ordered from the most to the least verbose. A logger writes its own level and
everything after it; `silent` writes nothing.

## See also

- [The ctx object](/basics/context/) for `ctx.logger` and `ctx.correlationId`.
- [Errors](/api/errors/) for the error boundary and `BotError`.
- [Plugins and hooks](/architecture/plugins/) for `commandLogger` and `errorReporter`.
- [Health and metrics](/production/health/) for counters and uptime rather than lines of text.
- [Testing](/production/testing/) for the harness, whose contexts log at `silent`.
