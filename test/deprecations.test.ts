/**
 * The names kept until 2.0: each still works, and warns once per process with
 * its own code. The names that replace them never warn, and neither does the
 * code `djs-bot generate` and `djs-bot init` write.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ShardingManager } from "discord.js";
import nc from "@ix-xs/node-comfort";
import {
  createAuditLog,
  defineBot,
  defineSelectMenu,
  defineStringSelect,
  emoji,
  launchShardManager,
  memoryAuditSink,
  normalizeSharding,
  oneOf,
  p,
  env,
  loadEnvFile,
  retry,
  timeout,
  createCache,
  TTLCache,
  createRateLimiter,
  RateLimiter,
  rateLimit,
  createCircuitBreaker,
  CircuitBreaker,
  CircuitOpenError,
  defineCommand,
  type MiddlewareFn,
  type PluginApp,
  type AuditLog,
  type Bot,
} from "../src/index.js";
import { resetDeprecations } from "../src/deprecate.js";
import { createLogger } from "../src/logger.js";
import { shardingOptions } from "../src/sharding.js";
import { createHarness } from "../src/testing.js";
import { antiSpam } from "../src/plugins/index.js";

let emitWarning: MockInstance<typeof process.emitWarning>;

/** The codes of the deprecation warnings emitted since the test started. */
const codes = (): string[] =>
  emitWarning.mock.calls
    .map(([, options]) => options)
    .filter((options): options is { type?: string; code?: string } => typeof options === "object" && options !== null)
    .filter((options) => options.type === "DeprecationWarning")
    .map((options) => options.code ?? "");

beforeEach(() => {
  resetDeprecations();
  emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => undefined);
});
afterEach(() => {
  emitWarning.mockRestore();
  resetDeprecations();
});

describe("deprecated names", () => {
  it("oneOf() works as p.oneOf() and warns once", () => {
    const codec = oneOf("approve", "reject");
    oneOf("a", "b");
    expect(codec.decode("reject")).toBe("reject");
    expect(codec.decode("tampered")).toBe("approve");
    expect(codes()).toEqual(["DJS_BOT_DEP_ONEOF"]);
    expect(String(emitWarning.mock.calls[0]![0])).toBe("oneOf() is deprecated: use p.oneOf(). It will be removed in 2.0.");
  });

  it("audit `sink` is used as the first of the sinks, and warns once", async () => {
    const single = memoryAuditSink();
    const other = memoryAuditSink();
    const audit = createAuditLog({ sink: single, sinks: [other] });
    createAuditLog({ sink: memoryAuditSink() });
    await audit.record("member.ban", { actorId: "mod" });
    expect((await single.query!()).map((e) => e.action)).toEqual(["member.ban"]);
    expect((await other.query!()).map((e) => e.action)).toEqual(["member.ban"]);
    expect(codes()).toEqual(["DJS_BOT_DEP_AUDIT_SINK"]);
  });

  it("audit `sink` in the bot config still receives the entries, and warns once", async () => {
    const sink = memoryAuditSink();
    const bot = defineBot({ logger: { level: "silent" }, audit: { sink } });
    await bot.load();
    const audit = (await bot.container.resolve("audit")) as AuditLog;
    await audit.record("command:ping", { actorId: "u1" });
    expect((await sink.query!()).map((e) => e.action)).toEqual(["command:ping"]);
    expect(codes()).toEqual(["DJS_BOT_DEP_AUDIT_SINK"]);
  });

  it("emoji.custom() gives the markup of emoji.format() and warns once", () => {
    expect(emoji.custom("blob", "123")).toBe("<:blob:123>");
    expect(emoji.custom("blob", "123", true)).toBe("<a:blob:123>");
    expect(emoji.custom("wave", "9", false)).toBe(emoji.format({ name: "wave", id: "9", animated: false }));
    expect(codes()).toEqual(["DJS_BOT_DEP_EMOJI_CUSTOM"]);
  });

  it("defineSelectMenu() defines the same menu as defineStringSelect() and warns once", () => {
    const input = { id: "roles:pick", params: { page: p.number }, run: () => undefined };
    const old = defineSelectMenu(input);
    defineSelectMenu({ id: "other", run: () => undefined });
    const current = defineStringSelect(input);
    expect({ ...old, build: undefined }).toEqual({ ...current, build: undefined });
    const visual = { options: [{ label: "A", value: "a" }] };
    expect(old.build({ page: 2 }, visual).toJSON()).toEqual(current.build({ page: 2 }, visual).toJSON());
    expect(codes()).toEqual(["DJS_BOT_DEP_DEFINE_SELECT_MENU"]);
  });

  it("normalizeSharding() and launchShardManager() share one warning", async () => {
    expect(normalizeSharding({ totalShards: 2 })).toEqual(shardingOptions({ totalShards: 2 }));
    expect(normalizeSharding(true)).toEqual({ totalShards: "auto", mode: "process", respawn: true });
    const spawnShards = vi.spyOn(ShardingManager.prototype, "spawn").mockResolvedValue(new Map() as never);
    try {
      const manager = await launchShardManager(path.resolve("package.json"), "token", { totalShards: 1 }, createLogger({ level: "silent" }));
      expect(manager).toBeInstanceOf(ShardingManager);
    } finally {
      spawnShards.mockRestore();
    }
    expect(codes()).toEqual(["DJS_BOT_DEP_SHARDING_INTERNALS"]);
  });
});

