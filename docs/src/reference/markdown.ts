// Renders the Markdown of a doc comment to HTML, with the links between
// symbols ("ref:Name") sent to their pages in the language of the page.
import { createMarkdownProcessor, type MarkdownRenderer } from "@astrojs/markdown-remark";
import { withBase, withLocale } from "../../plugins/base-links.mjs";
import { pathOf } from "./model";
import { referenceFor } from "../../plugins/api-links.mjs";

let processor: Promise<MarkdownRenderer> | undefined;

export function href(path: string, locale: string | undefined): string {
  return withBase(withLocale(path, locale), import.meta.env.BASE_URL);
}

/** One paragraph or more of Markdown, as HTML. */
export async function render(
  markdown: string | undefined,
  locale: string | undefined,
  { inline = false, autolink = false } = {},
): Promise<string> {
  if (!markdown) return "";
  // In the guide, names of exports in code link to the reference, as in its pages.
  if (autolink) {
    markdown = markdown.replace(/(?<!\[)`([^`\n]+)`(?!\]\()/g, (whole, code: string) => {
      const url = referenceFor(code);
      return url ? `[${whole}](${url})` : whole;
    });
  }
  processor ??= createMarkdownProcessor({ syntaxHighlight: false, gfm: true, smartypants: false });
  const source = markdown
    // Root-relative links of the guide get the language and the base, then
    // the links between symbols go to their pages (already complete).
    .replace(/\]\((\/[^)\s]*)\)/g, (_, path: string) => `](${href(path, locale)})`)
    .replace(/\]\(ref:([\w$]+)\)/g, (_, name: string) => `](${href(pathOf(name), locale)})`);
  const { code } = await (await processor).render(source);
  if (inline) return code.replace(/^<p>([\s\S]*)<\/p>\s*$/, "$1");
  return code;
}
