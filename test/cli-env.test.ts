/**
 * What `djs-bot start` hands to the bot it launches, from a `.env` file that
 * nobody checked, such as the one of a repository someone sent you.
 */
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Runs the CLI from the source, in `cwd`. */
function cli(cwd: string, ...args: string[]): Promise<{ code: number | null; out: string }> {
  const tsx = pathToFileURL(path.resolve("node_modules/tsx/dist/loader.mjs")).href;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", tsx, path.resolve("src/cli.ts"), ...args], { cwd });
    let out = "";
    child.stdout.on("data", (chunk) => (out += String(chunk)));
    child.stderr.on("data", (chunk) => (out += String(chunk)));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out }));
  });
}

describe("djs-bot start and a .env file", () => {
  it("passes the variables of .env to the bot, but none that could run code", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "djsbot-cli-env-"));
    try {
      writeFileSync(path.join(dir, "evil.cjs"), 'console.log("EVIL CODE RAN");\n');
      writeFileSync(path.join(dir, ".env"), "NODE_OPTIONS=--require ./evil.cjs\nFROM_DOTENV=yes\n");
      writeFileSync(
        path.join(dir, "bot.js"),
        'console.log("bot: " + process.env.FROM_DOTENV + " / " + String(process.env.NODE_OPTIONS));\n',
      );
      const { code, out } = await cli(dir, "start", "bot.js");
      expect(out).toContain("bot: yes / undefined");
      expect(out).not.toContain("EVIL CODE RAN");
      expect(code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