describe("deprecated copies of node-comfort", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("env() and its helpers still read the environment, with one warning for all", () => {
    vi.stubEnv("DJSBOT_T_TEXT", "hello");
    vi.stubEnv("DJSBOT_T_EMPTY", "");
    vi.stubEnv("DJSBOT_T_NUM", "42");
    vi.stubEnv("DJSBOT_T_BOOL", "yes");
    vi.stubEnv("DJSBOT_T_LIST", " a, b ,,c ");
    expect(env("DJSBOT_T_TEXT")).toBe("hello");
    expect(env("DJSBOT_T_EMPTY", "fallback")).toBe("fallback");
    expect(() => env("DJSBOT_T_MISSING")).toThrow(/Missing required/);
    expect(env.optional("DJSBOT_T_EMPTY")).toBeUndefined();
    expect(env.number("DJSBOT_T_NUM")).toBe(42);
    expect(env.boolean("DJSBOT_T_BOOL")).toBe(true);
    expect(env.boolean("DJSBOT_T_MISSING")).toBe(false);
    expect(env.list("DJSBOT_T_LIST")).toEqual(["a", "b", "c"]);
    expect(env.list("DJSBOT_T_MISSING")).toEqual([]);
    expect(codes()).toEqual(["DJS_BOT_DEP_ENV"]);
  });

  it("each env helper names itself when it is the first used", () => {
    vi.stubEnv("DJSBOT_T_NUM", "7");
    expect(env.number("DJSBOT_T_NUM")).toBe(7);
    expect(String(emitWarning.mock.calls[0]![0])).toBe(
      "env.number() is deprecated: use nc.env.number(name, { default }). It will be removed in 2.0.",
    );
  });

  it("node-comfort reads the same values without a warning", () => {
    vi.stubEnv("DJSBOT_T_NUM", "42");
    vi.stubEnv("DJSBOT_T_BOOL", "yes");
    vi.stubEnv("DJSBOT_T_LIST", " a, b ,,c ");
    vi.stubEnv("DJSBOT_T_EMPTY", "");
    expect(nc.env.number("DJSBOT_T_NUM")).toBe(42);
    expect(nc.env.boolean("DJSBOT_T_BOOL")).toBe(true);
    expect(nc.env.boolean("DJSBOT_T_MISSING", { default: false })).toBe(false);
    expect(nc.env.list("DJSBOT_T_LIST")).toEqual(["a", "b", "c"]);
    expect(nc.env.list("DJSBOT_T_MISSING", { default: [] })).toEqual([]);
    expect(nc.env.string("DJSBOT_T_EMPTY", { optional: true })).toBeUndefined();
    expect(() => nc.env.required("DJSBOT_T_MISSING")).toThrow(/DJSBOT_T_MISSING/);
    expect(codes()).toEqual([]);
  });

  it("loadEnvFile() still loads a file, and warns once", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "djsbot-load-env-"));
    try {
      writeFileSync(path.join(dir, ".env.local"), "DJSBOT_T_FROM_FILE=yes\n");
      vi.stubEnv("DJSBOT_T_FROM_FILE", undefined);
      loadEnvFile(path.join(dir, ".env.local"));
      loadEnvFile(path.join(dir, ".env.missing"));
      expect(process.env.DJSBOT_T_FROM_FILE).toBe("yes");
      expect(codes()).toEqual(["DJS_BOT_DEP_LOAD_ENV_FILE"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retry() and timeout() still work, with one warning for both", async () => {
    let calls = 0;
    const result = await retry(
      () => {
        calls++;
        if (calls < 2) throw new Error("again");
        return "done";
      },
      { delay: 0, jitter: 0 },
    );
    expect(result).toBe("done");
    await expect(timeout(new Promise(() => undefined), 5, "too slow")).rejects.toThrow("too slow");
    expect(codes()).toEqual(["DJS_BOT_DEP_RETRY_TIMEOUT"]);
  });

  it("nc.async.retry() and nc.async.timeout() do the same without a warning", async () => {
    let calls = 0;
    const result = await nc.async.retry(() => {
      calls++;
      if (calls < 2) throw new Error("again");
      return "done";
    });
    expect(result).toBe("done");
    await expect(nc.async.timeout(new Promise(() => undefined), 5, "too slow")).rejects.toThrow("too slow");
    expect(codes()).toEqual([]);
  });

  it("createCache() and TTLCache still cache, with one warning for both", async () => {
    const cache = createCache<string, number>({ ttl: "1m", max: 2 });
    new TTLCache<string, number>();
    let calls = 0;
    const fetcher = async () => ++calls;
    expect(await cache.getOrFetch("k", fetcher)).toBe(1);
    expect(await cache.getOrFetch("k", fetcher)).toBe(1);
    cache.set("a", 2, "1s");
    cache.set("b", 3);
    expect(cache.has("k")).toBe(false); // the oldest went when the cache was full
    expect(cache.get("a")).toBe(2);
    expect(codes()).toEqual(["DJS_BOT_DEP_CACHE"]);
    expect(String(emitWarning.mock.calls[0]![0])).toBe(
      'createCache() is deprecated: use nc.cache.create({ ttl: "5m", max: 1000, ...options }). It will be removed in 2.0.',
    );
  });

  it("nc.cache.create() does the same with the mapped names, without a warning", async () => {
    const opts: { ttl?: string; max?: number } = { ttl: "1m", max: 2 };
    const cache = nc.cache.create<string, number>({ ttl: "5m", max: 1000, ...opts });
    let calls = 0;
    const fetcher = async () => ++calls;
    expect(await cache.getOrSet("k", fetcher)).toBe(1);
    expect(await cache.getOrSet("k", fetcher)).toBe(1);
    cache.set("a", 2, { ttl: "1s" });
    cache.set("b", 3);
    expect(cache.has("k")).toBe(false);
    expect(cache.get("a")).toBe(2);
    expect(codes()).toEqual([]);
  });

  it("the bot reads DISCORD_DEV_GUILD itself, without a warning", async () => {
    vi.stubEnv("DISCORD_DEV_GUILD", "123456789012345678");
    const bot = defineBot({ logger: { level: "silent" } });
    await bot.load();
    expect(bot.devGuildId).toBe("123456789012345678");
    expect(codes()).toEqual([]);
  });
});

