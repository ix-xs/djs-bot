import { defineCommand } from "../../../../src/index.js";
import { FeedbackModal } from "./feedback.modal.js";

/** Opens the feedback modal. */
export default defineCommand({
  name: "feedback",
  description: "Send feedback to the team",
  // A modal must be the first response, so this command opts out of the
  // bot-wide automatic deferral.
  defer: false,
  run: (ctx) => ctx.showModal(FeedbackModal),
});
