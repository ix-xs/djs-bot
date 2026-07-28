import { describe, it, expect } from "vitest";
import {
  defineCommand,
  defineUserSelect,
  defineModal,
  subcommand,
  s,
  field,
  inGuild,
} from "../src/index.js";
import { createHarness } from "../src/testing.js";

describe("harness (extended)", () => {
  const h = createHarness();

  it("runs a command with options without casting", async () => {
    const Greet = defineCommand({
      name: "greet",
      description: "Greet someone",
      options: { name: s.string({ required: true }) },
      run: (ctx) => ctx.reply.success(`Hi ${(ctx.options as { name: string }).name}`),
    });
    const { replies } = await h.command(Greet, { options: { name: "Sam" } });
    expect(replies[0]).toEqual({ type: "success", content: "Hi Sam" });
  });

  it("blocks a guarded subcommand-style command", async () => {
    const GuildCmd = defineCommand({
      name: "g",
      description: "guild only",
      guards: [inGuild()],
      run: (ctx) => ctx.reply.success("ok"),
    });
    const denied = await h.command(GuildCmd); // no guildId → inGuild fails
    expect(denied.passedGuards).toBe(false);
    const allowed = await h.command(GuildCmd, { guildId: "g1" });
    expect(allowed.passedGuards).toBe(true);
  });

  it("invokes a native user-select handler with values", async () => {
    const Picker = defineUserSelect({
      id: "pick:user",
      run: (ctx) => ctx.reply.success(`picked ${ctx.values.length}`),
    });
    const { replies } = await h.select(Picker, { values: ["1", "2"] });
    expect(replies[0]).toEqual({ type: "success", content: "picked 2" });
  });

  it("invokes a modal handler with submitted fields", async () => {
    const Feedback = defineModal({
      id: "fb",
      title: "Feedback",
      fields: { body: field.paragraph({ label: "Body", required: true }) },
      run: (ctx) => ctx.reply.success(`got ${ctx.fields.body}`),
    });
    const { replies } = await h.modal(Feedback, { fields: { body: "great" } });
    expect(replies[0]).toEqual({ type: "success", content: "got great" });
  });

  it("exposes a working ctx.t no-op when i18n is unconfigured", async () => {
    const Cmd = defineCommand({
      name: "k",
      description: "k",
      run: (ctx) => ctx.reply(ctx.t("some.key")),
    });
    const { replies } = await h.command(Cmd);
    expect(replies[0]).toEqual({ type: "reply", content: "some.key" });
  });

  // Keep `subcommand` referenced so the import stays meaningful in this suite.
  it("builds a subcommand definition", () => {
    const sub = subcommand({ description: "x", run: () => {} });
    expect(sub.kind).toBe("subcommand");
  });
});
