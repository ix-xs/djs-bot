import { defineCommand, s } from "@ix-xs/djs-bot";

const FRUITS = ["apple", "apricot", "banana", "cherry"];

export default defineCommand({
  name: "fruit",
  description: "Pick a fruit",
  options: {
    name: s.string({
      description: "Fruit",
      required: true,
      autocomplete: (ctx) =>
        FRUITS.filter((fruit) => fruit.startsWith(ctx.value)),
    }),
  },
  run: (ctx) => ctx.reply.success(`You picked ${ctx.options.name}`),
});
