export = Label;
/**
 * Component types allowed inside a label.
 *
 * @typedef {(
 *   import("./TextInput") |
 *   import("./SelectMenu") |
 *   import("./FileUpload") |
 *   import("./RadioGroup") |
 *   import("./CheckboxGroup") |
 *   import("./Checkbox")
 * )} LabelChild
 */
/**
 * Raw options used to create a {@link Label} instance.
 *
 * @typedef {Object} LabelOptions
 * @property {string} label Visible label text.
 * @property {string} [description] Optional description text.
 * @property {LabelChild} component Interactive child component.
 */
/**
 * Discord-compatible label payload.
 *
 * @typedef {Object} LabelData
 * @property {18} type Discord component type for a label.
 * @property {string} label Visible label text.
 * @property {string} [description] Optional description text.
 * @property {Record<string, any>} component Child component payload.
 */
/**
 * Lightweight wrapper around a Discord-compatible label payload.
 *
 * @example
 * const label = new Label({
 *   label: "Upload a file",
 *   description: "You can send up to 3 files.",
 *   component: new FileUpload({
 *     custom_id: "upload:files",
 *     min_values: 1,
 *     max_values: 3,
 *   }),
 * });
 */
declare class Label {
    /**
     * Creates a new label instance from raw options.
     *
     * @param {LabelOptions} options Raw label options.
     * @returns {Label} A new label instance.
     *
     * @example
     * const label = Label.from({
     *   label: "Choose an option",
     *   component: new FileUpload({
     *     custom_id: "attachments",
     *     max_values: 2,
     *   }),
     * });
     */
    static from(options: LabelOptions): Label;
    /**
     * Creates a new label component.
     *
     * @param {LabelOptions} options Label options.
     * @throws {TypeError} Throws if the provided label options are invalid.
     *
     * @example
     * const label = new Label({
     *   label: "Upload a file",
     *   description: "You can send up to 3 files.",
     *   component: new FileUpload({
     *     custom_id: "upload:files",
     *     min_values: 1,
     *     max_values: 3,
     *   }),
     * });
     */
    constructor(options: LabelOptions);
    /**
     * Returns the label text.
     *
     * @returns {string} The label text.
     */
    getLabel(): string;
    /**
     * Returns the optional description.
     *
     * @returns {string|undefined} The description text.
     */
    getDescription(): string | undefined;
    /**
     * Returns the child component.
     *
     * @returns {Record<string, any>} The child component payload.
     */
    getComponent(): Record<string, any>;
    /**
     * Sets the label text.
     *
     * @param {string} label New label text.
     * @returns {this} The current label instance.
     *
     * @example
     * label.setLabel("Select a file");
     */
    setLabel(label: string): this;
    /**
     * Sets the description text.
     *
     * @param {string} description New description text.
     * @returns {this} The current label instance.
     *
     * @example
     * label.setDescription("Accepted formats: PDF, PNG, JPG.");
     */
    setDescription(description: string): this;
    /**
     * Clears the description text.
     *
     * @returns {this} The current label instance.
     *
     * @example
     * label.clearDescription();
     */
    clearDescription(): this;
    /**
     * Replaces the child component.
     *
     * @param {LabelChild} component New child component.
     * @returns {this} The current label instance.
     *
     * @example
     * label.setComponent(
     *   new SelectMenu({
     *     type: "string",
     *     custom_id: "role:choose",
     *     options: [
     *       { label: "JavaScript", value: "js" },
     *       { label: "TypeScript", value: "ts" },
     *     ],
     *   }),
     * );
     */
    setComponent(component: LabelChild): this;
    /**
     * Returns the label as a Discord-compatible JSON object.
     *
     * @returns {LabelData} The raw label payload.
     *
     * @example
     * const payload = label.toJSON();
     *
     * console.log(payload);
     * // {
     * //   type: 18,
     * //   label: "Upload a file",
     * //   description: "You can send up to 3 files.",
     * //   component: {
     * //     type: 19,
     * //     custom_id: "upload:files",
     * //     min_values: 1,
     * //     max_values: 3
     * //   }
     * // }
     */
    toJSON(): LabelData;
    #private;
}
declare namespace Label {
    export { LabelChild, LabelOptions, LabelData };
}
/**
 * Component types allowed inside a label.
 */
type LabelChild = (import("./TextInput") | import("./SelectMenu") | import("./FileUpload") | import("./RadioGroup") | import("./CheckboxGroup") | import("./Checkbox"));
/**
 * Raw options used to create a {@link Label} instance.
 */
type LabelOptions = {
    /**
     * Visible label text.
     */
    label: string;
    /**
     * Optional description text.
     */
    description?: string | undefined;
    /**
     * Interactive child component.
     */
    component: LabelChild;
};
/**
 * Discord-compatible label payload.
 */
type LabelData = {
    /**
     * Discord component type for a label.
     */
    type: 18;
    /**
     * Visible label text.
     */
    label: string;
    /**
     * Optional description text.
     */
    description?: string | undefined;
    /**
     * Child component payload.
     */
    component: Record<string, any>;
};
//# sourceMappingURL=Label.d.ts.map