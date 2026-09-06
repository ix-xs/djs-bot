---
title: "A moderation bot"
description: "Ban, kick, timeout, warn and a warning history, with guards, audit and confirmation."
sidebar:
  order: 1
---

A complete moderation feature you can copy into `features/moderation/`. It shows
guards, permission layering, the audit trail, a confirmation dialog and a store
namespace working together.

## What it does

| Command | Behaviour |
| --- | --- |
| `/ban` | Bans a member after a confirmation dialog, records an audit entry |
| `/kick` | Kicks a member |
| `/timeout` | Times a member out for a duration |
| `/warn` | Stores a warning and DMs the member |
| `/warnings` | Lists a member warnings, paginated |

## Shared guards

Every command here needs the same three things: a guild, the moderator
permission, and the bot own permission. Declare that once.

```ts title="features/moderation/guards.ts"
import { inGuild, hasPermission, botHasPermission, PermissionFlagsBits } from "@ix-xs/djs-bot";

export const canBan = [
  inGuild(),
  hasPermission(PermissionFlagsBits.BanMembers),
  botHasPermission(PermissionFlagsBits.BanMembers),
];

export const canKick = [
  inGuild(),
  hasPermission(PermissionFlagsBits.KickMembers),
  botHasPermission(PermissionFlagsBits.KickMembers),
];

export const canModerate = [
  inGuild(),
  hasPermission(PermissionFlagsBits.ModerateMembers),
  botHasPermission(PermissionFlagsBits.ModerateMembers),
];
```

`botHasPermission` is the one people forget. Without it, a missing bot
permission makes the command look broken instead of explaining itself.

## A shared safety check

Never let a moderator act on someone above them, on themselves, or on the bot.

```ts title="features/moderation/checks.ts"
import type { CommandContext } from "@ix-xs/djs-bot";
import type { GuildMember } from "discord.js";

/** Returns a refusal message, or null when the action is allowed. */
export function refuse(ctx: CommandContext<unknown>, target: GuildMember | null): string | null {
  if (!target) return "That user is not in this server.";
  if (target.id === ctx.user.id) return "You cannot do that to yourself.";
  if (target.id === ctx.client.user.id) return "I am not doing that to myself.";
  if (target.id === ctx.guild!.ownerId) return "I cannot act on the server owner.";

  const me = ctx.guild!.members.me!;
  if (target.roles.highest.position >= me.roles.highest.position) {
    return "My highest role is not above theirs, so I cannot act on them.";
  }
  if (
    ctx.member!.roles.highest.position <= target.roles.highest.position &&
    ctx.user.id !== ctx.guild!.ownerId
  ) {
    return "You cannot act on someone with a role equal to or above yours.";
  }
  return null;
}
```

## `/ban`

```ts title="features/moderation/ban.command.ts"
import { defineCommand, s, confirm, PermissionFlagsBits } from "@ix-xs/djs-bot";
import { canBan } from "./guards.js";
import { refuse } from "./checks.js";

export default defineCommand({
  name: "ban",
  description: "Ban a member from the server",
  guards: canBan,
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  options: {
    member: s.member({ description: "Who to ban", required: true }),
    reason: s.string({ description: "Why", maxLength: 400 }),
    days: s.integer({ description: "Days of messages to delete", min: 0, max: 7 }),
  },

  async run(ctx) {
    const { member, reason, days } = ctx.options;

    const problem = refuse(ctx, member);
    if (problem) return ctx.reply.error(problem);

    const ok = await confirm(ctx, {
      content: `Ban **${member.user.tag}**?${reason ? `\nReason: ${reason}` : ""}`,
      confirmLabel: "Ban",
    });
    if (!ok) return;

    // Tell them before the ban, since afterwards we share no server with them.
    await member.send(`You were banned from **${ctx.guild!.name}**.${reason ? ` Reason: ${reason}` : ""}`)
      .catch(() => undefined);

    await ctx.guild!.members.ban(member, {
      reason: `${ctx.user.tag}: ${reason ?? "no reason given"}`,
      deleteMessageSeconds: (days ?? 0) * 86_400,
    });

    await ctx.audit("member.ban", { targetId: member.id, metadata: { reason } });

    return ctx.reply.success(`Banned **${member.user.tag}**.`, { ephemeral: false });
  },
});
```

