/**
 * Guards - composable, typed preconditions that run before a handler.
 *
 * A guard either passes or fails with a user-facing reason. Failing short-
 * circuits the pipeline and replies with the reason, so handlers only ever run
 * when their preconditions hold.
 *
 * @module guards
 */
import { PermissionsBitField, type PermissionResolvable } from "discord.js";
import comfort from "@ix-xs/node-comfort";
import type { BaseContext } from "./context.js";

/** The outcome of a guard check. */
export interface GuardResult {
  readonly ok: boolean;
  /** User-facing explanation when `ok` is false. */
  readonly reason?: string;
}

/** A guard's check function. */
export type GuardFn = (ctx: BaseContext) => GuardResult | Promise<GuardResult>;

/** A named, composable precondition. */
export interface Guard {
  readonly kind: "guard";
  readonly name: string;
  readonly run: GuardFn;
}

/** Signals a guard passed. */
export function pass(): GuardResult {
  return { ok: true };
}
/** Signals a guard failed, with a user-facing reason. */
export function fail(reason: string): GuardResult {
  return { ok: false, reason };
}

/**
 * Creates a named guard.
 * @example
 * export const isPremium = guard("isPremium", async (ctx) =>
 *   (await ctx.services.billing.isPremium(ctx.guildId)) ? pass() : fail("Premium only."));
 */
export function guard(name: string, run: GuardFn): Guard {
  return { kind: "guard", name, run };
}
guard.pass = pass;
guard.fail = fail;

/* ------------------------------ Built-in guards --------------------------- */

/** Requires the interaction to happen inside a guild. */
export function inGuild(): Guard {
  return guard("inGuild", (ctx) => (ctx.guild ? pass() : fail("This can only be used in a server.")));
}

/** Requires the interaction to happen in DMs. */
export function dmOnly(): Guard {
  return guard("dmOnly", (ctx) => (ctx.guild ? fail("This can only be used in DMs.") : pass()));
}

/** Requires the invoking member to have all of the given permissions. */
export function hasPermission(...permissions: PermissionResolvable[]): Guard {
  const needed = new PermissionsBitField(permissions);
  return guard("hasPermission", (ctx) => {
    if (!ctx.member) return fail("This can only be used in a server.");
    const perms = ctx.member.permissions;
    return perms.has(needed)
      ? pass()
      : fail(`You need: ${needed.toArray().join(", ")}.`);
  });
}

/** Requires the *bot* to have all of the given permissions in the guild. */
export function botHasPermission(...permissions: PermissionResolvable[]): Guard {
  const needed = new PermissionsBitField(permissions);
  return guard("botHasPermission", (ctx) => {
    const me = ctx.guild?.members.me;
    if (!me) return fail("I can't verify my permissions here.");
    return me.permissions.has(needed)
      ? pass()
      : fail(`I need: ${needed.toArray().join(", ")}.`);
  });
}

/** Restricts usage to specific channel ids. */
export function inChannel(...channelIds: string[]): Guard {
  const set = new Set(channelIds);
  return guard("inChannel", (ctx) =>
    ctx.channel && set.has(ctx.channel.id) ? pass() : fail("This can't be used in this channel."),
  );
}

/** Restricts usage to the given user ids (bot owners/admins). */
export function ownerOnly(...userIds: string[]): Guard {
  const set = new Set(userIds);
  return guard("ownerOnly", (ctx) => (set.has(ctx.user.id) ? pass() : fail("You can't use this.")));
}

/** Cooldown scope. */
export type CooldownScope = "user" | "guild" | "channel" | "global";

/**
 * Per-invocation cooldown. Each `cooldown()` owns its own timer map, so the
 * scope naturally applies per command/component it is attached to.
 *
 * @param duration A human duration like `"5s"`, `"2m"`, or milliseconds.
 * @param options  `scope` selects what to rate-limit by (default `"user"`).
 * @example guards: [cooldown("10s"), cooldown("1m", { scope: "guild" })]
 */
export function cooldown(duration: string | number, options: { scope?: CooldownScope } = {}): Guard {
  const ms = comfort.time.parseDuration(duration) ?? (typeof duration === "number" ? duration : 0);
  const scope = options.scope ?? "user";
  const hits = new Map<string, number>();

  return guard("cooldown", (ctx) => {
    const id =
      scope === "user"
        ? ctx.user.id
        : scope === "guild"
          ? (ctx.guildId ?? ctx.user.id)
          : scope === "channel"
            ? (ctx.channel?.id ?? ctx.user.id)
            : "global";

    const now = Date.now();
    const until = hits.get(id) ?? 0;
    if (now < until) {
      const remaining = Math.ceil((until - now) / 1000);
      return fail(`Please wait ${remaining}s before doing that again.`);
    }
    hits.set(id, now + ms);
    return pass();
  });
}
