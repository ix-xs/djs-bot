import { describe, it, expect } from "vitest";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from "discord.js";
import { toPayload, type PagePayload } from "../src/pagination.js";

const nav = () => new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("n:next").setLabel(">").setStyle(ButtonStyle.Secondary));

describe("paginate payload merging", () => {
  it("renders an embed page as embeds + the nav row", () => {
    const embed = new EmbedBuilder().setTitle("hi");
    const payload = toPayload(embed, nav(), 0);
    expect(payload.embeds).toEqual([embed]);
    expect(payload.components).toHaveLength(1);
    expect(payload.flags).toBeUndefined();
  });

  it("appends the nav row to a Components V2 payload page and keeps its flags", () => {
    const container = new ActionRowBuilder<ButtonBuilder>();
    const page: PagePayload = { components: [container], flags: MessageFlags.IsComponentsV2 };
    const payload = toPayload(page, nav(), 0);
    // original component + nav row
    expect(payload.components).toHaveLength(2);
    expect((payload.flags as number) & MessageFlags.IsComponentsV2).toBeTruthy();
  });

  it("ORs the ephemeral flag into the page flags", () => {
    const page: PagePayload = { content: "x", flags: MessageFlags.IsComponentsV2 };
    const payload = toPayload(page, null, MessageFlags.Ephemeral);
    const flags = payload.flags as number;
    expect(flags & MessageFlags.IsComponentsV2).toBeTruthy();
    expect(flags & MessageFlags.Ephemeral).toBeTruthy();
  });

  it("omits an empty nav (single page) and adds no flags", () => {
    const embed = new EmbedBuilder().setTitle("solo");
    const payload = toPayload(embed, null, 0);
    expect(payload.components).toEqual([]);
    expect(payload.flags).toBeUndefined();
  });

  it("preserves content and files on a payload page", () => {
    const page: PagePayload = { content: "hello", files: [] };
    const payload = toPayload(page, nav(), 0);
    expect(payload.content).toBe("hello");
    expect(payload.components).toHaveLength(1);
  });
});
