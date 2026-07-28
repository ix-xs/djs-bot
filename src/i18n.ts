/**
 * Runtime internationalisation.
 *
 * Translate the *messages your bot sends* per user, based on their Discord
 * client locale (`interaction.locale`). This is separate from command-name
 * localizations (which are declared on the command and shown in the picker).
 *
 * Features: nested keys (`"welcome.title"`), `{var}` interpolation, `{count}`
 * pluralization (`{ one, other }`), and locale fallback.
 *
 * @module i18n
 */
import comfort from "@ix-xs/node-comfort";

/** A (possibly nested) tree of translation strings. */
export interface Messages {
  [key: string]: string | { one: string; other: string } | Messages;
}

/** Options for {@link createI18n}. */
export interface I18nOptions {
  /** The locale used when the user's locale has no entry. Default `"en"`. */
  defaultLocale?: string;
  /** A second locale to try before the default. */
  fallbackLocale?: string;
  /** Per-locale message trees, e.g. `{ en: {...}, fr: {...} }`. */
  resources: Record<string, Messages>;
}

/** A translator produced by {@link createI18n}. */
export interface I18n {
  /** The default locale. */
  readonly defaultLocale: string;
  /** Every locale with resources. */
  locales(): string[];
  /**
   * Translates `key` for `locale`, interpolating `vars`. Falls back to the
   * fallback/default locale, and finally returns the key itself if unresolved.
   */
  t(locale: string | undefined, key: string, vars?: Record<string, unknown>): string;
}

function resolveEntry(tree: Messages | undefined, key: string): unknown {
  if (!tree) return undefined;
  return comfort.obj.get(tree as Record<string, unknown>, key);
}

/**
 * Creates a translator.
 *
 * @example
 * const i18n = createI18n({
 *   defaultLocale: "en",
 *   resources: {
 *     en: { greet: "Hello {name}!", items: { one: "{count} item", other: "{count} items" } },
 *     fr: { greet: "Bonjour {name} !", items: { one: "{count} objet", other: "{count} objets" } },
 *   },
 * });
 * i18n.t("fr", "greet", { name: "Léa" });      // "Bonjour Léa !"
 * i18n.t("en", "items", { count: 3 });         // "3 items"
 */
export function createI18n(options: I18nOptions): I18n {
  const defaultLocale = options.defaultLocale ?? "en";
  const fallbackLocale = options.fallbackLocale;

  const interpolate = (template: string, vars?: Record<string, unknown>): string =>
    vars ? comfort.str.template(template, vars, { open: "{", close: "}", fallback: "" }) : template;

  const pick = (locale: string, key: string, vars?: Record<string, unknown>): string | undefined => {
    const entry = resolveEntry(options.resources[locale], key);
    if (entry === undefined || entry === null) return undefined;

    if (typeof entry === "object" && "one" in entry && "other" in entry) {
      const count = Number(vars?.count ?? 0);
      const form = count === 1 ? (entry as { one: string }).one : (entry as { other: string }).other;
      return interpolate(form, vars);
    }
    if (typeof entry === "string") return interpolate(entry, vars);
    return undefined;
  };

  return {
    defaultLocale,
    locales: () => Object.keys(options.resources),
    t(locale, key, vars) {
      // Discord locales look like "en-US"; try the exact locale, then its base.
      const candidates = [
        locale,
        locale?.split("-")[0],
        fallbackLocale,
        defaultLocale,
      ].filter((l): l is string => Boolean(l));
      for (const candidate of candidates) {
        const value = pick(candidate, key, vars);
        if (value !== undefined) return value;
      }
      return key;
    },
  };
}
