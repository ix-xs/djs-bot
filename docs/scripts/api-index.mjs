/**
 * Generates `src/content/docs/api/exports.md`: one row per symbol the package
 * exports, with the first sentence of its doc comment and the page that
 * documents it. Run from the repository root with `npm run docs:api`; the
 * result is committed, and `test/exports.test.ts` fails when it is out of date.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

const content = path.join(root, "docs/src/content/docs");
export const OUTPUT = path.join(content, "api/exports.md");
/** The page of each language: English, then the translations. */
export const OUTPUTS = { en: OUTPUT, fr: path.join(content, "fr/api/exports.md") };

const ENTRIES = [
  { specifier: "@ix-xs/djs-bot", file: "src/index.ts", intro: { en: "The framework itself.", fr: "Le framework lui-même." } },
  { specifier: "@ix-xs/djs-bot/plugins", file: "src/plugins/index.ts", intro: { en: "The official plugins.", fr: "Les plugins officiels." } },
  {
    specifier: "@ix-xs/djs-bot/testing",
    file: "src/testing.ts",
    intro: { en: "The test harness. Import it from your tests only.", fr: "Le harnais de test. À n'importer que depuis vos tests." },
  },
];

/** The words of the page itself. The descriptions of the symbols come from the source, in English. */
const WORDS = {
  en: {
    title: "All exports",
    description: "Every function, object, class and type the package exports, with what it is for and where it is documented.",
    intro: [
      "The complete list of what you can import, built from the source code. The",
      "description of each symbol is the one your editor shows on hover; the last",
      "column links to the page that explains it.",
    ],
    kinds: { function: "Functions", object: "Objects and constants", class: "Classes", type: "Types" },
    columns: "| Export | What it is | Documented in |",
    reexported: "Re-exported from discord.js",
    convenience: "For convenience, so that a bot rarely needs to import from `discord.js` directly:",
    total: (count) => `${count} symbols are declared by the framework.`,
  },
  fr: {
    title: "Tous les exports",
    description: "Chaque fonction, objet, classe et type exporté par le paquet, avec son rôle et la page qui le documente.",
    intro: [
      "La liste complète de ce que vous pouvez importer, construite à partir du",
      "code source. La description de chaque symbole est celle que votre éditeur",
      "affiche au survol, en anglais comme dans le code ; la dernière colonne mène",
      "à la page qui l'explique.",
    ],
    kinds: { function: "Fonctions", object: "Objets et constantes", class: "Classes", type: "Types" },
    columns: "| Export | Ce que c'est | Documenté dans |",
    reexported: "Réexporté depuis discord.js",
    convenience: "Par commodité, pour qu'un bot ait rarement besoin d'importer directement depuis `discord.js` :",
    total: (count) => `${count} symboles sont déclarés par le framework.`,
  },
};

