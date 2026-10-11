import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  nameLocalizations: { fr: "profil" },
  description: "Show a player profile",
  options: {
    user: s.user({
      description: "Whose profile",
      nameLocalizations: { fr: "joueur" },
      required: true,
    }),
  },
  run: (ctx) =>
    ctx.reply.success(ctx.t("profile.of", { user: ctx.options.user })),
});
