export = ActionRow;
/**
 * Lightweight wrapper around a Discord action row payload.
 *
 * This class is designed as a plain structured container that:
 * - groups message components into a Discord-compatible action row,
 * - keeps internal payload data private,
 * - provides a simple fluent API,
 * - returns raw JSON ready to be used in `components`.
 *
 * @example
 * const row = new ActionRow([
 *   new SelectMenu({
 *     type: "string",
 *     custom_id: "lang:choose",
 *     options: [
 *       { label: "JavaScript", value: "js" },
 *       { label: "TypeScript", value: "ts" },
 *     ],
 *   }),
 * ]);
 */
declare class ActionRow {
    /**
     * Creates a new action row instance from raw components.
     *
     * @param {ActionRowComponent[]} [components=[]] Raw row components.
     * @returns {ActionRow} A new action row instance.
     *
     * @example
     * const row = ActionRow.from([
     *   new Button({
     *     custom_id: "ticket:create",
     *     label: "Create ticket",
     *     style: "Primary",
     *   }),
     * ]);
     */
    static from(components?: ActionRowComponent[]): ActionRow;
    /**
     * Creates a new action row.
     *
     * @param {ActionRowComponent[]} [components=[]] Components placed in the row.
     * @throws {TypeError} Throws if `components` is not an array.
     *
     * @example
     * const row = new ActionRow([
     *   new SelectMenu({
     *     type: "string",
     *     custom_id: "lang:choose",
     *     options: [
     *       { label: "JavaScript", value: "js" },
     *       { label: "TypeScript", value: "ts" },
     *     ],
     *   }),
     * ]);
     */
    constructor(components?: ActionRowComponent[]);
    /**
     * Returns the components contained in this row.
     *
     * @returns {Array<any>} The row components.
     */
    getComponents(): Array<any>;
    /**
     * Returns the number of components in the row.
     *
     * @returns {number} The number of components.
     */
    getComponentCount(): number;
    /**
     * Returns whether the row is empty.
     *
     * @returns {boolean} `true` if the row contains no component, otherwise `false`.
     */
    isEmpty(): boolean;
    /**
     * Replaces all components in the row.
     *
     * @param {ActionRowComponent[]} components New row components.
     * @returns {this} The current action row instance.
     * @throws {TypeError} Throws if `components` is not an array.
     */
    setComponents(components: ActionRowComponent[]): this;
    /**
     * Adds a single component to the row.
     *
     * @param {ActionRowComponent} component Component to add.
     * @returns {this} The current action row instance.
     *
     * @example
     * row.addComponent(
     *   new Button({
     *     custom_id: "profile:open",
     *     label: "Open profile",
     *     style: "Primary",
     *   }),
     * );
     */
    addComponent(component: ActionRowComponent): this;
    /**
     * Adds multiple components to the row.
     *
     * @param {ActionRowComponent[]} components Components to add.
     * @returns {this} The current action row instance.
     * @throws {TypeError} Throws if `components` is not an array.
     *
     * @example
     * row.addComponents([
     *   new Button({
     *     custom_id: "user:accept",
     *     label: "Accept",
     *     style: "Success",
     *   }),
     *   new Button({
     *     custom_id: "user:deny",
     *     label: "Deny",
     *     style: "Danger",
     *   }),
     * ]);
     */
    addComponents(components: ActionRowComponent[]): this;
    /**
     * Removes a component by index.
     *
     * @param {number} index Component index.
     * @returns {this} The current action row instance.
     */
    removeComponent(index: number): this;
    /**
     * Clears all components from the row.
     *
     * @returns {this} The current action row instance.
     */
    clearComponents(): this;
    /**
     * Returns the action row as a Discord-compatible JSON object.
     *
     * @returns {ActionRowData} The raw action row payload.
     *
     * @example
     * await interaction.reply({
     *   content: "Choose an option:",
     *   components: [row.toJSON()],
     * });
     */
    toJSON(): ActionRowData;
    #private;
}
declare namespace ActionRow {
    export { ActionRowComponent, JSONEncodable, ActionRowData };
}
/**
 * Component instances supported inside an action row.
 */
type ActionRowComponent = import("./Button") | import("./SelectMenu");
/**
 * A component that can be converted to JSON.
 */
type JSONEncodable = {
    toJSON: () => any;
};
/**
 * Discord-compatible action row payload.
 */
type ActionRowData = {
    /**
     * Discord component type for action rows.
     */
    type: 1;
    /**
     * Components contained in the row.
     */
    components: Array<any>;
};
//# sourceMappingURL=ActionRow.d.ts.map