import { Collection } from "discord.js";
import { defineModal, field, p } from "../../../../src/index.js";
import { report } from "./report.js";

/**
 * Form A: text, dropdown, user picker, file upload and checkbox. The handler
 * checks that each value arrives in the shape `ctx.fields` promises.
 */
export const FormA = defineModal({
  id: "selftest:form-a",
  title: "Self-test, form A",
  params: { opener: p.string },
  fields: {
    title: field.short({ label: "A title", description: "Any text", required: true, maxLength: 60 }),
    kind: field.select({
      label: "A kind",
      required: true,
      options: [
        { label: "Bug", value: "bug", emoji: "🐛" },
        { label: "Idea", value: "idea", emoji: "💡", description: "Something new" },
      ],
    }),
    who: field.users({ label: "Some users", description: "Optional, up to 3", maxValues: 3 }),
    proof: field.files({ label: "Images or PDFs", description: "Optional", maxValues: 2, fileTypes: ["image", ".pdf"] }),
    urgent: field.checkbox({ label: "Tick me" }),
  },
  run: async (ctx) => {
    const { title, kind, who, proof, urgent } = ctx.fields;
    const allowed = /\.(png|jpe?g|gif|webp|avif|bmp|pdf)$/i;
    await ctx.reply.ephemeral(
      report(ctx, "Form A", [
        ["params round-trip through the customId", ctx.params.opener === ctx.user.id],
        ["title is a non-empty string", typeof title === "string" && title.length > 0, JSON.stringify(title)],
        ["kind is an array with the chosen value", Array.isArray(kind) && ["bug", "idea"].includes(kind[0] ?? ""), kind.join()],
        ["who is a Collection of users", who instanceof Collection, `${who.size} picked`],
        ["proof is a Collection of attachments", proof instanceof Collection, `${proof.size} file(s)`],
        [
          "every uploaded file matches the fileTypes filter",
          [...proof.values()].every((file) => allowed.test(file.name)),
          proof.map((file) => file.name).join(", ") || "none uploaded",
        ],
        ["urgent is a boolean", typeof urgent === "boolean", String(urgent)],
      ]),
    );
  },
});

/** Form B: paragraph, radio group, checkbox group, role picker, channel picker. */
export const FormB = defineModal({
  id: "selftest:form-b",
  title: "Self-test, form B",
  fields: {
    details: field.paragraph({ label: "Some details", placeholder: "Optional", maxLength: 500 }),
    plan: field.radio({
      label: "Pick exactly one",
      required: true,
      options: [
        { label: "Free", value: "free" },
        { label: "Pro", value: "pro", description: "Everything" },
      ],
    }),
    extras: field.checkboxes({
      label: "Pick any",
      options: [
        { label: "Logs", value: "logs" },
        { label: "Backups", value: "backups", default: true },
      ],
    }),
    roles: field.roles({ label: "Some roles", description: "Optional", maxValues: 3 }),
    where: field.channels({ label: "Some channels", description: "Optional", maxValues: 2 }),
  },
  run: async (ctx) => {
    const { details, plan, extras, roles, where } = ctx.fields;
    await ctx.reply.ephemeral(
      report(ctx, "Form B", [
        ["details is a string (empty when left blank)", typeof details === "string", `${details.length} chars`],
        ["plan is the chosen radio value", plan === "free" || plan === "pro", plan],
        ["extras is an array of ticked values", Array.isArray(extras), extras.join() || "none"],
        ["roles is a Collection", roles instanceof Collection, `${roles.size} picked`],
        ["where is a Collection", where instanceof Collection, `${where.size} picked`],
      ]),
    );
  },
});
