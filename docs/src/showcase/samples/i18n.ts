import { createI18n } from "@ix-xs/djs-bot";
import { resources } from "./locales.js";

/** For where there is no `ctx.t`: events, jobs, services. */
export const i18n = createI18n({ defaultLocale: "en", resources });
