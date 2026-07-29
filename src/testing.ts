/**
 * A dependency-free test harness.
 *
 * Discord bots are notoriously hard to unit-test because everything runs behind
 * a gateway. `createHarness` invokes your command/component/modal handlers with
 * a synthesized context and captures every reply, so you can assert on handler
 * behaviour with a normal test runner - no token, no network, no mocks to wire.
 *
 * @example
 * import { createHarness } from "@ix-xs/djs-bot/testing";
 * const h = createHarness();
 * const { replies } = await h.command(Echo, { options: { text: "hi" } });
 * expect(replies[0]).toMatchObject({ type: "reply", content: "hi" });
 *
 * @module testing
 */
import { createLogger } from "./logger.js";
import type { ServiceMap } from "./container.js";
import type { Bot } from "./bot.js";
import type {
  ButtonContext,
  CommandContext,
  ModalContext,
  ReplyFn,
  SelectMenuContext,
  UpdateFn,
} from "./context.js";
import type {
  ButtonDefinition,
  CommandDefinition,
  ModalDefinition,
  SelectRoutable,
} from "./definitions.js";
import type { Guard } from "./guards.js";

/** A single captured response produced by a handler under test. */
export interface CapturedReply {
  type: "reply" | "success" | "error" | "info" | "defer" | "followUp" | "editReply" | "update" | "update:disable";
  content?: unknown;
}

/** The result of running a handler through the harness. */
export interface HarnessResult {
  /** Everything the handler sent, in order. */
  replies: CapturedReply[];
  /** Whether all guards passed (handlers only run when they do). */
  passedGuards: boolean;
  /** The reason a guard rejected, if any. */
  rejectionReason?: string;
}

/** Shared invocation inputs. */
interface BaseInput {
  /** Override the invoking user id (default `"test-user"`). */
  userId?: string;
  /** Provide a fake guild id (default none - DM context). */
  guildId?: string;
  /** Services available as `ctx.services` (overrides the bot's, if any). */
  services?: Partial<ServiceMap>;
  /** The user's locale for `ctx.locale` (default `"en"`). */
  locale?: string;
  /** Run the definition's guards before the handler (default `true`). */
  runGuards?: boolean;
}

function captureResponders() {
  const replies: CapturedReply[] = [];
  const reply = ((content: unknown) => {
    replies.push({ type: "reply", content });
    return Promise.resolve();
  }) as ReplyFn;
  reply.success = (m) => (replies.push({ type: "success", content: m }), Promise.resolve());
  reply.error = (m) => (replies.push({ type: "error", content: m }), Promise.resolve());
  reply.info = (m) => (replies.push({ type: "info", content: m }), Promise.resolve());
  reply.defer = () => (replies.push({ type: "defer" }), Promise.resolve());
  reply.followUp = (c) => (replies.push({ type: "followUp", content: c }), Promise.resolve());
  reply.editReply = (c) => (replies.push({ type: "editReply", content: c }), Promise.resolve());

  const update = ((content: unknown) => {
    replies.push({ type: "update", content });
    return Promise.resolve();
  }) as UpdateFn;
  update.disable = () => (replies.push({ type: "update:disable" }), Promise.resolve());
  update.defer = () => (replies.push({ type: "defer" }), Promise.resolve());

  return { replies, reply, update };
}

function baseCtx(input: BaseInput, bot?: Bot) {
  const userId = input.userId ?? "test-user";
  const user = { id: userId, username: userId, tag: `${userId}#0000`, toString: () => `<@${userId}>` };
  const services = (input.services ?? (bot ? bot.container.view() : {})) as ServiceMap;
  return {
    client: {} as never,
    user: user as never,
    guild: (input.guildId ? ({ id: input.guildId } as never) : null),
    guildId: input.guildId ?? null,
    channel: null,
    member: input.guildId ? ({ id: userId, permissions: { has: () => true } } as never) : null,
    services,
    logger: createLogger({ level: "silent" }),
    correlationId: "test",
    locale: input.locale ?? "en",
    t: (key: string) => key,
    audit: async () => undefined,
  };
}

async function runGuards(guards: readonly Guard[], ctx: unknown, run: boolean): Promise<{ ok: boolean; reason?: string }> {
  if (!run) return { ok: true };
  for (const guard of guards) {
    const result = await guard.run(ctx as never);
    if (!result.ok) return { ok: false, reason: result.reason };
  }
  return { ok: true };
}

/** A harness bound to an optional {@link Bot} (for its services). */
export interface Harness {
  /** Invokes a slash command handler. Pass `options` matching the command's schema. */
  command(
    def: CommandDefinition,
    input?: BaseInput & { options?: Record<string, unknown> },
  ): Promise<HarnessResult>;
  /** Invokes a button handler with typed params. */
  button(def: ButtonDefinition, input?: BaseInput & { params?: Record<string, unknown> }): Promise<HarnessResult>;
  /** Invokes a select-menu handler (string or native). */
  select(
    def: SelectRoutable,
    input?: BaseInput & { params?: Record<string, unknown>; values?: string[] },
  ): Promise<HarnessResult>;
  /** Invokes a modal handler with submitted field values. */
  modal(def: ModalDefinition, input?: BaseInput & { fields?: Record<string, string>; params?: Record<string, unknown> }): Promise<HarnessResult>;
}

/**
 * Creates a test harness. Pass a loaded {@link Bot} to reuse its services, or
 * omit it and inject services per call.
 */
export function createHarness(bot?: Bot): Harness {
  return {
    async command(def, input = {}) {
      const { replies, reply } = captureResponders();
      const ctx = { ...baseCtx(input, bot), reply, interaction: {} as never, options: input.options ?? {} };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run?.(ctx as unknown as CommandContext<never>);
      return { replies, passedGuards: true };
    },
    async button(def, input = {}) {
      const { replies, reply, update } = captureResponders();
      const ctx = { ...baseCtx(input, bot), reply, update, interaction: {} as never, params: input.params ?? {} };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run(ctx as unknown as ButtonContext<never>);
      return { replies, passedGuards: true };
    },
    async select(def, input = {}) {
      const { replies, reply, update } = captureResponders();
      const ctx = {
        ...baseCtx(input, bot),
        reply,
        update,
        interaction: {} as never,
        params: input.params ?? {},
        values: input.values ?? [],
      };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run(ctx as unknown as SelectMenuContext<never>);
      return { replies, passedGuards: true };
    },
    async modal(def, input = {}) {
      const { replies, reply } = captureResponders();
      const ctx = {
        ...baseCtx(input, bot),
        reply,
        interaction: {} as never,
        params: input.params ?? {},
        fields: input.fields ?? {},
      };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run(ctx as never);
      return { replies, passedGuards: true };
    },
  };
}
