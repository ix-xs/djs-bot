/**
 * Reads the declarations of the package and writes `src/data/api.json`: one
 * entry per export, with its kind, its signature, its doc comment, its
 * parameters, properties and methods, and the types they mention, each linked
 * to its own page (or to the discord.js documentation for a discord.js type).
 *
 * The reference pages of the site (`src/pages/reference/`) are built from that
 * file. Run from the repository root with `npm run docs:api`; the result is
 * committed, and `test/exports.test.ts` fails when it is out of date.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRIES, pageFor } from "./api-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

export const MODEL = path.join(root, "docs/src/data/api.json");
const REPOSITORY = "https://github.com/ix-xs/djs-bot/blob/main/";

/** Where a type of another package is documented, by package name. */
const DISCORDJS_PACKAGES = {
  "discord.js": "discord.js",
  "@discordjs/builders": "builders",
  "@discordjs/collection": "collection",
  "@discordjs/formatters": "formatters",
  "@discordjs/rest": "rest",
  "@discordjs/util": "util",
  "@discordjs/ws": "ws",
};

/** The built-in types worth a link, and where they are explained. */
const BUILTINS = {
  Promise: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise",
  Map: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map",
  ReadonlyMap: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map",
  Set: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Set",
  ReadonlySet: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Set",
  Date: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Date",
  Error: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error",
  RegExp: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/RegExp",
  AbortSignal: "https://developer.mozilla.org/docs/Web/API/AbortSignal",
  AbortController: "https://developer.mozilla.org/docs/Web/API/AbortController",
  URL: "https://developer.mozilla.org/docs/Web/API/URL",
  Buffer: "https://nodejs.org/api/buffer.html",
  Record: "https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type",
  Partial: "https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype",
  Readonly: "https://www.typescriptlang.org/docs/handbook/utility-types.html#readonlytype",
  Required: "https://www.typescriptlang.org/docs/handbook/utility-types.html#requiredtype",
  Pick: "https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys",
  Omit: "https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys",
  Exclude: "https://www.typescriptlang.org/docs/handbook/utility-types.html#excludeuniontype-excludedmembers",
  Extract: "https://www.typescriptlang.org/docs/handbook/utility-types.html#extracttype-union",
  NonNullable: "https://www.typescriptlang.org/docs/handbook/utility-types.html#nonnullabletype",
  ReturnType: "https://www.typescriptlang.org/docs/handbook/utility-types.html#returntypetype",
  Awaited: "https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype",
};

/** A name as an address: `defineCommand` -> `define-command`, `KVStore` -> `kv-store`. */
export const kebab = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

function versionOf(pkg) {
  try {
    return JSON.parse(readFileSync(path.join(root, "node_modules", pkg, "package.json"), "utf8")).version;
  } catch {
    return "main";
  }
}

