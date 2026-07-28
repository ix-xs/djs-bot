import { describe, it, expect } from "vitest";
import { normalizeSharding, isShardChild, assets, createCache, mention, emoji, timestamp } from "../src/index.js";

describe("sharding config", () => {
  it("normalises loose input", () => {
    expect(normalizeSharding(true)).toEqual({ totalShards: "auto", mode: "process", respawn: true });
    expect(normalizeSharding("auto")).toEqual({ totalShards: "auto", mode: "process", respawn: true });
    expect(normalizeSharding({ totalShards: 4, mode: "worker" })).toEqual({
      totalShards: 4,
      mode: "worker",
      respawn: true,
    });
  });
  it("detects a shard child from the environment", () => {
    const prev = process.env.SHARDING_MANAGER;
    process.env.SHARDING_MANAGER = "true";
    expect(isShardChild()).toBe(true);
    if (prev === undefined) delete process.env.SHARDING_MANAGER;
    else process.env.SHARDING_MANAGER = prev;
  });
});

describe("asset & format helpers", () => {
  it("builds emoji CDN urls", () => {
    expect(assets.emoji("123")).toBe("https://cdn.discordapp.com/emojis/123.png");
    expect(assets.emoji("123", { animated: true, size: 128 })).toBe(
      "https://cdn.discordapp.com/emojis/123.gif?size=128",
    );
  });
  it("formats mentions, emojis and timestamps", () => {
    expect(mention.user("42")).toBe("<@42>");
    expect(mention.command("config", "99", "set")).toBe("</config set:99>");
    expect(emoji.parse("<a:blob:123>")).toEqual({ animated: true, name: "blob", id: "123" });
    expect(timestamp(0)).toBe("<t:0>");
  });
});

describe("cache", () => {
  it("dedupes concurrent fetches and caches the result", async () => {
    const cache = createCache<string, number>({ ttl: "1m" });
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return 7;
    };
    const [a, b] = await Promise.all([cache.getOrFetch("k", fetcher), cache.getOrFetch("k", fetcher)]);
    expect(a).toBe(7);
    expect(b).toBe(7);
    expect(calls).toBe(1);
    expect(cache.get("k")).toBe(7);
  });
});
