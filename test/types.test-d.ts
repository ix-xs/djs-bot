/**
 * Type-level tests. These have no runtime assertions - they fail the build
 * (via `npm run test:types`) if the framework's type contracts regress.
 * Notably, they lock the `required` → non-optional inference that a subtle
 * generics bug once broke.
 */
import {
  s,
  p,
  field,
  defineCommand,
  defineButton,
  defineModal,
  type InferOptions,
  type InferParams,
  type InferFields,
} from "../src/index.js";
import type { Attachment, GuildBasedChannel, GuildMember, Role, User } from "discord.js";

/* ------------------------------- helpers --------------------------------- */

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

/* ------------------------- option required inference --------------------- */

const options = {
  target: s.user({ required: true }),
  reason: s.string(),
  days: s.integer({ min: 0, max: 7 }),
  flag: s.boolean({ required: true }),
  where: s.channel({ required: true }),
  who: s.role(),
  any: s.mentionable({ required: true }),
  file: s.attachment(),
  member: s.member({ required: true }),
};
type Opts = InferOptions<typeof options>;

// Required options are non-optional and correctly typed…
type _r1 = Expect<Equal<Opts["target"], User>>;
type _r2 = Expect<Equal<Opts["flag"], boolean>>;
type _r3 = Expect<Equal<Opts["where"], GuildBasedChannel>>;
type _r4 = Expect<Equal<Opts["any"], Role | User | GuildMember>>;
type _r5 = Expect<Equal<Opts["member"], GuildMember>>;

// …optional options include `| undefined`.
type _o1 = Expect<Equal<Opts["reason"], string | undefined>>;
type _o2 = Expect<Equal<Opts["days"], number | undefined>>;
type _o3 = Expect<Equal<Opts["who"], Role | undefined>>;
type _o4 = Expect<Equal<Opts["file"], Attachment | undefined>>;

/* --------------------------- customId params ----------------------------- */

type Params = InferParams<{ id: typeof p.string; page: typeof p.number; open: typeof p.boolean }>;
type _p1 = Expect<Equal<Params, { id: string; page: number; open: boolean }>>;

/* ----------------------------- modal fields ------------------------------ */

type Fields = InferFields<{ subject: ReturnType<typeof field.short>; body: ReturnType<typeof field.paragraph> }>;
type _f1 = Expect<Equal<Fields, { subject: string; body: string }>>;

/* --------------------- ctx types inside handlers ------------------------- */

defineCommand({
  name: "t",
  description: "t",
  options: { user: s.user({ required: true }), note: s.string() },
  run: (ctx) => {
    type _c1 = Expect<Equal<typeof ctx.options.user, User>>;
    type _c2 = Expect<Equal<typeof ctx.options.note, string | undefined>>;
    type _c3 = Expect<Equal<typeof ctx.locale, string>>;
    void ctx.t("k");
  },
});

defineButton({
  id: "b",
  params: { ticketId: p.string, page: p.number },
  run: (ctx) => {
    type _b1 = Expect<Equal<typeof ctx.params.ticketId, string>>;
    type _b2 = Expect<Equal<typeof ctx.params.page, number>>;
  },
});

defineModal({
  id: "m",
  title: "m",
  fields: { note: field.paragraph({ label: "Note" }) },
  run: (ctx) => {
    type _m1 = Expect<Equal<typeof ctx.fields.note, string>>;
  },
});

// Reference the type aliases so unused-locals rules don't complain.
export type _Check = [
  _r1, _r2, _r3, _r4, _r5, _o1, _o2, _o3, _o4, _p1, _f1,
];
