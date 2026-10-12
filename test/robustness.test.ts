/**
 * What changed when the internals moved onto node-comfort 2.1: one test per
 * defect fixed and per behaviour gained. The shutdown has its own file, since
 * it ends the process (test/shutdown.test.ts).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  PermissionFlagsBits,
  createLogger,
  createStore,
  defineBot,
  defineCommand,
  defineJob,
  defineTrigger,
  hasPermission,
  isBotError,
  loadEnvFile,
  s,
  sqliteStore,
  timeout,
  retry,
  toAutocompleteChoices,
} from "../src/index.js";
import { renderMessage } from "../src/messages.js";
import { Scheduler } from "../src/scheduler.js";
import { createHarness } from "../src/testing.js";

afterEach(() => {
  vi.useRealTimers();
});

/** Captures what a stream is asked to write while `fn` runs. */
function capture(stream: NodeJS.WriteStream, fn: () => void): string {
  const lines: string[] = [];
  const original = stream.write.bind(stream);
  stream.write = ((chunk: string) => {
    lines.push(String(chunk));
    return true;
  }) as typeof stream.write;
  try {
    fn();
  } finally {
    stream.write = original;
  }
  return lines.join("");
}

describe("sqlite store", () => {
  it("writes many keys as one step: a batch that fails stores nothing", async () => {
    const store = sqliteStore<unknown>(":memory:");
    await store.set("kept", 1);
    // JSON cannot write a bigint, so the second key fails.
    await expect(store.setMany({ a: 1, b: 2n })).rejects.toThrow();
    expect(await store.keys()).toEqual(["kept"]);

    await store.setMany([
      ["a", 1],
      ["b", 2],
    ]);
    expect((await store.entries()).sort()).toEqual([
      ["a", 1],
      ["b", 2],
      ["kept", 1],
    ]);
  });

  it("reads the entries of one namespace, without the expired ones", async () => {
    vi.useFakeTimers();
    const store = sqliteStore<number>(":memory:");
    const guild = store.namespace("guild-1");
    await guild.set("stays", 1);
    await guild.set("goes", 2, "1s");
    await store.namespace("guild-2").set("other", 3);

    expect((await guild.entries()).sort()).toEqual([
      ["goes", 2],
      ["stays", 1],
    ]);
    vi.advanceTimersByTime(2_000);
    expect(await guild.entries()).toEqual([["stays", 1]]);
  });

  it("tells two namespaces apart when only the case of their names differs", async () => {
    const store = sqliteStore<number>(":memory:");
    const upper = store.namespace("Users");
    const lower = store.namespace("users");
    await upper.set("a", 1);
    await lower.set("b", 2);

    expect(await upper.keys()).toEqual(["a"]);
    expect(await lower.entries()).toEqual([["b", 2]]);
    await upper.clear();
    expect(await lower.keys()).toEqual(["b"]);
  });

  it("matches a namespace literally when its name holds pattern characters", async () => {
    const store = sqliteStore<number>(":memory:");
    for (const name of ["a*b", "a?b", "a[b]", "aXb"]) await store.namespace(name).set("k", 1);

    for (const name of ["a*b", "a?b", "a[b]"]) {
      expect(await store.namespace(name).keys()).toEqual(["k"]);
      expect(await store.namespace(name).entries()).toEqual([["k", 1]]);
    }
    await store.namespace("a*b").clear();
    expect(await store.namespace("aXb").keys()).toEqual(["k"]);
  });
});

describe("a store built on a backend of your own", () => {
  it("uses the backend's bulk paths when it has them", async () => {
    const calls: string[] = [];
    const data = new Map<string, unknown>();
    const store = createStore<number>({
      get: (key) => data.get(key),
      set: (key, value) => {
        calls.push("set");
        data.set(key, value);
      },
      delete: (key) => data.delete(key),
      keys: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
      setMany: (entries, ttlMs) => {
        calls.push(`setMany ${entries.length} ${ttlMs}`);
        for (const [key, value] of entries) data.set(key, value);
      },
      entries: (prefix) => {
        calls.push("entries");
        return [...data].filter(([key]) => key.startsWith(prefix));
      },
    });

    const scoped = store.namespace("n");
    await scoped.setMany({ a: 1, b: 2 }, "1m");
    expect(await scoped.entries()).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect([...data.keys()]).toEqual(["n:a", "n:b"]);
    expect(calls).toEqual(["setMany 2 60000", "entries"]);
  });
});

