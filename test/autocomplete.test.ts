import { describe, it, expect } from "vitest";
import { defineBot, defineCommand, s, subcommand, toAutocompleteChoices, type Bot, type BotConfig } from "../src/index.js";
import { readAutocompleteOptions } from "../src/context.js";
import { createHarness } from "../src/testing.js";

describe("toAutocompleteChoices", () => {
  it("maps plain values and keeps ready-made choices", () => {
    expect(toAutocompleteChoices(["a", "b"]).choices).toEqual([
      { name: "a", value: "a" },
      { name: "b", value: "b" },
    ]);
    expect(toAutocompleteChoices([{ name: "Apple", value: "apple" }]).choices).toEqual([{ name: "Apple", value: "apple" }]);
    expect(toAutocompleteChoices("nope")).toEqual({ choices: [], dropped: 0 });
    expect(toAutocompleteChoices(undefined)).toEqual({ choices: [], dropped: 0 });
  });

  it("keeps the first 25", () => {
    const many = Array.from({ length: 40 }, (_, i) => `item ${i}`);
    const { choices, dropped } = toAutocompleteChoices(many);
    expect(choices).toHaveLength(25);
    expect(choices[24]).toEqual({ name: "item 24", value: "item 24" });
    expect(dropped).toBe(0);
  });

  it("cuts a name that is too long instead of losing the whole list", () => {
    const { choices, dropped } = toAutocompleteChoices([{ name: "x".repeat(140), value: "ok" }]);
    expect(choices[0]!.name).toHaveLength(100);
    expect(choices[0]!.name.endsWith("...")).toBe(true);
    expect(choices[0]!.value).toBe("ok");
    expect(dropped).toBe(0);
  });

  it("leaves out what Discord would refuse", () => {
    const { choices, dropped } = toAutocompleteChoices([
      { name: "too long a value", value: "v".repeat(101) },
      { name: "", value: "" },
      { name: "no value" },
      null,
      { name: "kept", value: "kept" },
    ]);
    expect(choices).toEqual([{ name: "kept", value: "kept" }]);
    expect(dropped).toBe(4);
  });

  it("gives the value the type of the option", () => {
    expect(toAutocompleteChoices(["10", 20, { name: "Thirty", value: "30" }], "integer").choices).toEqual([
      { name: "10", value: 10 },
      { name: "20", value: 20 },
      { name: "Thirty", value: 30 },
    ]);
    expect(toAutocompleteChoices([1.5, "abc", ""], "integer")).toEqual({ choices: [], dropped: 3 });
    expect(toAutocompleteChoices([1.5, "2.25"], "number").choices).toEqual([
      { name: "1.5", value: 1.5 },
      { name: "2.25", value: 2.25 },
    ]);
    expect(toAutocompleteChoices([7, 8], "string").choices).toEqual([
      { name: "7", value: "7" },
      { name: "8", value: "8" },
    ]);
  });
});

describe("readAutocompleteOptions", () => {
  it("reads the values filled in so far", () => {
    expect(
      readAutocompleteOptions([
        { name: "category", type: 3, value: "fruit" },
        { name: "amount", type: 4, value: 3 },
        { name: "who", type: 6, value: "123456789012345678" },
        { name: "item", type: 3, value: "ap" },
      ]),
    ).toEqual({ category: "fruit", amount: 3, who: "123456789012345678", item: "ap" });
    expect(readAutocompleteOptions(undefined)).toEqual({});
  });

  it("looks inside the subcommand and its group", () => {
    const leaf = [{ name: "item", type: 3, value: "ap" }];
    expect(readAutocompleteOptions([{ name: "add", type: 1, options: leaf }])).toEqual({ item: "ap" });
    expect(readAutocompleteOptions([{ name: "shop", type: 2, options: [{ name: "add", type: 1, options: leaf }] }])).toEqual({
      item: "ap",
    });
    expect(readAutocompleteOptions([{ name: "add", type: 1 }])).toEqual({});
  });
});

/* -------------------------------------------------------------------------- */
/*  Through the router                                                        */
/* -------------------------------------------------------------------------- */

interface Typing {
  commandName: string;
  focused: { name: string; value: string };
  data: unknown[];
  subcommand?: string;
  group?: string;
}

/** A stand-in for an autocomplete interaction: what the router reads, and `respond`. */
function typing(input: Typing) {
  const answers: unknown[][] = [];
  const interaction = {
    answers,
    locale: "en",
    user: { id: "user-1" },
    guild: null,
    guildId: "guild-1",
    channelId: "channel-1",
    commandName: input.commandName,
    options: {
      data: input.data,
      getFocused: () => input.focused,
      getSubcommand: () => input.subcommand ?? null,
      getSubcommandGroup: () => input.group ?? null,
    },
    isChatInputCommand: () => false,
    isAutocomplete: () => true,
    async respond(choices: unknown[]) {
      answers.push(choices);
    },
  };
  return interaction;
}

