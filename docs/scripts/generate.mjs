// Generates the Starlight "Guide" pages by splitting the repo's USAGE.md into
// one page per `##` section. Run with: npm run generate (from docs/).
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.resolve(here, "..", "src", "content", "docs", "guide");

const usage = await readFile(path.join(repoRoot, "USAGE.md"), "utf8");

// Split into `##` sections, ignoring `##` that appear inside fenced code blocks.
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

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

let order = 0;
let count = 0;
for (const section of sections) {
  const title = section.heading.replace(/^\d+\.\s*/, "").trim();
  if (/^table of contents$/i.test(title)) continue;
  order += 1;
  const slug = slugify(title) || `section-${order}`;
  const body = section.body.join("\n").replace(/^\n+/, "").replace(/\n+$/, "").trim();
  const frontmatter = `---\ntitle: ${JSON.stringify(title)}\nsidebar:\n  order: ${order}\n---\n\n`;
  await writeFile(
    path.join(outDir, `${String(order).padStart(2, "0")}-${slug}.md`),
    frontmatter + body + "\n",
    "utf8",
  );
  count += 1;
}

console.log(`✓ Generated ${count} guide pages from USAGE.md → ${path.relative(repoRoot, outDir)}`);
