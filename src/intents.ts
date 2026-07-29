/**
 * Intent & partial autopilot.
 *
 * Forgetting an intent is the classic "my event never fires" bug. When
 * `intents: "auto"`, the framework derives the exact gateway intents (and the
 * partials needed to receive uncached objects) from the events you actually
 * registered - and warns you when a privileged intent is required.
 *
 * @module intents
 */
import { GatewayIntentBits, Partials, type ClientEvents } from "discord.js";
import type { EventDefinition } from "./definitions.js";

const I = GatewayIntentBits;

/** Maps each event to the gateway intents required to receive it. */
const EVENT_INTENTS: Partial<Record<keyof ClientEvents, GatewayIntentBits[]>> = {
  guildCreate: [I.Guilds],
  guildDelete: [I.Guilds],
  guildUpdate: [I.Guilds],
  channelCreate: [I.Guilds],
  channelDelete: [I.Guilds],
  channelUpdate: [I.Guilds],
  roleCreate: [I.Guilds],
  roleDelete: [I.Guilds],
  roleUpdate: [I.Guilds],
  threadCreate: [I.Guilds],
  threadDelete: [I.Guilds],
  threadUpdate: [I.Guilds],
  guildMemberAdd: [I.GuildMembers],
  guildMemberRemove: [I.GuildMembers],
  guildMemberUpdate: [I.GuildMembers],
  guildMemberAvailable: [I.GuildMembers],
  guildBanAdd: [I.GuildModeration],
  guildBanRemove: [I.GuildModeration],
  guildAuditLogEntryCreate: [I.GuildModeration],
  emojiCreate: [I.GuildEmojisAndStickers],
  emojiDelete: [I.GuildEmojisAndStickers],
  emojiUpdate: [I.GuildEmojisAndStickers],
  stickerCreate: [I.GuildEmojisAndStickers],
  stickerDelete: [I.GuildEmojisAndStickers],
  guildIntegrationsUpdate: [I.GuildIntegrations],
  webhooksUpdate: [I.GuildWebhooks],
  inviteCreate: [I.GuildInvites],
  inviteDelete: [I.GuildInvites],
  voiceStateUpdate: [I.GuildVoiceStates],
  presenceUpdate: [I.GuildPresences],
  messageCreate: [I.GuildMessages, I.MessageContent],
  messageUpdate: [I.GuildMessages],
  messageDelete: [I.GuildMessages],
  messageDeleteBulk: [I.GuildMessages],
  messageReactionAdd: [I.GuildMessageReactions],
  messageReactionRemove: [I.GuildMessageReactions],
  messageReactionRemoveAll: [I.GuildMessageReactions],
  messageReactionRemoveEmoji: [I.GuildMessageReactions],
  typingStart: [I.GuildMessageTyping],
  guildScheduledEventCreate: [I.GuildScheduledEvents],
  guildScheduledEventUpdate: [I.GuildScheduledEvents],
  guildScheduledEventDelete: [I.GuildScheduledEvents],
  guildScheduledEventUserAdd: [I.GuildScheduledEvents],
  guildScheduledEventUserRemove: [I.GuildScheduledEvents],
};

/** Which events imply which partials (needed to receive uncached objects). */
const EVENT_PARTIALS: Partial<Record<keyof ClientEvents, Partials[]>> = {
  messageReactionAdd: [Partials.Message, Partials.Channel, Partials.Reaction],
  messageReactionRemove: [Partials.Message, Partials.Channel, Partials.Reaction],
  messageDelete: [Partials.Message],
  messageUpdate: [Partials.Message],
  guildMemberRemove: [Partials.GuildMember],
  typingStart: [Partials.Channel],
};

/** The privileged intents Discord gates behind Developer Portal toggles. */
const PRIVILEGED = new Set<GatewayIntentBits>([I.GuildMembers, I.GuildPresences, I.MessageContent]);

/** Result of {@link computeIntents}. */
export interface ComputedIntents {
  /** Gateway intents to pass to the discord.js `Client`. */
  intents: GatewayIntentBits[];
  /** Partials to pass to the discord.js `Client`. */
  partials: Partials[];
  /** Names of privileged intents that were auto-enabled (surface these to users). */
  privileged: string[];
}

/**
 * Derives the minimal set of intents and partials for the given events.
 * `Guilds` is always included so guild interactions are delivered.
 *
 * @param options.hasTriggers When true, adds the message intents (incl. the
 *   privileged `MessageContent`) so message triggers can read message content.
 */
export function computeIntents(
  events: readonly EventDefinition[],
  options: { hasTriggers?: boolean } = {},
): ComputedIntents {
  const intents = new Set<GatewayIntentBits>([I.Guilds]);
  const partials = new Set<Partials>();

  for (const { event } of events) {
    for (const intent of EVENT_INTENTS[event] ?? []) intents.add(intent);
    for (const partial of EVENT_PARTIALS[event] ?? []) partials.add(partial);
  }

  if (options.hasTriggers) {
    intents.add(I.GuildMessages);
    intents.add(I.MessageContent);
    intents.add(I.DirectMessages);
    partials.add(Partials.Channel);
    partials.add(Partials.Message);
  }

  const privileged = [...intents]
    .filter((intent) => PRIVILEGED.has(intent))
    .map((intent) => GatewayIntentBits[intent] ?? String(intent));

  return { intents: [...intents], partials: [...partials], privileged };
}
