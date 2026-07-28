import { describe, it, expect } from "vitest";
import {
  createI18n,
  memoryStore,
  createRateLimiter,
  rateLimit,
  createCircuitBreaker,
  CircuitOpenError,
} from "../src/index.js";

describe("i18n", () => {
  const i18n = createI18n({
    defaultLocale: "en",
    resources: {
      en: { greet: "Hello {name}!", items: { one: "{count} item", other: "{count} items" } },
      fr: { greet: "Bonjour {name} !" },
    },
  });

  it("interpolates and localizes", () => {
    expect(i18n.t("fr", "greet", { name: "Léa" })).toBe("Bonjour Léa !");
    expect(i18n.t("en-US", "greet", { name: "Sam" })).toBe("Hello Sam!"); // base-locale fallback
  });
  it("falls back to default then to the key", () => {
    expect(i18n.t("fr", "greet.missing")).toBe("greet.missing");
    expect(i18n.t("de", "greet", { name: "Max" })).toBe("Hello Max!"); // → default en
  });
  it("pluralizes with count", () => {
    expect(i18n.t("en", "items", { count: 1 })).toBe("1 item");
    expect(i18n.t("en", "items", { count: 5 })).toBe("5 items");
  });
});

describe("memory store", () => {
  it("gets/sets, namespaces, and expires", async () => {
    const store = memoryStore<number>();
    await store.set("a", 1);
    expect(await store.get("a")).toBe(1);
    expect(await store.has("a")).toBe(true);

    const ns = store.namespace("guild-1");
    await ns.set("a", 99);
    expect(await ns.get("a")).toBe(99);
    expect(await store.get("a")).toBe(1); // isolated

    await store.set("t", 5, 1); // 1ms ttl
    await new Promise((r) => setTimeout(r, 5));
    expect(await store.get("t")).toBeUndefined();

    expect(await store.getOrSet("x", () => 7)).toBe(7);
    expect(await store.get("x")).toBe(7);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    const rl = createRateLimiter({ limit: 2, window: 1000 });
    expect(rl.consume("k").allowed).toBe(true);
    expect(rl.consume("k").allowed).toBe(true);
    const third = rl.consume("k");
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });
  it("exposes a guard factory", () => {
    const g = rateLimit({ limit: 1, window: "1m" });
    expect(g.name).toBe("rateLimit");
  });
});

describe("circuit breaker", () => {
  it("opens after the failure threshold and rejects fast", async () => {
    const cb = createCircuitBreaker({ failureThreshold: 2, resetTimeout: 10_000 });
    const boom = () => Promise.reject(new Error("boom"));
    await expect(cb.execute(boom)).rejects.toThrow("boom");
    await expect(cb.execute(boom)).rejects.toThrow("boom");
    expect(cb.status).toBe("open");
    await expect(cb.execute(() => Promise.resolve("ok"))).rejects.toBeInstanceOf(CircuitOpenError);
  });
  it("closes again after a successful trial", async () => {
    const cb = createCircuitBreaker({ failureThreshold: 1, resetTimeout: 1 });
    await expect(cb.execute(() => Promise.reject(new Error("x")))).rejects.toThrow();
    expect(cb.status).toBe("open");
    await new Promise((r) => setTimeout(r, 5));
    await expect(cb.execute(() => Promise.resolve("ok"))).resolves.toBe("ok");
    expect(cb.status).toBe("closed");
  });
});