describe("a job on a long interval", () => {
  it("waits for its interval, even past the 24.8 days a timer can count", async () => {
    vi.useFakeTimers();
    let runs = 0;
    const job = defineJob({ name: "monthly", schedule: "30d", run: () => void runs++ });
    const logger = createLogger({ level: "silent" });
    const scheduler = new Scheduler([job], () => ({}) as never, logger);
    scheduler.start();

    await vi.advanceTimersByTimeAsync(29 * 86_400_000);
    expect(runs).toBe(0);
    await vi.advanceTimersByTimeAsync(86_400_000 + 1_000);
    expect(runs).toBe(1);
    vi.useRealTimers();
    await scheduler.stop(0);
  });
});

describe("framework messages", () => {
  it("leaves a placeholder alone when its name is one every object has", () => {
    expect(renderMessage({ guildOnly: "Use {constructor} or {toString}" }, "guildOnly", {})).toBe(
      "Use {constructor} or {toString}",
    );
  });

  it("spells out a permission whose name holds an acronym", async () => {
    const harness = createHarness();
    const cmd = defineCommand({
      name: "speak",
      description: "Speak",
      guards: [hasPermission(PermissionFlagsBits.SendTTSMessages)],
      run: () => undefined,
    });
    const denied = await harness.command(cmd, { guildId: "g", permissions: [] });
    expect(denied.rejectionReason).toBe("You need: Send TTS Messages.");
  });
});

describe("definitions", () => {
  it("reports a malformed choice with its code, even one JSON cannot write", () => {
    const define = (): unknown =>
      defineCommand({
        name: "x",
        description: "ok",
        options: { a: s.string({ choices: [{ label: 1n }] as never }) },
        run: () => undefined,
      });
    let thrown: unknown;
    try {
      define();
    } catch (error) {
      thrown = error;
    }
    expect(isBotError(thrown) && thrown.code).toBe("DJSBOT_E015");
    expect(String(thrown)).toContain("each choice must be { name, value }");
  });
});

describe("autocomplete suggestions", () => {
  it("never cuts an emoji in two when it shortens a name", () => {
    const { choices } = toAutocompleteChoices([{ name: `${"a".repeat(96)}😀😀😀`, value: "x" }]);
    const name = choices[0]!.name;
    expect(name.length).toBeLessThanOrEqual(100);
    expect(name.endsWith("...")).toBe(true);
    // No half of a pair is left at the cut: the text survives a round trip through UTF-8.
    expect(Buffer.from(name, "utf8").toString("utf8")).toBe(name);
  });
});

describe("logger", () => {
  it("writes a record that holds a bigint or a loop instead of throwing", () => {
    const loop: Record<string, unknown> = { name: "loop" };
    loop.self = loop;
    const out = capture(process.stdout, () => {
      createLogger({ pretty: false }).info({ permissions: 8n, loop }, "state");
    });
    const record = JSON.parse(out) as { msg: string; permissions: string; loop: { self: string } };
    expect(record.msg).toBe("state");
    expect(record.permissions).toBe("8");
    expect(record.loop.self).toBe("[Circular]");
  });

  it("keeps the cause of an error", () => {
    const out = capture(process.stdout, () => {
      createLogger({ pretty: false }).error({ err: new Error("outer", { cause: new Error("inner") }) }, "failed");
    });
    const record = JSON.parse(out) as { err: { message: string; cause: { message: string; stack: string } } };
    expect(record.err.message).toBe("outer");
    expect(record.err.cause.message).toBe("inner");
    expect(record.err.cause.stack).toContain("inner");
  });

  it("writes plain text, with a fixed-width time, when the output is not a terminal", () => {
    // A test runner's output is not a terminal; some CI systems force colours anyway.
    const forced = process.env.FORCE_COLOR;
    delete process.env.FORCE_COLOR;
    try {
      const out = capture(process.stdout, () => {
        createLogger({ pretty: true }).info({ guilds: 3, big: 1n }, "Ready");
      });
      expect(out).toMatch(/^\d{2}:\d{2}:\d{2} INFO {2}Ready guilds=3 big=1\n$/);
    } finally {
      if (forced !== undefined) process.env.FORCE_COLOR = forced;
    }
  });
});

