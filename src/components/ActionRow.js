// @ts-check

/**
 * Component instances supported inside an action row.
 *
 * @typedef {import("./Button") | import("./SelectMenu")} ActionRowComponent
 */

/**
 * A component that can be converted to JSON.
 *
 * @typedef {Object} JSONEncodable
 * @property {() => any} toJSON
 */

/**
 * Discord-compatible action row payload.
 *
 * @typedef {Object} ActionRowData
 * @property {1} type Discord component type for action rows.
 * @property {Array<any>} components Components contained in the row.
 */

/**
 * Returns whether a value exposes a callable `toJSON()` method.
 *
 * @param {unknown} value The value to test.
 * @returns {value is JSONEncodable} `true` if the value can be JSON-serialized through `toJSON()`.
 */
function hasToJSON(value) {
  return (
    !!value &&
    typeof value === "object" &&
    "toJSON" in value &&
    typeof /** @type {{ toJSON?: unknown }} */ (value).toJSON === "function"
  );
}

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
class ActionRow {
  /**
   * Action row payload in Discord-compatible format.
   *
   * @type {ActionRowData}
   */
  #row;

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
  constructor(components = []) {
    if (!Array.isArray(components)) {
      throw new TypeError("ActionRow: 'components' must be an array.");
    }

    this.#row = {
      type: 1,
      components: this.#normalizeComponents(components),
    };
  }

  /**
   * Normalizes action row components.
   *
   * If a component exposes `toJSON()`, its JSON form is used.
   * Otherwise the raw component object is kept as-is.
   *
   * @param {ActionRowComponent[]} components Raw components.
   * @returns {Array<any>} Normalized components.
   */
  #normalizeComponents(components) {
    return components
      .filter(Boolean)
      .map((component) => (hasToJSON(component) ? component.toJSON() : component));
  }

  /**
   * Returns the components contained in this row.
   *
   * @returns {Array<any>} The row components.
   */
  getComponents() {
    return this.#row.components.map((component) =>
      component && typeof component === "object"
        ? { ...component }
        : component,
    );
  }

  /**
   * Returns the number of components in the row.
   *
   * @returns {number} The number of components.
   */
  getComponentCount() {
    return this.#row.components.length;
  }

  /**
   * Returns whether the row is empty.
   *
   * @returns {boolean} `true` if the row contains no component, otherwise `false`.
   */
  isEmpty() {
    return this.#row.components.length === 0;
  }

  /**
   * Replaces all components in the row.
   *
   * @param {ActionRowComponent[]} components New row components.
   * @returns {this} The current action row instance.
   * @throws {TypeError} Throws if `components` is not an array.
   */
  setComponents(components) {
    if (!Array.isArray(components)) {
      throw new TypeError("ActionRow.setComponents(): 'components' must be an array.");
    }

    this.#row.components = this.#normalizeComponents(components);
    return this;
  }

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
  addComponent(component) {
    if (!component) {
      throw new TypeError("ActionRow.addComponent(): 'component' is required.");
    }

    this.#row.components.push(hasToJSON(component) ? component.toJSON() : component);
    return this;
  }

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
  addComponents(components) {
    if (!Array.isArray(components)) {
      throw new TypeError("ActionRow.addComponents(): 'components' must be an array.");
    }

    this.#row.components.push(...this.#normalizeComponents(components));
    return this;
  }

  /**
   * Removes a component by index.
   *
   * @param {number} index Component index.
   * @returns {this} The current action row instance.
   */
  removeComponent(index) {
    if (index >= 0 && index < this.#row.components.length) {
      this.#row.components.splice(index, 1);
    }

    return this;
  }

  /**
   * Clears all components from the row.
   *
   * @returns {this} The current action row instance.
   */
  clearComponents() {
    this.#row.components = [];
    return this;
  }

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
  toJSON() {
    return {
      type: 1,
      components: this.#row.components.map((component) =>
        component && typeof component === "object"
          ? { ...component }
          : component,
      ),
    };
  }

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
  static from(components = []) {
    return new ActionRow(components);
  }
}

module.exports = ActionRow;