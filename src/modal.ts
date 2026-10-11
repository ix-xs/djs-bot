/**
 * Turns a declared {@link FieldMap} into a discord.js modal, and a submitted
 * modal back into the typed `ctx.fields` object.
 *
 * Kept apart from the definitions so the two directions (build and read) sit
 * next to each other: adding a field kind means touching exactly this file and
 * the `field` builders.
 *
 * @module modal
 */
import {
  ChannelSelectMenuBuilder,
  CheckboxBuilder,
  CheckboxGroupBuilder,
  Collection,
  FileUploadBuilder,
  LabelBuilder,
  MentionableSelectMenuBuilder,
  ModalBuilder,
  RadioGroupBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ChannelType,
  type ModalSubmitFields,
} from "discord.js";
import { BotError } from "./errors.js";
import { assertFileType } from "./validate.js";
import type { FieldChoice, FieldDef, FieldMap } from "./schema.js";

/** Discord's limit on top-level components in one modal. */
export const MODAL_MAX_COMPONENTS = 5;

/** Discord's limits on what a modal and its components may contain. */
export const MODAL_LIMITS = {
  title: 45,
  label: 45,
  description: 100,
  textPlaceholder: 100,
  selectPlaceholder: 150,
  textLength: 4000,
  optionText: 100,
  /** Most items a select, picker or checkbox group lets the user choose. */
  picks: 25,
  /** Most files one upload field accepts. */
  files: 10,
  fileTypes: 10,
} as const;

interface FieldConfig {
  description?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  value?: string;
  minValues?: number;
  maxValues?: number;
  options?: readonly FieldChoice[];
  defaultValues?: readonly string[];
  channelTypes?: readonly ChannelType[];
  fileTypes?: readonly string[];
  default?: boolean;
}

/** How many options each choice field accepts: [fewest, most]. */
const OPTION_LIMITS: Partial<Record<FieldDef["kind"], readonly [number, number]>> = {
  select: [1, 25],
  radio: [2, 10],
  checkboxes: [1, 10],
};

/**
 * Checks a modal's fields against Discord's rules when the modal is defined,
 * so a mistake fails at startup with a coded error instead of an HTTP 400 the
 * first time someone opens it.
 * @throws {BotError} `DJSBOT_E014`
 */
export function assertModalFields(modalId: string, fields: FieldMap, title?: string): void {
  const entries = Object.entries(fields);
  const reject = (detail: string, hint?: string): never => {
    throw new BotError("DJSBOT_E014", { detail: `modal "${modalId}": ${detail}`, hint });
  };
  if (title !== undefined && (title.length < 1 || title.length > MODAL_LIMITS.title)) {
    reject(`the title must be 1-${MODAL_LIMITS.title} characters (got ${title.length})`);
  }
  if (entries.length === 0 || entries.length > MODAL_MAX_COMPONENTS) {
    throw new BotError("DJSBOT_E014", {
      detail: `modal "${modalId}" has ${entries.length} components (allowed: 1-${MODAL_MAX_COMPONENTS})`,
    });
  }
  for (const [name, def] of entries) {
    const limits = OPTION_LIMITS[def.kind];
    if (!limits) continue;
    const count = (def.config as FieldConfig).options?.length ?? 0;
    if (count < limits[0] || count > limits[1]) {
      throw new BotError("DJSBOT_E014", {
        detail: `field "${name}" of modal "${modalId}" has ${count} option(s)`,
        hint: `A ${def.kind} field needs between ${limits[0]} and ${limits[1]} options.`,
      });
    }
  }

  for (const [name, def] of entries) {
    if (def.kind === "text") continue;
    const cfg = def.config as FieldConfig;
    const field = `field "${name}"`;
    const tooLong = (what: string, value: string | undefined, max: number): void => {
      if (value !== undefined && value.length > max) {
        reject(`${field}: ${what} is ${value.length} characters (max ${max})`);
      }
    };
    if (def.label.length < 1) reject(`${field} has an empty label`);
    tooLong("the label", def.label, MODAL_LIMITS.label);
    tooLong("the description", cfg.description, MODAL_LIMITS.description);

    const isText = def.kind === "short" || def.kind === "paragraph";
    tooLong("the placeholder", cfg.placeholder, isText ? MODAL_LIMITS.textPlaceholder : MODAL_LIMITS.selectPlaceholder);
    if (isText) {
      tooLong("the pre-filled value", cfg.value, MODAL_LIMITS.textLength);
      const { minLength, maxLength } = cfg;
      if (minLength !== undefined && (minLength < 0 || minLength > MODAL_LIMITS.textLength)) {
        reject(`${field}: minLength must be 0-${MODAL_LIMITS.textLength}`);
      }
      if (maxLength !== undefined && (maxLength < 1 || maxLength > MODAL_LIMITS.textLength)) {
        reject(`${field}: maxLength must be 1-${MODAL_LIMITS.textLength}`);
      }
      if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
        reject(`${field}: minLength (${minLength}) is greater than maxLength (${maxLength})`);
      }
    }

    for (const option of cfg.options ?? []) {
      tooLong(`the label of option "${option.value}"`, option.label, MODAL_LIMITS.optionText);
      tooLong(`the value of option "${option.label}"`, option.value, MODAL_LIMITS.optionText);
      tooLong(`the description of option "${option.label}"`, option.description, MODAL_LIMITS.optionText);
    }

    const most = def.kind === "files" ? MODAL_LIMITS.files : MODAL_LIMITS.picks;
    const { minValues, maxValues } = cfg;
    if (minValues !== undefined && (minValues < 0 || minValues > most)) reject(`${field}: minValues must be 0-${most}`);
    if (maxValues !== undefined && (maxValues < 1 || maxValues > most)) reject(`${field}: maxValues must be 1-${most}`);
    if (minValues !== undefined && maxValues !== undefined && minValues > maxValues) {
      reject(`${field}: minValues (${minValues}) is greater than maxValues (${maxValues})`);
    }

    const fileTypes = cfg.fileTypes ?? [];
    if (fileTypes.length > MODAL_LIMITS.fileTypes) {
      reject(`${field} lists ${fileTypes.length} file types (max ${MODAL_LIMITS.fileTypes})`);
    }
    for (const type of fileTypes) assertFileType(type, reject, field);
  }
}

