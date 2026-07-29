/**
 * Performance benchmarks for the framework's hot paths.
 *
 *   npm run bench
 *
 * Measured:
 *  - customId codec (encode/decode) - runs on every component interaction
 *  - registry registration - boot-time cost
 *  - routing hot path - key parse + registry lookup + param decode + guard pipeline
 *  - intent autopilot - computeIntents over many events
 *  - infra primitives - i18n, rate limiter, TTL cache
 *  - loader - file discovery + a cold load of N features
 */
import { Bench } from "tinybench";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import comfort from "@ix-xs/node-comfort";

import {
  encodeCustomId,
  decodeCustomId,
  customIdKey,
  p,
  s,
  Registry,
  defineCommand,
  defineButton,
  defineEvent,
  computeIntents,
  createI18n,
  createRateLimiter,
  createCache,
  inGuild,
  cooldown,
  guard,
  pass,
  type Guard,
} from "../src/index.js";
import { loadFromDirectory } from "../src/loader.js";

const TIME = 400; // ms per task

function header(title: string): void {
  console.log(`\n\x1b[1m\x1b[36m${title}\x1b[0m`);
}

function printTable(bench: Bench): void {
  const rows = bench.tasks.map((t) => ({
    task: t.name,
    "ops/sec": Math.round(t.result?.hz ?? 0).toLocaleString("en-US"),
    "avg (µs)": ((t.result?.mean ?? 0) * 1000).toFixed(3),
    samples: t.result?.samples.length ?? 0,
  }));
  console.table(rows);
}

async function benchCustomId(): Promise<void> {
  header("customId codec");
  const schema2 = { ticketId: p.string, ownerId: p.string };
  const schema4 = { a: p.string, b: p.number, c: p.boolean, d: p.string };
  const encoded2 = encodeCustomId("ticket:close", schema2, { ticketId: "abc123", ownerId: "998877665544332211" });
  const encoded4 = encodeCustomId("x:y", schema4, { a: "hello", b: 42, c: true, d: "world" });

  const bench = new Bench({ time: TIME });
  bench
    .add("encode (0 params)", () => encodeCustomId("just:key", {}, {}))
    .add("encode (2 params)", () => encodeCustomId("ticket:close", schema2, { ticketId: "abc123", ownerId: "998877665544332211" }))
    .add("encode (4 params)", () => encodeCustomId("x:y", schema4, { a: "hello", b: 42, c: true, d: "world" }))
    .add("customIdKey (parse key)", () => customIdKey(encoded2))
    .add("decode (2 params)", () => decodeCustomId(encoded2, schema2))
    .add("decode (4 params)", () => decodeCustomId(encoded4, schema4));
  await bench.run();
  printTable(bench);
}

async function benchRegistry(): Promise<void> {
  header("registry registration");
  const commands = Array.from({ length: 100 }, (_, i) =>
    defineCommand({ name: `cmd${i}`, description: "d", options: { x: s.string({ required: true }) }, run: () => {} }),
  );
  const buttons = Array.from({ length: 100 }, (_, i) =>
    defineButton({ id: `btn:${i}`, params: { id: p.string }, run: () => {} }),
  );

  const bench = new Bench({ time: TIME });
  bench
    .add("register 100 commands", () => {
      const r = new Registry();
      for (const c of commands) r.add(c);
    })
    .add("register 100 buttons", () => {
      const r = new Registry();
      for (const b of buttons) r.add(b);
    });
  await bench.run();
  printTable(bench);
}

