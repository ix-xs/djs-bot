import { defineUserCommand } from "../../../../src/index.js";
import { EmbedBuilder, time, TimestampStyles } from "discord.js";

/** Right-click a user → Apps → "User info". `ctx.targetUser`/`targetMember` are typed. */
export default defineUserCommand({
  name: "User info",
  run: async (ctx) => {
    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle(ctx.targetUser.tag)
      .setThumbnail(ctx.targetUser.displayAvatarURL())
      .addFields(
        { name: "ID", value: ctx.targetUser.id, inline: true },
        {
          name: "Account created",
          value: time(ctx.targetUser.createdAt, TimestampStyles.RelativeTime),
          inline: true,
        },
      );
    if (ctx.targetMember?.joinedAt) {
      embed.addFields({
        name: "Joined server",
        value: time(ctx.targetMember.joinedAt, TimestampStyles.RelativeTime),
        inline: true,
      });
    }
    await ctx.reply({ embeds: [embed], flags: 64 /* ephemeral */ });
  },
});
