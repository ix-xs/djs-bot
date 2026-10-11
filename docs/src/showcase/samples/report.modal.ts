import { defineCommand, defineModal, field } from "@ix-xs/djs-bot";

export const Report = defineModal({
  id: "report",
  title: "Report a problem",
  fields: {
    kind: field.select({
      label: "Kind",
      required: true,
      options: [{ label: "Bug", value: "bug" }],
    }),
    details: field.paragraph({ label: "Details", required: true }),
    urgent: field.checkbox({ label: "This is urgent" }),
  },
  run: (ctx) => ctx.reply.success(`Reported: ${ctx.fields.details}`),
});

export default defineCommand({
  name: "report",
  description: "Report a problem",
  run: (ctx) => ctx.showModal(Report),
});
