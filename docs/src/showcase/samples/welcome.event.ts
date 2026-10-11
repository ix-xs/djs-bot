import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("guildMemberAdd", async (member) => {
  await member.guild.systemChannel?.send(`Welcome ${member}!`);
});
