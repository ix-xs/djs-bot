export = TextDisplay;
/**
 * Discord-compatible text display payload.
 *
 * @typedef {Object} TextDisplayData
 * @property {10} type Discord component type for a text display.
 * @property {string} content Markdown text content.
 */
/**
 * Lightweight wrapper around a Discord-compatible text display payload.
 *
 * @example
 * const text = new TextDisplay("## Hello");
 *
 * @example
 * const otherText = TextDisplay.from("Simple text");
 */
declare class TextDisplay {
    /**
     * Creates a new text display instance from raw content.
     *
     * @param {string} content Raw markdown content.
     * @returns {TextDisplay} A new text display instance.
     *
     * @example
     * const otherText = TextDisplay.from("Simple text");
     */
    static from(content: string): TextDisplay;
    /**
     * Creates a new text display.
     *
     * @param {string} content Markdown content.
     * @throws {TypeError} Throws if the provided content is invalid.
     *
     * @example
     * const text = new TextDisplay("## Hello");
     */
    constructor(content: string);
    /**
     * Returns the text display content.
     *
     * @returns {string} The markdown content.
     */
    getContent(): string;
    /**
     * Sets the text display content.
     *
     * @param {string} content New markdown content.
     * @returns {this} The current text display instance.
     *
     * @example
     * text.setContent("### Updated title\n**Markdown** content.");
     */
    setContent(content: string): this;
    /**
     * Returns the text display as a Discord-compatible JSON object.
     *
     * @returns {TextDisplayData} The raw text display payload.
     *
     * @example
     * const payload = text.toJSON();
     *
     * console.log(payload);
     * // {
     * //   type: 10,
     * //   content: "## Hello"
     * // }
     */
    toJSON(): TextDisplayData;
    #private;
}
declare namespace TextDisplay {
    export { TextDisplayData };
}
/**
 * Discord-compatible text display payload.
 */
type TextDisplayData = {
    /**
     * Discord component type for a text display.
     */
    type: 10;
    /**
     * Markdown text content.
     */
    content: string;
};
//# sourceMappingURL=TextDisplay.d.ts.map