import { describe, it, expect } from "vitest";
import { defineCommand, defineButton, s, p, inGuild } from "../src/index.js";
import { createHarness } from "../src/testing.js";

const Echo = defineCommand({
  name: "echo",
  description: "Echo text back",
  options: { text: s.string({ required: true }) },
  run: (ctx) => ctx.reply((ctx.options as { text: string }).text),
});

const GuildOnly = defineCommand({
  name: "guild-only",
  description: "Only in guilds",
  guards: [inGuild()],
  run: (ctx) => ctx.reply.success("ok"),
});

const Close = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string },
  run: (ctx) => ctx.reply.success(`closing ${(ctx.params as { ticketId: string }).ticketId}`),
});

describe("harness", () => {
  const h = createHarness();

  it("runs a command handler and captures the reply", async () => {
    const { replies } = await h.command(Echo, { options: { text: "hello" } });
    expect(replies).toEqual([{ type: "reply", content: "hello" }]);
  });

  it("blocks a handler when a guard fails", async () => {
    const { passedGuards, rejectionReason, replies } = await h.command(GuildOnly);
    expect(passedGuards).toBe(false);
    expect(rejectionReason).toMatch(/server/i);
    expect(replies).toEqual([]);
  });

  it("passes decoded params to a button handler", async () => {
    const { replies } = await h.button(Close, { params: { ticketId: "t-1" } });
    expect(replies[0]).toEqual({ type: "success", content: "closing t-1" });
  });
});
