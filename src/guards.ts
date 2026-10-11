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
import { messageFor } from "./messages.js";

/** The outcome of a guard check. */
export interface GuardResult {
  /** Whether the handler may run. */
  readonly ok: boolean;
  /** User-facing explanation when `ok` is false. */
  readonly reason?: string;
}

/** A guard's check function. */
export type GuardFn = (ctx: BaseContext) => GuardResult | Promise<GuardResult>;

/** A named, composable precondition. */
export interface Guard {
  /** Marks the object as a guard. */
  readonly kind: "guard";
  /** The guard's name, shown in logs and in test results. */
  readonly name: string;
  /** The check itself. */
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

/* ------------------------------ Combinators ------------------------------ */

/**
 * Passes when **at least one** of the given guards passes. When they all fail,
 * the reason of the last one is shown.
 * @example guards: [anyOf(ownerOnly(), hasPermission(PermissionFlagsBits.ManageGuild))]
 */
export function anyOf(...guards: Guard[]): Guard {
  return guard(`anyOf(${guards.map((g) => g.name).join(", ")})`, async (ctx) => {
    let last: GuardResult = fail(messageFor(ctx, "guardDenied"));
    for (const candidate of guards) {
      last = await candidate.run(ctx);
      if (last.ok) return last;
    }
    return last;
  });
}

/**
 * Inverts a guard: passes when it fails. `reason` is what the user sees when
 * the inner guard passes (and this one therefore fails).
 * @example guards: [not(inChannel(spamChannelId), "Not in this channel, please.")]
 */
export function not(inner: Guard, reason?: string): Guard {
  return guard(`not(${inner.name})`, async (ctx) =>
    (await inner.run(ctx)).ok ? fail(reason ?? messageFor(ctx, "guardDenied")) : pass(),
  );
}

/* ------------------------------ Built-in guards --------------------------- */

/** `"BanMembers"` → `"Ban Members"`, so permission lists read naturally. */
function readable(permissions: readonly string[]): string {
  return permissions.map((name) => name.replace(/([a-z])([A-Z])/g, "$1 $2")).join(", ");
}

/** The permissions from `needed` that `held` lacks. */
function missingFrom(held: unknown, needed: PermissionsBitField): string[] {
  const bitfield = held as { has?(p: PermissionsBitField): boolean; missing?(p: PermissionsBitField): string[] };
  if (typeof bitfield.missing === "function") return bitfield.missing(needed);
  return bitfield.has?.(needed) ? [] : needed.toArray();
}

/** Requires the interaction to happen inside a guild. */
export function inGuild(): Guard {
  return guard("inGuild", (ctx) => (ctx.guildId ? pass() : fail(messageFor(ctx, "guildOnly"))));
}

/** Requires the interaction to happen in DMs. */
export function dmOnly(): Guard {
  return guard("dmOnly", (ctx) => (ctx.guildId ? fail(messageFor(ctx, "dmOnly")) : pass()));
}

/**
 * Requires the invoking member to have all of the given permissions **in the
 * current channel** (channel overwrites included, as computed by Discord).
 */
export function hasPermission(...permissions: PermissionResolvable[]): Guard {
  const needed = new PermissionsBitField(permissions);
  return guard("hasPermission", (ctx) => {
    // `memberPermissions` is resolved by Discord for the interaction's channel;
    // the member's own bitfield only knows the guild-wide roles.
    const held = ctx.interaction?.memberPermissions ?? ctx.member?.permissions;
    if (!held) return fail(messageFor(ctx, "guildOnly"));
    const missing = missingFrom(held, needed);
    return missing.length === 0
      ? pass()
      : fail(messageFor(ctx, "missingPermissions", { permissions: readable(missing) }));
  });
}

/**
 * Requires the *bot* to have all of the given permissions **in the current
 * channel** (channel overwrites included, as computed by Discord).
 */
export function botHasPermission(...permissions: PermissionResolvable[]): Guard {
  const needed = new PermissionsBitField(permissions);
  return guard("botHasPermission", (ctx) => {
    const held = ctx.interaction?.appPermissions ?? ctx.guild?.members?.me?.permissions;
    if (!held) return fail(messageFor(ctx, "guildOnly"));
    const missing = missingFrom(held, needed);
    return missing.length === 0
      ? pass()
      : fail(messageFor(ctx, "botMissingPermissions", { permissions: readable(missing) }));
  });
}

/** Restricts usage to specific channel ids. */
export function inChannel(...channelIds: string[]): Guard {
  const set = new Set(channelIds);
  return guard("inChannel", (ctx) => {
    const id = ctx.channelId ?? ctx.channel?.id;
    return id && set.has(id) ? pass() : fail(messageFor(ctx, "wrongChannel"));
  });
}

/** Requires the invoking member to hold **at least one** of the given roles. */
export function hasRole(...roleIds: string[]): Guard {
  return guard("hasRole", (ctx) => {
    const roles = ctx.member?.roles?.cache;
    return roles && roleIds.some((id) => roles.has(id)) ? pass() : fail(messageFor(ctx, "missingRole"));
  });
}

/** Restricts usage to the owner of the server the interaction happens in. */
export function guildOwnerOnly(): Guard {
  return guard("guildOwnerOnly", (ctx) =>
    ctx.guild && ctx.guild.ownerId === ctx.user.id ? pass() : fail(messageFor(ctx, "guildOwnerOnly")),
  );
}

/**
 * Restricts usage to specific user ids. Pass ids explicitly, or call `ownerOnly()`
 * with no arguments to use the owners from `defineBot({ owners })`.
 */
export function ownerOnly(...userIds: string[]): Guard {
  const explicit = new Set(userIds);
  return guard("ownerOnly", (ctx) => {
    const owners = explicit.size > 0 ? explicit : new Set(ctx.owners ?? []);
    return owners.has(ctx.user.id) ? pass() : fail(messageFor(ctx, "ownerOnly"));
  });
}

/** Cooldown scope. */
export type CooldownScope = "user" | "guild" | "channel" | "global";

/** Resolves the key a scoped limiter counts by. */
export function scopeKey(ctx: BaseContext, scope: CooldownScope): string {
  switch (scope) {
    case "user":
      return ctx.user.id;
    case "guild":
      return ctx.guildId ?? ctx.user.id;
    case "channel":
      return ctx.channelId ?? ctx.channel?.id ?? ctx.user.id;
    default:
      return "global";
  }
}

/** How many checks between two sweeps of expired cooldown entries. */
const SWEEP_EVERY = 1000;

/**
 * Per-invocation cooldown. Each `cooldown()` owns its own timer map, so the
 * scope naturally applies per command/component it is attached to.
 *
 * @param duration A human duration like `"5s"`, `"2m"`, or milliseconds.
 * @param options  `scope` selects what to rate-limit by (default `"user"`).
 * @example guards: [cooldown("10s"), cooldown("1m", { scope: "guild" })]
 */
export function cooldown(
  duration: string | number,
  options: {
    /** What shares one cooldown: each user, each guild, each channel or everyone. Default `"user"`. */
    scope?: CooldownScope;
  } = {},
): Guard {
  const ms = comfort.time.parseDuration(duration) ?? (typeof duration === "number" ? duration : 0);
  const scope = options.scope ?? "user";
  const hits = new Map<string, number>();
  let checks = 0;

  return guard("cooldown", (ctx) => {
    const now = Date.now();
    // Without this, every user who ever ran the command would stay in the map
    // for the lifetime of the process.
    if (++checks % SWEEP_EVERY === 0) {
      for (const [key, until] of hits) if (now >= until) hits.delete(key);
    }

    const id = scopeKey(ctx, scope);
    const until = hits.get(id) ?? 0;
    if (now < until) {
      return fail(messageFor(ctx, "cooldown", { seconds: Math.ceil((until - now) / 1000) }));
    }
    hits.set(id, now + ms);
    return pass();
  });
}
