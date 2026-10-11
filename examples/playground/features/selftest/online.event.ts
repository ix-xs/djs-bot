import { defineEvent } from "../../../../src/index.js";

/** Logged once the gateway is connected. */
export default defineEvent(
  "clientReady",
  (client, ctx) => {
    ctx.logger.info({ selftest: "ready", tag: client.user.tag }, "playground online: run /selftest panel");
  },
  { once: true },
);
