import { describe, it, expect } from "vitest";
import { defineCommand, defineButton, defineModal, defineUserCommand, subcommand, s, p, field, isBotError } from "../src/index.js";

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return isBotError(e) ? e.code : "OTHER";
  }
  return undefined;
};

describe("definition-time validation", () => {
  it("accepts a valid slash command", () => {
    expect(codeOf(() => defineCommand({ name: "ban-user", description: "x", run: () => {} }))).toBeUndefined();
  });

  it("rejects uppercase / spaced slash command names (E012)", () => {
    expect(codeOf(() => defineCommand({ name: "Ban User", description: "x", run: () => {} }))).toBe("DJSBOT_E012");
    expect(codeOf(() => defineCommand({ name: "BAN", description: "x", run: () => {} }))).toBe("DJSBOT_E012");
  });

  it("rejects a too-long name (E012)", () => {
    expect(codeOf(() => defineCommand({ name: "a".repeat(33), description: "x", run: () => {} }))).toBe("DJSBOT_E012");
  });

  it("validates option names", () => {
    expect(
      codeOf(() => defineCommand({ name: "ok", description: "x", options: { "Bad Name": s.string() }, run: () => {} })),
    ).toBe("DJSBOT_E012");
  });

  it("validates subcommand and group names", () => {
    expect(
      codeOf(() =>
        defineCommand({
          name: "cfg",
          description: "x",
          subcommands: { "Bad Sub": subcommand({ description: "y", run: () => {} }) },
        }),
      ),
    ).toBe("DJSBOT_E012");
  });

  it("allows spaces & capitals in context menu names, but caps length", () => {
    expect(codeOf(() => defineUserCommand({ name: "User Info", run: () => {} }))).toBeUndefined();
    expect(codeOf(() => defineUserCommand({ name: "x".repeat(33), run: () => {} }))).toBe("DJSBOT_E012");
  });

  it("rejects component ids containing the '$' separator (E013)", () => {
    expect(codeOf(() => defineButton({ id: "a$b", run: () => {} }))).toBe("DJSBOT_E013");
    expect(codeOf(() => defineModal({ id: "form$1", title: "t", fields: { a: field.short({ label: "A" }) }, run: () => {} }))).toBe(
      "DJSBOT_E013",
    );
  });

  it("rejects an empty component id (E013)", () => {
    expect(codeOf(() => defineButton({ id: "", run: () => {} }))).toBe("DJSBOT_E013");
  });

  it("accepts colon-namespaced component ids with typed params", () => {
    expect(codeOf(() => defineButton({ id: "ticket:close", params: { n: p.number }, run: () => {} }))).toBeUndefined();
  });
});