async function benchRouting(): Promise<void> {
  header("routing hot path (per interaction)");
  // Build a realistic registry with 200 buttons.
  const registry = new Registry();
  for (let i = 0; i < 200; i++) registry.add(defineButton({ id: `btn:${i}`, params: { id: p.string }, run: () => {} }));
  const target = defineButton({
    id: "ticket:close",
    params: { ticketId: p.string, ownerId: p.string },
    guards: [inGuild(), cooldown("0s"), guard("check", () => pass())],
    run: () => {},
  });
  registry.add(target);
  const customId = encodeCustomId("ticket:close", target.params, { ticketId: "t-1", ownerId: "u-1" });

  // Minimal ctx used by the built-in guards.
  const ctx = {
    user: { id: "u-1" },
    guild: { id: "g-1" },
    guildId: "g-1",
    channel: { id: "c-1" },
    member: { permissions: { has: () => true } },
  } as never;

  const runGuards = async (guards: readonly Guard[]): Promise<boolean> => {
    for (const g of guards) {
      const res = await g.run(ctx);
      if (!res.ok) return false;
    }
    return true;
  };

  const bench = new Bench({ time: TIME });
  bench
    .add("lookup (200-entry registry)", () => registry.buttons.get(customIdKey(customId)))
    .add("decode params", () => decodeCustomId(customId, target.params))
    .add("guard pipeline (3 guards)", async () => {
      await runGuards(target.guards);
    })
    .add("full route (key+lookup+decode+guards)", async () => {
      const key = customIdKey(customId);
      const def = registry.buttons.get(key)!;
      decodeCustomId(customId, def.params);
      await runGuards(def.guards);
    });
  await bench.run();
  printTable(bench);
}

async function benchIntents(): Promise<void> {
  header("intent autopilot");
  const events = [
    "guildMemberAdd", "messageCreate", "messageReactionAdd", "voiceStateUpdate",
    "guildBanAdd", "presenceUpdate", "channelCreate", "roleUpdate", "threadCreate", "inviteCreate",
  ].map((e) => defineEvent(e as never, () => {}));

  const bench = new Bench({ time: TIME });
  bench.add("computeIntents (10 events)", () => computeIntents(events, { hasTriggers: true }));
  await bench.run();
  printTable(bench);
}

async function benchInfra(): Promise<void> {
  header("infra primitives");
  const i18n = createI18n({
    resources: { en: { a: { b: { c: "hello {name}" } } }, fr: { a: { b: { c: "bonjour {name}" } } } },
  });
  const limiter = createRateLimiter({ limit: 1_000_000_000, window: "1m" });
  const cache = createCache<string, number>({ ttl: "1m" });
  cache.set("k", 1);

  const bench = new Bench({ time: TIME });
  bench
    .add("i18n.t (nested + interpolation)", () => i18n.t("fr", "a.b.c", { name: "Léa" }))
    .add("rateLimiter.consume", () => limiter.consume("user-1"))
    .add("TTLCache.get (hit)", () => cache.get("k"))
    .add("TTLCache.getOrFetch (hit)", async () => {
      await cache.getOrFetch("k", () => 1);
    });
  await bench.run();
  printTable(bench);
}

async function benchLoader(): Promise<void> {
  header("loader");
  const dir = mkdtempSync(path.join(tmpdir(), "djsbot-bench-"));
  const featureCount = 200;
  for (let i = 0; i < featureCount; i++) {
    const sub = path.join(dir, `f${i}`);
    mkdirSync(sub, { recursive: true });
    writeFileSync(
      path.join(sub, `c${i}.command.mjs`),
      `export default { kind: "command", name: "cmd${i}", description: "d", options: {}, guards: [], run: () => {} };\n`,
    );
  }

  try {
    // Discovery is repeatable; benchmark it.
    const bench = new Bench({ time: TIME });
    bench.add(`discover ${featureCount} files (fs walk)`, () => comfort.fs.getFilesIn(dir, true));
    await bench.run();
    printTable(bench);

    // A cold load imports every file once (module cache makes repeats meaningless),
    // so measure it as a single wall-clock run.
    const t0 = performance.now();
    const loaded = await loadFromDirectory(dir);
    const ms = performance.now() - t0;
    console.log(
      `\n  cold load of ${featureCount} features: \x1b[1m${ms.toFixed(1)} ms\x1b[0m ` +
        `(${(ms / featureCount).toFixed(3)} ms/feature, ${loaded.length} defs)`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  console.log(`\x1b[1mdjs-bot benchmarks\x1b[0m - Node ${process.version}, ${process.platform}/${process.arch}`);
  await benchCustomId();
  await benchRouting();
  await benchRegistry();
  await benchIntents();
  await benchInfra();
  await benchLoader();
  console.log("\n\x1b[90mNote: numbers are indicative and machine-dependent.\x1b[0m");
}

void main();