type PickBuilder =
  | StringSelectMenuBuilder
  | UserSelectMenuBuilder
  | RoleSelectMenuBuilder
  | ChannelSelectMenuBuilder
  | MentionableSelectMenuBuilder;

/** Applies the options every select-like component shares. */
function applyPick<B extends PickBuilder>(menu: B, name: string, def: FieldDef, cfg: FieldConfig): B {
  menu.setCustomId(name).setRequired(def.required);
  if (cfg.placeholder) menu.setPlaceholder(cfg.placeholder);
  if (cfg.minValues !== undefined) menu.setMinValues(cfg.minValues);
  if (cfg.maxValues !== undefined) menu.setMaxValues(cfg.maxValues);
  return menu;
}

const choice = (option: FieldChoice): { label: string; value: string; description?: string; default?: boolean } => ({
  label: option.label,
  value: option.value,
  ...(option.description ? { description: option.description } : {}),
  ...(option.default ? { default: true } : {}),
});

/** Sets the interactive component of a label from one field descriptor. */
function attach(label: LabelBuilder, name: string, def: FieldDef, cfg: FieldConfig): void {
  switch (def.kind) {
    case "short":
    case "paragraph": {
      const input = new TextInputBuilder()
        .setCustomId(name)
        .setStyle(def.kind === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(def.required);
      if (cfg.placeholder) input.setPlaceholder(cfg.placeholder);
      if (cfg.minLength !== undefined) input.setMinLength(cfg.minLength);
      if (cfg.maxLength !== undefined) input.setMaxLength(cfg.maxLength);
      if (cfg.value !== undefined) input.setValue(cfg.value);
      label.setTextInputComponent(input);
      return;
    }
    case "select": {
      const menu = applyPick(new StringSelectMenuBuilder(), name, def, cfg);
      menu.addOptions(
        (cfg.options ?? []).map((option) => ({ ...choice(option), ...(option.emoji ? { emoji: option.emoji } : {}) })),
      );
      label.setStringSelectMenuComponent(menu);
      return;
    }
    case "users": {
      const menu = applyPick(new UserSelectMenuBuilder(), name, def, cfg);
      if (cfg.defaultValues?.length) menu.setDefaultUsers([...cfg.defaultValues]);
      label.setUserSelectMenuComponent(menu);
      return;
    }
    case "roles": {
      const menu = applyPick(new RoleSelectMenuBuilder(), name, def, cfg);
      if (cfg.defaultValues?.length) menu.setDefaultRoles([...cfg.defaultValues]);
      label.setRoleSelectMenuComponent(menu);
      return;
    }
    case "channels": {
      const menu = applyPick(new ChannelSelectMenuBuilder(), name, def, cfg);
      if (cfg.channelTypes?.length) menu.setChannelTypes([...cfg.channelTypes]);
      if (cfg.defaultValues?.length) menu.setDefaultChannels([...cfg.defaultValues]);
      label.setChannelSelectMenuComponent(menu);
      return;
    }
    case "mentionables":
      label.setMentionableSelectMenuComponent(applyPick(new MentionableSelectMenuBuilder(), name, def, cfg));
      return;
    case "files": {
      // `file_types` has no setter in discord.js yet; the builder keeps raw
      // API fields passed to its constructor, so it is seeded there.
      const seed = cfg.fileTypes?.length ? { file_types: [...cfg.fileTypes] } : {};
      const upload = new FileUploadBuilder(seed as never).setCustomId(name).setRequired(def.required);
      if (cfg.minValues !== undefined) upload.setMinValues(cfg.minValues);
      if (cfg.maxValues !== undefined) upload.setMaxValues(cfg.maxValues);
      label.setFileUploadComponent(upload);
      return;
    }
    case "radio":
      label.setRadioGroupComponent(
        new RadioGroupBuilder()
          .setCustomId(name)
          .setRequired(def.required)
          .addOptions((cfg.options ?? []).map(choice)),
      );
      return;
    case "checkboxes": {
      const group = new CheckboxGroupBuilder()
        .setCustomId(name)
        .setRequired(def.required)
        .addOptions((cfg.options ?? []).map(choice));
      if (cfg.minValues !== undefined) group.setMinValues(cfg.minValues);
      if (cfg.maxValues !== undefined) group.setMaxValues(cfg.maxValues);
      label.setCheckboxGroupComponent(group);
      return;
    }
    case "checkbox": {
      const box = new CheckboxBuilder().setCustomId(name);
      if (cfg.default) box.setDefault(true);
      label.setCheckboxComponent(box);
      return;
    }
    case "text":
      return; // handled by the caller: a text block has no label wrapper
  }
}

/** Builds a discord.js modal from a custom id, a title and the declared fields. */
export function buildModal(customId: string, title: string, fields: FieldMap): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  for (const [name, def] of Object.entries(fields)) {
    if (def.kind === "text") {
      modal.addTextDisplayComponents(new TextDisplayBuilder().setContent(def.label));
      continue;
    }
    const cfg = def.config as FieldConfig;
    const label = new LabelBuilder().setLabel(def.label);
    if (cfg.description) label.setDescription(cfg.description);
    attach(label, name, def, cfg);
    modal.addLabelComponents(label);
  }
  return modal;
}

