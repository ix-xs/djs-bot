import { defineCommand } from "../../../../src/index.js";
import { FeedbackModal } from "./feedback.modal.js";

/** Opens the feedback modal. */
export default defineCommand({
  name: "feedback",
  description: "Send feedback to the team",
  run: async (ctx) => {
    await ctx.interaction.showModal(FeedbackModal.build());
  },
});
