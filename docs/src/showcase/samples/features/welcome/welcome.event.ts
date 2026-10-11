import { defineEvent } from "@ix-xs/djs-bot";
import { i18n } from "../../i18n.js";

export default defineEvent("guildMemberAdd", async (member) => {
  const locale = member.guild.preferredLocale;
  const text = i18n.t(locale, "welcome", { member });
  await member.guild.systemChannel?.send(text);
});
