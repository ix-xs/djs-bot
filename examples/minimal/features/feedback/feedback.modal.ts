import { defineModal, field } from "../../../../src/index.js";

/** A modal with typed fields — `ctx.fields` is `{ subject: string; body: string }`. */
export const FeedbackModal = defineModal({
  id: "feedback:submit",
  title: "Send feedback",
  fields: {
    subject: field.short({ label: "Subject", required: true, maxLength: 80 }),
    body: field.paragraph({ label: "Details", required: true, maxLength: 1000 }),
  },
  run: async (ctx) => {
    ctx.logger.info({ subject: ctx.fields.subject }, "feedback received");
    await ctx.reply.success(`Thanks for the feedback on **${ctx.fields.subject}**!`, { ephemeral: true });
  },
});
