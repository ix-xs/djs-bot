// @ts-check

/**
 * Supported Discord timestamp display formats.
 *
 * @typedef {"Default" | "Long Date" | "Long Date/Time" | "Long Time" | "Relative" | "Short Date" | "Short Date/Time" | "Short Time"} DiscordTimestampFormatName
 */

/**
 * Builds a Discord timestamp string.
 * Discord timestamps use Unix time in seconds and support several display styles
 * such as short date, long date/time, or relative time.
 * If no timestamp is provided, the current date is used.
 *
 * @param {number | Date} [timestamp=Date.now()] Timestamp in milliseconds, or a Date instance.
 * @param {DiscordTimestampFormatName} [format="Default"] Display format name.
 * @returns {string} A Discord-formatted timestamp string such as `<t:1736251200:R>`.
 *
 * @example
 * const timestamp = require("./timestamp");
 *
 * timestamp();
 * // "<t:1736251200>"
 *
 * @example
 * timestamp(Date.now(), "Relative");
 * // "<t:1736251200:R>"
 *
 * @example
 * timestamp(new Date("2026-07-06T18:00:00Z"), "Long Date/Time");
 * // "<t:1783360800:F>"
 */
module.exports =
  /**
   * @param {number | Date} [timestamp=Date.now()]
   * @param {DiscordTimestampFormatName} [format="Default"]
   * @returns {string}
   */
  (timestamp = Date.now(), format = "Default") => {
    /** @type {Record<DiscordTimestampFormatName, string>} */
    const formats = {
      Default: "",
      "Long Date": ":D",
      "Long Date/Time": ":F",
      "Long Time": ":T",
      Relative: ":R",
      "Short Date": ":d",
      "Short Date/Time": ":f",
      "Short Time": ":t",
    };

    const ms =
      timestamp instanceof Date
        ? timestamp.getTime()
        : typeof timestamp === "number"
          ? timestamp
          : Date.now();

    const unix = Math.floor(ms / 1000);
    const suffix = formats[format] ?? "";

    return `<t:${unix}${suffix}>`;
  };