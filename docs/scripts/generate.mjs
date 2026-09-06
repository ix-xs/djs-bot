// Generates the Starlight "Guide" pages from the repo's USAGE.md - one page per
// `##` section, grouped into categories so the sidebar stays navigable.
// Run with: npm run generate (from docs/).
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const guideDir = path.resolve(here, "..", "src", "content", "docs", "guide");

/**
 * The category each USAGE.md section (by its number) belongs to. The order of
 * this list is the order of the sidebar groups. Keep it in sync with the sidebar
 * in astro.config.mjs (both are generated from CATEGORIES below).
 */
export const CATEGORIES = [
  { label: "Basics", slug: "basics", sections: [1, 2, 3, 4] },
  { label: "Commands & options", slug: "commands", sections: [5, 6, 7, 8, 9, 21] },
  { label: "Components & interactions", slug: "components", sections: [12, 13, 14, 16, 30] },
  { label: "Messages & formatting", slug: "messages", sections: [15, 17, 18, 19, 32, 33] },
  { label: "Events & triggers", slug: "events", sections: [10, 11] },
  { label: "Architecture", slug: "architecture", sections: [22, 23, 24, 25] },
  { label: "Data & state", slug: "data", sections: [20, 35, 36, 39] },
  { label: "Production & ops", slug: "ops", sections: [26, 29, 31, 34, 37, 38, 40] },
  { label: "Errors & testing", slug: "reference", sections: [27, 28] },
];

const categoryOf = (num) => CATEGORIES.find((c) => c.sections.includes(num)) ?? CATEGORIES[CATEGORIES.length - 1];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The hand-written API reference pages, by slug. */
const API_PAGES = {
  configuration: "Configuration & environment",
  context: "The ctx object",
  definitions: "Definitions",
  options: "Options & schemas",
  guards: "Guards",
  services: "Services & dependency injection",
  plugins: "Plugins, hooks & middleware",
  store: "Store (persistence)",
  i18n: "Internationalisation",
  flags: "Feature flags",
  audit: "Audit trail",
  logger: "Logger",
  health: "Health checks & metrics",
  resilience: "Resilience",
  cache: "Cache & entity resolution",
  ui: "UI, components & the customId codec",
  formatting: "Formatting, assets & voice",
  errors: "Error handling & codes",
  testing: "Testing",
  cli: "CLI reference",
};

/**
 * Which API reference page(s) exhaustively document each USAGE.md section. The
 * guide teaches the task; the reference lists every option. Each generated page
 * ends with a link to its counterpart so the two layers stay connected.
 */
const REFERENCE = {
  1: ["cli", "configuration"],
  2: ["configuration"],
  3: ["configuration"],
  4: ["context"],
  5: ["definitions", "options"],
  6: ["options"],
  7: ["definitions"],
  8: ["definitions"],
  9: ["definitions"],
  10: ["definitions"],
  11: ["definitions"],
  12: ["definitions", "ui"],
  13: ["definitions"],
  14: ["definitions", "options"],
  15: ["ui"],
  16: ["ui"],
  17: ["formatting"],
  18: ["formatting"],
  19: ["formatting"],
  20: ["cache"],
  21: ["guards"],
  22: ["services"],
  23: ["definitions"],
  24: ["plugins"],
  25: ["definitions"],
  26: ["cli", "configuration"],
  27: ["errors"],
  28: ["testing"],
  29: ["cli"],
  30: ["ui"],
  31: ["configuration"],
  32: ["formatting"],
  33: ["formatting"],
  34: ["configuration"],
  35: ["i18n"],
  36: ["store"],
  37: ["resilience"],
  38: ["audit"],
  39: ["flags"],
  40: ["health"],
};

/**
 * Derives a one-line page description from the first paragraph of prose, so
 * search results and social cards say something useful. Falls back to the title.
 */
function describe(body, title) {
  const lines = body.split("\n");
  let inFence = false;
  const paragraph = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      if (paragraph.length > 0) break;
      continue;
    }
    if (inFence) continue;

    const trimmed = line.trim();
    // Skip headings, tables, lists, blockquotes and rules before the prose.
    // A bare `*` or `-` only starts a list when followed by a space, so a
    // paragraph line beginning with `**bold**` still counts as prose.
    const isBlock = /^(#{1,6}\s|>|\||[-*+]\s|\d+\.\s|-{3,}$)/.test(trimmed);
    // An indented line before any prose is the continuation of a skipped list
    // item, not the start of a paragraph.
    const isContinuation = paragraph.length === 0 && /^\s/.test(line);
    if (!trimmed || isBlock || isContinuation) {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(trimmed);
  }

  const text = paragraph
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> their text
    .replace(/[`*]/g, "") // keep underscores: they are part of names like DJSBOT_CLI

    .replace(/\s+/g, " ")
    .trim();

  if (!text) return `${title} in @ix-xs/djs-bot.`;

  if (text.length > 160) {
    // Prefer ending on a whole sentence; otherwise cut on a word boundary.
    const head = text.slice(0, 160);
    const lastStop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
    if (lastStop > 80) return head.slice(0, lastStop + 1);
    return `${head.slice(0, head.lastIndexOf(" ")).trimEnd()}...`;
  }

  // A paragraph that runs straight into a code block reads as a broken sentence.
  return text.replace(/[:,;]$/, ".").replace(/([^.!?])$/, "$1.");
}

/** Renders the "Full reference" footer appended to a generated guide page. */
function referenceFooter(num) {
  const slugs = (REFERENCE[num] ?? []).filter((slug) => slug in API_PAGES);
  if (slugs.length === 0) return "";

  const links = slugs.map((slug) => `- [${API_PAGES[slug]}](/djs-bot/api/${slug}/)`).join("\n");
  return `\n\n## Full reference\n\nEvery option, signature and edge case for this topic:\n\n${links}\n`;
}

async function main() {
  const usage = await readFile(path.join(repoRoot, "USAGE.md"), "utf8");

  // Split into `##` sections, ignoring headings inside fenced code blocks.
  const lines = usage.split(/\r?\n/);
  const sections = [];
  let current = null;
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) inFence = !inFence;
    const heading = !inFence && /^##\s+(.+)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { heading: heading[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);

  await rm(guideDir, { recursive: true, force: true });
  for (const category of CATEGORIES) await mkdir(path.join(guideDir, category.slug), { recursive: true });

  let count = 0;
  for (const section of sections) {
    const num = Number.parseInt(section.heading, 10);
    const title = section.heading.replace(/^\d+\.\s*/, "").trim();
    if (Number.isNaN(num) || /^table of contents$/i.test(title)) continue;

    const category = categoryOf(num);
    const slug = slugify(title) || `section-${num}`;
    const body = section.body.join("\n").replace(/^\n+/, "").replace(/\n+$/, "").trim();
    const frontmatter =
      `---\ntitle: ${JSON.stringify(title)}\n` +
      `description: ${JSON.stringify(describe(body, title))}\n` +
      `sidebar:\n  order: ${num}\n---\n\n`;

    await writeFile(
      path.join(guideDir, category.slug, `${slug}.md`),
      frontmatter + body + referenceFooter(num) + "\n",
      "utf8",
    );
    count += 1;
  }

  console.log(`✓ Generated ${count} guide pages from USAGE.md → ${path.relative(repoRoot, guideDir)}`);
}

// Only run when executed directly (astro.config imports CATEGORIES from here).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("generate.mjs")) {
  await main();
}
