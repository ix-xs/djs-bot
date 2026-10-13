import { defineCollection } from "astro:content";
import { docsLoader, i18nLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Texts of the interface that Starlight does not translate by itself: the
  // search results, which the search library leaves in English.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
