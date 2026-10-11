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
  // Guilds
  guildCreate: [I.Guilds],
  guildDelete: [I.Guilds],
  guildUpdate: [I.Guilds],
  guildAvailable: [I.Guilds],
  guildUnavailable: [I.Guilds],
  channelCreate: [I.Guilds],
  channelDelete: [I.Guilds],
  channelUpdate: [I.Guilds],
  channelPinsUpdate: [I.Guilds],
  roleCreate: [I.Guilds],
  roleDelete: [I.Guilds],
  roleUpdate: [I.Guilds],
  threadCreate: [I.Guilds],
  threadDelete: [I.Guilds],
  threadUpdate: [I.Guilds],
  threadListSync: [I.Guilds],
  threadMemberUpdate: [I.Guilds],
  threadMembersUpdate: [I.Guilds],
  stageInstanceCreate: [I.Guilds],
  stageInstanceDelete: [I.Guilds],
  stageInstanceUpdate: [I.Guilds],
  // Members (privileged)
  guildMemberAdd: [I.GuildMembers],
  guildMemberRemove: [I.GuildMembers],
  guildMemberUpdate: [I.GuildMembers],
  guildMemberAvailable: [I.GuildMembers],
  guildMembersChunk: [I.GuildMembers],
  userUpdate: [I.GuildMembers],
  // Moderation
  guildBanAdd: [I.GuildModeration],
  guildBanRemove: [I.GuildModeration],
  guildAuditLogEntryCreate: [I.GuildModeration],
  // Expressions (emojis, stickers, soundboard)
  emojiCreate: [I.GuildExpressions],
  emojiDelete: [I.GuildExpressions],
  emojiUpdate: [I.GuildExpressions],
  stickerCreate: [I.GuildExpressions],
  stickerDelete: [I.GuildExpressions],
  stickerUpdate: [I.GuildExpressions],
  guildSoundboardSoundCreate: [I.GuildExpressions],
  guildSoundboardSoundDelete: [I.GuildExpressions],
  guildSoundboardSoundUpdate: [I.GuildExpressions],
  guildSoundboardSoundsUpdate: [I.GuildExpressions],
  // Integrations, webhooks, invites
  guildIntegrationsUpdate: [I.GuildIntegrations],
  webhooksUpdate: [I.GuildWebhooks],
  inviteCreate: [I.GuildInvites],
  inviteDelete: [I.GuildInvites],
  // Voice
  voiceStateUpdate: [I.GuildVoiceStates],
  voiceChannelEffectSend: [I.GuildVoiceStates],
  // Presence (privileged)
  presenceUpdate: [I.GuildPresences],
  // Messages
  messageCreate: [I.GuildMessages, I.MessageContent],
  messageUpdate: [I.GuildMessages],
  messageDelete: [I.GuildMessages],
  messageDeleteBulk: [I.GuildMessages],
  messageReactionAdd: [I.GuildMessageReactions],
  messageReactionRemove: [I.GuildMessageReactions],
  messageReactionRemoveAll: [I.GuildMessageReactions],
  messageReactionRemoveEmoji: [I.GuildMessageReactions],
  messagePollVoteAdd: [I.GuildMessagePolls],
  messagePollVoteRemove: [I.GuildMessagePolls],
  typingStart: [I.GuildMessageTyping],
  // Scheduled events
  guildScheduledEventCreate: [I.GuildScheduledEvents],
  guildScheduledEventUpdate: [I.GuildScheduledEvents],
  guildScheduledEventDelete: [I.GuildScheduledEvents],
  guildScheduledEventUserAdd: [I.GuildScheduledEvents],
  guildScheduledEventUserRemove: [I.GuildScheduledEvents],
  // Auto moderation
  autoModerationRuleCreate: [I.AutoModerationConfiguration],
  autoModerationRuleDelete: [I.AutoModerationConfiguration],
  autoModerationRuleUpdate: [I.AutoModerationConfiguration],
  autoModerationActionExecution: [I.AutoModerationExecution],
};

/** Which events imply which partials (needed to receive uncached objects). */
const EVENT_PARTIALS: Partial<Record<keyof ClientEvents, Partials[]>> = {
  messageReactionAdd: [Partials.Message, Partials.Channel, Partials.Reaction],
  messageReactionRemove: [Partials.Message, Partials.Channel, Partials.Reaction],
  messageReactionRemoveAll: [Partials.Message, Partials.Channel],
  messageReactionRemoveEmoji: [Partials.Message, Partials.Channel, Partials.Reaction],
  messagePollVoteAdd: [Partials.Message, Partials.Channel],
  messagePollVoteRemove: [Partials.Message, Partials.Channel],
  messageDelete: [Partials.Message],
  messageUpdate: [Partials.Message],
  guildMemberRemove: [Partials.GuildMember],
  guildScheduledEventUserAdd: [Partials.GuildScheduledEvent],
  guildScheduledEventUserRemove: [Partials.GuildScheduledEvent],
  typingStart: [Partials.Channel],
};

/** The privileged intents Discord gates behind Developer Portal toggles. */
const PRIVILEGED = new Set<GatewayIntentBits>([I.GuildMembers, I.GuildPresences, I.MessageContent]);

/** The names of the privileged intents found in a list. */
export function privilegedIn(intents: Iterable<GatewayIntentBits>): string[] {
  return [...new Set(intents)]
    .filter((intent) => PRIVILEGED.has(intent))
    .map((intent) => GatewayIntentBits[intent] ?? String(intent));
}

/** Result of {@link computeIntents}. */
export interface ComputedIntents {
  /** Gateway intents to pass to the discord.js `Client`. */
  intents: GatewayIntentBits[];
  /** Partials to pass to the discord.js `Client`. */
  partials: Partials[];
  /** Names of the privileged intents in use (surface these to users). */
  privileged: string[];
}

/** Fine-tunes the automatic selection without giving it up. */
export interface IntentAdjustments {
  /** Intents to request on top of the derived ones (e.g. `DirectMessages`). */
  add?: readonly GatewayIntentBits[];
  /**
   * Derived intents to drop. Typically `MessageContent`, when a `messageCreate`
   * listener does not read the text and you would rather not request a
   * privileged intent.
   */
  remove?: readonly GatewayIntentBits[];
}

/**
 * Derives the minimal set of intents and partials for the given events.
 * `Guilds` is always included so guild interactions are delivered.
 *
 * @param options.hasTriggers When true, adds the message intents (incl. the
 *   privileged `MessageContent`) so message triggers can read message content.
 * @param options.add / options.remove Adjust the derived set.
 */
export function computeIntents(
  events: readonly EventDefinition[],
  options: { hasTriggers?: boolean } & IntentAdjustments = {},
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

  for (const intent of options.add ?? []) intents.add(intent);
  for (const intent of options.remove ?? []) intents.delete(intent);

  // Direct messages arrive in channels that are never cached up front.
  if (intents.has(I.DirectMessages) || intents.has(I.DirectMessageReactions)) partials.add(Partials.Channel);

  return { intents: [...intents], partials: [...partials], privileged: privilegedIn(intents) };
}
