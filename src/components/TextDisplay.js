// @ts-check

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
class TextDisplay {
  /**
   * Text display payload in Discord-compatible format.
   *
   * @type {TextDisplayData}
   */
  #textDisplay;

  /**
   * Creates a new text display.
   *
   * @param {string} content Markdown content.
   * @throws {TypeError} Throws if the provided content is invalid.
   *
   * @example
   * const text = new TextDisplay("## Hello");
   */
  constructor(content) {
    if (typeof content !== "string" || content.length === 0) {
      throw new TypeError("TextDisplay: 'content' must be a non-empty string.");
    }

    if (content.length > 4000) {
      throw new TypeError("TextDisplay: 'content' must not exceed 4000 characters.");
    }

    this.#textDisplay = {
      type: 10,
      content,
    };
  }

  /**
   * Returns the text display content.
   *
   * @returns {string} The markdown content.
   */
  getContent() {
    return this.#textDisplay.content;
  }

  /**
   * Sets the text display content.
   *
   * @param {string} content New markdown content.
   * @returns {this} The current text display instance.
   *
   * @example
   * text.setContent("### Updated title\n**Markdown** content.");
   */
  setContent(content) {
    if (typeof content !== "string" || content.length === 0) {
      throw new TypeError("TextDisplay.setContent(): 'content' must be a non-empty string.");
    }

    if (content.length > 4000) {
      throw new TypeError("TextDisplay.setContent(): 'content' must not exceed 4000 characters.");
    }

    this.#textDisplay.content = content;
    return this;
  }

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
  toJSON() {
    return {
      ...this.#textDisplay,
    };
  }

  /**
   * Creates a new text display instance from raw content.
   *
   * @param {string} content Raw markdown content.
   * @returns {TextDisplay} A new text display instance.
   *
   * @example
   * const otherText = TextDisplay.from("Simple text");
   */
  static from(content) {
    return new TextDisplay(content);
  }
}

module.exports = TextDisplay;