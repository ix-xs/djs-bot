// Internal links in the docs are written root-relative ("/api/store/"), with no
// knowledge of where the site is hosted. This remark plugin prepends the
// configured base path at build time, so moving the site (another domain, a
// sub-path, the root) is a configuration change rather than a search and replace.

/** Normalises a base path to "" (root) or "/segment" with no trailing slash. */
export function normalizeBase(base) {
  const trimmed = String(base ?? "").replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

/**
 * Prefixes a root-relative URL with the base path. External URLs, anchors,
 * protocol-relative URLs and URLs that already carry the base are left alone.
 */
export function withBase(url, base) {
  const prefix = normalizeBase(base);
  if (typeof url !== "string" || !prefix) return url;
  if (!url.startsWith("/") || url.startsWith("//")) return url;
  if (url === prefix || url.startsWith(`${prefix}/`)) return url;
  return prefix + url;
}

/** Attributes of MDX components that hold an internal link. */
const LINK_ATTRIBUTES = new Set(["href", "link"]);

function visit(node, fn) {
  fn(node);
  if (Array.isArray(node.children)) for (const child of node.children) visit(child, fn);
}

/** The remark plugin. `options.base` is the site's base path. */
export function remarkBaseLinks(options = {}) {
  const { base } = options;
  return (tree) => {
    visit(tree, (node) => {
      // [text](/path) and [ref]: /path
      if ((node.type === "link" || node.type === "definition") && typeof node.url === "string") {
        node.url = withBase(node.url, base);
        return;
      }
      // <LinkCard href="/path" /> in .mdx files
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        for (const attribute of node.attributes ?? []) {
          if (attribute.type === "mdxJsxAttribute" && LINK_ATTRIBUTES.has(attribute.name)) {
            attribute.value = withBase(attribute.value, base);
          }
        }
      }
    });
  };
}