describe("deprecated rate limiter and circuit breaker", () => {
  it("createRateLimiter() and RateLimiter are node-comfort's Quota, with one warning for both", () => {
    const limiter = createRateLimiter({ limit: 2, window: "1m" });
    new RateLimiter({ limit: 1, window: 1000 });
    expect(limiter).toBeInstanceOf(RateLimiter);
    expect(limiter).toBeInstanceOf(nc.quota.Quota);
    expect(limiter.consume("k")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume("k")).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume("k")).toMatchObject({ allowed: false, remaining: 0 });
    expect(limiter.reset("k")).toBe(true);
    expect(limiter.size).toBe(0);
    expect(codes()).toEqual(["DJS_BOT_DEP_RATE_LIMITER"]);
    expect(String(emitWarning.mock.calls[0]![0])).toBe(
      "createRateLimiter() is deprecated: use nc.quota.create(). It will be removed in 2.0.",
    );
  });

  it("an invalid limit or window now throws", () => {
    expect(() => createRateLimiter({ limit: 2, window: "soon" })).toThrow();
    expect(() => createRateLimiter({ limit: Number.NaN, window: "1m" })).toThrow(TypeError);
  });

  it("createCircuitBreaker() and CircuitBreaker are node-comfort's Circuit, with one warning for all", async () => {
    const opened: string[] = [];
    const breaker = createCircuitBreaker({ failureThreshold: 1, resetTimeout: "1m", onOpen: () => opened.push(breaker.status) });
    new CircuitBreaker();
    expect(breaker).toBeInstanceOf(CircuitBreaker);
    expect(breaker).toBeInstanceOf(nc.circuit.Circuit);
    await expect(breaker.execute(() => Promise.reject(new Error("down")))).rejects.toThrow("down");
    // onOpen runs once the status has changed.
    expect(opened).toEqual(["open"]);
    const rejected = await breaker.execute(() => "never").catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(CircuitOpenError);
    expect(rejected).toBeInstanceOf(nc.errors.CircuitOpenError);
    expect(rejected).toMatchObject({ code: "ERR_CIRCUIT_OPEN", message: "The circuit is open: the call was rejected" });
    expect(codes()).toEqual(["DJS_BOT_DEP_CIRCUIT_BREAKER"]);
  });

  it("CircuitOpenError still catches the errors of a circuit, and warns only when built", async () => {
    const circuit = nc.circuit.create({ failureThreshold: 1 });
    await circuit.execute(() => Promise.reject(new Error("down"))).catch(() => undefined);
    const rejected = await circuit.execute(() => "never").catch((error: unknown) => error);
    expect(rejected instanceof CircuitOpenError).toBe(true);
    expect(new Error("other") instanceof CircuitOpenError).toBe(false);
    expect(codes()).toEqual([]);
    const built = new CircuitOpenError();
    expect(built).toBeInstanceOf(nc.errors.CircuitOpenError);
    expect(built.name).toBe("CircuitOpenError");
    expect(codes()).toEqual(["DJS_BOT_DEP_CIRCUIT_BREAKER"]);
  });

  it("the rateLimit() guard and the antiSpam plugin never warn", async () => {
    const harness = createHarness();
    const cmd = defineCommand({ name: "limited", description: "d", guards: [rateLimit({ limit: 1, window: "1m" })], run: () => undefined });
    expect((await harness.command(cmd, { userId: "a" })).passedGuards).toBe(true);
    const second = await harness.command(cmd, { userId: "a" });
    expect(second.rejectionReason).toBe("Rate limit reached. Try again in 60s.");
    expect((await harness.command(cmd, { userId: "b" })).passedGuards).toBe(true);
    expect(() => rateLimit({ limit: 1, window: "never" })).toThrow();

    const plugin = antiSpam({ max: 1, window: "1m" });
    const middlewares: MiddlewareFn[] = [];
    await plugin.setup({ hooks: { beforeInteraction: (fn: MiddlewareFn) => middlewares.push(fn) } } as unknown as PluginApp);
    const replies: string[] = [];
    const ctx = { user: { id: "u1" }, interaction: { type: 2 }, reply: { error: (m: string) => replies.push(m) } } as never;
    let ran = 0;
    await middlewares[0]!(ctx, async () => void ran++);
    await middlewares[0]!(ctx, async () => void ran++);
    expect(ran).toBe(1);
    expect(replies).toHaveLength(1);
    expect(codes()).toEqual([]);
  });

  it("nc.quota and nc.circuit never warn", async () => {
    nc.quota.create({ limit: 1, window: "1m" }).consume("k");
    await nc.circuit.create().execute(() => "ok");
    expect(codes()).toEqual([]);
  });
});

