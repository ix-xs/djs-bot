// The API reference: one page per export of the package, built from
// `src/data/api.json` (written by `scripts/api-model.mjs` from the source).
// This module reads that file, groups the symbols by topic, and holds the words
// of the reference pages in each language.
import api from "../data/api.json";
import fr from "../data/api.fr.json";

/** A piece of code: plain text, or text linked to a page. */
export type Token = [string] | [string, { ref?: string; href?: string; external?: string }];

export interface Doc {
  text?: string;
  examples?: string[];
  deprecated?: string | true;
  default?: string;
  see?: string[];
}

export interface Param extends Doc {
  name: string;
  type: Token[];
  optional?: boolean;
  rest?: boolean;
  default?: string;
  doc?: string;
  fields?: Property[];
}

export interface Signature {
  params: Param[];
  returns: { type: Token[]; doc?: string };
  typeParams?: TypeParam[];
  doc?: Doc;
  code: Token[];
}

export interface TypeParam {
  name: string;
  constraint?: Token[];
  default?: Token[];
}

export interface Property extends Doc {
  name: string;
  type: Token[];
  optional?: boolean;
  readonly?: boolean;
  static?: boolean;
  inheritedFrom?: string;
}

export interface Method extends Doc {
  name: string;
  overloads: Signature[];
  optional?: boolean;
  static?: boolean;
  details?: string;
  inheritedFrom?: string;
}

export type Kind = "function" | "class" | "interface" | "type" | "variable" | "enum";

export interface ApiSymbol extends Doc {
  name: string;
  kind: Kind;
  module: string;
  source: string;
  file: string;
  guide?: string;
  code?: Token[];
  overloads?: Signature[];
  ctor?: Signature;
  properties?: Property[];
  methods?: Method[];
  values?: string[];
  typeParams?: TypeParam[];
  usedBy?: string[];
  slug: string;
}

export const model = api as unknown as {
  discordjs: string;
  modules: { name: string; intro: Record<string, string> }[];
  symbols: ApiSymbol[];
  reexported: { name: string; module: string; link?: { href?: string } }[];
};

export const symbols = model.symbols;
const byName = new Map(symbols.map((s) => [s.name, s]));
export const find = (name: string) => byName.get(name);

/** The address of a symbol's page, as the model sets it (`define-command`). */
export const slugOf = (name: string) => byName.get(name)?.slug ?? name.toLowerCase();
export const pathOf = (name: string) => `/reference/${slugOf(name)}/`;

/** What the kind of a symbol is called, and how it is drawn. */
export const KIND_ORDER: Kind[] = ["function", "variable", "class", "interface", "type", "enum"];
export function kindOf(symbol: ApiSymbol): Kind | "constant" {
  if (symbol.kind === "variable" && !symbol.properties?.length && !symbol.methods?.length) return "constant";
  return symbol.kind;
}

/** The topics of the reference, in the order of the guide. */
export const TOPICS = [
  "basics",
  "commands",
  "components",
  "events",
  "architecture",
  "data",
  "messages",
  "production",
  "api",
] as const;
export type Topic = (typeof TOPICS)[number];
export const topicOf = (symbol: ApiSymbol): Topic => (symbol.guide?.split("/")[1] as Topic) ?? "basics";

/** The symbols of each topic: what you call first, then what you read. */
export function grouped(): { topic: Topic; symbols: ApiSymbol[] }[] {
  return TOPICS.map((topic) => ({
    topic,
    symbols: symbols
      .filter((s) => topicOf(s) === topic)
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, "en")),
  })).filter((group) => group.symbols.length > 0);
}

/** The symbols a beginner meets first. */
export const ESSENTIALS = ["defineBot", "defineCommand", "s", "CommandContext", "defineButton", "defineEvent"];

/* -------------------------------------------------------------------------- */
/*  Translation                                                                */
/* -------------------------------------------------------------------------- */

type Table = Record<string, { en: string; fr?: string }>;
const TABLES: Record<string, Table> = { fr: fr as Table };

