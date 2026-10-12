// A bot whose signal handlers are installed, then given a signal: what it
// prints and how it exits is read by test/shutdown.test.ts.
//
// The signal is emitted on `process`, not sent: on Windows a signal that is
// sent ends the process at once, without running any handler.
import { defineBot, definePlugin } from "../../src/index.js";

const scenario = process.argv[2];
const say = (line: string): void => void process.stdout.write(`${line}\n`);

const hook = definePlugin({
  name: "probe",
  setup(app) {
    app.hooks.onShutdown(async () => {
      say("hook started");
      if (scenario === "twice") await new Promise((resolve) => setTimeout(resolve, 2_000));
      say("hook finished");
    });
  },
});

const bot = defineBot({ logger: { level: "silent" }, plugins: [hook] });
await bot.load();

const internals = bot as unknown as { installSignals(): void; _client: unknown };
if (scenario === "fails") {
  internals._client = {
    destroy: async () => {
      throw new Error("could not disconnect");
    },
  };
}
internals.installSignals();

process.on("exit", (code) => say(`exit ${code}`));
process.emit("SIGINT");
if (scenario === "twice") setTimeout(() => process.emit("SIGINT"), 200);

// Keeps the process alive: only the shutdown may end it.
setInterval(() => undefined, 1_000);
