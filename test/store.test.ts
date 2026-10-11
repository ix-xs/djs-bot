import { describe, it, expect } from "vitest";
import { createStore, memoryStore, sqliteStore, type KVBackend, type KVStore } from "../src/index.js";
import { upgradeStore } from "../src/store.js";

const adapters: Array<[string, () => KVStore]> = [
  ["memory", () => memoryStore()],
  ["sqlite", () => sqliteStore(":memory:")],
];

describe.each(adapters)("%s store", (_name, make) => {
  it("counts atomically under concurrency", async () => {
    const store = make();
    await Promise.all(Array.from({ length: 50 }, () => store.increment("hits")));
    expect(await store.get("hits")).toBe(50);
    expect(await store.increment("hits", -10)).toBe(40);
  });

  it("queues update() so no write is lost", async () => {
    const store = make();
    await store.set("list", []);
    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        store.update("list", async (current) => {
          await new Promise((resolve) => setTimeout(resolve, 5 - n)); // finish out of order
          return [...((current as number[]) ?? []), n];
        }),
      ),
    );
    expect(await store.get("list")).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps working after an update() that throws", async () => {
    const store = make();
    await expect(
      store.update("k", () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await store.update("k", () => "ok")).toBe("ok");
  });

  it("reads and writes in bulk", async () => {
    const store = make();
    await store.setMany({ a: 1, b: 2 });
    await store.setMany([["c", 3]]);
    expect(await store.size()).toBe(3);
    expect(Object.fromEntries(await store.getMany(["a", "c", "missing"]))).toEqual({ a: 1, c: 3 });
    expect((await store.entries()).sort()).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("scopes bulk reads and counters to a namespace", async () => {
    const store = make();
    const a = store.namespace("a");
    const b = store.namespace("b");
    await a.increment("n");
    await b.increment("n", 5);
    expect(await a.get("n")).toBe(1);
    expect(await b.entries()).toEqual([["n", 5]]);
    await a.clear();
    expect(await a.size()).toBe(0);
    expect(await b.size()).toBe(1);
  });

  it("hides expired keys from keys(), entries() and size()", async () => {
    const store = make();
    await store.set("gone", 1, 1);
    await store.set("kept", 2);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(await store.keys()).toEqual(["kept"]);
    expect(await store.entries()).toEqual([["kept", 2]]);
    expect(await store.size()).toBe(1);
  });

  it("closes more than once without throwing", async () => {
    const store = make();
    await store.close();
    await store.close();
  });
});

describe("createStore", () => {
  it("derives the whole contract from a four-method backend", async () => {
    const data = new Map<string, unknown>();
    const backend: KVBackend = {
      get: (key) => data.get(key),
      set: (key, value) => void data.set(key, value),
      delete: (key) => data.delete(key),
      keys: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
    };
    const store = createStore<number>(backend);
    const ns = store.namespace<number>("scores");

    await ns.increment("alice", 3);
    await ns.increment("alice");
    expect(data.get("scores:alice")).toBe(4);

    expect(await ns.getOrSet("bob", () => 9)).toBe(9);
    expect(await ns.keys()).toEqual(["alice", "bob"]);

    await ns.clear(); // falls back to keys() + delete() when clear() is absent
    expect(data.size).toBe(0);
  });

  it("runs a getOrSet factory once for concurrent callers", async () => {
    const store = memoryStore<number>();
    let calls = 0;
    const factory = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 42;
    };
    const values = await Promise.all([store.getOrSet("k", factory), store.getOrSet("k", factory)]);
    expect(values).toEqual([42, 42]);
    expect(calls).toBe(1);
  });
});

describe("upgradeStore", () => {
  it("returns a complete store unchanged", () => {
    const store = memoryStore();
    expect(upgradeStore(store)).toBe(store);
  });

  it("adds the newer methods to an adapter written for 1.0", async () => {
    const data = new Map<string, unknown>();
    // The 1.0 contract: eight methods, no counters, no bulk reads.
    const legacy = {
      get: async (key: string) => data.get(key),
      set: async (key: string, value: unknown) => void data.set(key, value),
      has: async (key: string) => data.has(key),
      delete: async (key: string) => data.delete(key),
      keys: async () => [...data.keys()],
      clear: async () => data.clear(),
      namespace: () => legacy,
      getOrSet: async (key: string, factory: () => unknown) => data.get(key) ?? factory(),
    } as unknown as KVStore;

    const store = upgradeStore(legacy);
    expect(store).not.toBe(legacy);
    expect(await store.increment("n", 2)).toBe(2);
    expect(await store.entries()).toEqual([["n", 2]]);
    expect(data.get("n")).toBe(2);
  });
});