/** The value a field resolves to when the submission does not contain it. */
function emptyValue(kind: FieldDef["kind"]): unknown {
  switch (kind) {
    case "short":
    case "paragraph":
      return "";
    case "select":
    case "checkboxes":
      return [];
    case "checkbox":
      return false;
    case "radio":
      return undefined;
    case "mentionables":
      return { users: new Collection(), members: new Collection(), roles: new Collection() };
    default:
      return new Collection();
  }
}

/**
 * Reads a submitted modal into the `ctx.fields` object, one value per declared
 * field and typed by its kind. A field that is missing from the submission
 * (say the definition changed while the modal was open) resolves to its empty
 * value instead of throwing.
 */
export function readModalFields(fields: FieldMap, submitted: ModalSubmitFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(fields)) {
    if (def.kind === "text") continue;
    try {
      out[name] = readOne(name, def, submitted);
    } catch {
      out[name] = emptyValue(def.kind);
    }
  }
  return out;
}

function readOne(name: string, def: FieldDef, submitted: ModalSubmitFields): unknown {
  switch (def.kind) {
    case "short":
    case "paragraph":
      return submitted.getTextInputValue(name);
    case "select":
      return [...submitted.getStringSelectValues(name)];
    case "users":
      return submitted.getSelectedUsers(name) ?? emptyValue(def.kind);
    case "roles":
      return submitted.getSelectedRoles(name) ?? emptyValue(def.kind);
    case "channels":
      return submitted.getSelectedChannels(name) ?? emptyValue(def.kind);
    case "mentionables": {
      const picked = submitted.getSelectedMentionables(name);
      return {
        users: picked?.users ?? new Collection(),
        members: picked?.members ?? new Collection(),
        roles: picked?.roles ?? new Collection(),
      };
    }
    case "files":
      return submitted.getUploadedFiles(name) ?? emptyValue(def.kind);
    case "radio":
      return submitted.getRadioGroup(name) ?? undefined;
    case "checkboxes":
      return [...submitted.getCheckboxGroup(name)];
    case "checkbox":
      return submitted.getCheckbox(name);
    case "text":
      return undefined;
  }
}
