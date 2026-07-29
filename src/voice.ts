/**
 * Lightweight voice-state helpers - inspect and move members between voice
 * channels using the gateway/REST only. This does **not** pull in
 * `@discordjs/voice`; it's for moderation/utility, not audio playback.
 *
 * @module voice
 */
import type { Collection, GuildMember, VoiceBasedChannel } from "discord.js";

/** Voice-state helpers. */
export const voice = {
  /** The voice channel a member is connected to, or `null`. */
  channelOf(member: GuildMember): VoiceBasedChannel | null {
    return member.voice.channel;
  },

  /** Whether a member is connected to any voice channel. */
  isConnected(member: GuildMember): boolean {
    return member.voice.channel !== null;
  },

  /** The members currently in a voice channel. */
  membersIn(channel: VoiceBasedChannel): Collection<string, GuildMember> {
    return channel.members;
  },

  /** Moves a member to a voice channel (or `null` to disconnect). */
  move(member: GuildMember, channel: VoiceBasedChannel | null): Promise<GuildMember> {
    return member.voice.setChannel(channel);
  },

  /** Disconnects a member from voice. */
  disconnect(member: GuildMember): Promise<GuildMember> {
    return member.voice.disconnect();
  },

  /** Server-mutes or unmutes a member. */
  mute(member: GuildMember, muted = true, reason?: string): Promise<GuildMember> {
    return member.voice.setMute(muted, reason);
  },

  /** Server-deafens or undeafens a member. */
  deafen(member: GuildMember, deafened = true, reason?: string): Promise<GuildMember> {
    return member.voice.setDeaf(deafened, reason);
  },
};