/**
 * A sentence of the reference in a language. English is the source: a
 * translation is used only while the sentence it was made from is still the
 * one in the code, so a doc comment that changes falls back to English until
 * it is translated again.
 */
export function translate(key: string, english: string | undefined, locale: string | undefined): string | undefined {
  if (!english || !locale) return english;
  const entry = TABLES[locale]?.[key];
  return entry && entry.en === english && entry.fr ? entry.fr : english;
}

/** Whether a sentence still waits for its translation. */
export function untranslated(key: string, english: string | undefined, locale: string | undefined): boolean {
  if (!english || !locale) return false;
  const entry = TABLES[locale]?.[key];
  return !(entry && entry.en === english && entry.fr);
}

/* -------------------------------------------------------------------------- */
/*  Words                                                                      */
/* -------------------------------------------------------------------------- */

const en = {
  title: "API reference",
  lead: "Every function, object, class and type the package exports, each on a page of its own: what it is for, what it takes, what it gives back.",
  sidebarAll: "Overview",
  kinds: {
    function: "Function",
    variable: "Object",
    constant: "Constant",
    class: "Class",
    interface: "Interface",
    type: "Type",
    enum: "Enum",
  },
  kindsPlural: {
    function: "Functions",
    variable: "Objects",
    constant: "Constants",
    class: "Classes",
    interface: "Interfaces",
    type: "Types",
    enum: "Enums",
  },
  kindHelp: {
    function: "Something you call. `defineCommand({ ... })` is a function: you call it, it gives something back.",
    variable: "A ready-made value that groups related functions. `s` is an object: `s.string()`, `s.user()`...",
    class: "A kind of object with its own methods. You rarely create one yourself: `defineBot()` gives you a `Bot`.",
    interface: "The shape of an object: the list of what it holds. You read it (`ctx` is a `CommandContext`) or you fill it in (the options of `defineBot()` are a `BotConfig`).",
    type: "A name given to a set of possible values, such as `\"info\" | \"error\"`. It exists for your editor only.",
  },
  howToRead: "How to read this reference",
  howToReadText:
    "Each page answers three questions: what the thing is for, what it takes, and what it gives back. The coloured letter before a name tells you what kind of thing it is:",
  essentials: "Where to start",
  essentialsText: "Six exports cover most bots. Start with these, and follow the links from there.",
  topics: {
    basics: "Basics",
    commands: "Commands",
    components: "Components",
    events: "Events",
    architecture: "Architecture",
    data: "Data",
    messages: "Messages",
    production: "Production",
    api: "Errors",
  },
  modules: "Entry points",
  modulesText: "The package has three entry points. Almost everything comes from the first one.",
  reexported: "Re-exported from discord.js",
  reexportedText: "For convenience, so that a bot rarely needs to import from `discord.js` directly. They are documented on discord.js.org:",
  import: "Import",
  declaration: "Declaration",
  parameters: "Parameters",
  parameter: "Parameter",
  type: "Type",
  description: "Description",
  returns: "Returns",
  example: "Example",
  examples: "Examples",
  properties: "Properties",
  methods: "Methods",
  values: "Possible values",
  constructor: "Constructor",
  typeParams: "Type parameters",
  usedBy: "Used by",
  usedByText: "The other exports that mention this one.",
  see: "See also",
  guide: "Explained in the guide",
  source: "Source",
  optional: "optional",
  readonly: "read-only",
  static: "static",
  deprecated: "Deprecated",
  default: "Default:",
  inherited: "From",
  accepts: "What it accepts",
  form: "Form",
  nothing: "Nothing",
  untranslated: "",
  members: (count: number) => `${count} ${count === 1 ? "member" : "members"}`,
  summary: (kind: string) => kind,
};

type Words = typeof en;

