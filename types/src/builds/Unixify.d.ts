declare namespace _exports {
    export { DiscordTimestampFormatName };
}
/**
 * @param {number | Date} [timestamp=Date.now()]
 * @param {DiscordTimestampFormatName} [format="Default"]
 * @returns {string}
 */
declare function _exports(timestamp?: number | Date, format?: DiscordTimestampFormatName): string;
export = _exports;
/**
 * Supported Discord timestamp display formats.
 */
type DiscordTimestampFormatName = "Default" | "Long Date" | "Long Date/Time" | "Long Time" | "Relative" | "Short Date" | "Short Date/Time" | "Short Time";
//# sourceMappingURL=Unixify.d.ts.map