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
  { label: "Reference", slug: "reference", sections: [27, 28] },
];

const categoryOf = (num) => CATEGORIES.find((c) => c.sections.includes(num)) ?? CATEGORIES[CATEGORIES.length - 1];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
    const frontmatter = `---\ntitle: ${JSON.stringify(title)}\nsidebar:\n  order: ${num}\n---\n\n`;

    await writeFile(path.join(guideDir, category.slug, `${slug}.md`), frontmatter + body + "\n", "utf8");
    count += 1;
  }

  console.log(`✓ Generated ${count} guide pages from USAGE.md → ${path.relative(repoRoot, guideDir)}`);
}

// Only run when executed directly (astro.config imports CATEGORIES from here).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("generate.mjs")) {
  await main();
}
