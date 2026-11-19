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
  type AuditLog,
} from "../src/index.js";
import { resetDeprecations } from "../src/deprecate.js";
import { createLogger } from "../src/logger.js";
import { shardingOptions } from "../src/sharding.js";

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

      // The starter's entry reads the token, and starts the bot unless the CLI loads it.
      vi.stubEnv("DISCORD_TOKEN", "a.b.c");
      vi.stubEnv("DJSBOT_CLI", "1");
      // Each file runs, with the framework imported from the source.
      const index = JSON.stringify(pathToFileURL(path.resolve("src/index.ts")).href);
      const files = tsFiles(dir);
      expect(files.length).toBe(GENERATORS.length + 2);
      for (const file of files) {
        const runnable = file.replace(/\.ts$/, ".local.ts");
        writeFileSync(runnable, readFileSync(file, "utf8").replaceAll('"@ix-xs/djs-bot"', index));
        await import(/* @vite-ignore */ pathToFileURL(runnable).href);
      }
      expect(codes()).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
