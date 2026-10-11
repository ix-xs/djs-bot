import { defineCommand, s } from "@ix-xs/djs-bot";

const FRUITS = ["apple", "cherry", "mango", "melon"];

export default defineCommand({
  name: "fruit",
  description: "Pick a fruit",
  options: {
    name: s.string({
      description: "Fruit",
      nameLocalizations: { fr: "nom" },
      required: true,
      autocomplete: (ctx) =>
        FRUITS.map((id) => ({ name: ctx.t(`fruit.${id}`), value: id }))
          .filter((choice) => choice.name.startsWith(ctx.value)),
    }),
  },
  run: (ctx) => {
    const fruit = ctx.t(`fruit.${ctx.options.name}`);
    return ctx.reply.success(ctx.t("fruit.picked", { fruit }));
  },
});