export function build() {
  const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(
    ENTRIES.map((entry) => path.join(root, entry.file)),
    { ...parsed.options, noEmit: true },
  );
  const checker = program.getTypeChecker();
  const sourceDir = path.join(root, "src").split("\\").join("/").toLowerCase() + "/";
  const fileOf = (decl) => decl.getSourceFile().fileName.split("\\").join("/");
  const ownSource = (decl) => fileOf(decl).toLowerCase().startsWith(sourceDir);

  // First pass: every name the package exports, so that types can link to one another.
  const exported = new Map(); // symbol -> name
  const names = new Set();
  for (const entry of ENTRIES) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(path.join(root, entry.file)));
    for (const ex of checker.getExportsOfModule(moduleSymbol)) {
      const symbol = ex.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(ex) : ex;
      exported.set(symbol, ex.name);
      // Only the names declared by the package have a page; a re-export of
      // discord.js is linked to discord.js.org instead.
      const declaration = symbol.declarations?.[0];
      if (declaration && ownSource(declaration)) names.add(ex.name);
    }
  }

  const resolve = (symbol) => (symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);

  /** Where a referenced symbol is documented, or nothing. */
  function linkOf(symbol) {
    symbol = resolve(symbol);
    if (!symbol) return undefined;
    const own = exported.get(symbol);
    const decl = symbol.declarations?.[0];
    if (own && decl && ownSource(decl)) return { ref: own };
    if (!decl) return undefined;
    const file = fileOf(decl);
    const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(file);
    if (match) {
      const pkg = match[1];
      const name = symbol.name;
      if (DISCORDJS_PACKAGES[pkg]) {
        let kind = "TypeAlias";
        if (symbol.flags & ts.SymbolFlags.Class) kind = "Class";
        else if (symbol.flags & ts.SymbolFlags.Interface) kind = "Interface";
        else if (symbol.flags & ts.SymbolFlags.Enum) kind = "Enum";
        else if (symbol.flags & ts.SymbolFlags.Function) kind = "Function";
        else if (symbol.flags & ts.SymbolFlags.Variable) kind = "Variable";
        return { href: `https://discord.js.org/docs/packages/${DISCORDJS_PACKAGES[pkg]}/${versionOf(pkg)}/${name}:${kind}`, external: pkg };
      }
      if (pkg === "discord-api-types") {
        let kind = "type";
        if (symbol.flags & ts.SymbolFlags.Interface) kind = "interface";
        else if (symbol.flags & ts.SymbolFlags.Enum) kind = "enum";
        return { href: `https://discord-api-types.dev/api/discord-api-types-v10/${kind}/${name}`, external: pkg };
      }
      if (pkg === "typescript" || pkg === "@types/node") {
        if (BUILTINS[name]) return { href: BUILTINS[name], external: "builtin" };
      }
      return undefined;
    }
    if (/\/typescript\/lib\//.test(file) && BUILTINS[symbol.name]) return { href: BUILTINS[symbol.name], external: "builtin" };
    return undefined;
  }

  /**
   * A piece of code as tokens: `[text]` or `[text, link]`, where the link is
   * `{ ref }` for an export of the package or `{ href, external }`.
   */
  function tokensOf(node, text = node.getText()) {
    const start = node.getStart();
    const spans = [];
    const visit = (child) => {
      let id;
      if (ts.isTypeReferenceNode(child)) id = child.typeName;
      else if (ts.isExpressionWithTypeArguments(child)) id = child.expression;
      else if (ts.isTypeQueryNode(child)) id = child.exprName;
      if (id) {
        const last = ts.isQualifiedName(id) ? id.right : ts.isPropertyAccessExpression(id) ? id.name : id;
        const link = linkOf(checker.getSymbolAtLocation(last));
        if (link) spans.push({ from: id.getStart() - start, to: id.getEnd() - start, link });
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
    return cut(text, spans);
  }

  /** Text produced by the checker (no source node): links the names of the package only. */
  function tokensOfText(text) {
    const spans = [];
    for (const match of text.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
      if (names.has(match[0]) && /^[A-Z]/.test(match[0])) spans.push({ from: match.index, to: match.index + match[0].length, link: { ref: match[0] } });
    }
    return cut(text, spans);
  }

  function cut(text, spans) {
    spans.sort((a, b) => a.from - b.from);
    const out = [];
    let at = 0;
    for (const span of spans) {
      if (span.from < at) continue;
      if (span.from > at) out.push([text.slice(at, span.from)]);
      out.push([text.slice(span.from, span.to), span.link]);
      at = span.to;
    }
    if (at < text.length) out.push([text.slice(at)]);
    return merge(out);
  }

  /** Joins neighbouring plain tokens, and dedents what spans several lines. */
  function merge(tokens) {
    const out = [];
    for (const token of tokens) {
      const last = out[out.length - 1];
      if (last && last.length === 1 && token.length === 1) last[0] += token[0];
      else out.push([...token]);
    }
    return out;
  }

  const typeText = (type, at) =>
    checker.typeToString(type, at, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);

  /** The doc comment of a symbol, with its tags. */
  function docOf(symbol, declaration) {
    const text = ts.displayPartsToString(symbol?.getDocumentationComment(checker) ?? []).trim();
    const tags = symbol?.getJsDocTags(checker) ?? [];
    return docFrom(text, tags, declaration);
  }

  function docFrom(text, tags) {
    const doc = { text: cleanLinks(text) };
    const examples = [];
    const see = [];
    for (const tag of tags) {
      const value = ts.displayPartsToString(tag.text ?? []).trim();
      if (tag.name === "example") examples.push(stripFence(value));
      else if (tag.name === "deprecated") doc.deprecated = cleanLinks(value) || true;
      else if (tag.name === "default" || tag.name === "defaultValue") doc.default = value.replace(/^`|`$/g, "");
      else if (tag.name === "see") see.push(cleanLinks(value));
      else if (tag.name === "remarks") doc.text += `\n\n${cleanLinks(value)}`;
    }
    if (examples.length) doc.examples = examples;
    if (see.length) doc.see = see;
    if (!doc.text) delete doc.text;
    return doc;
  }

  const stripFence = (code) => code.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");

  /** `{@link X}` and `{@link X | label}` become Markdown links the page resolves. */
  function cleanLinks(text) {
    return text.replace(/\{@link(?:code|plain)?\s+([^}\s|]+)(?:\s*\|\s*([^}]*[^}\s])|\s+([^}]*[^}\s]))?\s*\}/g, (_, target, label1, label2) => {
      const label = (label1 ?? label2 ?? target).trim();
      const name = target.replace(/\(\)$/, "").split(/[.#]/)[0];
      if (/^https?:/.test(target)) return `[${label}](${target})`;
      return names.has(name) ? `[\`${label}\`](ref:${name})` : `\`${label}\``;
    });
  }

  /** Doc of each `@param`, by name. */
  function paramDocs(declaration) {
    const docs = {};
    for (const tag of ts.getJSDocTags(declaration)) {
      if (ts.isJSDocParameterTag(tag)) {
        const comment = typeof tag.comment === "string" ? tag.comment : ts.getTextOfJSDocComment(tag.comment) ?? "";
        docs[tag.name.getText()] = cleanLinks(comment.replace(/^-\s*/, "").trim());
      }
    }
    return docs;
  }

  function returnsDoc(declaration) {
    for (const tag of ts.getJSDocTags(declaration)) {
      if (ts.isJSDocReturnTag(tag)) {
        const comment = typeof tag.comment === "string" ? tag.comment : ts.getTextOfJSDocComment(tag.comment) ?? "";
        return cleanLinks(comment.trim());
      }
    }
    return undefined;
  }

  function typeParamsOf(declaration) {
    const list = declaration?.typeParameters;
    if (!list?.length) return undefined;
    return list.map((tp) => ({
      name: tp.name.getText(),
      constraint: tp.constraint ? tokensOf(tp.constraint) : undefined,
      default: tp.default ? tokensOf(tp.default) : undefined,
    }));
  }

  /** One call signature: its parameters, what it returns, its own doc. */
  function signatureOf(signature, name) {
    const declaration = signature.getDeclaration();
    const docs = declaration ? paramDocs(declaration) : {};
    const params = signature.getParameters().map((param) => {
      const pdecl = param.valueDeclaration;
      const isParam = pdecl && ts.isParameter(pdecl);
      const type = isParam && pdecl.type ? tokensOf(pdecl.type) : tokensOfText(typeText(checker.getTypeOfSymbolAtLocation(param, pdecl ?? declaration), declaration));
      const out = { name: param.name, type };
      if (isParam && (pdecl.questionToken || pdecl.initializer)) out.optional = true;
      if (isParam && pdecl.dotDotDotToken) out.rest = true;
      if (isParam && pdecl.initializer) out.default = pdecl.initializer.getText();
      if (isParam && ts.isObjectBindingPattern(pdecl.name)) out.name = "options";
      const doc = docs[param.name] ?? ts.displayPartsToString(param.getDocumentationComment(checker)).trim();
      if (doc) out.doc = cleanLinks(doc);
      // A parameter typed with an object type the package does not export: list what it accepts.
      if (!out.type.some((t) => t[1]?.ref)) {
        const ptype = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(param, pdecl ?? declaration));
        const fields = optionsOf(ptype, pdecl ?? declaration);
        if (fields.length) out.fields = fields;
      }
      return out;
    });
    const returnNode = declaration?.type;
    const returns = { type: returnNode ? tokensOf(returnNode) : tokensOfText(typeText(signature.getReturnType(), declaration)) };
    const rdoc = declaration ? returnsDoc(declaration) : undefined;
    if (rdoc) returns.doc = rdoc;
    const out = { params, returns };
    const tps = declaration && typeParamsOf(declaration);
    if (tps) out.typeParams = tps;
    const sdoc = declaration ? docFrom(ts.displayPartsToString(signature.getDocumentationComment(checker)).trim(), signature.getJsDocTags()) : {};
    if (sdoc.text || sdoc.examples || sdoc.deprecated) out.doc = sdoc;
    out.code = signatureCode(name, out);
    return out;
  }

  /** `name<T>(a: A, b?: B): R` as tokens. */
  function signatureCode(name, sig) {
    const out = [[name]];
    if (sig.typeParams) {
      out.push(["<"]);
      sig.typeParams.forEach((tp, i) => {
        if (i) out.push([", "]);
        out.push([tp.name]);
        if (tp.constraint) out.push([" extends "], ...tp.constraint);
        if (tp.default) out.push([" = "], ...tp.default);
      });
      out.push([">"]);
    }
    const multiline = sig.params.length > 1 && sig.params.map((p) => p.name + flat(p.type)).join(", ").length > 60;
    out.push(["("]);
    sig.params.forEach((param, i) => {
      if (multiline) out.push(["\n  "]);
      else if (i) out.push([", "]);
      out.push([`${param.rest ? "..." : ""}${param.name}${param.optional ? "?" : ""}: `], ...param.type);
      if (multiline) out.push([","]);
    });
    if (multiline) out.push(["\n"]);
    out.push(["): "], ...sig.returns.type);
    return merge(out);
  }

  const flat = (tokens) => tokens.map((t) => t[0]).join("");

  /** A property of an interface, a class or an object. */
  function propertyOf(symbol, owner) {
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    const out = { name: symbol.name };
    if (declaration && (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) && declaration.type) {
      out.type = tokensOf(declaration.type);
    } else {
      out.type = tokensOfText(typeText(checker.getTypeOfSymbolAtLocation(symbol, declaration ?? owner), declaration ?? owner));
    }
    if (symbol.flags & ts.SymbolFlags.Optional) out.optional = true;
    const modifiers = declaration ? ts.getCombinedModifierFlags(declaration) : 0;
    if (modifiers & ts.ModifierFlags.Readonly) out.readonly = true;
    if (modifiers & ts.ModifierFlags.Static) out.static = true;
    Object.assign(out, docOf(symbol, declaration));
    const parent = declaration?.parent;
    const parentName = parent && (parent.name?.getText?.() ?? undefined);
    if (parentName && owner && parentName !== owner.name?.getText?.() && names.has(parentName)) out.inheritedFrom = parentName;
    return out;
  }

  /** A member that can be called: a method, or a property whose value is a function. */
  function methodOf(symbol, owner) {
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    const type = checker.getTypeOfSymbolAtLocation(symbol, declaration ?? owner);
    const out = { name: symbol.name, overloads: type.getCallSignatures().map((sig) => signatureOf(sig, symbol.name)) };
    if (symbol.flags & ts.SymbolFlags.Optional) out.optional = true;
    const modifiers = declaration ? ts.getCombinedModifierFlags(declaration) : 0;
    if (modifiers & ts.ModifierFlags.Static) out.static = true;
    Object.assign(out, docOf(symbol, declaration));
    // A property whose value is a named function (`string: makeString`): its own doc comment says more.
    if (declaration && ts.isPropertyAssignment(declaration) && ts.isIdentifier(declaration.initializer)) {
      const target = resolve(checker.getSymbolAtLocation(declaration.initializer));
      const tdoc = target && docOf(target);
      if (tdoc?.examples && !out.examples) out.examples = tdoc.examples;
      if (tdoc?.text && tdoc.text !== out.text) out.details = tdoc.text;
    }
    const parent = declaration?.parent;
    const parentName = parent && (parent.name?.getText?.() ?? undefined);
    if (parentName && owner && parentName !== owner.name?.getText?.() && names.has(parentName)) out.inheritedFrom = parentName;
    return out;
  }

  /** The properties of an object type that has no page of its own. */
  function optionsOf(type, at) {
    if (!(type.flags & ts.TypeFlags.Object) && !type.isIntersection()) return [];
    if (type.getCallSignatures().length || checker.isArrayType?.(type)) return [];
    const all = type.getProperties();
    const props = all.filter((symbol) => {
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
      return declaration && ownSource(declaration);
    });
    if (props.length === 0) return [];
    return props.map((symbol) => {
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
      const out = { name: symbol.name };
      out.type = declaration && (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) && declaration.type
        ? tokensOf(declaration.type)
        : tokensOfText(typeText(checker.getTypeOfSymbolAtLocation(symbol, at), at));
      if (symbol.flags & ts.SymbolFlags.Optional) out.optional = true;
      Object.assign(out, docOf(symbol, declaration));
      return out;
    });
  }

  const isCallable = (symbol, owner) => {
    if (symbol.flags & ts.SymbolFlags.Method) return true;
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (declaration && (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) && declaration.type) {
      return ts.isFunctionTypeNode(declaration.type);
    }
    const type = checker.getTypeOfSymbolAtLocation(symbol, declaration ?? owner);
    return type.getCallSignatures().length > 0 && type.getProperties().length === 0;
  };

  /** The members of a type: properties and methods, in source order. */
  function membersOf(type, owner, { skipPrivate = true } = {}) {
    const properties = [];
    const methods = [];
    for (const symbol of type.getProperties()) {
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
      if (skipPrivate && declaration) {
        const modifiers = ts.getCombinedModifierFlags(declaration);
        if (modifiers & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;
        if (declaration.name && ts.isPrivateIdentifier(declaration.name)) continue;
      }
      if (symbol.name.startsWith("_") || symbol.name.startsWith("__")) continue;
      if (declaration && !ownSource(declaration)) continue; // members inherited from discord.js or the standard library
      if (isCallable(symbol, owner)) methods.push(methodOf(symbol, owner));
      else properties.push(propertyOf(symbol, owner));
    }
    return { properties, methods };
  }

  const symbols = [];
  for (const entry of ENTRIES) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(path.join(root, entry.file)));
    for (const ex of checker.getExportsOfModule(moduleSymbol)) {
      const symbol = resolve(ex);
      const declaration = symbol.declarations?.[0];
      if (!declaration || !ownSource(declaration)) continue;
      const file = fileOf(declaration);
      const relative = path.relative(root, file).split(path.sep).join("/");
      const line = declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.getStart()).line + 1;
      const guide = pageFor(ex.name, path.basename(file));
      const item = {
        name: ex.name,
        module: entry.specifier,
        source: `${REPOSITORY}${relative}#L${line}`,
        file: relative,
        guide: guide?.[1],
        ...docOf(symbol, declaration),
      };

      if (symbol.flags & ts.SymbolFlags.Class) {
        item.kind = "class";
        const type = checker.getDeclaredTypeOfSymbol(symbol);
        const heritage = declaration.heritageClauses?.flatMap((clause) => clause.types.map((t) => ({ keyword: clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements", type: tokensOf(t) })));
        if (heritage?.length) item.heritage = heritage;
        item.typeParams = typeParamsOf(declaration);
        const ctor = declaration.members.find((m) => ts.isConstructorDeclaration(m) && !(ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Private));
        if (ctor) item.ctor = signatureOf(checker.getSignatureFromDeclaration(ctor), "new " + ex.name);
        const instance = membersOf(type, declaration);
        const statics = membersOf(checker.getTypeOfSymbolAtLocation(symbol, declaration), declaration);
        item.properties = [...statics.properties.filter((p) => p.name !== "prototype").map((p) => ({ ...p, static: true })), ...instance.properties];
        item.methods = [...statics.methods.map((m) => ({ ...m, static: true })), ...instance.methods];
        item.code = [["class "], [ex.name], ...(item.typeParams ? [["<" + item.typeParams.map((t) => t.name).join(", ") + ">"]] : []), ...(heritage ?? []).flatMap((h) => [[` ${h.keyword} `], ...h.type])];
      } else if (symbol.flags & ts.SymbolFlags.Interface) {
        item.kind = "interface";
        const type = checker.getDeclaredTypeOfSymbol(symbol);
        item.typeParams = typeParamsOf(declaration);
        const heritage = declaration.heritageClauses?.flatMap((clause) => clause.types.map((t) => tokensOf(t)));
        if (heritage?.length) item.extends = heritage;
        const { properties, methods } = membersOf(type, declaration);
        item.properties = properties;
        item.methods = methods;
        item.code = merge([["interface "], [ex.name], ...(item.typeParams ? [["<" + item.typeParams.map((t) => t.name).join(", ") + ">"]] : []), ...(heritage?.length ? [[" extends "], ...heritage.flatMap((h, i) => (i ? [[", "], ...h] : h))] : [])]);
      } else if (symbol.flags & ts.SymbolFlags.TypeAlias) {
        item.kind = "type";
        item.typeParams = typeParamsOf(declaration);
        item.code = merge([["type "], [ex.name], ...(item.typeParams ? [["<"], ...item.typeParams.flatMap((t, i) => [...(i ? [[", "]] : []), [t.name], ...(t.constraint ? [[" extends "], ...t.constraint] : []), ...(t.default ? [[" = "], ...t.default] : [])]), [">"]] : []), [" = "], ...tokensOf(declaration.type)]);
        // A union of string literals: list the values.
        const aliased = checker.getTypeAtLocation(declaration.type);
        if (aliased.isUnion() && aliased.types.every((t) => t.isStringLiteral())) item.values = aliased.types.map((t) => t.value);
        // An object type: list its members like an interface.
        if (ts.isTypeLiteralNode(declaration.type)) {
          const { properties, methods } = membersOf(aliased, declaration);
          item.properties = properties;
          item.methods = methods;
        }
      } else if (symbol.flags & ts.SymbolFlags.Function) {
        item.kind = "function";
        const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
        item.overloads = type.getCallSignatures().map((sig) => signatureOf(sig, ex.name));
        // Functions with properties (`env.optional`).
        const extra = type.getProperties().filter((p) => p.declarations?.some(ownSource));
        if (extra.length) item.methods = extra.map((m) => methodOf(m, declaration));
      } else if (symbol.flags & ts.SymbolFlags.Variable) {
        const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
        const isConst = ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.Const;
        if (type.getCallSignatures().length) {
          item.kind = "function";
          item.overloads = type.getCallSignatures().map((sig) => signatureOf(sig, ex.name));
          const extra = type.getProperties().filter((p) => p.declarations?.some(ownSource));
          if (extra.length) item.methods = extra.map((m) => methodOf(m, declaration));
        } else {
          item.kind = "variable";
          const typeNode = declaration.type;
          const literal = declaration.initializer && (ts.isObjectLiteralExpression(declaration.initializer) || (ts.isAsExpression(declaration.initializer) && ts.isObjectLiteralExpression(declaration.initializer.expression)));
          if (literal) {
            const { properties, methods } = membersOf(type, declaration);
            item.properties = properties;
            item.methods = methods;
            // The shape of the object, one member per line, as a table of contents.
            const lines = [
              ...properties.map((prop) => [[`\n  ${prop.name}${prop.optional ? "?" : ""}: `], ...prop.type]),
              ...methods.map((method) => {
                const last = method.overloads[method.overloads.length - 1];
                const params = last ? last.params.map((param) => `${param.rest ? "..." : ""}${param.name}${param.optional ? "?" : ""}`).join(", ") : "";
                return [[`\n  ${method.name}(${params}): `], ...(last ? last.returns.type : [["unknown"]])];
              }),
            ];
            item.code = merge([[`${isConst ? "const" : "let"} `], [ex.name], [": {"], ...(typeNode ? [] : lines.flat()), ["\n}"]]);
            if (typeNode) item.code = merge([[`${isConst ? "const" : "let"} `], [ex.name], [": "], ...tokensOf(typeNode)]);
          } else {
            item.code = merge([[`${isConst ? "const" : "let"} `], [ex.name], [": "], ...(typeNode ? tokensOf(typeNode) : tokensOfText(typeText(type, declaration)))]);
          }
        }
      } else if (symbol.flags & ts.SymbolFlags.Enum) {
        item.kind = "enum";
        item.values = declaration.members.map((m) => m.name.getText());
      } else {
        item.kind = "type";
      }
      for (const key of Object.keys(item)) if (item[key] === undefined || (Array.isArray(item[key]) && item[key].length === 0)) delete item[key];
      symbols.push(item);
    }
  }

  // Which symbols mention each one: "used by".
  const usedBy = new Map();
  const mentions = (value, into) => {
    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === "string" && value[1] && typeof value[1] === "object" && value[1].ref) into.add(value[1].ref);
      for (const v of value) mentions(v, into);
    } else if (value && typeof value === "object") for (const v of Object.values(value)) mentions(v, into);
  };
  for (const item of symbols) {
    const found = new Set();
    mentions({ ...item, code: undefined }, found);
    mentions(item.code, found);
    found.delete(item.name);
    for (const name of found) {
      if (!usedBy.has(name)) usedBy.set(name, new Set());
      usedBy.get(name).add(item.name);
    }
  }
  // The address of each page. Two names that differ only by case (`guard` and
  // `Guard`) would share a file on a case-insensitive disk: the one that is
  // not a value gets its kind added.
  const taken = new Map();
  for (const item of symbols) taken.set(kebab(item.name), (taken.get(kebab(item.name)) ?? 0) + 1);
  for (const item of symbols) {
    const base = kebab(item.name);
    item.slug = taken.get(base) > 1 && item.kind !== "function" && item.kind !== "variable" ? `${base}-${item.kind}` : base;
  }
  for (const item of symbols) {
    const users = usedBy.get(item.name);
    if (users?.size) item.usedBy = [...users].sort((a, b) => a.localeCompare(b, "en"));
  }

  const reexported = [];
  for (const entry of ENTRIES) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(path.join(root, entry.file)));
    for (const ex of checker.getExportsOfModule(moduleSymbol)) {
      const symbol = resolve(ex);
      const declaration = symbol.declarations?.[0];
      if (declaration && !ownSource(declaration)) reexported.push({ name: ex.name, module: entry.specifier, link: linkOf(symbol) });
    }
  }

  return {
    discordjs: versionOf("discord.js"),
    modules: ENTRIES.map((e) => ({ name: e.specifier, intro: e.intro })),
    symbols,
    reexported,
  };
}

