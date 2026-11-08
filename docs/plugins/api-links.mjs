// Every time the guide names an export in code (`defineCommand()`,
// `CommandContext`, `s.string()`), the name becomes a link to its page in the
// API reference. Nothing to write by hand, and nothing that goes stale: the
// names come from `src/data/api.json`, the model the reference is built from.
//
// Runs before `remarkBaseLinks`, which then adds the language and the base.
// Imported, not read from disk: the site's build bundles this file too.
import model from "../src/data/api.json" with { type: "json" };

/** Name -> the names of its members. */
const MEMBERS = new Map(
  model.symbols.map((symbol) => [symbol.name, new Set([...(symbol.properties ?? []), ...(symbol.methods ?? [])].map((m) => m.name))]),
);

/** The variables the guide always gives the same name, and what they hold. */
const ALIASES = { ctx: "CommandContext", bot: "Bot" };

const SLUGS = new Map(model.symbols.map((symbol) => [symbol.name, symbol.slug]));
export const slugOf = (name) => SLUGS.get(name);

/**
 * The page of the reference that a piece of inline code names, or nothing:
 * `defineCommand`, `defineCommand()`, `CommandContext<O>`, `s.string()`,
 * `ctx.reply()` and `bot.deploy()` (`ctx` and `bot` are always named so in the guide).
 */
export function referenceFor(code) {
  const match = /^([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?(?:\(\)|\(\.\.\.\)|<[^<>]*>)?$/.exec(code.trim());
  if (!match) return undefined;
  const [, written, member] = match;
  const name = member && ALIASES[written] ? ALIASES[written] : written;
  if (!member && ALIASES[written]) return undefined;
  const members = MEMBERS.get(name);
  if (!members) return undefined;
  if (member && !members.has(member)) return undefined;
  return `/reference/${slugOf(name)}/${member ? `#${member}` : ""}`;
}

/** The remark plugin. */
export function remarkApiLinks() {
  return (tree) => {
    const walk = (node, inLink, inHeading) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        if (child.type === "inlineCode" && !inLink && !inHeading) {
          const url = referenceFor(child.value);
          if (url) return { type: "link", url, data: { hProperties: { className: ["api-link"] } }, children: [child] };
        }
        walk(child, inLink || child.type === "link" || child.type === "linkReference", inHeading || child.type === "heading");
        return child;
      });
    };
    walk(tree, false, false);
  };
}
