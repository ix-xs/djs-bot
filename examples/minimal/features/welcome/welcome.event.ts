import { defineEvent } from "../../../../src/index.js";

/**
 * Because this event exists, the `GuildMembers` privileged intent is added
 * automatically (with a warning telling you to enable it in the portal).
 */
export default defineEvent("guildMemberAdd", async (member, ctx) => {
  ctx.logger.info({ id: member.id, guild: member.guild.id }, "member joined");
  const channel = member.guild.systemChannel;
  if (channel?.isTextBased()) {
    await channel.send(`👋 Welcome ${member}, glad you're here!`);
  }
});
