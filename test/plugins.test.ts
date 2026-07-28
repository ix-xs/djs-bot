import { describe, it, expect, vi } from "vitest";
import { antiSpam, commandLogger, errorReporter, maintenance } from "../src/plugins/index.js";
import type { MiddlewareFn, PluginApp } from "../src/index.js";

/** A minimal fake PluginApp that captures the hooks a plugin registers. */
function fakeApp() {
  const middlewares: MiddlewareFn[] = [];
  const errorHooks: Array<(e: unknown) => unknown> = [];
  const app = {
    logger: { info() {}, error() {}, warn() {}, debug() {}, child: () => app.logger } as never,
    config: {},
    services: { register() {}, has: () => false },
    hooks: {
      beforeInteraction: (fn: MiddlewareFn) => middlewares.push(fn),
      afterInteraction: () => {},
      onError: (fn: (e: unknown) => unknown) => errorHooks.push(fn),
      onReady: () => {},
      onShutdown: () => {},
    },
  } as unknown as PluginApp;
  return { app, middlewares, errorHooks };
}

function fakeCtx(userId = "u1") {
  const replies: string[] = [];
  const ctx = {
    user: { id: userId },
    interaction: { type: 2 },
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    reply: Object.assign(() => Promise.resolve(), {
      error: (m: string) => (replies.push(m), Promise.resolve()),
      success: () => Promise.resolve(),
      info: () => Promise.resolve(),
    }),
  } as never;
  return { ctx, replies };
}

describe("official plugins", () => {
  it("antiSpam blocks once the limit is exceeded", async () => {
    const plugin = antiSpam({ max: 2, window: "1m" });
    const { app, middlewares } = fakeApp();
    await plugin.setup(app);
    const mw = middlewares[0]!;
    const { ctx, replies } = fakeCtx();
    let ran = 0;
    const next = async () => {
      ran++;
    };
    await mw(ctx, next);
    await mw(ctx, next);
    await mw(ctx, next); // 3rd exceeds max=2
    expect(ran).toBe(2);
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatch(/slow down/i);
  });

  it("errorReporter forwards errors and swallows reporter failures", async () => {
    const report = vi.fn(() => {
      throw new Error("reporter down");
    });
    const plugin = errorReporter({ report });
    const { app, errorHooks } = fakeApp();
    await plugin.setup(app);
    await errorHooks[0]!(new Error("boom")); // should not throw
    expect(report).toHaveBeenCalledOnce();
  });

  it("maintenance blocks everyone except the allow-list", async () => {
    const plugin = maintenance({ enabled: true, allow: ["owner"] });
    const { app, middlewares } = fakeApp();
    await plugin.setup(app);
    const mw = middlewares[0]!;

    const blocked = fakeCtx("someone");
    let ranBlocked = 0;
    await mw(blocked.ctx, async () => {
      ranBlocked++;
    });
    expect(ranBlocked).toBe(0);
    expect(blocked.replies).toHaveLength(1);

    const owner = fakeCtx("owner");
    let ranOwner = 0;
    await mw(owner.ctx, async () => {
      ranOwner++;
    });
    expect(ranOwner).toBe(1);
  });

  it("commandLogger wraps and calls next", async () => {
    const plugin = commandLogger();
    const { app, middlewares } = fakeApp();
    await plugin.setup(app);
    const { ctx } = fakeCtx();
    let ran = 0;
    await middlewares[0]!(ctx, async () => {
      ran++;
    });
    expect(ran).toBe(1);
    expect(plugin.name).toBe("command-logger");
  });
});
