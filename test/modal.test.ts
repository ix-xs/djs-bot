import { describe, it, expect } from "vitest";
import { Collection, ComponentType } from "discord.js";
import { defineModal, field, isBotError, p } from "../src/index.js";
import { readModalFields } from "../src/modal.js";
import { createHarness } from "../src/testing.js";

const Report = defineModal({
  id: "report:submit",
  title: "Report",
  params: { targetId: p.string },
  fields: {
    intro: field.text("Tell us what happened."),
    reason: field.select({
      label: "Reason",
      description: "Pick the closest one",
      required: true,
      options: [
        { label: "Spam", value: "spam", emoji: "🚫" },
        { label: "Abuse", value: "abuse", default: true },
      ],
    }),
    details: field.paragraph({ label: "Details", maxLength: 500, placeholder: "Optional" }),
    proof: field.files({ label: "Screenshots", maxValues: 3 }),
    anonymous: field.checkbox({ label: "Stay anonymous", default: true }),
  },
  run: (ctx) => ctx.reply.success(`${ctx.fields.reason.join(",")}:${ctx.fields.anonymous}`),
});

describe("defineModal", () => {
  it("builds labelled components for every field kind", () => {
    const json = Report.build({ targetId: "42" }).toJSON();
    expect(json.title).toBe("Report");
    expect(json.custom_id.startsWith("report:submit$")).toBe(true);

    const [intro, reason, details, proof, anonymous] = json.components as Array<Record<string, any>>;
    expect(intro).toMatchObject({ type: ComponentType.TextDisplay, content: "Tell us what happened." });
    expect(reason).toMatchObject({
      type: ComponentType.Label,
      label: "Reason",
      description: "Pick the closest one",
      component: { type: ComponentType.StringSelect, custom_id: "reason", required: true },
    });
    expect(reason!.component.options).toMatchObject([
      { label: "Spam", value: "spam", emoji: { name: "🚫" } },
      { label: "Abuse", value: "abuse", default: true },
    ]);
    expect(details!.component).toMatchObject({
      type: ComponentType.TextInput,
      custom_id: "details",
      required: false,
      max_length: 500,
      placeholder: "Optional",
    });
    expect(proof!.component).toMatchObject({ type: ComponentType.FileUpload, custom_id: "proof", max_values: 3 });
    expect(anonymous!.component).toMatchObject({ type: ComponentType.Checkbox, custom_id: "anonymous", default: true });
  });

  it("builds entity pickers, radio groups and checkbox groups", () => {
    const modal = defineModal({
      id: "pick",
      title: "Pick",
      fields: {
        who: field.users({ label: "Who", maxValues: 2, defaultValues: ["111111111111111111"] }),
        where: field.channels({ label: "Where", required: true }),
        plan: field.radio({
          label: "Plan",
          required: true,
          options: [
            { label: "Free", value: "free" },
            { label: "Pro", value: "pro", description: "Everything" },
          ],
        }),
        extras: field.checkboxes({ label: "Extras", minValues: 0, options: [{ label: "A", value: "a" }] }),
        roles: field.roles({ label: "Roles" }),
      },
      run: () => undefined,
    });
    const components = modal.build().toJSON().components as Array<Record<string, any>>;
    expect(components.map((c) => c.component.type)).toEqual([
      ComponentType.UserSelect,
      ComponentType.ChannelSelect,
      ComponentType.RadioGroup,
      ComponentType.CheckboxGroup,
      ComponentType.RoleSelect,
    ]);
    expect(components[0]!.component.default_values).toEqual([{ id: "111111111111111111", type: "user" }]);
    expect(components[2]!.component.required).toBe(true);
  });

  it("rejects an empty modal, more than five components, and a choice field without options", () => {
    const codeOf = (make: () => unknown): string | undefined => {
      try {
        make();
      } catch (error) {
        return isBotError(error) ? error.code : "other";
      }
      return undefined;
    };
    const six = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [`f${i}`, field.short({ label: `F${i}` })]),
    );
    expect(codeOf(() => defineModal({ id: "a", title: "A", fields: {}, run: () => undefined }))).toBe("DJSBOT_E014");
    expect(codeOf(() => defineModal({ id: "b", title: "B", fields: six, run: () => undefined }))).toBe("DJSBOT_E014");
    expect(
      codeOf(() =>
        defineModal({
          id: "c",
          title: "C",
          // A radio group with a single choice is not a choice: Discord wants 2-10.
          fields: { x: field.radio({ label: "X", options: [{ label: "Only", value: "only" }] }) },
          run: () => undefined,
        }),
      ),
    ).toBe("DJSBOT_E014");
  });
});

