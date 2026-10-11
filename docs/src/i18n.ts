// The words of the site's own interface (header, search, landing page), in
// each language. Starlight translates its own; page content is translated in
// `src/content/docs/<language>/`.
import { withBase, withLocale } from "../plugins/base-links.mjs";

const en = {
  // Header
  "nav.sections": "Sections",
  "nav.docs": "Docs",
  "nav.recipes": "Recipes",
  "nav.reference": "Reference",
  "nav.github": "GitHub repository",
  "nav.theme": "Switch between dark and light",
  "nav.language": "Language",

  // Names of the parts of the documentation, as the sidebar writes them
  "area.start": "Start",
  "area.reference": "Reference",
  "area.basics": "Basics",
  "area.commands": "Commands",
  "area.components": "Components",
  "area.events": "Events",
  "area.architecture": "Architecture",
  "area.data": "Data",
  "area.messages": "Messages",
  "area.production": "Production",
  "area.recipes": "Recipes",
  "area.tutorial": "Tutorial",

  // Search
  "search.recent": "Recently opened",
  "search.clear": "Clear",
  "search.start": "Start here",
  "search.try": "Try a search",
  "search.move": "move",
  "search.open": "open",
  "search.close": "close",

  // Landing page
  "hero.eyebrow": "A TypeScript framework for discord.js",
  "hero.copy": "Copy the install command",
  "hero.facts": "Open source, MIT|Node 22 and later|discord.js 14",

  // Discord previews
  "discord.message": "Discord message from {author}",
  "discord.used": "{user} used",
  "discord.today": "Today at 14:02",
} as const;

export type UiKey = keyof typeof en;

const fr: Record<UiKey, string> = {
  "nav.sections": "Rubriques",
  "nav.docs": "Docs",
  "nav.recipes": "Recettes",
  "nav.reference": "Référence",
  "nav.github": "Dépôt GitHub",
  "nav.theme": "Basculer entre sombre et clair",
  "nav.language": "Langue",

  "area.start": "Démarrer",
  "area.reference": "Référence",
  "area.basics": "Bases",
  "area.commands": "Commandes",
  "area.components": "Composants",
  "area.events": "Événements",
  "area.architecture": "Architecture",
  "area.data": "Données",
  "area.messages": "Messages",
  "area.production": "Production",
  "area.recipes": "Recettes",
  "area.tutorial": "Tutoriel",

  "search.recent": "Ouvertes récemment",
  "search.clear": "Effacer",
  "search.start": "Pour commencer",
  "search.try": "Essayer une recherche",
  "search.move": "naviguer",
  "search.open": "ouvrir",
  "search.close": "fermer",

  "hero.eyebrow": "Un framework TypeScript pour discord.js",
  "hero.copy": "Copier la commande d'installation",
  "hero.facts": "Open source, MIT|Node 22 et suivants|discord.js 14",

  "discord.message": "Message Discord de {author}",
  "discord.used": "{user} a utilisé",
  "discord.today": "Aujourd'hui à 14:02",
};

const DICTIONARIES: Record<string, Record<UiKey, string>> = { en, fr };

/** The languages of the site, in the order the switch lists them. `locale` is the folder and URL prefix. */
export const LANGUAGES = [
  { locale: undefined, code: "en", label: "English" },
  { locale: "fr", code: "fr", label: "Français" },
] as const;

/**
 * The translator for a page: `t("search.clear")`, `t("discord.used", { user: "Jo" })`.
 * `locale` is Starlight's (`undefined` for English).
 */
export function useT(locale: string | undefined) {
  const dictionary = DICTIONARIES[locale ?? "en"] ?? en;
  return (key: UiKey, values: Record<string, string> = {}): string =>
    (dictionary[key] ?? en[key]).replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}

/** A link written as in English ("/quick-start/"), for a page in `locale` and the site's base path. */
export function href(path: string, locale: string | undefined): string {
  return withBase(withLocale(path, locale), import.meta.env.BASE_URL);
}
