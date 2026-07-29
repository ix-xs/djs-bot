/**
 * Typed schema builders shared across the framework.
 *
 * - `s` - slash-command option builders (`s.string`, `s.user`, …). The option
 *   map you pass to {@link defineCommand} is turned into a fully-typed
 *   `ctx.options` object, so `ctx.options.user` is a `GuildMember`, not `any`.
 * - `p` - customId parameter codecs (`p.string`, `p.number`, …) used by
 *   {@link defineButton}/{@link defineSelectMenu} to encode typed params into a
 *   component's customId and decode them back with the right types.
 * - `field` - modal text-input builders.
 *
 * @module schema
 */
import type { Attachment, GuildBasedChannel, GuildMember, LocalizationMap, Role, User, ChannelType } from "discord.js";
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
function makeAttachment(config: CommonOpt & { required: true }): OptionDef<"attachment", true>;
function makeAttachment(config?: CommonOpt): OptionDef<"attachment", false>;
function makeAttachment(config: CommonOpt = {}): OptionDef<"attachment", boolean> {
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
};

/* -------------------------------------------------------------------------- */
/*  Modal fields                                                               */
/* -------------------------------------------------------------------------- */

/** Internal descriptor for a modal text input. */
export interface FieldDef<Req extends boolean = boolean> {
  readonly label: string;
  readonly style: "short" | "paragraph";
  readonly required: Req;
  readonly config: Readonly<Record<string, unknown>>;
}

interface FieldOpt<R extends boolean> {
  /** The label shown above the input. */
  label: string;
  /** Whether the field must be filled. */
  required?: R;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  value?: string;
}

/** A map of field name → descriptor, as passed to {@link defineModal}. */
export type FieldMap = Record<string, FieldDef>;

/** Infers the typed `ctx.fields` object from a {@link FieldMap} (all strings). */
export type InferFields<M extends FieldMap> = {
  [K in keyof M]: string;
};

/**
 * Modal text-input builders.
 * @example
 * fields: {
 *   title: field.short({ label: "Title", required: true }),
 *   body:  field.paragraph({ label: "Details", maxLength: 1000 }),
 * }
 */
export const field = {
  /** A single-line text input. */
  short<R extends boolean = false>(config: FieldOpt<R>): FieldDef<R> {
    return {
      label: config.label,
      style: "short",
      required: (config.required ?? false) as R,
      config: config as unknown as Readonly<Record<string, unknown>>,
    };
  },
  /** A multi-line text input. */
  paragraph<R extends boolean = false>(config: FieldOpt<R>): FieldDef<R> {
    return {
      label: config.label,
      style: "paragraph",
      required: (config.required ?? false) as R,
      config: config as unknown as Readonly<Record<string, unknown>>,
    };
  },
};
