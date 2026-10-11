/**
 * Typed schema builders shared across the framework.
 *
 * - `s` - slash-command option builders (`s.string`, `s.user`, …). The option
 *   map you pass to {@link defineCommand} is turned into a fully-typed
 *   `ctx.options` object, so `ctx.options.user` is a `GuildMember`, not `any`.
 * - `p` - customId parameter codecs (`p.string`, `p.number`, …) used by
 *   {@link defineButton}/{@link defineSelectMenu} to encode typed params into a
 *   component's customId and decode them back with the right types.
 * - `field` - modal component builders (text inputs, selects, file uploads,
 *   radio groups, checkboxes).
 *
 * @module schema
 */
import type {
  Attachment,
  ChannelType,
  Collection,
  GuildBasedChannel,
  GuildMember,
  LocalizationMap,
  Role,
  User,
} from "discord.js";
import type { AutocompleteHandler } from "./context.js";

/* -------------------------------------------------------------------------- */
/*  Slash command options                                                     */
/* -------------------------------------------------------------------------- */

/** Every supported slash-command option kind. */
export type OptionKind =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "user"
  | "member"
  | "channel"
  | "role"
  | "mentionable"
  | "attachment";

/** Resolved runtime type produced by an option of a given kind. */
export interface OptionOutput {
  string: string;
  integer: number;
  number: number;
  boolean: boolean;
  user: User;
  member: GuildMember;
  channel: GuildBasedChannel;
  role: Role;
  mentionable: Role | User | GuildMember;
  attachment: Attachment;
}

/** Internal descriptor for a single option. */
export interface OptionDef<K extends OptionKind = OptionKind, Req extends boolean = boolean> {
  readonly kind: K;
  readonly required: Req;
  readonly description: string;
  readonly config: Readonly<Record<string, unknown>>;
  /** Phantom marker for output-type inference. Never present at runtime. */
  readonly __out?: OptionOutput[K];
}

/** Any option descriptor. */
export type AnyOption = OptionDef<OptionKind, boolean>;

/** A map of option name → descriptor, as passed to {@link defineCommand}. */
export type OptionMap = Record<string, AnyOption>;

type InferOne<O> = O extends OptionDef<infer K, infer R>
  ? R extends true
    ? OptionOutput[K]
    : OptionOutput[K] | undefined
  : never;

/** Infers the typed `ctx.options` object from an {@link OptionMap}. */
export type InferOptions<M extends OptionMap> = {
  [K in keyof M]: InferOne<M[K]>;
};

interface CommonOpt {
  /** Shown to users in the Discord command picker. */
  description?: string;
  /** Whether the option must be provided. Drives whether the type is optional. */
  required?: boolean;
  /** Per-locale translations of the option name. */
  nameLocalizations?: LocalizationMap;
  /** Per-locale translations of the option description. */
  descriptionLocalizations?: LocalizationMap;
}

interface StringOpt extends CommonOpt {
  minLength?: number;
  maxLength?: number;
  choices?: ReadonlyArray<{ name: string; value: string }>;
  /** `true`, or an async handler returning up to 25 suggestions. */
  autocomplete?: boolean | AutocompleteHandler;
}
interface NumberOpt extends CommonOpt {
  min?: number;
  max?: number;
  choices?: ReadonlyArray<{ name: string; value: number }>;
  /** `true`, or an async handler returning up to 25 suggestions. */
  autocomplete?: boolean | AutocompleteHandler;
}
interface ChannelOpt extends CommonOpt {
  channelTypes?: ReadonlyArray<ChannelType>;
}

/**
 * What a file may be: one of Discord's categories, or a dot-prefixed extension.
 * Matching is done on the file's extension only.
 */
export type FileType = "image" | "video" | "audio" | `.${string}`;

interface AttachmentOpt extends CommonOpt {
  /**
   * Restricts which files the user may attach, e.g. `["image", ".pdf"]`. Up to
   * 10 entries. Discord filters the file picker and refuses anything else.
   */
  fileTypes?: ReadonlyArray<FileType>;
}

function def<K extends OptionKind>(kind: K, config: CommonOpt): OptionDef<K, boolean> {
  return {
    kind,
    required: config.required ?? false,
    description: config.description ?? "No description provided.",
    config: config as unknown as Readonly<Record<string, unknown>>,
  };
}

/**
 * Each builder is overloaded: passing `{ required: true }` returns a "required"
 * option (`OptionDef<K, true>` → non-optional in `ctx.options`), otherwise an
 * optional one. Overloads (rather than a `const` type param) keep inline
 * callbacks like `autocomplete` fully typed.
 */