describe("the names that replace them", () => {
  it("never warn", async () => {
    p.oneOf("approve", "reject").decode("reject");
    const audit = createAuditLog({ sinks: [memoryAuditSink()] });
    await audit.record("member.ban", {});
    emoji.format({ name: "blob", id: "123", animated: true });
    defineStringSelect({ id: "roles:pick", run: () => undefined }).build(undefined, { options: [{ label: "A", value: "a" }] });
    shardingOptions("auto");
    const bot = defineBot({ logger: { level: "silent" }, audit: { sinks: [memoryAuditSink()] } });
    await bot.load();
    expect(codes()).toEqual([]);
  });
});

/* ------------------------------ CLI templates ----------------------------- */

/** Runs the CLI from the source, in `cwd`. */
function cli(cwd: string, ...args: string[]): Promise<{ code: number | null; out: string }> {
  const tsx = pathToFileURL(path.resolve("node_modules/tsx/dist/loader.mjs")).href;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", tsx, path.resolve("src/cli.ts"), ...args], { cwd });
    let out = "";
    child.stdout.on("data", (chunk) => (out += String(chunk)));
    child.stderr.on("data", (chunk) => (out += String(chunk)));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out }));
  });
}

/** Every `.ts` file under `dir`, declaration files left out. */
function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return name.endsWith(".ts") && !name.endsWith(".d.ts") ? [full] : [];
  });
}

