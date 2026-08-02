import { describe, it, expect, afterEach } from "vitest";
import { createLogger, BotError } from "../src/index.js";

function captureStdout(fn: () => void): string {
  const lines: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return lines.join("");
}

describe("logger error serialization", () => {
  afterEach(() => {
    /* stdout restored inside captureStdout */
  });

  it("serializes a nested Error (message + stack) in JSON output", () => {
    const out = captureStdout(() => {
      createLogger({ level: "info", pretty: false }).error({ err: new Error("boom") }, "failed");
    });
    const rec = JSON.parse(out);
    expect(rec.msg).toBe("failed");
    expect(rec.err.message).toBe("boom");
    expect(typeof rec.err.stack).toBe("string");
  });

  it("preserves BotError code/hint in the serialized error", () => {
    const out = captureStdout(() => {
      createLogger({ level: "info", pretty: false }).error({ err: new BotError("DJSBOT_E001") }, "no token");
    });
    const rec = JSON.parse(out);
    expect(rec.err.code).toBe("DJSBOT_E001");
    expect(typeof rec.err.hint).toBe("string");
  });

  it("serializes a top-level Error argument", () => {
    const out = captureStdout(() => {
      createLogger({ level: "info", pretty: false }).error(new Error("direct"));
    });
    const rec = JSON.parse(out);
    expect(rec.err.message).toBe("direct");
  });
});
