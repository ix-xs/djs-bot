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
import { PermissionsBitField, type PermissionResolvable } from "discord.js";
import { createLogger } from "./logger.js";
import type { ServiceMap } from "./container.js";
import type { Bot } from "./bot.js";
import type { AutocompleteChoice, ReplyFn, ShowModalFn, UpdateFn } from "./context.js";
import type {
  ButtonDefinition,
  CommandDefinition,
  JobDefinition,
  MessageCommandDefinition,
  ModalDefinition,
  SelectRoutable,
  UserCommandDefinition,
} from "./definitions.js";
import type { Guard } from "./guards.js";
import { renderMessage, type FrameworkMessages } from "./messages.js";

/** A single captured response produced by a handler under test. */
export interface CapturedReply {
  type:
    | "reply"
    | "success"
    | "error"
    | "info"
    | "warn"
    | "ephemeral"
    | "defer"
    | "followUp"
    | "editReply"
    | "delete"
    | "update"
    | "update:disable"
    | "modal";
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
  /** Provide a fake channel id (default none). */
  channelId?: string;
  /** Services available as `ctx.services` (overrides the bot's, if any). */
  services?: Partial<ServiceMap>;
  /** The user's locale for `ctx.locale` (default `"en"`). */
  locale?: string;
  /** Bot owner ids for `ctx.owners` (so `ownerOnly()` can be tested). */
  owners?: string[];
  /**
   * The permissions the invoking member holds, to exercise `hasPermission()`.
   * Default: every permission.
   */
  permissions?: PermissionResolvable[];
  /**
   * The permissions the bot holds, to exercise `botHasPermission()`.
   * Default: every permission.
   */
  botPermissions?: PermissionResolvable[];
  /** Role ids the invoking member holds, to exercise `hasRole()`. */
  roles?: string[];
  /** Framework message overrides, as in `defineBot({ messages })`. */
  messages?: FrameworkMessages;
  /** Extra fields merged into the fake `ctx.interaction`. */
  interaction?: Record<string, unknown>;
  /** Run the definition's guards before the handler (default `true`). */
  runGuards?: boolean;
}

function captureResponders() {
  const replies: CapturedReply[] = [];
  const push =
    (type: CapturedReply["type"]) =>
    (content?: unknown): Promise<void> => {
      replies.push(content === undefined ? { type } : { type, content });
      return Promise.resolve();
    };

  const reply = push("reply") as unknown as ReplyFn;
  reply.success = push("success");
  reply.error = push("error");
  reply.info = push("info");
  reply.warn = push("warn");
  reply.ephemeral = push("ephemeral");
  reply.defer = () => push("defer")();
  reply.followUp = push("followUp");
  reply.editReply = push("editReply");
  reply.delete = () => push("delete")();
  reply.fetch = () => Promise.resolve({ id: "test-reply" } as never);

  const update = push("update") as unknown as UpdateFn;
  update.disable = () => push("update:disable")();
  update.defer = () => push("defer")();

  const showModal = ((modal: { build(...args: unknown[]): unknown }, ...args: unknown[]) => {
    replies.push({ type: "modal", content: modal.build(...args) });
    return Promise.resolve();
  }) as unknown as ShowModalFn;

  return { replies, reply, update, showModal };
}

function baseCtx(input: BaseInput, bot?: Bot) {
  const userId = input.userId ?? "test-user";
  const user = { id: userId, username: userId, tag: `${userId}#0000`, toString: () => `<@${userId}>` };
  const services = (input.services ?? (bot ? bot.container.view() : {})) as ServiceMap;
  const memberPermissions = new PermissionsBitField(input.permissions ?? PermissionsBitField.All);
  const appPermissions = new PermissionsBitField(input.botPermissions ?? PermissionsBitField.All);
  const roles = new Set(input.roles ?? []);
  const messages = input.messages ?? bot?.config.messages;
  const inGuild = Boolean(input.guildId);

  const ctx = {
    client: {} as never,
    user: user as never,
    guild: inGuild ? ({ id: input.guildId, ownerId: undefined } as never) : null,
    guildId: input.guildId ?? null,
    channel: input.channelId ? ({ id: input.channelId } as never) : null,
    channelId: input.channelId ?? null,
    member: inGuild
      ? ({ id: userId, permissions: memberPermissions, roles: { cache: { has: (id: string) => roles.has(id) } } } as never)
      : null,
    services,
    logger: createLogger({ level: "silent" }),
    correlationId: "test",
    locale: input.locale ?? "en",
    owners: input.owners ?? bot?.config.owners ?? [],
    t: (key: string) => key,
    say: (key: string, vars?: unknown) => renderMessage(messages, key as never, (vars ?? {}) as never),
    audit: async () => undefined,
    interaction: {
      memberPermissions: inGuild ? memberPermissions : null,
      appPermissions,
      ...input.interaction,
    } as never,
  };
  return ctx;
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
  /**
   * Invokes a slash command handler. Pass `options` matching the command's
   * schema, and `subcommand` (plus `group`) to target one leaf of a command
   * built from subcommands.
   */
  command(
    def: CommandDefinition,
    input?: BaseInput & { options?: Record<string, unknown>; subcommand?: string; group?: string },
  ): Promise<HarnessResult>;
  /** Invokes a user context-menu command on a target user. */
  userCommand(
    def: UserCommandDefinition,
    input?: BaseInput & { targetUser?: unknown; targetMember?: unknown },
  ): Promise<HarnessResult>;
  /** Invokes a message context-menu command on a target message. */
  messageCommand(def: MessageCommandDefinition, input?: BaseInput & { targetMessage?: unknown }): Promise<HarnessResult>;
  /** Invokes a button handler with typed params. */
  button(def: ButtonDefinition, input?: BaseInput & { params?: Record<string, unknown> }): Promise<HarnessResult>;
  /** Invokes a select-menu handler (string or native). */
  select(
    def: SelectRoutable,
    input?: BaseInput & {
      params?: Record<string, unknown>;
      values?: string[];
      users?: unknown;
      members?: unknown;
      roles?: unknown;
      channels?: unknown;
    },
  ): Promise<HarnessResult>;
  /** Invokes a modal handler with submitted field values. */
  modal(
    def: ModalDefinition,
    input?: BaseInput & { fields?: Record<string, unknown>; params?: Record<string, unknown> },
  ): Promise<HarnessResult>;
  /**
   * Runs an option's autocomplete handler and returns the choices it produced
   * (already mapped and capped at 25, as the router does).
   */
  autocomplete(
    def: CommandDefinition,
    input: Pick<BaseInput, "userId" | "guildId" | "services" | "locale"> & {
      option: string;
      value?: string;
      subcommand?: string;
      group?: string;
    },
  ): Promise<AutocompleteChoice[]>;
  /** Runs a job once, with the bot's services (or the ones you pass). */
  job(def: JobDefinition, input?: { services?: Partial<ServiceMap>; signal?: AbortSignal }): Promise<void>;
}

