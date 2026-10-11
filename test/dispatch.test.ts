import { describe, it, expect, vi, afterEach } from "vitest";
import {
  defineBot,
  defineButton,
  defineCommand,
  defineEvent,
  defineModal,
  definePlugin,
  defineService,
  field,
  guard,
  fail,
  pass,
  s,
  subcommand,
  type Bot,
  type BotConfig,
  type DeferOption,
} from "../src/index.js";
import { fakeInteraction, methods, type FakeOptions } from "./fakes.js";

/** Builds a loaded bot with a stub client, ready to route fake interactions. */
async function boot(config: BotConfig): Promise<Bot> {
  const bot = defineBot({ logger: { level: "silent" }, ...config });
  await bot.load();
  (bot as unknown as { _client: unknown })._client = { ws: { ping: 1 } };
  return bot;
}

const send = async (bot: Bot, options: FakeOptions) => {
  const interaction = fakeInteraction(options);
  await (bot as unknown as { handleInteraction(i: unknown): Promise<void> }).handleInteraction(interaction);
  return interaction;
};

const textOf = (call: { payload?: unknown } | undefined): string | undefined => {
  const payload = call?.payload as { content?: string; embeds?: Array<{ data: { description?: string } }> } | undefined;
  return payload?.content ?? payload?.embeds?.[0]?.data.description;
};

describe("routing", () => {
  it("runs the handler with typed options and counts it", async () => {
    const echo = defineCommand({
      name: "echo",
      description: "Echo",
      options: { text: s.string({ required: true }) },
      run: (ctx) => ctx.reply(ctx.options.text),
    });
    const bot = await boot({ features: [echo] });
    const i = await send(bot, { commandName: "echo", strings: { text: "hi" } });

    expect(textOf(i.calls[0])).toBe("hi");
    expect(bot.stats()).toMatchObject({ interactions: 1, commands: 1, errors: 0, guardRejections: 0 });
  });

  it("routes subcommands, running the parent guards first", async () => {
    const order: string[] = [];
    const mark = (name: string) =>
      guard(name, () => {
        order.push(name);
        return pass();
      });
    const config = defineCommand({
      name: "config",
      description: "Config",
      guards: [mark("parent")],
      subcommands: {
        set: subcommand({
          description: "Set",
          guards: [mark("child")],
          run: (ctx) => {
            order.push("run");
            return ctx.reply("ok");
          },
        }),
      },
    });
    const bot = await boot({ features: [config] });
    await send(bot, { commandName: "config", subcommand: "set" });
    expect(order).toEqual(["parent", "child", "run"]);
  });

  it("leaves unregistered components alone, for collectors", async () => {
    const bot = await boot({});
    const i = await send(bot, { kind: "button", customId: "someone-elses-button" });
    expect(methods(i)).toEqual([]);
  });

  it("passes a button's decoded params and the update helper", async () => {
    const close = defineButton({
      id: "ticket:close",
      run: (ctx) => ctx.update({ content: "closed" }),
    });
    const bot = await boot({ features: [close] });
    const i = await send(bot, { kind: "button", customId: "ticket:close" });
    expect(methods(i)).toEqual(["update"]);
    expect(bot.stats().components).toBe(1);
  });

  it("opens a modal from a command through ctx.showModal", async () => {
    const form = defineModal({
      id: "form",
      title: "Form",
      fields: { name: field.short({ label: "Name" }) },
      run: (ctx) => ctx.reply(ctx.fields.name),
    });
    const open = defineCommand({ name: "open", description: "Open", run: (ctx) => ctx.showModal(form) });
    const bot = await boot({ features: [open, form] });

    const opened = await send(bot, { commandName: "open" });
    expect(methods(opened)).toEqual(["showModal"]);

    const submitted = await send(bot, {
      kind: "modal",
      customId: "form",
      fields: { getTextInputValue: () => "Ada" },
    });
    expect(textOf(submitted.calls[0])).toBe("Ada");
    expect(bot.stats().modals).toBe(1);
  });
});

describe("guards and messages", () => {
  const blocked = defineCommand({
    name: "blocked",
    description: "Blocked",
    guards: [guard("never", () => fail("custom reason"))],
    run: (ctx) => ctx.reply("should not run"),
  });

  it("replies with the guard's reason, ephemerally, and never runs the handler", async () => {
    const bot = await boot({ features: [blocked] });
    const i = await send(bot, { commandName: "blocked" });
    expect(methods(i)).toEqual(["reply"]);
    expect(textOf(i.calls[0])).toBe("custom reason");
    expect(bot.stats().guardRejections).toBe(1);
  });

  it("uses the configured wording for built-in messages", async () => {
    const bot = await boot({
      messages: {
        unknownCommand: "Commande inconnue : {name}",
        error: (_vars, ctx) => `Oups (${ctx?.locale})`,
      },
      features: [
        defineCommand({
          name: "boom",
          description: "Boom",
          run: () => {
            throw new Error("kaboom");
          },
        }),
      ],
    });

    const unknown = await send(bot, { commandName: "nope" });
    expect(textOf(unknown.calls[0])).toBe("Commande inconnue : nope");

    const failed = await send(bot, { commandName: "boom", locale: "fr" });
    expect(textOf(failed.calls[0])).toBe("Oups (fr)");
    expect(bot.stats().errors).toBe(1);
  });

  it("applies the theme to semantic replies", async () => {
    const bot = await boot({
      theme: { success: 0x123456 },
      features: [defineCommand({ name: "ok", description: "Ok", run: (ctx) => ctx.reply.success("yes") })],
    });
    const i = await send(bot, { commandName: "ok" });
    const embed = (i.calls[0]!.payload as { embeds: Array<{ data: { color: number } }> }).embeds[0]!;
    expect(embed.data.color).toBe(0x123456);
  });
});

