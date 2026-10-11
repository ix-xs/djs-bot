/**
 * End-to-end dispatch benchmark: one interaction through the real router.
 *
 *   npx tsx benchmarks/dispatch.ts
 *
 * Unlike the "routing hot path" suite in `run.ts`, which times the pieces in
 * isolation, this drives `Bot.handleInteraction` itself: context creation, the
 * reply helpers, option resolution, middleware, guards, the handler and the
 * bookkeeping around them. The interaction is a stub whose Discord calls resolve
 * immediately, built once per task and reused (its calls never flip the
 * replied/deferred flags), so the number is the framework's own overhead per
 * interaction and nothing else.
 */
import { Bench } from "tinybench";
import {
  defineBot,
  defineButton,
  defineCommand,
  definePlugin,
  inGuild,
  cooldown,
  p,
  s,
  subcommand,
  type Bot,
} from "../src/index.js";

const TIME = 600; // ms per task

type Kind = "command" | "button";

/** A stub interaction: every Discord call is a resolved promise. */
function stub(kind: Kind, extra: Record<string, unknown> = {}) {
  const done = Promise.resolve();
  const interaction = {
    replied: false,
    deferred: false,
    locale: "en",
    user: { id: "1" },
    guild: null,
    guildId: "2",
    channel: null,
    channelId: "3",
    member: null,
    memberPermissions: null,
    appPermissions: null,
    commandName: "ping",
    customId: "",
    values: [] as string[],
    options: {
      getSubcommand: () => null as string | null,
      getSubcommandGroup: () => null as string | null,
      getString: () => "hello",
      getInteger: () => 3,
      getUser: () => null,
    },
    isChatInputCommand: () => kind === "command",
    isAutocomplete: () => false,
    isUserContextMenuCommand: () => false,
    isMessageContextMenuCommand: () => false,
    isButton: () => kind === "button",
    isAnySelectMenu: () => false,
    isModalSubmit: () => false,
    isMessageComponent: () => kind === "button",
    inCachedGuild: () => false,
    reply: () => done,
    deferReply: () => done,
    editReply: () => done,
    followUp: () => done,
    update: () => done,
    deferUpdate: () => done,
    ...extra,
  };
  return interaction;
}

async function boot(config: Parameters<typeof defineBot>[0]): Promise<(interaction: unknown) => Promise<void>> {
  const bot: Bot = defineBot({ logger: { level: "silent" }, ...config });
  await bot.load();
  (bot as unknown as { _client: unknown })._client = { ws: { ping: 1 } };
  const route = (bot as unknown as { handleInteraction(i: unknown): Promise<void> }).handleInteraction.bind(bot);
  return route;
}

async function main(): Promise<void> {
  const ping = defineCommand({ name: "ping", description: "Ping", run: (ctx) => ctx.reply("pong") });
  const echo = defineCommand({
    name: "echo",
    description: "Echo",
    options: { text: s.string({ required: true }), times: s.integer() },
    guards: [inGuild(), cooldown(0)],
    run: (ctx) => ctx.reply(ctx.options.text),
  });
  const config = defineCommand({
    name: "config",
    description: "Config",
    subcommands: { set: subcommand({ description: "Set", options: { key: s.string() }, run: (ctx) => ctx.reply("ok") }) },
  });
  const close = defineButton({
    id: "ticket:close",
    params: { ticketId: p.string, ownerId: p.string },
    run: (ctx) => ctx.update("closed"),
  });
  const buttonId = close.build({ ticketId: "123456789012345678", ownerId: "876543210987654321" }).toJSON() as {
    custom_id: string;
  };

  const plain = await boot({ features: [ping, echo, config, close] });
  const timing = definePlugin({
    name: "timing",
    setup(app) {
      app.hooks.beforeInteraction(async (_ctx, next) => {
        await next();
      });
      app.hooks.afterInteraction(() => undefined);
    },
  });
  const withPlugins = await boot({ features: [ping, echo], plugins: [timing, timing], defaults: { defer: true } });

  const pingStub = stub("command");
  const echoStub = stub("command", { commandName: "echo" });
  const subStub = stub("command", {
    commandName: "config",
    options: { getSubcommand: () => "set", getSubcommandGroup: () => null, getString: () => "k" },
  });
  const buttonStub = stub("button", { customId: buttonId.custom_id });

  const bench = new Bench({ time: TIME });
  bench
    .add("command, no options", () => plain(pingStub))
    .add("command, 2 options + 2 guards", () => plain(echoStub))
    .add("subcommand", () => plain(subStub))
    .add("button, 2 params", () => plain(buttonStub))
    .add("command + 2 middlewares + auto-defer", () => withPlugins(echoStub));

  await bench.run();
  console.log(`\ndispatch, end to end (framework overhead per interaction) - Node ${process.version}`);
  console.table(
    bench.tasks.map((t) => ({
      task: t.name,
      "ops/sec": Math.round(t.result?.hz ?? 0).toLocaleString("en-US"),
      "avg (µs)": ((t.result?.mean ?? 0) * 1000).toFixed(2),
      "p99 (µs)": ((t.result?.p99 ?? 0) * 1000).toFixed(2),
    })),
  );
}

void main();
