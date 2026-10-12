import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";

/** Runs the fixture in a process of its own, since each scenario ends it. */
function run(scenario: string): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", path.resolve("test/fixtures/shutdown.mts"), scenario], {
      env: { ...process.env, NODE_COMFORT_DOTENV: "false" },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += String(chunk)));
    child.stderr.on("data", (chunk) => (err += String(chunk)));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out, err }));
  });
}

describe("a shutdown asked by a signal", () => {
  it("runs the shutdown hooks, then exits with code 0", async () => {
    const { code, out } = await run("once");
    expect(out).toContain("hook started");
    expect(out).toContain("hook finished");
    expect(out).toContain("exit 0");
    expect(code).toBe(0);
  }, 30_000);

  it("exits with code 1 when the shutdown itself fails, instead of staying alive", async () => {
    const { code, out, err } = await run("fails");
    expect(out).toContain("hook finished");
    expect(err).toContain("could not disconnect");
    expect(code).toBe(1);
  }, 30_000);

  it("exits at once on a second signal, without starting the shutdown again", async () => {
    const { code, out } = await run("twice");
    expect(out.match(/hook started/g)).toHaveLength(1);
    expect(out).not.toContain("hook finished");
    expect(code).toBe(1);
  }, 30_000);
});
