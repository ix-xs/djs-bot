import { defineUserCommand } from "../../../../src/index.js";
import { report } from "./report.js";

/** Right-click a user > Apps > "Self-test: user". */
export default defineUserCommand({
  name: "Self-test: user",
  run: (ctx) =>
    ctx.reply.ephemeral(
      report(ctx, "User context menu", [
        ["received the clicked user", Boolean(ctx.targetUser?.id), ctx.targetUser.tag],
        ["received them as a member of this server", ctx.targetMember !== null, ctx.targetMember?.displayName],
      ]),
    ),
});