const frWords: Words = {
  title: "Référence de l'API",
  lead: "Chaque fonction, objet, classe et type exporté par le paquet, chacun sur sa propre page : à quoi il sert, ce qu'il prend, ce qu'il renvoie.",
  sidebarAll: "Vue d'ensemble",
  kinds: {
    function: "Fonction",
    variable: "Objet",
    constant: "Constante",
    class: "Classe",
    interface: "Interface",
    type: "Type",
    enum: "Énumération",
  },
  kindsPlural: {
    function: "Fonctions",
    variable: "Objets",
    constant: "Constantes",
    class: "Classes",
    interface: "Interfaces",
    type: "Types",
    enum: "Énumérations",
  },
  kindHelp: {
    function: "Quelque chose que vous appelez. `defineCommand({ ... })` est une fonction : vous l'appelez, elle vous rend quelque chose.",
    variable: "Une valeur toute prête qui regroupe des fonctions de la même famille. `s` est un objet : `s.string()`, `s.user()`...",
    class: "Un genre d'objet avec ses propres méthodes. Vous en créez rarement un vous-même : `defineBot()` vous donne un `Bot`.",
    interface: "La forme d'un objet : la liste de ce qu'il contient. Vous la lisez (`ctx` est un `CommandContext`) ou vous la remplissez (les options de `defineBot()` sont un `BotConfig`).",
    type: "Un nom donné à un ensemble de valeurs possibles, comme `\"info\" | \"error\"`. Il n'existe que pour votre éditeur.",
  },
  howToRead: "Comment lire cette référence",
  howToReadText:
    "Chaque page répond à trois questions : à quoi sert la chose, ce qu'elle prend, et ce qu'elle renvoie. La lettre de couleur devant un nom indique de quel genre de chose il s'agit :",
  essentials: "Par où commencer",
  essentialsText: "Six exports couvrent la plupart des bots. Commencez par eux, et suivez les liens à partir de là.",
  topics: {
    basics: "Bases",
    commands: "Commandes",
    components: "Composants",
    events: "Événements",
    architecture: "Architecture",
    data: "Données",
    messages: "Messages",
    production: "Production",
    api: "Erreurs",
  },
  modules: "Points d'entrée",
  modulesText: "Le paquet a trois points d'entrée. Presque tout vient du premier.",
  reexported: "Réexporté depuis discord.js",
  reexportedText: "Par commodité, pour qu'un bot ait rarement besoin d'importer directement depuis `discord.js`. Ils sont documentés sur discord.js.org :",
  import: "Import",
  declaration: "Déclaration",
  parameters: "Paramètres",
  parameter: "Paramètre",
  type: "Type",
  description: "Description",
  returns: "Renvoie",
  example: "Exemple",
  examples: "Exemples",
  properties: "Propriétés",
  methods: "Méthodes",
  values: "Valeurs possibles",
  constructor: "Constructeur",
  typeParams: "Paramètres de type",
  usedBy: "Utilisé par",
  usedByText: "Les autres exports qui mentionnent celui-ci.",
  see: "Voir aussi",
  guide: "Expliqué dans le guide",
  source: "Source",
  optional: "facultatif",
  readonly: "lecture seule",
  static: "statique",
  deprecated: "Obsolète",
  default: "Par défaut :",
  inherited: "Vient de",
  accepts: "Ce qu'il accepte",
  form: "Forme",
  nothing: "Rien",
  untranslated: "Pas encore traduit",
  members: (count: number) => `${count} ${count === 1 ? "membre" : "membres"}`,
  summary: (kind: string) => kind,
};

export function words(locale: string | undefined): Words {
  return locale === "fr" ? frWords : en;
}

/** The sidebar of the reference: one group per topic, one link per symbol. */
export function sidebar(locale: string | undefined) {
  const w = words(locale);
  return [
    { label: w.sidebarAll, link: "/reference/" },
    ...grouped().map(({ topic, symbols: list }) => ({
      label: w.topics[topic],
      collapsed: true,
      items: list.map((symbol) => ({
        label: symbol.name,
        link: pathOf(symbol.name),
        attrs: { "data-kind": kindOf(symbol), translate: "no" },
      })),
    })),
  ];
}
