import { describe, it, expect } from "vitest";
import { encodeCustomId, decodeCustomId, customIdKey, BotError, p } from "../src/index.js";

const schema = { ticketId: p.string, ownerId: p.string, page: p.number, open: p.boolean };

describe("customId codec", () => {
  it("round-trips typed params", () => {
    const encoded = encodeCustomId("ticket:close", schema, {
      ticketId: "abc",
      ownerId: "123",
      page: 4,
      open: true,
    });
    expect(customIdKey(encoded)).toBe("ticket:close");
    const { key, params } = decodeCustomId(encoded, schema);
    expect(key).toBe("ticket:close");
    expect(params).toEqual({ ticketId: "abc", ownerId: "123", page: 4, open: true });
  });

  it("keeps a bare key when there are no params", () => {
    expect(encodeCustomId("just:key", {}, {})).toBe("just:key");
    expect(decodeCustomId("just:key", {})).toEqual({ key: "just:key", params: {} });
  });

  it("throws a coded error when exceeding the 100-char limit", () => {
    expect(() =>
      encodeCustomId("k", { big: p.string }, { big: "x".repeat(200) }),
    ).toThrowError(BotError);
  });
});
