export = Button;
/**
 * Button styles supported by this wrapper.
 *
 * @typedef {"blue" | "gray" | "green" | "red" | "link"} ButtonStyle
 */
/**
 * Raw options used to create a {@link Button} instance.
 *
 * @typedef {Object} ButtonOptions
 * @property {ButtonStyle} [style="blue"] Button style.
 * @property {string} [label] Button label.
 * @property {import("discord.js").ComponentEmojiResolvable} [emoji] Button emoji.
 * @property {string} [custom_id] Button custom id.
 * @property {string} [url] Button URL, only used for link buttons.
 * @property {boolean} [disabled] Whether the button is disabled.
 */
/**
 * Discord-compatible button payload.
 *
 * @typedef {Object} ButtonData
 * @property {2} type Discord component type for buttons.
 * @property {1 | 2 | 3 | 4 | 5} style Discord button style.
 * @property {string} [label] Button label.
 * @property {import("discord.js").ComponentEmojiResolvable} [emoji] Button emoji.
 * @property {string} [custom_id] Button custom id.
 * @property {string} [url] Button URL.
 * @property {boolean} [disabled] Whether the button is disabled.
 */
/**
 * Lightweight wrapper around a Discord-compatible button payload.
 *
 * Supports:
 * - primary blue buttons,
 * - secondary gray buttons,
 * - success green buttons,
 * - danger red buttons,
 * - link buttons.
 *
 * @example
 * const button = new Button({
 *   style: "blue",
 *   label: "Créer",
 *   custom_id: "ticket:create",
 * });
 *
 * @example
 * const linkButton = new Button({
 *   style: "link",
 *   label: "Documentation",
 *   url: "https://discord.js.org",
 * });
 */