function makeString(config: StringOpt & { required: true }): OptionDef<"string", true>;
function makeString(config?: StringOpt): OptionDef<"string", false>;
function makeString(config: StringOpt = {}): OptionDef<"string", boolean> {
  return def("string", config);
}
function makeInteger(config: NumberOpt & { required: true }): OptionDef<"integer", true>;
function makeInteger(config?: NumberOpt): OptionDef<"integer", false>;
function makeInteger(config: NumberOpt = {}): OptionDef<"integer", boolean> {
  return def("integer", config);
}
function makeNumber(config: NumberOpt & { required: true }): OptionDef<"number", true>;
function makeNumber(config?: NumberOpt): OptionDef<"number", false>;
function makeNumber(config: NumberOpt = {}): OptionDef<"number", boolean> {
  return def("number", config);
}
function makeBoolean(config: CommonOpt & { required: true }): OptionDef<"boolean", true>;
function makeBoolean(config?: CommonOpt): OptionDef<"boolean", false>;
function makeBoolean(config: CommonOpt = {}): OptionDef<"boolean", boolean> {
  return def("boolean", config);
}
function makeUser(config: CommonOpt & { required: true }): OptionDef<"user", true>;
function makeUser(config?: CommonOpt): OptionDef<"user", false>;
function makeUser(config: CommonOpt = {}): OptionDef<"user", boolean> {
  return def("user", config);
}
function makeMember(config: CommonOpt & { required: true }): OptionDef<"member", true>;
function makeMember(config?: CommonOpt): OptionDef<"member", false>;
function makeMember(config: CommonOpt = {}): OptionDef<"member", boolean> {
  return def("member", config);
}
function makeChannel(config: ChannelOpt & { required: true }): OptionDef<"channel", true>;
function makeChannel(config?: ChannelOpt): OptionDef<"channel", false>;
function makeChannel(config: ChannelOpt = {}): OptionDef<"channel", boolean> {
  return def("channel", config);
}
function makeRole(config: CommonOpt & { required: true }): OptionDef<"role", true>;
function makeRole(config?: CommonOpt): OptionDef<"role", false>;
function makeRole(config: CommonOpt = {}): OptionDef<"role", boolean> {
  return def("role", config);
}
function makeMentionable(config: CommonOpt & { required: true }): OptionDef<"mentionable", true>;
function makeMentionable(config?: CommonOpt): OptionDef<"mentionable", false>;
function makeMentionable(config: CommonOpt = {}): OptionDef<"mentionable", boolean> {
  return def("mentionable", config);
}
function makeAttachment(config: AttachmentOpt & { required: true }): OptionDef<"attachment", true>;
function makeAttachment(config?: AttachmentOpt): OptionDef<"attachment", false>;
function makeAttachment(config: AttachmentOpt = {}): OptionDef<"attachment", boolean> {
  return def("attachment", config);
}

/**
 * Slash-command option builders. Pass the result to {@link defineCommand}'s
 * `options` map; the handler's `ctx.options` is typed from it - `required: true`
 * makes the value non-optional.
 *
 * @example
 * options: {
 *   target: s.user({ description: "Who to ban", required: true }), // ctx.options.target: User
 *   reason: s.string({ description: "Why", maxLength: 200 }),       // ctx.options.reason?: string
 *   days:   s.integer({ min: 0, max: 7 }),                          // ctx.options.days?: number
 *   query:  s.string({ autocomplete: async (ac) => [{ name: ac.value, value: ac.value }] }),
 * }
 */
export const s = {
  /** A text option. */
  string: makeString,
  /** An integer option (whole numbers). */
  integer: makeInteger,
  /** A floating-point number option. */
  number: makeNumber,
  /** A boolean (true/false) option. */
  boolean: makeBoolean,
  /** A user option - resolves to a {@link User}. */
  user: makeUser,
  /** A member option - resolves to a {@link GuildMember} (guild-only). */
  member: makeMember,
  /** A channel option - resolves to a guild channel. */
  channel: makeChannel,
  /** A role option - resolves to a {@link Role}. */
  role: makeRole,
  /** A mentionable option - user, member or role. */
  mentionable: makeMentionable,
  /** An attachment option - resolves to an {@link Attachment}. */
  attachment: makeAttachment,
};

/* -------------------------------------------------------------------------- */
/*  customId parameter codecs                                                  */
/* -------------------------------------------------------------------------- */

/** Encodes/decodes a single customId parameter with a known runtime type. */
export interface ParamCodec<T> {
  readonly type: "string" | "number" | "boolean";
  /** Serialises a value to a string. */
  encode(value: T): string;
  /** Parses a string back into the typed value. */
  decode(raw: string): T;
}

/** A map of param name → codec, as passed to {@link defineButton}. */
export type ParamMap = Record<string, ParamCodec<unknown>>;