/** Finds the subcommand a harness call targets. */
function pickSubcommand(def: CommandDefinition, subcommand?: string, group?: string) {
  if (!subcommand) return undefined;
  const sub = group ? def.groups?.[group]?.subcommands[subcommand] : def.subcommands?.[subcommand];
  if (!sub) {
    throw new Error(`Command "${def.name}" has no subcommand "${[group, subcommand].filter(Boolean).join(" ")}".`);
  }
  return sub;
}

/**
 * Creates a test harness. Pass a loaded {@link Bot} to reuse its services, or
 * omit it and inject services per call.
 */
export function createHarness(bot?: Bot): Harness {
  return {
    async command(def, input = {}) {
      const { replies, reply, showModal } = captureResponders();
      const sub = pickSubcommand(def, input.subcommand, input.group);
      const ctx = { ...baseCtx(input, bot), reply, showModal, options: input.options ?? {} };
      const guards = sub ? [...def.guards, ...sub.guards] : def.guards;
      const gate = await runGuards(guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      if (sub) await sub.run(ctx as never);
      else await def.run?.(ctx as never);
      return { replies, passedGuards: true };
    },
    async userCommand(def, input = {}) {
      const { replies, reply, showModal } = captureResponders();
      const ctx = {
        ...baseCtx(input, bot),
        reply,
        showModal,
        targetUser: input.targetUser ?? { id: "target-user" },
        targetMember: input.targetMember ?? null,
      };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run(ctx as never);
      return { replies, passedGuards: true };
    },
    async messageCommand(def, input = {}) {
      const { replies, reply, showModal } = captureResponders();
      const ctx = {
        ...baseCtx(input, bot),
        reply,
        showModal,
        targetMessage: input.targetMessage ?? { id: "target-message", content: "" },
      };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run(ctx as never);
      return { replies, passedGuards: true };
    },
    async button(def, input = {}) {
      const { replies, reply, update, showModal } = captureResponders();
      const ctx = { ...baseCtx(input, bot), reply, update, showModal, params: input.params ?? {} };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run(ctx as never);
      return { replies, passedGuards: true };
    },
    async select(def, input = {}) {
      const { replies, reply, update, showModal } = captureResponders();
      const ctx = {
        ...baseCtx(input, bot),
        reply,
        update,
        showModal,
        params: input.params ?? {},
        values: input.values ?? [],
        users: input.users,
        members: input.members,
        roles: input.roles,
        channels: input.channels,
      };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run(ctx as never);
      return { replies, passedGuards: true };
    },
    async modal(def, input = {}) {
      const { replies, reply } = captureResponders();
      const ctx = {
        ...baseCtx(input, bot),
        reply,
        params: input.params ?? {},
        fields: input.fields ?? {},
      };
      const gate = await runGuards(def.guards, ctx, input.runGuards ?? true);
      if (!gate.ok) return { replies, passedGuards: false, rejectionReason: gate.reason };
      await def.run(ctx as never);
      return { replies, passedGuards: true };
    },
    async autocomplete(def, input) {
      const sub = pickSubcommand(def, input.subcommand, input.group);
      const options = sub ? sub.options : def.options;
      const handler = options[input.option]?.config.autocomplete;
      if (typeof handler !== "function") {
        throw new Error(`Option "${input.option}" of "${def.name}" has no autocomplete handler.`);
      }
      const base = baseCtx(input, bot);
      const result = await (handler as (ctx: unknown) => unknown)({
        interaction: {},
        client: base.client,
        user: base.user,
        guild: base.guild,
        services: base.services,
        logger: base.logger,
        focused: input.option,
        value: input.value ?? "",
        locale: base.locale,
        t: base.t,
      });
      const list = Array.isArray(result) ? result : [];
      return list
        .map((item) =>
          typeof item === "object" && item !== null
            ? (item as AutocompleteChoice)
            : { name: String(item), value: item as string | number },
        )
        .slice(0, 25);
    },
    async job(def, input = {}) {
      await def.run({
        client: {} as never,
        services: (input.services ?? (bot ? bot.container.view() : {})) as ServiceMap,
        logger: createLogger({ level: "silent" }),
        signal: input.signal ?? new AbortController().signal,
        correlationId: "test",
      });
    },
  };
}
