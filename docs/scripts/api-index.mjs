/**
 * Generates `src/content/docs/api/exports.md`: one row per symbol the package
 * exports, with the first sentence of its doc comment and the page that
 * documents it. Run from the repository root with `npm run docs:api`; the
 * result is committed, and `test/exports.test.ts` fails when it is out of date.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

export const OUTPUT = path.join(root, "docs/src/content/docs/api/exports.md");

const ENTRIES = [
  { specifier: "@ix-xs/djs-bot", file: "src/index.ts", intro: "The framework itself." },
  { specifier: "@ix-xs/djs-bot/plugins", file: "src/plugins/index.ts", intro: "The official plugins." },
  { specifier: "@ix-xs/djs-bot/testing", file: "src/testing.ts", intro: "The test harness. Import it from your tests only." },
];

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

const KINDS = [
  ["function", "Functions"],
  ["object", "Objects and constants"],
  ["class", "Classes"],
  ["type", "Types"],
];

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

export function generate() {
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
    'title: "All exports"',
    'description: "Every function, object, class and type the package exports, with what it is for and where it is documented."',
    "sidebar:",
    "  order: 1",
    "---",
    "",
    "<!-- Generated by docs/scripts/api-index.mjs from the source. Do not edit by hand: run `npm run docs:api`. -->",
    "",
    "The complete list of what you can import, built from the source code. The",
    "description of each symbol is the one your editor shows on hover; the last",
    "column links to the page that explains it.",
    "",
  ];
  const names = [];
  let total = 0;

  for (const entry of ENTRIES) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(path.join(root, entry.file)));
    const groups = new Map(KINDS.map(([kind]) => [kind, []]));
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

    out.push(`## \`${entry.specifier}\``, "", entry.intro, "", "```ts", `import { /* ... */ } from "${entry.specifier}";`, "```", "");
    for (const [kind, title] of KINDS) {
      const rows = groups.get(kind).sort((a, b) => a.name.localeCompare(b.name, "en"));
      if (rows.length === 0) continue;
      out.push(`### ${title}`, "", "| Export | What it is | Documented in |", "| --- | --- | --- |");
      for (const row of rows) {
        const call = kind === "function" ? "()" : "";
        out.push(`| \`${row.name}${call}\` | ${row.summary} | [${row.page[0]}](${row.page[1]}) |`);
      }
      out.push("");
    }
    if (reexported.length > 0) {
      out.push(
        "### Re-exported from discord.js",
        "",
        "For convenience, so that a bot rarely needs to import from `discord.js` directly:",
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
  out.push(`${total} symbols are declared by the framework.`, "");
  return { markdown: out.join("\n"), names };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { markdown, names } = generate();
  if (process.argv.includes("--check")) {
    const current = readFileSync(OUTPUT, "utf8").replace(/\r\n/g, "\n");
    if (current !== markdown) {
      console.error("docs/src/content/docs/api/exports.md is out of date. Run: npm run docs:api");
      process.exit(1);
    }
    console.log(`api index up to date (${names.length} exports)`);
  } else {
    writeFileSync(OUTPUT, markdown);
    console.log(`api index written (${names.length} exports)`);
  }
}
