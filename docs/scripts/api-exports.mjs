/**
 * The "All exports" page, in each language: one table per page of the
 * documentation, in the order of the sidebar, with every export that page
 * explains, its kind, and the first sentence of its doc comment.
 *
 * Written from the model of `api-model.mjs` (and the French sentences of
 * `src/data/api.fr.json`) by `npm run docs:api`, checked by
 * `npm run docs:api -- --check`. Never edited by hand.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugsOf } from "../sidebar.mjs";

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = path.join(docs, "src/content/docs");

/** Where the page of each language is written. */
export const EXPORTS_PAGES = {
  en: path.join(content, "api/exports.md"),
  fr: path.join(content, "fr/api/exports.md"),
};

const WORDS = {
  en: {
    title: "All exports",
    description: "Every export of the package, one line each, grouped by the page that explains it, with a link to its page in the reference.",
    intro:
      "One table per page of the documentation, in the order of the sidebar. The name leads to the page of the export in the [reference](/reference/). Functions end with `()`.",
    see: (title, link) => `See [${title}](${link}).`,
    head: "| Export | Kind | What it is for |",
    from: (module) => `Import from \`${module}\`.`,
    deprecated: "Deprecated.",
    kinds: { function: "Function", variable: "Object", constant: "Constant", class: "Class", interface: "Interface", type: "Type", enum: "Enum" },
  },
  fr: {
    title: "Tous les exports",
    description: "Chaque export du paquet, une ligne chacun, regroupés par la page qui l'explique, avec un lien vers sa page dans la référence.",
    intro:
      "Un tableau par page de la documentation, dans l'ordre du menu. Le nom mène à la page de l'export dans la [référence](/reference/). Les fonctions se terminent par `()`.",
    see: (title, link) => `Voir [${title}](${link}).`,
    head: "| Export | Genre | À quoi il sert |",
    from: (module) => `S'importe depuis \`${module}\`.`,
    deprecated: "Obsolète.",
    kinds: { function: "Fonction", variable: "Objet", constant: "Constante", class: "Classe", interface: "Interface", type: "Type", enum: "Énumération" },
  },
};

const KIND_ORDER = ["function", "variable", "class", "interface", "type", "enum"];
const ROOT_MODULE = "@ix-xs/djs-bot";

/** The kind as the reference draws it: an object without members is a constant. */
const kindOf = (symbol) =>
  symbol.kind === "variable" && !symbol.properties?.length && !symbol.methods?.length ? "constant" : symbol.kind;

/** The first sentence of a description, as the front page of the reference cuts it. */
function firstSentence(text = "") {
  const paragraph = text.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  const stop = /[.!?](?=\s+[A-Z`*[]|$)/g;
  for (let match; (match = stop.exec(paragraph)); ) {
    if (/\b(e\.g|i\.e|p\. ex)$/.test(paragraph.slice(0, match.index))) continue;
    return paragraph.slice(0, match.index + 1);
  }
  return paragraph;
}

/**
 * A sentence ready for a table cell: links become their text (the same
 * sentence can link differently once translated, and the name of the row
 * already links), backslashes and pipes are escaped (a backslash left alone
 * would cancel the escape of a pipe after it), and `<` outside code stays text.
 */
function cell(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .split("`")
    .map((piece, index) => (index % 2 === 1 ? piece : piece.replace(/</g, "&lt;")))
    .join("`")
    .replace(/[\\|]/g, "\\$&");
}

/** The title of a page of the documentation, in a language (English when it is not translated). */
function titleOf(slug, language) {
  const candidates = language === "en" ? [slug] : [`${language}/${slug}`, slug];
  for (const candidate of candidates) {
    for (const extension of [".md", ".mdx"]) {
      try {
        const source = readFileSync(path.join(content, candidate + extension), "utf8");
        const match = /^title:\s*"?(.*?)"?\s*$/m.exec(source);
        if (match) return match[1];
      } catch {
        // not this one
      }
    }
  }
  throw new Error(`No page for ${slug}`);
}

/** The text of a doc comment in a language: its translation while the English is unchanged. */
function translator(language, tables) {
  const table = tables[language] ?? {};
  return (key, english) => {
    if (!english || language === "en") return english;
    const entry = table[key];
    return entry && entry.en === english && entry.fr ? entry.fr : english;
  };
}

/**
 * The pages, by file: `{ [file]: markdown }`.
 * `tables` holds the translation tables by language (`{ fr: {...} }`).
 */
export function exportsPages(model, tables) {
  const order = slugsOf();
  const bySlug = new Map();
  for (const symbol of model.symbols) {
    const slug = symbol.guide?.replace(/^\/|\/$/g, "");
    if (!order.includes(slug)) throw new Error(`${symbol.name} is explained on ${symbol.guide}, which is not in the sidebar (sidebar.mjs)`);
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(symbol);
  }
  for (const list of bySlug.values()) {
    list.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, "en"));
  }

  const out = {};
  for (const [language, file] of Object.entries(EXPORTS_PAGES)) {
    const w = WORDS[language];
    const t = translator(language, tables);
    const lines = [
      "---",
      `title: ${JSON.stringify(w.title)}`,
      `description: ${JSON.stringify(w.description)}`,
      "---",
      "",
      "<!-- Generated by scripts/api-exports.mjs from src/data/api.json. Do not edit: run `npm run docs:api` from the repository root. -->",
      "",
      w.intro,
    ];
    for (const slug of order) {
      const symbols = bySlug.get(slug);
      if (!symbols) continue;
      const title = titleOf(slug, language);
      lines.push("", `## ${title}`, "", w.see(title, `/${slug}/`), "", w.head, "| --- | --- | --- |");
      for (const symbol of symbols) {
        const name = symbol.kind === "function" ? `${symbol.name}()` : symbol.name;
        const parts = [];
        // A deprecated export says what to use instead, first.
        if (symbol.deprecated) {
          parts.push(`**${w.deprecated}**`);
          if (typeof symbol.deprecated === "string") parts.push(firstSentence(t(`${symbol.name}#deprecated`, symbol.deprecated)));
        }
        parts.push(firstSentence(t(symbol.name, symbol.text)));
        if (symbol.module !== ROOT_MODULE) parts.push(w.from(symbol.module));
        const text = parts.join(" ");
        lines.push(`| [\`${name}\`](/reference/${symbol.slug}/) | ${w.kinds[kindOf(symbol)]} | ${cell(text)} |`);
      }
    }
    out[file] = lines.join("\n") + "\n";
  }
  return out;
}
