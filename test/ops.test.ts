import { describe, it, expect } from "vitest";
import {
  createAuditLog,
  memoryAuditSink,
  createFeatureFlags,
  featureEnabled,
  startHealthServer,
  memoryStore,
} from "../src/index.js";
import type { AddressInfo } from "node:net";

describe("audit log", () => {
  it("records and queries with filters", async () => {
    const audit = createAuditLog({ sink: memoryAuditSink() });
    await audit.record("member.ban", { actorId: "mod", guildId: "g1", targetId: "u1" });
    await audit.record("member.kick", { actorId: "mod", guildId: "g1" });
    await audit.record("member.ban", { actorId: "other", guildId: "g2" });

    const bans = await audit.query({ action: "member.ban" });
    expect(bans).toHaveLength(2);
    const byGuild = await audit.query({ guildId: "g1" });
    expect(byGuild).toHaveLength(2);
    expect(await audit.query({ actorId: "mod", limit: 1 })).toHaveLength(1);
    // newest first
    expect(byGuild[0]!.timestamp).toBeGreaterThanOrEqual(byGuild[1]!.timestamp);
  });
});

describe("feature flags", () => {
  it("resolves guild → global → default", async () => {
    const flags = createFeatureFlags({ store: memoryStore(), defaults: { economy: true, beta: false } });
    expect(await flags.isEnabled("economy")).toBe(true); // default
    expect(await flags.isEnabled("beta")).toBe(false); // default

    await flags.disable("economy", { guildId: "g1" }); // guild override
    expect(await flags.isEnabled("economy", { guildId: "g1" })).toBe(false);
    expect(await flags.isEnabled("economy", { guildId: "g2" })).toBe(true); // unaffected

    await flags.enable("beta"); // global override wins over default
    expect(await flags.isEnabled("beta")).toBe(true);

    const list = await flags.list("g1");
    expect(list.economy).toBe(false);
    expect(list.beta).toBe(true);
  });

  it("guard fails open when flags aren't configured", async () => {
    const g = featureEnabled("economy");
    const ctx = { services: {}, guildId: null } as never;
    expect(await g.run(ctx)).toEqual({ ok: true });
  });
});

describe("health server", () => {
  it("serves /healthz, /readyz and /metrics", async () => {
    let ready = false;
    const server = startHealthServer(() => ({ ready, uptimeMs: 5, metrics: { interactions: 2 } }), { port: 0 });
    await new Promise((r) => server.once("listening", r));
    const port = (server.address() as AddressInfo).port;

    const get = async (path: string) => {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      return { status: res.status, body: await res.json() };
    };

    expect((await get("/healthz")).status).toBe(200);
    expect((await get("/readyz")).status).toBe(503); // not ready yet
    ready = true;
    expect((await get("/readyz")).status).toBe(200);
    const metrics = await get("/metrics");
    expect((metrics.body as { metrics: { interactions: number } }).metrics.interactions).toBe(2);
    expect((await get("/nope")).status).toBe(404);

    server.close();
  });
});
