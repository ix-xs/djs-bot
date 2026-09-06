---
title: "Logger"
description: "Levels, pretty vs JSON output, child bindings, correlation ids and logging errors correctly."
sidebar:
  order: 13
---

A small structured logger: colourful and readable in development, single-line
JSON in production. Every interaction and job gets a **child logger carrying a
correlation id**, so one request can be traced end to end without any plumbing.

```ts title="src/index.ts"
export default defineBot({
  logger: { level: "info" },
});
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `level` | `"debug" \| "info" \| "warn" \| "error" \| "silent"` | `"info"` | Minimum level emitted. |
| `pretty` | `boolean` | `true` unless `NODE_ENV=production` | Force pretty or JSON output. |

## Logging from a handler

```ts
run: async (ctx) => {
  ctx.logger.info({ target: ctx.options.user.id }, "ban requested");
  ...
}
```

`ctx.logger` is already bound to `ctx.correlationId`, so every line from this
interaction shares it:

```
14:22:07 INFO  ban requested correlationId=8f3a2b target=1234567890
14:22:07 INFO  interaction handled correlationId=8f3a2b ms=143
```

Grep one id and you have the whole story of one interaction — including lines
written by plugins.

## The API

| Method | Signature | Description |
| --- | --- | --- |
| `logger.debug(obj, msg?)` | | Verbose detail, off by default. |
| `logger.info(obj, msg?)` | | Normal operation. |
| `logger.warn(obj, msg?)` | | Something suspicious but survivable. Written to stderr. |
| `logger.error(obj, msg?)` | | A failure. Written to stderr. |
| `logger.child(bindings)` | `Record<string, unknown>` | A new logger that always includes these fields. |

Both arguments are flexible:

```ts
logger.info("just a message");
logger.info({ userId, guildId }, "member joined");
logger.error(err);                       // an Error alone
logger.error({ err, userId }, "failed"); // an Error among fields
```

## Logging errors

`Error` objects do **not** JSON-serialise — `JSON.stringify(err)` gives `{}`,
which is how stack traces vanish from production logs. The logger normalises any
`Error` it finds, at the top level or in a field, into `name`, `message`,
`stack`, plus a `BotError` `code`, `hint` and `docs`:

```ts
try {
  await risky();
} catch (err) {
  ctx.logger.error({ err, userId: ctx.user.id }, "risky() failed");
}
```

```json
{"level":"error","time":"2026-01-01T12:00:00.000Z","msg":"risky() failed",
 "correlationId":"8f3a2b","userId":"123",
 "err":{"name":"BotError","message":"customId too long","stack":"…",
        "code":"DJSBOT_E020","hint":"Shorten params…"}}
```

:::tip
Use the field name `err` — it is the convention this logger, pino and most log
processors expect.
:::

## Child loggers

`child()` returns a logger that always includes the given fields — ideal in a
service, so its lines are identifiable without repeating context:

```ts
export class TicketService {
  private readonly log: Logger;
  constructor(logger: Logger) {
    this.log = logger.child({ service: "tickets" });
  }
  open(userId: string) {
    this.log.info({ userId }, "ticket opened");   // service=tickets always present
  }
}
```

Bindings compose, so `ctx.logger.child({ step: "validate" })` keeps the
correlation id and adds the step.

## Output formats

**Development** (`pretty: true`) — timestamp, coloured level, message, then
fields:

```
14:22:07 INFO  member joined userId=123 guildId=456
14:22:08 WARN  rate limited userId=123
14:22:09 ERROR command failed correlationId=8f3a err={"name":"TypeError",…}
```

**Production** (`NODE_ENV=production`) — one JSON object per line, ready for any
log pipeline:

```json
{"level":"info","time":"2026-01-01T12:00:00.000Z","msg":"member joined","userId":"123"}
```

`info` and `debug` go to **stdout**; `warn` and `error` go to **stderr**.

## Standalone

```ts
import { createLogger } from "@ix-xs/djs-bot";

const logger = createLogger({ level: "debug", bindings: { app: "worker" } });
logger.info("started");
```

| Option | Type | Description |
| --- | --- | --- |
| `level` | `LogLevel` | Minimum level. |
| `pretty` | `boolean` | Force a format. |
| `bindings` | `Record<string, unknown>` | Fields merged into every record. |

`new Logger(options)` is equivalent — `createLogger` just reads better.

## Choosing a level

| Level | Use for |
| --- | --- |
| `debug` | Payload dumps, cache hits, anything you would delete later. Off in production. |
| `info` | Business events: a command ran, a member joined, a job finished. |
| `warn` | Recovered problems: a retry, a rate limit, a missing optional config. |
| `error` | Something failed and a user noticed. |
| `silent` | Tests. |

Set it from the environment so you can raise verbosity without a redeploy:

```ts
logger: { level: (env.optional("LOG_LEVEL") ?? "info") as LogLevel },
```