export function serialise(model) {
  return JSON.stringify(model, null, 1) + "\n";
}


/**
 * Every sentence of the reference that a translation needs, by key, as the
 * pages look them up (`src/components/reference/`):
 *
 *   Name                      the description of an export
 *   Name.member               a property or a method (under the export that declares it)
 *   Name.member#details       more about a method
 *   Name(param)               a parameter of a function
 *   Name(param).field         what an options object accepts
 *   Name#returns              what a function returns
 *   Name.member(param), ...   the same, for a method
 */
export function sentences(model) {
  const out = new Map();
  const put = (key, text) => {
    if (text && typeof text === "string") out.set(key, text);
  };
  const callable = (owner, signature) => {
    for (const param of signature.params) {
      put(`${owner}(${param.name})`, param.doc);
      for (const field of param.fields ?? []) put(`${field.inheritedFrom ?? `${owner}(${param.name})`}.${field.name}`, field.text);
    }
    put(`${owner}#returns`, signature.returns.doc);
  };
  for (const symbol of model.symbols) {
    put(symbol.name, symbol.text);
    if (typeof symbol.deprecated === "string") put(`${symbol.name}#deprecated`, symbol.deprecated);
    for (const signature of symbol.overloads ?? []) callable(symbol.name, signature);
    if (symbol.ctor) callable(`${symbol.name}#constructor`, symbol.ctor);
    for (const member of [...(symbol.properties ?? []), ...(symbol.methods ?? [])]) {
      const key = `${member.inheritedFrom ?? symbol.name}.${member.name}`;
      put(key, member.text);
      put(`${key}#details`, member.details);
      for (const signature of member.overloads ?? []) callable(key, signature);
    }
  }
  return out;
}

