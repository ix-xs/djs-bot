import { defineModal, field } from "../../../../src/index.js";

/**
 * A modal with typed fields: `ctx.fields` is
 * `{ subject: string; kind: string[]; body: string; anonymous: boolean }`.
 */
export const FeedbackModal = defineModal({
  id: "feedback:submit",
  title: "Send feedback",
  fields: {
    subject: field.short({ label: "Subject", required: true, maxLength: 80 }),
    kind: field.select({
      label: "What is it about?",
      required: true,
      options: [
        { label: "A bug", value: "bug", emoji: "🐛" },
        { label: "An idea", value: "idea", emoji: "💡" },
      ],
    }),
    body: field.paragraph({ label: "Details", required: true, maxLength: 1000 }),
    anonymous: field.checkbox({ label: "Send anonymously" }),
  },
  run: async (ctx) => {
    ctx.logger.info(
      { subject: ctx.fields.subject, kind: ctx.fields.kind[0], anonymous: ctx.fields.anonymous },
      "feedback received",
    );
    await ctx.reply.success(`Thanks for the feedback on **${ctx.fields.subject}**!`, { ephemeral: true });
  },
});
