/**
 * One test per defect fixed in 1.1.1. Each was found by checking the
 * documentation against the code, and each failed before its fix.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:net";
import {
  confirm,
  createAuditLog,
  createFeatureFlags,
  defineBot,
  defineButton,
  defineCommand,
  defineJob,
  defineRoleSelect,
  defineUserCommand,
  hasRole,
  memoryAuditSink,
  memoryStore,
  paginate,
  retry,
  s,
  type BaseContext,
  type Bot,
  type BotConfig,
  type ParamCodec,
} from "../src/index.js";
import { flagValue, positional } from "../src/cli-args.js";
import { encodeCustomId } from "../src/customId.js";
import { Registry } from "../src/registry.js";
import { createHarness } from "../src/testing.js";
import { fakeInteraction, methods, type FakeOptions } from "./fakes.js";

async function boot(config: BotConfig): Promise<Bot> {
  const bot = defineBot({ logger: { level: "silent" }, ...config });
  await bot.load();
  (bot as unknown as { _client: unknown })._client = { ws: { ping: 1 } };
  return bot;
}
const send = async (bot: Bot, options: FakeOptions, patch: Record<string, unknown> = {}) => {
  const interaction = Object.assign(fakeInteraction(options), patch);
  await (bot as unknown as { handleInteraction(i: unknown): Promise<void> }).handleInteraction(interaction);
  return interaction;
};
const textOf = (call: { payload?: unknown } | undefined): string | undefined => {
  const payload = call?.payload as { content?: string; embeds?: Array<{ data: { description?: string } }> } | undefined;
  return payload?.content ?? payload?.embeds?.[0]?.data.description;
};
const codeOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    return String(error);
  }
  return "did not throw";
};

afterEach(() => vi.useRealTimers());

describe("CLI arguments", () => {
  it("does not take the value of --guild for the entry file", () => {
    expect(positional(["--guild", "123456789012345678"])).toBeUndefined();
    expect(positional(["--guild", "123456789012345678", "--dry-run"])).toBeUndefined();
    expect(positional(["--guild", "123", "src/index.ts"])).toBe("src/index.ts");
    expect(positional(["src/index.ts", "--guild", "123"])).toBe("src/index.ts");
    expect(positional(["--dry-run", "src/bot.ts"])).toBe("src/bot.ts");
    expect(positional([])).toBeUndefined();
  });

  it("reads a flag value in both spellings", () => {
    expect(flagValue(["--guild", "123"], "--guild")).toBe("123");
    expect(flagValue(["src/index.ts", "--guild=123"], "--guild")).toBe("123");
    expect(flagValue(["--guild", "--dry-run"], "--guild")).toBeUndefined();
    expect(flagValue(["--guild="], "--guild")).toBeUndefined();
    expect(flagValue(["--dry-run"], "--guild")).toBeUndefined();
  });
});

describe("retry", () => {
  it("waits between attempts by default, and longer each time", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const result = retry(() => {
      calls++;
      if (calls < 3) throw new Error("not yet");
      return "ok";
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    // First wait: 200 ms, give or take 20 %.
    await vi.advanceTimersByTimeAsync(150);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toBe(2);
    // Second wait: 400 ms, give or take 20 %.
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toBe(3);
    await expect(result).resolves.toBe("ok");
  });

  it("still retries at once when asked to", async () => {
    let calls = 0;
    await expect(
      retry(
        () => {
          calls++;
          if (calls < 3) throw new Error("not yet");
          return calls;
        },
        { delay: 0, jitter: 0 },
      ),
    ).resolves.toBe(3);
  });
});

describe("feature flags", () => {
  it("lists a guild's own value over the global one, whatever was stored first", async () => {
    const flags = createFeatureFlags({ store: memoryStore() });
    // The guild override is written before the global value.
    await flags.disable("economy", { guildId: "g1" });
    await flags.enable("economy");
    await flags.enable("music");

    expect(await flags.isEnabled("economy", { guildId: "g1" })).toBe(false);
    expect(await flags.list("g1")).toEqual({ economy: false, music: true });
    expect(await flags.list("g2")).toEqual({ economy: true, music: true });
    expect(await flags.list()).toEqual({ economy: true, music: true });
  });
});

describe("audit log", () => {
  it("survives a sink that throws synchronously", async () => {
    const memory = memoryAuditSink();
    const audit = createAuditLog({
      sinks: [
        {
          record() {
            throw new Error("sink is down");
          },
        },
        memory,
      ],
    });
    await expect(audit.record("member.ban", { actorId: "u1" })).resolves.toMatchObject({ action: "member.ban" });
    expect(await audit.query({ action: "member.ban" })).toHaveLength(1);
  });
});

describe("a customId that cannot be decoded", () => {
  it("tells the user and reaches the error hooks", async () => {
    const strict: ParamCodec<string> = {
      type: "string",
      encode: (value) => value,
      decode: () => {
        throw new Error("unreadable");
      },
    };
    let ran = false;
    const Old = defineButton({ id: "old", params: { token: strict }, run: () => void (ran = true) });
    const seen: unknown[] = [];
    const bot = await boot({ features: [Old], onError: (error) => void seen.push(error) });

    const i = await send(bot, { kind: "button", customId: encodeCustomId("old", { token: strict }, { token: "abc" }) });

    expect(ran).toBe(false);
    expect(seen).toHaveLength(1);
    expect(methods(i)).toEqual(["reply"]);
    expect(bot.stats().errors).toBe(1);
  });
});

describe("a required member option", () => {
  const Kick = (onRun: () => void) =>
    defineCommand({
      name: "kick",
      description: "Kick",
      options: { who: s.member({ required: true }) },
      run: () => onRun(),
    });

  it("refuses the command when the user is not a member, instead of passing undefined", async () => {
    let ran = false;
    const bot = await boot({ features: [Kick(() => (ran = true))] });
    const i = await send(bot, { commandName: "kick" });

    expect(ran).toBe(false);
    expect(textOf(i.calls[0])).toBe("That user is not a member of this server.");
  });

  it("runs it when the member is there, and the wording can be changed", async () => {
    let ran = false;
    const bot = await boot({ features: [Kick(() => (ran = true))], messages: { notAMember: "{option}: pas un membre." } });
    const absent = await send(bot, { commandName: "kick" });
    expect(textOf(absent.calls[0])).toBe("who: pas un membre.");

    const present = fakeInteraction({ commandName: "kick" });
    present.options.getMember = (() => ({ id: "m1" })) as never;
    await (bot as unknown as { handleInteraction(i: unknown): Promise<void> }).handleInteraction(present);
    expect(ran).toBe(true);
  });
});

describe("pagination and confirmation after a first reply", () => {
  /** A context whose interaction was already answered: the next message is a follow-up. */
  function answered() {
    const collectors: string[] = [];
    const message = (id: string) => ({
      id,
      createMessageComponentCollector: () => (collectors.push(id), { on: () => undefined }),
      awaitMessageComponent: () => (collectors.push(id), Promise.reject(new Error("timeout"))),
    });
    const edits: unknown[] = [];
    const interaction = {
      replied: true,
      followUp: async () => message("follow-up"),
      fetchReply: async () => message("original"),
      editReply: async (payload: unknown) => void edits.push(payload),
    };
    const ctx = {
      interaction,
      user: { id: "u1" },
      locale: "en",
      reply: async () => {
        throw new Error("a second reply must go out as a follow-up");
      },
      say: (key: string) => key,
    } as unknown as BaseContext;
    return { ctx, collectors, edits };
  }

  it("listens on the follow-up it sent, not on the first reply", async () => {
    const { ctx, collectors } = answered();
    await paginate(ctx, { pages: [{ content: "one" }, { content: "two" }] });
    expect(collectors).toEqual(["follow-up"]);
  });

  it("does the same for confirm, and greys out the right message on timeout", async () => {
    const { ctx, collectors, edits } = answered();
    await expect(confirm(ctx, { content: "Sure?", timeout: 10 })).resolves.toBe(false);
    expect(collectors).toEqual(["follow-up"]);
    expect((edits[0] as { message: { id: string } }).message.id).toBe("follow-up");
  });
});

