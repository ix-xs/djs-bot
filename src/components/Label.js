// @ts-check

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
class Label {
  /**
   * Label payload in Discord-compatible format.
   *
   * @type {LabelData}
   */
  #label;

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
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Label: 'options' must be an object.");
    }

    const {
      label,
      description,
      component,
    } = options;

    if (typeof label !== "string" || label.length === 0) {
      throw new TypeError("Label: 'label' must be a non-empty string.");
    }

    if (label.length > 45) {
      throw new TypeError("Label: 'label' must not exceed 45 characters.");
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.length === 0)
    ) {
      throw new TypeError("Label: 'description' must be a non-empty string when provided.");
    }

    if (description !== undefined && description.length > 100) {
      throw new TypeError("Label: 'description' must not exceed 100 characters.");
    }

    const normalizedComponent = this.#normalizeComponent(component);

    this.#label = {
      type: 18,
      label,
      description: description ?? undefined,
      component: normalizedComponent,
    };
  }

  /**
   * Normalizes the label child component into API-compatible JSON.
   *
   * @param {LabelChild} component Raw child component.
   * @returns {Record<string, any>} Normalized child component.
   * @throws {TypeError} Throws if the component is invalid.
   */
  #normalizeComponent(component) {
    if (!component || typeof component !== "object") {
      throw new TypeError("Label: 'component' must be an object.");
    }

    if ("toJSON" in component && typeof component.toJSON === "function") {
      return component.toJSON();
    }

    if ("type" in component && typeof component.type === "number") {
      return { ...component };
    }

    throw new TypeError("Label: 'component' must be a compatible component instance or a raw component object.");
  }

  /**
   * Returns the label text.
   *
   * @returns {string} The label text.
   */
  getLabel() {
    return this.#label.label;
  }

  /**
   * Returns the optional description.
   *
   * @returns {string|undefined} The description text.
   */
  getDescription() {
    return this.#label.description;
  }

  /**
   * Returns the child component.
   *
   * @returns {Record<string, any>} The child component payload.
   */
  getComponent() {
    return { ...this.#label.component };
  }

  /**
   * Sets the label text.
   *
   * @param {string} label New label text.
   * @returns {this} The current label instance.
   *
   * @example
   * label.setLabel("Select a file");
   */
  setLabel(label) {
    if (typeof label !== "string" || label.length === 0) {
      throw new TypeError("Label.setLabel(): 'label' must be a non-empty string.");
    }

    if (label.length > 45) {
      throw new TypeError("Label.setLabel(): 'label' must not exceed 45 characters.");
    }

    this.#label.label = label;
    return this;
  }

  /**
   * Sets the description text.
   *
   * @param {string} description New description text.
   * @returns {this} The current label instance.
   *
   * @example
   * label.setDescription("Accepted formats: PDF, PNG, JPG.");
   */
  setDescription(description) {
    if (typeof description !== "string" || description.length === 0) {
      throw new TypeError("Label.setDescription(): 'description' must be a non-empty string.");
    }

    if (description.length > 100) {
      throw new TypeError("Label.setDescription(): 'description' must not exceed 100 characters.");
    }

    this.#label.description = description;
    return this;
  }

  /**
   * Clears the description text.
   *
   * @returns {this} The current label instance.
   *
   * @example
   * label.clearDescription();
   */
  clearDescription() {
    delete this.#label.description;
    return this;
  }

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
  setComponent(component) {
    this.#label.component = this.#normalizeComponent(component);
    return this;
  }

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
  toJSON() {
    return {
      ...this.#label,
      component: { ...this.#label.component },
    };
  }

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
  static from(options) {
    return new Label(options);
  }
}

module.exports = Label;