/** The sentences a language still lacks, or whose English has changed since. */
export function pending(model, table) {
  const missing = {};
  for (const [key, en] of sentences(model)) {
    const entry = table[key];
    if (!entry || entry.en !== en || !entry.fr) missing[key] = { en, fr: entry && entry.en === en ? (entry.fr ?? "") : "" };
  }
  return missing;
}

/** Where each translation of the reference keeps its sentences. */
export const TRANSLATIONS = { fr: path.join(root, "docs/src/data/api.fr.json") };

/** What a translation lacks, and what it keeps that no export uses any more. */
export function translationProblems(model, language) {
  const table = JSON.parse(readFileSync(TRANSLATIONS[language], "utf8"));
  const wanted = sentences(model);
  return {
    pending: pending(model, table),
    unused: Object.keys(table).filter((key) => !wanted.has(key)),
  };
}

// npm run docs:api            writes src/data/api.json
// npm run docs:api -- --check fails when it is out of date, or a translation is incomplete
// npm run docs:api -- --pending prints, for each translation, the sentences to translate
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = serialise(build());
  const model = JSON.parse(json);
  const shown = path.relative(root, MODEL).split(path.sep).join("/");
  if (process.argv.includes("--pending")) {
    for (const language of Object.keys(TRANSLATIONS)) {
      const { pending: missing, unused } = translationProblems(model, language);
      console.log(JSON.stringify(missing, null, 1));
      for (const key of unused) console.error(`${language}: no longer used, remove it: ${key}`);
    }
  } else if (process.argv.includes("--check")) {
    const current = existsSync(MODEL) ? readFileSync(MODEL, "utf8").replace(/\r\n/g, "\n") : "";
    let failed = false;
    if (current !== json) {
      console.error(`${shown} is out of date. Run: npm run docs:api`);
      failed = true;
    } else console.log(`${shown} up to date (${model.symbols.length} exports)`);
    for (const language of Object.keys(TRANSLATIONS)) {
      const { pending: missing, unused } = translationProblems(model, language);
      const count = Object.keys(missing).length;
      if (count || unused.length) {
        console.error(`${language}: ${count} sentence(s) to translate, ${unused.length} no longer used. Run: npm run docs:api -- --pending`);
        failed = true;
      } else console.log(`${language}: every sentence translated`);
    }
    if (failed) process.exit(1);
  } else {
    mkdirSync(path.dirname(MODEL), { recursive: true });
    writeFileSync(MODEL, json);
    console.log(`${shown} written (${model.symbols.length} exports)`);
  }
}