/** The title of a page in a language: the one of its translation, or the English name given here. */
function titleOf(address, fallback, language) {
  if (language === "en") return fallback;
  for (const extension of [".md", ".mdx"]) {
    const file = path.join(content, language, address.replace(/^\/|\/$/g, "") + extension);
    if (!existsSync(file)) continue;
    const title = /^title:\s*(.+)$/m.exec(readFileSync(file, "utf8"))?.[1];
    if (title) return title.trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return fallback;
}

/** Which page documents what a source file declares. */
const PAGES = {
  "bot.ts": ["Configuration", "/basics/configuration/"],
  "config.ts": ["Configuration", "/basics/configuration/"],
  "constants.ts": ["Project layout", "/basics/project-layout/"],
  "registry.ts": ["Project layout", "/basics/project-layout/"],
  "loader.ts": ["Project layout", "/basics/project-layout/"],
  "ids.ts": ["The ctx object", "/basics/context/"],
  "context.ts": ["The ctx object", "/basics/context/"],
  "messages.ts": ["Wording and theme", "/basics/wording-and-theme/"],
  "definitions.ts": ["Slash commands", "/commands/slash-commands/"],
  "validate.ts": ["Slash commands", "/commands/slash-commands/"],
  "schema.ts": ["Options and autocomplete", "/commands/options/"],
  "guards.ts": ["Guards", "/commands/guards/"],
  "customId.ts": ["Buttons", "/components/buttons/"],
  "modal.ts": ["Modals", "/components/modals/"],
  "ui.ts": ["Components V2", "/components/components-v2/"],
  "pagination.ts": ["Pagination and confirmation", "/components/pagination/"],
  "intents.ts": ["Events and intents", "/events/events-and-intents/"],
  "scheduler.ts": ["Scheduled jobs", "/events/jobs/"],
  "container.ts": ["Services", "/architecture/services/"],
  "index.ts": ["Plugins and hooks", "/architecture/plugins/"],
  "store.ts": ["Store", "/data/store/"],
  "cache.ts": ["Cache and entity resolution", "/data/cache/"],
  "i18n.ts": ["Internationalisation", "/data/i18n/"],
  "flags.ts": ["Feature flags", "/data/flags/"],
  "audit.ts": ["Audit trail", "/data/audit/"],
  "format.ts": ["Mentions, timestamps and safe pings", "/messages/formatting/"],
  "assets.ts": ["Assets and voice", "/messages/assets-and-voice/"],
  "voice.ts": ["Assets and voice", "/messages/assets-and-voice/"],
  "deploy.ts": ["Deploying commands", "/production/deploying/"],
  "sharding.ts": ["Sharding", "/production/sharding/"],
  "health.ts": ["Health and metrics", "/production/health/"],
  "resilience.ts": ["Resilience", "/production/resilience/"],
  "logger.ts": ["Logging", "/production/logging/"],
  "testing.ts": ["Testing", "/production/testing/"],
  "errors.ts": ["Errors", "/api/errors/"],
};

/** Symbols of a shared source file that are documented on a page of their own. */
const BY_NAME = [
  [/^(subcommand|Subcommand)/, ["Subcommands", "/commands/subcommands/"]],
  [/(UserCommand|MessageCommand|InstallContext|InteractionContext)/, ["Context menus", "/commands/context-menus/"]],
  [/^(defineButton|Button)/, ["Buttons", "/components/buttons/"]],
  [/Select/, ["Select menus", "/components/select-menus/"]],
  [/^(defineModal|Modal|field|Field|InferFields)/, ["Modals", "/components/modals/"]],
  [/^(ParamCodec|ParamMap|InferParams|p|oneOf)$/, ["Buttons", "/components/buttons/"]],
  [/^(defineEvent|Event)/, ["Events and intents", "/events/events-and-intents/"]],
  [/^(defineTrigger|Trigger)/, ["Message triggers", "/events/triggers/"]],
  [/^(defineJob|Job)/, ["Scheduled jobs", "/events/jobs/"]],
  [/^(defineService|Service)/, ["Services", "/architecture/services/"]],
  [/^(definePlugin|Plugin|HookRegistrar|MiddlewareFn)/, ["Plugins and hooks", "/architecture/plugins/"]],
  [/^(defineFeature|Feature)/, ["Features", "/architecture/features/"]],
  [/^(Autocomplete|toAutocompleteChoices|NormalizedChoices)/, ["Options and autocomplete", "/commands/options/"]],
  [/^(DeferOption|ResolvedDefer|resolveDefer)/, ["Automatic deferral", "/basics/automatic-deferral/"]],
  [/^(BotError|ERROR_CATALOGUE|ErrorCode)/, ["Errors", "/api/errors/"]],
  [/^(env|loadEnvFile)$/, ["Configuration", "/basics/configuration/"]],
  [/^(Theme|DEFAULT_THEME)$/, ["Wording and theme", "/basics/wording-and-theme/"]],
];

function pageFor(name, file) {
  if (file === "definitions.ts" || file === "schema.ts" || file === "context.ts" || file === "config.ts" || file === "messages.ts" || file === "errors.ts") {
    for (const [pattern, page] of BY_NAME) if (pattern.test(name)) return page;
  }
  return PAGES[file];
}

const KINDS = ["function", "object", "class", "type"];

/** The first sentence of a doc comment, as one line of table-safe Markdown. */
function summarise(text) {
  const paragraph = text.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  const sentence = /^(.*?[.!?])(\s+[A-Z`*]|$)/.exec(paragraph)?.[1] ?? paragraph;
  return sentence
    .replace(/\{@link\s+([^}\s|]+)(?:[\s|][^}]*)?\}/g, "`$1`")
    .replace(/\|/g, "\\|")
    // Outside code spans, an angle bracket would be read as HTML.
    .split("`")
    .map((part, index) => (index % 2 === 0 ? part.replace(/</g, "&lt;") : part))
    .join("`");
}

/** The page in a language ("en" by default), and the names it lists. */
export function generate(language = "en") {
  const words = WORDS[language];
  const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(
    ENTRIES.map((entry) => path.join(root, entry.file)),
    { ...parsed.options, noEmit: true },
  );
  const checker = program.getTypeChecker();
  const sourceDir = path.join(root, "src").split("\\").join("/").toLowerCase() + "/";
  const ownSource = (decl) => decl.getSourceFile().fileName.split("\\").join("/").toLowerCase().startsWith(sourceDir);

  const out = [
    "---",
    `title: "${words.title}"`,
    `description: "${words.description}"`,
    "sidebar:",
    "  order: 1",
    "---",
    "",
    "<!-- Generated by docs/scripts/api-index.mjs from the source. Do not edit by hand: run `npm run docs:api`. -->",
    "",
    ...words.intro,
    "",
  ];
  const names = [];
  let total = 0;

  for (const entry of ENTRIES) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(path.join(root, entry.file)));
    const groups = new Map(KINDS.map((kind) => [kind, []]));
    const reexported = [];

    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      const decl = symbol.declarations?.[0];
      if (!decl) continue;
      if (!ownSource(decl)) {
        reexported.push(exported.name);
        continue;
      }
      let kind = "type";
      if (symbol.flags & ts.SymbolFlags.Class) kind = "class";
      else if (symbol.flags & ts.SymbolFlags.Function) kind = "function";
      else if (symbol.flags & ts.SymbolFlags.Variable) {
        kind = checker.getTypeOfSymbolAtLocation(symbol, decl).getCallSignatures().length ? "function" : "object";
      }
      const doc = ts.displayPartsToString(symbol.getDocumentationComment(checker));
      const page = pageFor(exported.name, path.basename(decl.getSourceFile().fileName));
      if (!page) throw new Error(`No page mapped for ${decl.getSourceFile().fileName} (export ${exported.name})`);
      if (!doc.trim()) throw new Error(`Export ${exported.name} has no doc comment`);
      groups.get(kind).push({ name: exported.name, summary: summarise(doc), page });
      names.push(exported.name);
      total++;
    }

    out.push(`## \`${entry.specifier}\``, "", entry.intro[language], "", "```ts", `import { /* ... */ } from "${entry.specifier}";`, "```", "");
    for (const kind of KINDS) {
      const rows = groups.get(kind).sort((a, b) => a.name.localeCompare(b.name, "en"));
      if (rows.length === 0) continue;
      out.push(`### ${words.kinds[kind]}`, "", words.columns, "| --- | --- | --- |");
      for (const row of rows) {
        const call = kind === "function" ? "()" : "";
        out.push(`| \`${row.name}${call}\` | ${row.summary} | [${titleOf(row.page[1], row.page[0], language)}](${row.page[1]}) |`);
      }
      out.push("");
    }
    if (reexported.length > 0) {
      out.push(
        `### ${words.reexported}`,
        "",
        words.convenience,
        "",
        reexported
          .sort((a, b) => a.localeCompare(b, "en"))
          .map((name) => `\`${name}\``)
          .join(", ") + ".",
        "",
      );
      names.push(...reexported);
    }
  }
  out.push(words.total(total), "");
  return { markdown: out.join("\n"), names };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  for (const [language, file] of Object.entries(OUTPUTS)) {
    const { markdown, names } = generate(language);
    const shown = path.relative(root, file).split(path.sep).join("/");
    if (check) {
      const current = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
      if (current !== markdown) {
        console.error(`${shown} is out of date. Run: npm run docs:api`);
        process.exit(1);
      }
      console.log(`${shown} up to date (${names.length} exports)`);
    } else {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, markdown);
      console.log(`${shown} written (${names.length} exports)`);
    }
  }
}