describe("readModalFields", () => {
  const users = new Collection([["1", { id: "1" }]]);
  const files = new Collection([["9", { id: "9", name: "a.png" }]]);
  const submitted = {
    getTextInputValue: (id: string) => `text:${id}`,
    getStringSelectValues: () => ["spam"],
    getSelectedUsers: () => users,
    getSelectedRoles: () => null,
    getSelectedChannels: () => null,
    getSelectedMentionables: () => null,
    getUploadedFiles: () => files,
    getRadioGroup: () => null,
    getCheckboxGroup: () => ["a", "b"],
    getCheckbox: () => true,
  } as never;

  it("reads each kind into its typed shape, with empty values instead of null", () => {
    const fields = {
      note: field.text("ignored"),
      title: field.short({ label: "T" }),
      reason: field.select({ label: "R", options: [{ label: "Spam", value: "spam" }] }),
      who: field.users({ label: "W" }),
      roles: field.roles({ label: "Ro" }),
      any: field.mentionables({ label: "M" }),
      proof: field.files({ label: "P" }),
      plan: field.radio({ label: "Pl", options: [{ label: "Free", value: "free" }, { label: "Pro", value: "pro" }] }),
      extras: field.checkboxes({ label: "E", options: [{ label: "A", value: "a" }] }),
      ok: field.checkbox({ label: "OK" }),
    };
    const out = readModalFields(fields, submitted);

    expect(out).not.toHaveProperty("note");
    expect(out.title).toBe("text:title");
    expect(out.reason).toEqual(["spam"]);
    expect(out.who).toBe(users);
    expect((out.roles as Collection<string, unknown>).size).toBe(0);
    expect(Object.keys(out.any as object)).toEqual(["users", "members", "roles"]);
    expect(out.proof).toBe(files);
    expect(out.plan).toBeUndefined();
    expect(out.extras).toEqual(["a", "b"]);
    expect(out.ok).toBe(true);
  });

  it("falls back to an empty value when a field is missing from the submission", () => {
    const broken = {
      getTextInputValue: () => {
        throw new Error("no such component");
      },
      getCheckbox: () => {
        throw new Error("no such component");
      },
    } as never;
    const out = readModalFields({ a: field.short({ label: "A" }), b: field.checkbox({ label: "B" }) }, broken);
    expect(out).toEqual({ a: "", b: false });
  });
});

describe("modals in the harness", () => {
  it("passes typed fields through, and captures ctx.showModal", async () => {
    const harness = createHarness();
    const result = await harness.modal(Report, {
      params: { targetId: "42" },
      fields: { reason: ["spam"], details: "", proof: new Collection(), anonymous: true },
    });
    expect(result.replies).toEqual([{ type: "success", content: "spam:true" }]);
  });
});