describe("middleware", () => {
  it("wraps the guards as well as the handler, and can stop before both", async () => {
    const order: string[] = [];
    let maintenance = false;
    const plugin = definePlugin({
      name: "order",
      setup(app) {
        app.hooks.beforeInteraction(async (ctx, next) => {
          order.push("before");
          if (maintenance) return void (await ctx.reply.error("down"));
          await next();
          order.push("after-next");
        });
        app.hooks.afterInteraction((_ctx, info) => {
          order.push(`hook:${typeof info.durationMs}`);
        });
      },
    });
    const command = defineCommand({
      name: "work",
      description: "Work",
      guards: [
        guard("g", () => {
          order.push("guard");
          return pass();
        }),
      ],
      run: (ctx) => {
        order.push("run");
        return ctx.reply("done");
      },
    });
    const bot = await boot({ features: [command], plugins: [plugin] });

    await send(bot, { commandName: "work" });
    expect(order).toEqual(["before", "guard", "run", "after-next", "hook:number"]);

    order.length = 0;
    maintenance = true;
    const i = await send(bot, { commandName: "work" });
    expect(order).toEqual(["before"]); // neither the guard nor the handler ran
    expect(textOf(i.calls[0])).toBe("down");
  });

  it("does not tell the user something broke when only an after hook failed", async () => {
    const plugin = definePlugin({
      name: "flaky-hook",
      setup: (app) =>
        app.hooks.afterInteraction(() => {
          throw new Error("metrics backend down");
        }),
    });
    const bot = await boot({
      plugins: [plugin],
      features: [defineCommand({ name: "ok", description: "Ok", run: (ctx) => ctx.reply("fine") })],
    });
    const i = await send(bot, { commandName: "ok" });
    expect(methods(i)).toEqual(["reply"]); // no follow-up error
    expect(bot.stats().errors).toBe(1); // but it was reported
  });

  it("gives plugins the real configuration", async () => {
    let seen: unknown;
    const plugin = definePlugin({ name: "peek", setup: (app) => void (seen = app.config.owners) });
    await boot({ owners: ["1"], plugins: [plugin] });
    expect(seen).toEqual(["1"]);
  });
});

describe("automatic deferral in the router", () => {
  afterEach(() => vi.useRealTimers());

  const slow = (defer?: DeferOption) =>
    defineCommand({
      name: "slow",
      description: "Slow",
      defer,
      run: async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await ctx.reply.success("done");
      },
    });

  it("defers a slow handler, then edits the reply", async () => {
    vi.useFakeTimers();
    const bot = await boot({ features: [slow(true)] });
    const pending = send(bot, { commandName: "slow" });
    await vi.advanceTimersByTimeAsync(3100);
    expect(methods(await pending)).toEqual(["deferReply", "editReply"]);
  });

  it("honours the bot-wide default, and a definition can opt out", async () => {
    vi.useFakeTimers();
    const withDefault = await boot({ defaults: { defer: "ephemeral" }, features: [slow()] });
    const a = send(withDefault, { commandName: "slow" });
    await vi.advanceTimersByTimeAsync(3100);
    expect(methods(await a)).toEqual(["deferReply", "editReply"]);

    const optedOut = await boot({ defaults: { defer: true }, features: [slow(false)] });
    const b = send(optedOut, { commandName: "slow" });
    await vi.advanceTimersByTimeAsync(3100);
    expect(methods(await b)).toEqual(["reply"]);
  });

  it("does not defer a fast handler", async () => {
    const bot = await boot({
      defaults: { defer: true },
      features: [defineCommand({ name: "fast", description: "Fast", run: (ctx) => ctx.reply("now") })],
    });
    expect(methods(await send(bot, { commandName: "fast" }))).toEqual(["reply"]);
  });
});

describe("errors outside interactions", () => {
  it("reports an event listener failure to onError and the error hooks", async () => {
    const seen: string[] = [];
    const plugin = definePlugin({
      name: "errors",
      setup: (app) => app.hooks.onError((error) => void seen.push(`hook:${(error as Error).message}`)),
    });
    const bot = await boot({
      plugins: [plugin],
      onError: (error) => void seen.push(`config:${(error as Error).message}`),
      features: [
        defineEvent("guildCreate", () => {
          throw new Error("sync boom");
        }),
      ],
    });

    const listeners = new Map<string, (...args: unknown[]) => void>();
    const client = { on: (event: string, fn: (...args: unknown[]) => void) => void listeners.set(event, fn) };
    (bot as unknown as { attachEvents(c: unknown): void }).attachEvents(client);
    listeners.get("guildCreate")!({});
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(seen.sort()).toEqual(["config:sync boom", "hook:sync boom"]);
    expect(bot.stats().errors).toBe(1);
  });
});

describe("shutdown", () => {
  it("disposes services in reverse order and closes the store", async () => {
    const order: string[] = [];
    const db = defineService("db", { factory: () => ({}), dispose: () => void order.push("db") });
    const repo = defineService("repo", {
      deps: ["db"],
      factory: () => ({}),
      dispose: () => void order.push("repo"),
    });
    let closed = 0;
    const { memoryStore } = await import("../src/index.js");
    const store = memoryStore();
    const close = store.close.bind(store);
    store.close = async () => {
      closed++;
      await close();
    };

    const bot = defineBot({ logger: { level: "silent" }, features: [repo, db], store });
    await bot.load();
    await bot.shutdown();
    await bot.shutdown(); // idempotent

    expect(order).toEqual(["repo", "db"]);
    expect(closed).toBe(1);
  });
});
