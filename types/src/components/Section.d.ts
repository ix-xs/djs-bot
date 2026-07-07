export = Section;
/**
 * Component types allowed as text content inside a section.
 *
 * @typedef {import("./TextDisplay")} SectionTextComponent
 */
/**
 * Component types allowed as accessory inside a section.
 *
 * @typedef {import("./Button") | import("./Thumbnail")} SectionAccessory
 */
/**
 * Raw options used to create a {@link Section} instance.
 *
 * @typedef {Object} SectionOptions
 * @property {SectionTextComponent[]} components Text display components, between 1 and 3.
 * @property {SectionAccessory} accessory Section accessory component.
 */
/**
 * Discord-compatible section payload.
 *
 * @typedef {Object} SectionData
 * @property {9} type Discord component type for a section.
 * @property {Array<Record<string, any>>} components Text display components.
 * @property {Record<string, any>} accessory Section accessory component.
 */
/**
 * Lightweight wrapper around a Discord-compatible section payload.
 *
 * @example
 * const section = new Section({
 *   components: [
 *     new TextDisplay({ content: "# Title" }),
 *     new TextDisplay({ content: "Secondary content" }),
 *   ],
 *   accessory: new Button({
 *     style: "blue",
 *     label: "Open",
 *     custom_id: "open",
 *   }),
 * });
 */
declare class Section {
    /**
     * Creates a new section instance from raw options.
     *
     * @param {SectionOptions} options Raw section options.
     * @returns {Section} A new section instance.
     *
     * @example
     * const section = Section.from({
     *   components: [
     *     new TextDisplay({ content: "Quick summary" }),
     *   ],
     *   accessory: new Button({
     *     style: "gray",
     *     label: "See more",
     *     custom_id: "details",
     *   }),
     * });
     */
    static from(options: SectionOptions): Section;
    /**
     * Creates a new section.
     *
     * @param {SectionOptions} options Section options.
     * @throws {TypeError} Throws if the provided section options are invalid.
     *
     * @example
     * const section = new Section({
     *   components: [
     *     new TextDisplay({ content: "# Title" }),
     *     new TextDisplay({ content: "Secondary content" }),
     *   ],
     *   accessory: new Button({
     *     style: "blue",
     *     label: "Open",
     *     custom_id: "open",
     *   }),
     * });
     */
    constructor(options: SectionOptions);
    /**
     * Returns the text components.
     *
     * @returns {Array<Record<string, any>>} The section text components.
     */
    getComponents(): Array<Record<string, any>>;
    /**
     * Returns the accessory component.
     *
     * @returns {Record<string, any>} The section accessory.
     */
    getAccessory(): Record<string, any>;
    /**
     * Replaces the text components.
     *
     * @param {SectionTextComponent[]} components New text components.
     * @returns {this} The current section instance.
     *
     * @example
     * section.setComponents([
     *   new TextDisplay({ content: "# New title" }),
     *   new TextDisplay({ content: "Updated description" }),
     * ]);
     */
    setComponents(components: SectionTextComponent[]): this;
    /**
     * Adds one text component to the section.
     *
     * @param {SectionTextComponent} component Text component to add.
     * @returns {this} The current section instance.
     *
     * @example
     * section.addComponent(
     *   new TextDisplay({ content: "Additional information" }),
     * );
     */
    addComponent(component: SectionTextComponent): this;
    /**
     * Replaces the accessory component.
     *
     * @param {SectionAccessory} accessory New accessory component.
     * @returns {this} The current section instance.
     *
     * @example
     * section.setAccessory(
     *   new Thumbnail({
     *     url: "https://example.com/preview.png",
     *     description: "Preview image",
     *   }),
     * );
     */
    setAccessory(accessory: SectionAccessory): this;
    /**
     * Returns the section as a Discord-compatible JSON object.
     *
     * @returns {SectionData} The raw section payload.
     *
     * @example
     * const payload = section.toJSON();
     *
     * console.log(payload);
     * // {
     * //   type: 9,
     * //   components: [
     * //     { type: 10, content: "# Title" },
     * //     { type: 10, content: "Secondary content" }
     * //   ],
     * //   accessory: {
     * //     type: 2,
     * //     style: "blue",
     * //     label: "Open",
     * //     custom_id: "open"
     * //   }
     * // }
     */
    toJSON(): SectionData;
    #private;
}
declare namespace Section {
    export { SectionTextComponent, SectionAccessory, SectionOptions, SectionData };
}
/**
 * Component types allowed as text content inside a section.
 */
type SectionTextComponent = import("./TextDisplay");
/**
 * Component types allowed as accessory inside a section.
 */
type SectionAccessory = import("./Button") | import("./Thumbnail");
/**
 * Raw options used to create a {@link Section} instance.
 */
type SectionOptions = {
    /**
     * Text display components, between 1 and 3.
     */
    components: SectionTextComponent[];
    /**
     * Section accessory component.
     */
    accessory: SectionAccessory;
};
/**
 * Discord-compatible section payload.
 */
type SectionData = {
    /**
     * Discord component type for a section.
     */
    type: 9;
    /**
     * Text display components.
     */
    components: Array<Record<string, any>>;
    /**
     * Section accessory component.
     */
    accessory: Record<string, any>;
};
//# sourceMappingURL=Section.d.ts.map