describe("loadEnvFile", () => {
  const names = ["DJSBOT_TEST_FILE", "DJSBOT_TEST_REAL", "DJSBOT_TEST_QUOTED"];
  afterEach(() => {
    for (const name of names) delete process.env[name];
  });

  it("loads a file of your own, and never replaces what the environment defines", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "djsbot-env-"));
    const file = path.join(dir, ".env.local");
    writeFileSync(file, 'DJSBOT_TEST_FILE=from-file\nDJSBOT_TEST_REAL=from-file\nDJSBOT_TEST_QUOTED="two words"\n');
    process.env.DJSBOT_TEST_REAL = "from-environment";
    try {
      loadEnvFile(file);
      expect(process.env.DJSBOT_TEST_FILE).toBe("from-file");
      expect(process.env.DJSBOT_TEST_REAL).toBe("from-environment");
      expect(process.env.DJSBOT_TEST_QUOTED).toBe("two words");
      // A file that is not there is not an error.
      expect(() => loadEnvFile(path.join(dir, ".env.missing"))).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("retry and timeout", () => {
  it("take their durations as text", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const result = retry(
      () => {
        attempts++;
        if (attempts < 2) throw new Error("again");
        return "done";
      },
      { delay: "1s", jitter: 0 },
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe("done");

    const slow = timeout(() => new Promise<string>(() => undefined), "2s", "too slow");
    const settled = expect(slow).rejects.toThrow("too slow");
    await vi.advanceTimersByTimeAsync(2_000);
    await settled;
  });

  it("stop retrying once the signal is aborted", async () => {
    const controller = new AbortController();
    let attempts = 0;
    const result = retry(
      () => {
        attempts++;
        controller.abort();
        throw new Error("down");
      },
      { attempts: 5, delay: 1, signal: controller.signal },
    );
    await expect(result).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it("hands the work a signal that aborts when the time is up", async () => {
    let aborted = false;
    const slow = timeout(
      (signal) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("stopped"));
          });
        }),
      20,
    );
    await expect(slow).rejects.toThrow();
    expect(aborted).toBe(true);
  });
});

describe("a trigger with a cooldown", () => {
  it("answers an author once per cooldown, and each author on their own", async () => {
    vi.useFakeTimers();
    const answered: string[] = [];
    const greet = defineTrigger({
      name: "greet",
      pattern: "hello",
      cooldown: "10s",
      run: (ctx) => void answered.push(ctx.author.id),
    });
    const bot = defineBot({ logger: { level: "silent" }, features: [greet] });
    await bot.load();
    const client = new EventEmitter();
    (bot as unknown as { _client: unknown; attachTriggers(c: unknown): void })._client = client;
    (bot as unknown as { attachTriggers(c: unknown): void }).attachTriggers(client);

    const say = async (authorId: string): Promise<void> => {
      client.emit("messageCreate", { content: "hello there", author: { id: authorId, bot: false } });
      await vi.advanceTimersByTimeAsync(0);
    };
    await say("ada");
    await say("ada");
    await say("bob");
    expect(answered).toEqual(["ada", "bob"]);

    await vi.advanceTimersByTimeAsync(10_001);
    await say("ada");
    expect(answered).toEqual(["ada", "bob", "ada"]);
  });
});

describe("presence rotation", () => {
  it("shows the first presence at once, then one per interval, until the shutdown", async () => {
    vi.useFakeTimers();
    const shown: string[] = [];
    const bot = defineBot({
      logger: { level: "silent" },
      presenceRotation: { interval: "1s", items: [{ status: "online" }, { status: "idle" }] },
    });
    await bot.load();
    const client = { user: { setPresence: (presence: { status: string }) => void shown.push(presence.status) } };
    (bot as unknown as { startPresenceRotation(c: unknown): void }).startPresenceRotation(client);

    expect(shown).toEqual(["online"]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(shown).toEqual(["online", "idle", "online"]);

    await bot.shutdown();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(shown).toHaveLength(3);
  });
});