describe("modal limits and file types", () => {
  const failure = (make: () => unknown): string => {
    try {
      make();
    } catch (error) {
      return String((error as Error).message);
    }
    return "";
  };
  const modal = (fields: Parameters<typeof defineModal>[0]["fields"], title = "T") => () =>
    defineModal({ id: "m", title, fields, run: () => undefined });

  it("passes fileTypes through to the upload component", () => {
    const built = defineModal({
      id: "up",
      title: "Upload",
      fields: { doc: field.files({ label: "Document", fileTypes: ["image", ".pdf"], maxValues: 2 }) },
      run: () => undefined,
    })
      .build()
      .toJSON();
    expect((built.components[0] as Record<string, any>).component).toMatchObject({
      type: ComponentType.FileUpload,
      custom_id: "doc",
      file_types: ["image", ".pdf"],
      max_values: 2,
    });
  });

  it("rejects text over Discord's limits, naming the field", () => {
    expect(failure(modal({ a: field.short({ label: "L".repeat(46) }) }))).toMatch(/field "a": the label is 46 characters \(max 45\)/);
    expect(failure(modal({ a: field.short({ label: "A", description: "d".repeat(101) }) }))).toMatch(/description/);
    expect(failure(modal({ a: field.short({ label: "A", placeholder: "p".repeat(101) }) }))).toMatch(/placeholder/);
    expect(failure(modal({ a: field.short({ label: "A" }) }, "T".repeat(46)))).toMatch(/title must be 1-45/);
  });

  it("rejects impossible lengths and counts", () => {
    expect(failure(modal({ a: field.paragraph({ label: "A", maxLength: 4001 }) }))).toMatch(/maxLength must be 1-4000/);
    expect(failure(modal({ a: field.short({ label: "A", minLength: 9, maxLength: 3 }) }))).toMatch(/minLength \(9\)/);
    expect(failure(modal({ a: field.files({ label: "A", maxValues: 11 }) }))).toMatch(/maxValues must be 1-10/);
    expect(failure(modal({ a: field.files({ label: "A", fileTypes: ["exe" as never] }) }))).toMatch(/not a valid file type/);
  });
});

describe("a modal built with text of its own", () => {
  const texts = (text?: Parameters<typeof Report.build>[1]) => {
    const json = Report.build({ targetId: "1" }, text).toJSON();
    const labels = json.components.flatMap((row) => ("label" in row ? [row] : []));
    return { json, labels };
  };

  it("keeps the declared text when none is given", () => {
    const { json, labels } = texts();
    expect(json.title).toBe("Report");
    expect(labels.map((label) => label.label)).toEqual(["Reason", "Details", "Screenshots", "Stay anonymous"]);
  });

  it("shows the title, labels, descriptions and placeholders it is given", () => {
    const { json, labels } = texts({
      title: "Signalement",
      fields: {
        intro: { label: "Dites-nous ce qui s'est passé." },
        reason: { label: "Motif", description: "Choisissez le plus proche" },
        details: { label: "Détails", placeholder: "Facultatif" },
      },
    });
    expect(json.title).toBe("Signalement");
    expect(JSON.stringify(json.components[0])).toContain("Dites-nous ce qui s'est passé.");
    // Fields that are not named keep their own text.
    expect(labels.map((label) => label.label)).toEqual(["Motif", "Détails", "Screenshots", "Stay anonymous"]);
    expect(labels[0]?.description).toBe("Choisissez le plus proche");
    expect(JSON.stringify(labels[1])).toContain("Facultatif");
    // The definition itself is untouched.
    expect(Report.title).toBe("Report");
    expect(Report.fields.reason.label).toBe("Reason");
    expect(texts().labels[0]?.label).toBe("Reason");
  });

  it("refuses text that breaks Discord's limits, or names a field that does not exist", () => {
    const code = (run: () => unknown) => {
      try {
        run();
      } catch (error) {
        return isBotError(error) ? error.code : String(error);
      }
      return "no error";
    };
    expect(code(() => Report.build({ targetId: "1" }, { title: "x".repeat(46) }))).toBe("DJSBOT_E014");
    expect(code(() => Report.build({ targetId: "1" }, { fields: { details: { label: "x".repeat(46) } } }))).toBe("DJSBOT_E014");
    // @ts-expect-error "detail" is not a field of this modal
    expect(code(() => Report.build({ targetId: "1" }, { fields: { detail: { label: "Détails" } } }))).toBe("DJSBOT_E014");
  });
});