describe("definitions", () => {
  it("refuses an unknown job timezone when the job is defined", () => {
    const job = (timezone: string) => () => defineJob({ name: "digest", schedule: "0 9 * * *", timezone, run: () => undefined });
    expect(codeOf(job("Europe/Paris"))).toBe("did not throw");
    expect(codeOf(job("Mars/Olympus"))).toMatch(/DJSBOT_E080.*unknown timezone "Mars\/Olympus"/);
  });

  it("reports two context-menu commands with one name as a duplicate command", () => {
    const registry = new Registry();
    registry.add(defineUserCommand({ name: "Inspect", run: () => undefined }));
    expect(codeOf(() => registry.add(defineUserCommand({ name: "Inspect", run: () => undefined })))).toMatch(/DJSBOT_E010.*user command "Inspect"/);
  });
});

describe("test harness", () => {
  it("keeps the member's roles apart from what a role select resolved", async () => {
    let seen: unknown;
    const Pick = defineRoleSelect({
      id: "pick",
      guards: [hasRole("staff")],
      run: (ctx) => void (seen = ctx.roles),
    });
    const picked = new Map([["r9", { id: "r9" }]]);
    const harness = createHarness();

    const ok = await harness.select(Pick, { guildId: "g1", roles: ["staff"], values: ["r9"], resolved: { roles: picked } });
    expect(ok.passedGuards).toBe(true);
    expect(seen).toBe(picked);

    const refused = await harness.select(Pick, { guildId: "g1", roles: [], values: ["r9"], resolved: { roles: picked } });
    expect(refused.passedGuards).toBe(false);
  });
});

describe("health server", () => {
  it("calls the onError given to defineBot when the port is taken", async () => {
    const blocker = createServer();
    const port = await new Promise<number>((resolve) => blocker.listen(0, () => resolve((blocker.address() as { port: number }).port)));
    const errors: Error[] = [];
    const bot = await boot({ health: { port, onError: (error) => void errors.push(error) } });
    try {
      (bot as unknown as { startHealth(client: unknown): void }).startHealth({
        isReady: () => true,
        guilds: { cache: { size: 0 } },
        ws: { ping: 1 },
        shard: null,
      });
      await vi.waitFor(() => expect(errors).toHaveLength(1));
      expect((errors[0] as NodeJS.ErrnoException).code).toBe("EADDRINUSE");
    } finally {
      (bot as unknown as { healthServer?: { close(): void } }).healthServer?.close();
      await new Promise((resolve) => blocker.close(resolve));
    }
  });
});
