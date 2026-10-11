import { defineCommand, defineSelectMenu, ui } from "@ix-xs/djs-bot";

export const ColourPicker = defineSelectMenu({
  id: "colour:pick",
  run: (ctx) =>
    ctx.update({ content: `You chose ${ctx.values[0]}.`, components: [] }),
});

export default defineCommand({
  name: "colour",
  description: "Pick a colour",
  run: (ctx) => {
    const menu = ColourPicker.build(undefined, {
      placeholder: "Pick a colour",
      options: [
        { label: "Red", value: "red", emoji: "🔴" },
        { label: "Blue", value: "blue", emoji: "🔵" },
      ],
    });
    return ctx.reply({
      content: "Which colour?",
      components: [ui.row(menu)],
    });
  },
});
