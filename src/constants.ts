/**
 * Framework-wide constants.
 * @module constants
 */

/** The current framework version (kept in sync with package.json at build time). */
export const VERSION = "1.2.1";

/** Human-facing framework name, used in logs and CLI output. */
export const FRAMEWORK_NAME = "djs-bot";

/** Root URL of the documentation site. */
export const DOCS_URL = "https://ix-xs.github.io/djs-bot";

/** The page documenting every error code; each code is an anchor on it. */
export const DOCS_BASE_URL = `${DOCS_URL}/api/errors/`;

/** Discord's hard limit on the length of a component `customId`. */
export const CUSTOM_ID_MAX_LENGTH = 100;

/**
 * Recognised file suffixes for convention-based discovery.
 * The suffix is only a *hint* for which files to import - the actual routing
 * is driven by each definition's `kind`, never by the filename. This keeps the
 * loader free of import side effects.
 */
export const FILE_SUFFIXES = [
  ".command",
  ".user",
  ".message",
  ".event",
  ".trigger",
  ".button",
  ".select",
  ".modal",
  ".service",
  ".job",
  ".plugin",
  ".feature",
] as const;

/** File extensions the loader will attempt to import. */
export const LOADABLE_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"] as const;
