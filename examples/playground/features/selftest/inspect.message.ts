import { defineMessageCommand } from "../../../../src/index.js";
import { report } from "./report.js";

/** Right-click a message > Apps > "Self-test: message". */
export default defineMessageCommand({
  name: "Self-test: message",
  run: (ctx) =>
    ctx.reply.ephemeral(
      report(ctx, "Message context menu", [
        ["received the clicked message", Boolean(ctx.targetMessage?.id), `${ctx.targetMessage.content.length} characters`],
      ]),
    ),
});
