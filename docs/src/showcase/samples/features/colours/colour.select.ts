import { defineCommand, defineSelectMenu, ui } from "@ix-xs/djs-bot";

export const ColourPicker = defineSelectMenu({
  id: "colour:pick",
  run: (ctx) => {
    const colour = ctx.t(`colour.${ctx.values[0]}`);
    return ctx.update({
      content: ctx.t("colour.chosen", { colour }),
      components: [],
    });
  },
});

export default defineCommand({
  name: "colour",
  nameLocalizations: { fr: "couleur" },
  description: "Pick a colour",
  run: (ctx) => {
    const menu = ColourPicker.build(undefined, {
      placeholder: ctx.t("colour.pick"),
      options: [
        { label: ctx.t("colour.red"), value: "red", emoji: "🔴" },
        { label: ctx.t("colour.blue"), value: "blue", emoji: "🔵" },
      ],
    });
    return ctx.reply({
      content: ctx.t("colour.which"),
      components: [ui.row(menu)],
    });
  },
});
