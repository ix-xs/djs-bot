/**
 * Input the bot does not control: a customId that comes back in a request, text
 * that reaches the terminal, and the version of Node the bot runs on.
 */
import { describe, expect, it } from "vitest";
import { createLogger, isBotError, p } from "../src/index.js";
import { decodeCustomId, encodeCustomId } from "../src/customId.js";
import { nodeAdvisory } from "../src/versions.js";

const schema = { ticketId: p.string, page: p.number, open: p.boolean };
const forged = (payload: unknown): string => `ticket$${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    return isBotError(error) ? error.code : "not a BotError";
  }
  return undefined;
};

describe("a customId payload", () => {
  it("decodes what the bot encoded", () => {
    const raw = encodeCustomId("ticket", schema, { ticketId: "T-1", page: 3, open: true });
    expect(decodeCustomId(raw, schema)).toEqual({ key: "ticket", params: { ticketId: "T-1", page: 3, open: true } });
  });

  it("is refused when it is not a list of strings", () => {
    expect(codeOf(() => decodeCustomId(forged({ ticketId: "T-1" }), schema))).toBe("DJSBOT_E021");
    expect(codeOf(() => decodeCustomId(forged([{ a: 1 }, "2", "1"]), schema))).toBe("DJSBOT_E021");
    expect(codeOf(() => decodeCustomId(forged(["T-1", ["x"], "1"]), schema))).toBe("DJSBOT_E021");
    expect(codeOf(() => decodeCustomId(forged(null), schema))).toBe("DJSBOT_E021");
    expect(codeOf(() => decodeCustomId(forged(["T-1", 2, "1"]), schema))).toBe("DJSBOT_E021");
  });

  it("refuses a number param that is not a finite number", () => {
    expect(codeOf(() => decodeCustomId(forged(["T-1", "1e999", "1"]), schema))).toBe("DJSBOT_E021");
    expect(codeOf(() => decodeCustomId(forged(["T-1", "abc", "1"]), schema))).toBe("DJSBOT_E021");
    expect(codeOf(() => decodeCustomId(forged(["T-1", "Infinity", "1"]), schema))).toBe("DJSBOT_E021");
    expect(decodeCustomId(forged(["T-1", "-2.5", "0"]), schema).params).toEqual({ ticketId: "T-1", page: -2.5, open: false });
  });

  it("still reads a button sent before a param was added", () => {
    expect(decodeCustomId(forged(["T-1"]), schema).params).toEqual({ ticketId: "T-1", page: 0, open: false });
  });
});

describe("development logs", () => {
  const capture = (fn: () => void): string => {
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => (chunks.push(String(chunk)), true)) as typeof process.stdout.write;
    const colours = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    try {
      fn();
    } finally {
      process.stdout.write = original;
      if (colours === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = colours;
    }
    return chunks.join("");
  };

  it("never send the control characters of a value to the terminal", () => {
    const out = capture(() => createLogger({ pretty: true }).info({ customId: "x\u001b[2J\u001b]0;pwned\u0007\nfake line" }, "unrouted"));
    expect(out).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f]/);
    expect(out).toContain("\\u001b[2J");
    expect(out.trimEnd().split("\n")).toHaveLength(1);
  });

  it("keep the line breaks of the developer's own message", () => {
    const out = capture(() => createLogger({ pretty: true }).info("first line\n\tsecond line"));
    expect(out).toContain("first line\n\tsecond line");
  });
});

describe("the Node version check of doctor", () => {
  it("warns below the release that fixes the flaw of the built-in fetch()", () => {
    expect(nodeAdvisory("22.13.0")).toMatch(/Update to 22\.23\.4/);
    expect(nodeAdvisory("22.23.3")).toMatch(/GHSA-xjj6-f33q-929c/);
    expect(nodeAdvisory("24.22.0")).toMatch(/Update to 24\.22\.1/);
    expect(nodeAdvisory("26.12.0")).toMatch(/Update to 26\.12\.1/);
  });

  it("says nothing from that release on", () => {
    expect(nodeAdvisory("22.23.4")).toBeUndefined();
    expect(nodeAdvisory("24.22.2")).toBeUndefined();
    expect(nodeAdvisory("26.13.0")).toBeUndefined();
    expect(nodeAdvisory("27.0.0")).toBeUndefined();
  });

  it("points the lines that get no fix to one that does", () => {
    expect(nodeAdvisory("25.9.0")).toMatch(/Node 25 gets no fix/);
    expect(nodeAdvisory("23.11.0")).toMatch(/Node 23 gets no fix/);
  });
});