/** Infers the typed `ctx.params` object from a {@link ParamMap}. */
export type InferParams<M extends ParamMap> = {
  [K in keyof M]: M[K] extends ParamCodec<infer T> ? T : never;
};

/**
 * customId parameter codecs. Attach a `params` map to a component so that
 * `Component.build({ ... })` is fully typed and `ctx.params` is decoded for you.
 *
 * @example
 * params: { ticketId: p.string, ownerId: p.string, page: p.number }
 */
export const p = {
  /** A string parameter. */
  string: {
    type: "string",
    encode: (v: string) => v,
    decode: (raw: string) => raw,
  } as ParamCodec<string>,
  /** A number parameter. */
  number: {
    type: "number",
    encode: (v: number) => String(v),
    decode: (raw: string) => Number(raw),
  } as ParamCodec<number>,
  /** A boolean parameter (`"1"`/`"0"`). */
  boolean: {
    type: "boolean",
    encode: (v: boolean) => (v ? "1" : "0"),
    decode: (raw: string) => raw === "1",
  } as ParamCodec<boolean>,
  /** A parameter restricted to a fixed set of strings (typed as that union). */
  oneOf,
};

/**
 * Builds a codec for a parameter that must be one of a fixed set of strings, so
 * `ctx.params` is typed as that union instead of a plain `string`.
 *
 * @example params: { action: oneOf("approve", "reject") } // "approve" | "reject"
 */
export function oneOf<const T extends readonly [string, ...string[]]>(...values: T): ParamCodec<T[number]> {
  const allowed = new Set<string>(values);
  return {
    type: "string",
    encode: (v) => v,
    decode: (raw) => (allowed.has(raw) ? raw : values[0]) as T[number],
  };
}

/* -------------------------------------------------------------------------- */
/*  Modal fields                                                               */
/* -------------------------------------------------------------------------- */

/** Every kind of component a modal can hold. */
export type FieldKind =
  | "short"
  | "paragraph"
  | "select"
  | "users"
  | "roles"
  | "channels"
  | "mentionables"
  | "files"
  | "radio"
  | "checkboxes"
  | "checkbox"
  | "text";

/** What `ctx.fields.<name>` holds for each kind of field. */
export interface FieldOutput<Req extends boolean = boolean> {
  short: string;
  paragraph: string;
  /** The values picked in a string select. */
  select: string[];
  users: Collection<string, User>;
  roles: Collection<string, Role>;
  channels: Collection<string, GuildBasedChannel>;
  mentionables: {
    users: Collection<string, User>;
    members: Collection<string, GuildMember>;
    roles: Collection<string, Role>;
  };
  /** The uploaded files. */
  files: Collection<string, Attachment>;
  /** The chosen value; `undefined` only when the group is optional and left empty. */
  radio: Req extends true ? string : string | undefined;
  /** The ticked values of a checkbox group. */
  checkboxes: string[];
  /** Whether a single checkbox was ticked. */
  checkbox: boolean;
}

/** Internal descriptor for one modal component. */
export interface FieldDef<Req extends boolean = boolean, K extends FieldKind = FieldKind> {
  readonly kind: K;
  /** The label shown above the component (the content itself for `text`). */
  readonly label: string;
  /** Text-input style. Only set on `short` and `paragraph` fields. */
  readonly style?: "short" | "paragraph";
  readonly required: Req;
  readonly config: Readonly<Record<string, unknown>>;
}

/** Options shared by every labelled field. */
interface LabelOpt<R extends boolean> {
  /** The label shown above the component. */
  label: string;
  /** Smaller help text shown under the label. */
  description?: string;
  /** Whether the field must be filled. */
  required?: R;
}

interface TextOpt<R extends boolean> extends LabelOpt<R> {
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  /** A pre-filled value. */
  value?: string;
}

/** One entry of a `select`, `radio` or `checkboxes` field. */
export interface FieldChoice {
  /** What the user reads. */
  label: string;
  /** What your handler receives. */
  value: string;
  /** Extra text under the label. */
  description?: string;
  /** Pre-selected when the modal opens. */
  default?: boolean;
  /** An emoji shown next to the label (string selects only). */
  emoji?: string;
}

interface PickOpt<R extends boolean> extends LabelOpt<R> {
  placeholder?: string;
  /** Fewest items that must be picked. */
  minValues?: number;
  /** Most items that may be picked. */
  maxValues?: number;
}

interface ChoiceOpt<R extends boolean> extends PickOpt<R> {
  /** The choices offered. At least one. */
  options: readonly FieldChoice[];
}

interface EntityOpt<R extends boolean> extends PickOpt<R> {
  /** Ids selected when the modal opens. */
  defaultValues?: readonly string[];
}