Three details worth copying: DM **before** the ban, pass a reason Discord itself
will show in its audit log, and record your own audit entry so `/warnings` and
dashboards can read it back.

## `/kick`

```ts title="features/moderation/kick.command.ts"
import { defineCommand, s, PermissionFlagsBits } from "@ix-xs/djs-bot";
import { canKick } from "./guards.js";
import { refuse } from "./checks.js";

export default defineCommand({
  name: "kick",
  description: "Kick a member from the server",
  guards: canKick,
  defaultMemberPermissions: PermissionFlagsBits.KickMembers,
  options: {
    member: s.member({ description: "Who to kick", required: true }),
    reason: s.string({ description: "Why", maxLength: 400 }),
  },

  async run(ctx) {
    const problem = refuse(ctx, ctx.options.member);
    if (problem) return ctx.reply.error(problem);

    await ctx.options.member.kick(`${ctx.user.tag}: ${ctx.options.reason ?? "no reason given"}`);
    await ctx.audit("member.kick", { targetId: ctx.options.member.id });

    return ctx.reply.success(`Kicked **${ctx.options.member.user.tag}**.`, { ephemeral: false });
  },
});
```

## `/timeout`

Discord caps a timeout at 28 days.

```ts title="features/moderation/timeout.command.ts"
import { defineCommand, s, timestamp, TimestampStyles, PermissionFlagsBits } from "@ix-xs/djs-bot";
import { canModerate } from "./guards.js";
import { refuse } from "./checks.js";

const MAX_MINUTES = 28 * 24 * 60;

export default defineCommand({
  name: "timeout",
  description: "Temporarily mute a member",
  guards: canModerate,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  options: {
    member: s.member({ description: "Who to time out", required: true }),
    minutes: s.integer({ description: "For how long", required: true, min: 1, max: MAX_MINUTES }),
    reason: s.string({ description: "Why", maxLength: 400 }),
  },

  async run(ctx) {
    const { member, minutes, reason } = ctx.options;

    const problem = refuse(ctx, member);
    if (problem) return ctx.reply.error(problem);

    const until = Date.now() + minutes * 60_000;
    await member.timeout(minutes * 60_000, `${ctx.user.tag}: ${reason ?? "no reason given"}`);
    await ctx.audit("member.timeout", { targetId: member.id, metadata: { minutes, reason } });

    return ctx.reply.success(
      `**${member.user.tag}** is muted until ${timestamp(until, TimestampStyles.RelativeTime)}.`,
      { ephemeral: false },
    );
  },
});
```

Pass `0` to `member.timeout()` to lift one early.

## `/warn` and warning storage

Warnings live in their own store namespace, so nothing else can collide with
them or wipe them.

```ts title="features/moderation/warnings.service.ts"
import { defineService, type KVStore } from "@ix-xs/djs-bot";

export interface Warning {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  at: number;
}

export class Warnings {
  private readonly ns: KVStore<Warning[]>;

  constructor(store: KVStore) {
    this.ns = store.namespace<Warning[]>("warnings");
  }

  private key(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
  }

  async add(warning: Omit<Warning, "id" | "at">): Promise<Warning> {
    const entry: Warning = { ...warning, id: crypto.randomUUID().slice(0, 8), at: Date.now() };
    const key = this.key(warning.guildId, warning.userId);
    const all = (await this.ns.get(key)) ?? [];
    all.push(entry);
    await this.ns.set(key, all);
    return entry;
  }

  async list(guildId: string, userId: string): Promise<Warning[]> {
    return (await this.ns.get(this.key(guildId, userId))) ?? [];
  }

  async clear(guildId: string, userId: string): Promise<void> {
    await this.ns.delete(this.key(guildId, userId));
  }
}

export default defineService("warnings", {
  deps: ["store"],
  factory: ({ store }) => new Warnings(store as KVStore),
});
```