declare class Button {
    /**
     * Creates a new button instance from raw options.
     *
     * @param {ButtonOptions} [options={}] Raw button options.
     * @returns {Button} A new button instance.
     *
     * @example
     * const button = Button.from({
     *   style: "red",
     *   label: "Delete",
     *   custom_id: "message:delete",
     * });
     */
    static from(options?: ButtonOptions): Button;
    /**
     * Creates a new button.
     *
     * @param {ButtonOptions} [options={}] Button options.
     * @throws {TypeError} Throws if the provided button options are invalid.
     *
     * @example
     * const confirmButton = new Button({
     *   style: "green",
     *   label: "Confirm",
     *   custom_id: "confirm:action",
     * });
     *
     * @example
     * const docsButton = new Button({
     *   style: "link",
     *   label: "Documentation",
     *   url: "https://discord.js.org",
     * });
     */
    constructor(options?: ButtonOptions);
    /**
     * Returns the button style id.
     *
     * @returns {1 | 2 | 3 | 4 | 5} The button style id.
     */
    getStyle(): 1 | 2 | 3 | 4 | 5;
    /**
     * Returns the button label.
     *
     * @returns {string|undefined} The button label.
     */
    getLabel(): string | undefined;
    /**
     * Returns the button emoji.
     *
     * @returns {import("discord.js").ComponentEmojiResolvable|undefined} The button emoji.
     */
    getEmoji(): import("discord.js").ComponentEmojiResolvable | undefined;
    /**
     * Returns the button custom id.
     *
     * @returns {string|undefined} The custom id.
     */
    getCustomId(): string | undefined;
    /**
     * Returns the button URL.
     *
     * @returns {string|undefined} The button URL.
     */
    getURL(): string | undefined;
    /**
     * Returns whether the button is disabled.
     *
     * @returns {boolean} `true` if the button is disabled, otherwise `false`.
     */
    isDisabled(): boolean;
    /**
     * Returns whether the button is a link button.
     *
     * @returns {boolean} `true` if the button is a link button, otherwise `false`.
     *
     * @example
     * const button = new Button({
     *   style: "link",
     *   label: "Open docs",
     *   url: "https://discord.js.org",
     * });
     *
     * console.log(button.isLink()); // true
     */
    isLink(): boolean;
    /**
     * Sets the button label.
     *
     * @param {string} label Button label.
     * @returns {this} The current button instance.
     */
    setLabel(label: string): this;
    /**
     * Clears the button label.
     *
     * @returns {this} The current button instance.
     *
     * @example
     * const button = new Button({
     *   custom_id: "refresh",
     *   label: "Refresh",
     *   emoji: "🔄",
     * });
     *
     * button.clearLabel();
     */
    clearLabel(): this;
    /**
     * Sets the button emoji.
     *
     * @param {import("discord.js").ComponentEmojiResolvable} emoji Button emoji.
     * @returns {this} The current button instance.
     */
    setEmoji(emoji: import("discord.js").ComponentEmojiResolvable): this;
    /**
     * Clears the button emoji.
     *
     * @returns {this} The current button instance.
     */
    clearEmoji(): this;
    /**
     * Sets the custom id for non-link buttons.
     *
     * @param {string} customId Button custom id.
     * @returns {this} The current button instance.
     *
     * @example
     * const button = new Button({
     *   style: "blue",
     *   label: "Create ticket",
     *   custom_id: "ticket:create",
     * });
     *
     * button.setCustomId("ticket:open");
     */
    setCustomId(customId: string): this;
    /**
     * Sets the URL for link buttons.
     *
     * @param {string} url Button URL.
     * @returns {this} The current button instance.
     *
     * @example
     * const button = new Button({
     *   style: "link",
     *   label: "Guide",
     *   url: "https://example.com",
     * });
     *
     * button.setURL("https://discord.js.org");
     */
    setURL(url: string): this;
    /**
     * Sets the disabled state.
     *
     * @param {boolean} [disabled=true] Whether the button is disabled.
     * @returns {this} The current button instance.
     *
     * @example
     * button.setDisabled(true);
     */
    setDisabled(disabled?: boolean): this;
    /**
     * Returns the button as a Discord-compatible JSON object.
     *
     * @returns {ButtonData} The raw button payload.
     *
     * @example
     * const payload = button.toJSON();
     *
     * console.log(payload);
     * // {
     * //   type: 2,
     * //   style: 3,
     * //   label: "Confirm",
     * //   custom_id: "confirm:action"
     * // }
     */
    toJSON(): ButtonData;
    #private;
}
declare namespace Button {
    export { ButtonStyle, ButtonOptions, ButtonData };
}
/**
 * Button styles supported by this wrapper.
 */
type ButtonStyle = "blue" | "gray" | "green" | "red" | "link";
/**
 * Raw options used to create a {@link Button} instance.
 */
type ButtonOptions = {
    /**
     * Button style.
     */
    style?: ButtonStyle | undefined;
    /**
     * Button label.
     */
    label?: string | undefined;
    /**
     * Button emoji.
     */
    emoji?: import("discord.js").ComponentEmojiResolvable | undefined;
    /**
     * Button custom id.
     */
    custom_id?: string | undefined;
    /**
     * Button URL, only used for link buttons.
     */
    url?: string | undefined;
    /**
     * Whether the button is disabled.
     */
    disabled?: boolean | undefined;
};
/**
 * Discord-compatible button payload.
 */
type ButtonData = {
    /**
     * Discord component type for buttons.
     */
    type: 2;
    /**
     * Discord button style.
     */
    style: 1 | 2 | 3 | 4 | 5;
    /**
     * Button label.
     */
    label?: string | undefined;
    /**
     * Button emoji.
     */
    emoji?: import("discord.js").ComponentEmojiResolvable | undefined;
    /**
     * Button custom id.
     */
    custom_id?: string | undefined;
    /**
     * Button URL.
     */
    url?: string | undefined;
    /**
     * Whether the button is disabled.
     */
    disabled?: boolean | undefined;
};
//# sourceMappingURL=Button.d.ts.map