/** A map of field name → descriptor, as passed to {@link defineModal}. */
export type FieldMap = Record<string, FieldDef>;

/**
 * Infers the typed `ctx.fields` object from a {@link FieldMap}. Text inputs are
 * strings, selects are arrays or collections, a checkbox is a boolean, and
 * `field.text` blocks (display only) are left out.
 */
export type InferFields<M extends FieldMap> = {
  [K in keyof M as M[K] extends FieldDef<boolean, "text"> ? never : K]: M[K] extends FieldDef<infer R, infer Kind>
    ? FieldOutput<R>[Exclude<Kind, "text">]
    : never;
};

function make<K extends FieldKind, R extends boolean>(
  kind: K,
  config: LabelOpt<R>,
  extra: Partial<FieldDef> = {},
): FieldDef<R, K> {
  return {
    kind,
    label: config.label,
    required: (config.required ?? false) as R,
    config: config as unknown as Readonly<Record<string, unknown>>,
    ...extra,
  } as FieldDef<R, K>;
}

/**
 * Modal component builders. Every field is rendered inside a labelled block, so
 * each accepts a `label` and an optional `description`.
 *
 * @example
 * fields: {
 *   title:    field.short({ label: "Title", required: true }),
 *   body:     field.paragraph({ label: "Details", maxLength: 1000 }),
 *   category: field.select({ label: "Category", options: [{ label: "Bug", value: "bug" }] }),
 *   assignee: field.users({ label: "Assign to", maxValues: 1 }),
 *   proof:    field.files({ label: "Screenshots", maxValues: 3 }),
 *   urgent:   field.checkbox({ label: "This is urgent" }),
 * }
 */
export const field = {
  /** A single-line text input. `ctx.fields.x` is a `string`. */
  short<R extends boolean = false>(config: TextOpt<R>): FieldDef<R, "short"> {
    return make("short", config, { style: "short" });
  },
  /** A multi-line text input. `ctx.fields.x` is a `string`. */
  paragraph<R extends boolean = false>(config: TextOpt<R>): FieldDef<R, "paragraph"> {
    return make("paragraph", config, { style: "paragraph" });
  },
  /** A dropdown of your own options. `ctx.fields.x` is a `string[]`. */
  select<R extends boolean = false>(config: ChoiceOpt<R>): FieldDef<R, "select"> {
    return make("select", config);
  },
  /** A user picker. `ctx.fields.x` is a `Collection<string, User>`. */
  users<R extends boolean = false>(config: EntityOpt<R>): FieldDef<R, "users"> {
    return make("users", config);
  },
  /** A role picker. `ctx.fields.x` is a `Collection<string, Role>`. */
  roles<R extends boolean = false>(config: EntityOpt<R>): FieldDef<R, "roles"> {
    return make("roles", config);
  },
  /** A channel picker. `ctx.fields.x` is a `Collection<string, GuildBasedChannel>`. */
  channels<R extends boolean = false>(
    config: EntityOpt<R> & { channelTypes?: readonly ChannelType[] },
  ): FieldDef<R, "channels"> {
    return make("channels", config);
  },
  /** A picker for users and roles together. `ctx.fields.x` is `{ users, members, roles }`. */
  mentionables<R extends boolean = false>(config: PickOpt<R>): FieldDef<R, "mentionables"> {
    return make("mentionables", config);
  },
  /**
   * A file upload. `ctx.fields.x` is a `Collection<string, Attachment>`.
   * `fileTypes` restricts what may be uploaded, e.g. `["image", ".pdf"]`.
   */
  files<R extends boolean = false>(
    config: Omit<PickOpt<R>, "placeholder"> & { fileTypes?: ReadonlyArray<FileType> },
  ): FieldDef<R, "files"> {
    return make("files", config);
  },
  /** A group of radio buttons (pick one). `ctx.fields.x` is the chosen value. */
  radio<R extends boolean = false>(
    config: LabelOpt<R> & { options: readonly FieldChoice[] },
  ): FieldDef<R, "radio"> {
    return make("radio", config);
  },
  /** A group of checkboxes (pick several). `ctx.fields.x` is a `string[]`. */
  checkboxes<R extends boolean = false>(config: Omit<ChoiceOpt<R>, "placeholder">): FieldDef<R, "checkboxes"> {
    return make("checkboxes", config);
  },
  /** A single checkbox. `ctx.fields.x` is a `boolean`. */
  checkbox(config: Omit<LabelOpt<false>, "required"> & { default?: boolean }): FieldDef<false, "checkbox"> {
    return make("checkbox", config);
  },
  /** A block of markdown shown between fields. Display only: absent from `ctx.fields`. */
  text(content: string): FieldDef<false, "text"> {
    return make("text", { label: content });
  },
};
