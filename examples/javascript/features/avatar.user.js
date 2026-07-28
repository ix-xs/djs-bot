const { defineUserCommand, assets } = require("@ix-xs/djs-bot");
const { EmbedBuilder } = require("discord.js");

// Right-click a user → Apps → "Avatar".
module.exports = defineUserCommand({
  name: "Avatar",
  run: async (ctx) => {
    const embed = new EmbedBuilder()
      .setTitle(ctx.targetUser.tag)
      .setImage(assets.avatar(ctx.targetUser, { size: 512 }));
    await ctx.reply({ embeds: [embed], flags: 64 /* ephemeral */ });
  },
});
