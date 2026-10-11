import { defineCommand, defineModal, field } from "@ix-xs/djs-bot";

export const Report = defineModal({
  id: "report",
  title: "Report a problem",
  fields: {
    kind: field.select({
      label: "Kind",
      required: true,
      options: [
        { label: "Bug", value: "bug" },
        { label: "Spam", value: "spam" },
      ],
    }),
    details: field.paragraph({ label: "Details", required: true }),
    urgent: field.checkbox({ label: "This is urgent" }),
  },
  run: (ctx) => {
    const { kind, details } = ctx.fields;
    return ctx.reply.success(ctx.t("report.sent", { kind: kind[0], details }));
  },
});

export default defineCommand({
  name: "report",
  nameLocalizations: { fr: "signaler" },
  description: "Report a problem",
  run: (ctx) =>
    ctx.showModal(Report, undefined, {
      title: ctx.t("report.title"),
      fields: {
        kind: { label: ctx.t("report.kind") },
        details: { label: ctx.t("report.details") },
        urgent: { label: ctx.t("report.urgent") },
      },
    }),
});