const GENERATORS = ["command", "event", "trigger", "button", "modal", "select", "service", "job", "plugin", "feature", "user", "message"];

describe("the code the CLI writes", () => {
  it("uses no deprecated name", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "djsbot-templates-"));
    try {
      const init = await cli(dir, "init");
      expect(init.code, init.out).toBe(0);
      const results = await Promise.all(GENERATORS.map((type) => cli(dir, "generate", type, `my-${type}`)));
      for (const { code, out } of results) expect(code, out).toBe(0);

      // The starter no longer reads the environment itself: the bot does.
      const entry = readFileSync(path.join(dir, "src/index.ts"), "utf8");
      expect(entry).not.toMatch(/env/);
      expect(entry).not.toContain("token:");

      // Each file runs, with the framework imported from the source. The
      // entry starts the bot unless the CLI loads it.
      vi.stubEnv("DJSBOT_CLI", "1");
      const index = JSON.stringify(pathToFileURL(path.resolve("src/index.ts")).href);
      const files = tsFiles(dir);
      expect(files.length).toBe(GENERATORS.length + 2);
      for (const file of files) writeFileSync(file, readFileSync(file, "utf8").replaceAll('"@ix-xs/djs-bot"', index));
      for (const file of files) await import(/* @vite-ignore */ pathToFileURL(file).href);

      // The starter's bot loads its features, the generated ones included.
      const entryUrl = pathToFileURL(path.join(dir, "src/index.ts")).href;
      const { default: bot } = (await import(/* @vite-ignore */ entryUrl)) as { default: Bot };
      await bot.load();
      expect([...bot.registry.commands.keys()].sort()).toEqual(["my-command", "ping"]);
      expect(codes()).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