async function boot(config: BotConfig): Promise<Bot> {
  const bot = defineBot({ logger: { level: "silent" }, ...config });
  await bot.load();
  (bot as unknown as { _client: unknown })._client = { ws: { ping: 1 } };
  return bot;
}

const route = async (bot: Bot, interaction: ReturnType<typeof typing>) => {
  await (bot as unknown as { handleInteraction(i: unknown): Promise<void> }).handleInteraction(interaction);
  return interaction.answers;
};

const STOCK: Record<string, string[]> = { fruit: ["apple", "apricot", "banana"], tool: ["axe", "anvil"] };

describe("autocomplete routing", () => {
  it("gives the handler what was typed and the other options", async () => {
    let seen: unknown;
    const buy = defineCommand({
      name: "buy",
      description: "Buy",
      options: {
        category: s.string({ required: true }),
        item: s.string({
          required: true,
          autocomplete: (ctx) => {
            seen = { focused: ctx.focused, value: ctx.value, options: ctx.options, guildId: ctx.guildId, channelId: ctx.channelId };
            return (STOCK[String(ctx.options.category)] ?? []).filter((name) => name.startsWith(ctx.value));
          },
        }),
      },
      run: () => undefined,
    });
    const bot = await boot({ features: [buy] });
    const answers = await route(
      bot,
      typing({
        commandName: "buy",
        focused: { name: "item", value: "ap" },
        data: [
          { name: "category", type: 3, value: "fruit" },
          { name: "item", type: 3, value: "ap", focused: true },
        ],
      }),
    );

    expect(seen).toEqual({
      focused: "item",
      value: "ap",
      options: { category: "fruit", item: "ap" },
      guildId: "guild-1",
      channelId: "channel-1",
    });
    expect(answers).toEqual([
      [
        { name: "apple", value: "apple" },
        { name: "apricot", value: "apricot" },
      ],
    ]);
    expect(bot.stats()).toMatchObject({ autocompletes: 1, errors: 0 });
  });

  it("answers numbers for an integer option, inside a subcommand", async () => {
    const shop = defineCommand({
      name: "shop",
      description: "Shop",
      subcommands: {
        add: subcommand({
          description: "Add",
          options: { quantity: s.integer({ autocomplete: () => ["1", "5", "many"] }) },
          run: () => undefined,
        }),
      },
    });
    const bot = await boot({ features: [shop] });
    const answers = await route(
      bot,
      typing({
        commandName: "shop",
        subcommand: "add",
        focused: { name: "quantity", value: "" },
        data: [{ name: "add", type: 1, options: [{ name: "quantity", type: 4, value: "", focused: true }] }],
      }),
    );
    expect(answers).toEqual([
      [
        { name: "1", value: 1 },
        { name: "5", value: 5 },
      ],
    ]);
  });

  it("answers an empty list when the handler throws, or when there is none", async () => {
    const broken = defineCommand({
      name: "broken",
      description: "Broken",
      options: {
        a: s.string({
          autocomplete: () => {
            throw new Error("lookup failed");
          },
        }),
        b: s.string(),
      },
      run: () => undefined,
    });
    const bot = await boot({ features: [broken] });
    const failing = await route(bot, typing({ commandName: "broken", focused: { name: "a", value: "x" }, data: [] }));
    const plain = await route(bot, typing({ commandName: "broken", focused: { name: "b", value: "x" }, data: [] }));
    const unknown = await route(bot, typing({ commandName: "nope", focused: { name: "a", value: "x" }, data: [] }));

    expect(failing).toEqual([[]]);
    expect(plain).toEqual([[]]);
    expect(unknown).toEqual([[]]);
    expect(bot.stats().errors).toBe(1);
  });
});

describe("harness.autocomplete", () => {
  it("passes the other options and returns what the bot would send", async () => {
    const buy = defineCommand({
      name: "buy",
      description: "Buy",
      options: {
        category: s.string({ required: true }),
        item: s.string({
          autocomplete: (ctx) => (STOCK[String(ctx.options.category)] ?? []).filter((name) => name.startsWith(ctx.value)),
        }),
        amount: s.integer({ autocomplete: () => ["1", "2", "x".repeat(3)] }),
      },
      run: () => undefined,
    });
    const harness = createHarness();

    expect(await harness.autocomplete(buy, { option: "item", value: "a", options: { category: "tool" } })).toEqual([
      { name: "axe", value: "axe" },
      { name: "anvil", value: "anvil" },
    ]);
    expect(await harness.autocomplete(buy, { option: "item", value: "a" })).toEqual([]);
    expect(await harness.autocomplete(buy, { option: "amount" })).toEqual([
      { name: "1", value: 1 },
      { name: "2", value: 2 },
    ]);
  });
});