Add the token to your service map so it is typed everywhere:

```ts title="src/types.d.ts"
import type { Warnings } from "./features/moderation/warnings.service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap { warnings: Warnings }
}
```

```ts title="features/moderation/warn.command.ts"
import { defineCommand, s, PermissionFlagsBits } from "@ix-xs/djs-bot";
import { canModerate } from "./guards.js";
import { refuse } from "./checks.js";

export default defineCommand({
  name: "warn",
  description: "Warn a member",
  guards: canModerate,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  options: {
    member: s.member({ description: "Who to warn", required: true }),
    reason: s.string({ description: "Why", required: true, maxLength: 400 }),
  },

  async run(ctx) {
    const { member, reason } = ctx.options;

    const problem = refuse(ctx, member);
    if (problem) return ctx.reply.error(problem);

    const warning = await ctx.services.warnings.add({
      guildId: ctx.guildId!,
      userId: member.id,
      moderatorId: ctx.user.id,
      reason,
    });

    const total = (await ctx.services.warnings.list(ctx.guildId!, member.id)).length;

    await member.send(`You were warned in **${ctx.guild!.name}**: ${reason}`).catch(() => undefined);
    await ctx.audit("member.warn", { targetId: member.id, metadata: { reason, warningId: warning.id } });

    return ctx.reply.success(
      `Warned **${member.user.tag}**. They now have ${total} warning${total === 1 ? "" : "s"}.`,
      { ephemeral: false },
    );
  },
});
```

## `/warnings`, paginated

```ts title="features/moderation/warnings.command.ts"
import {
  defineCommand, s, paginate, EmbedBuilder, Colors,
  timestamp, TimestampStyles, PermissionFlagsBits,
} from "@ix-xs/djs-bot";
import { canModerate } from "./guards.js";

const PER_PAGE = 5;

export default defineCommand({
  name: "warnings",
  description: "Show a member warnings",
  guards: canModerate,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  options: {
    user: s.user({ description: "Whose warnings", required: true }),
  },

  async run(ctx) {
    const all = await ctx.services.warnings.list(ctx.guildId!, ctx.options.user.id);
    if (all.length === 0) return ctx.reply.info(`**${ctx.options.user.tag}** has no warnings.`);

    const newestFirst = [...all].sort((a, b) => b.at - a.at);
    const pageCount = Math.ceil(newestFirst.length / PER_PAGE);

    await paginate(ctx, {
      count: pageCount,
      ephemeral: true,
      pages: (index) => {
        const slice = newestFirst.slice(index * PER_PAGE, index * PER_PAGE + PER_PAGE);
        return new EmbedBuilder()
          .setTitle(`Warnings for ${ctx.options.user.tag}`)
          .setColor(Colors.Yellow)
          .setDescription(
            slice
              .map((w) =>
                `\`${w.id}\` ${timestamp(w.at, TimestampStyles.RelativeTime)} by <@${w.moderatorId}>\n${w.reason}`,
              )
              .join("\n\n"),
          )
          .setFooter({ text: `${newestFirst.length} total` });
      },
    });
  },
});
```

## Wiring it up

```ts title="src/index.ts"
import { defineBot, env, sqliteStore, loggerAuditSink } from "@ix-xs/djs-bot";

const store = sqliteStore("data/bot.sqlite");

export default defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env("DISCORD_CLIENT_ID"),
  features: "./features",
  intents: "auto",
  store,
  audit: { sinks: [loggerAuditSink()], autoRecordCommands: true },
});
```

`intents: "auto"` adds `GuildMembers` for you because `s.member` and the
moderation calls need it. Remember to enable the **Server Members Intent** in
the Developer Portal.

## Going further

- Add `cooldown("3s")` to every command so a moderator cannot spam-ban.
- Add a `/unban` with an `autocomplete` option listing the ban list.
- Log actions to a channel by adding a custom [audit sink](/djs-bot/api/audit/#a-custom-sink).
- Gate the whole feature with a [feature flag](/djs-bot/api/flags/) so a server
  can turn it off.
