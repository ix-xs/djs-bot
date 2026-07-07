// @ts-check

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
class Section {
  /**
   * Section payload in Discord-compatible format.
   *
   * @type {SectionData}
   */
  #section;

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
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Section: 'options' must be an object.");
    }

    const {
      components,
      accessory,
    } = options;

    const normalizedComponents = this.#normalizeComponents(components);
    const normalizedAccessory = this.#normalizeAccessory(accessory);

    this.#section = {
      type: 9,
      components: normalizedComponents,
      accessory: normalizedAccessory,
    };
  }

  /**
   * Normalizes a single component-like object into API-compatible JSON.
   *
   * @param {object} component Raw component.
   * @returns {Record<string, any>} Normalized component.
   * @throws {TypeError} Throws if the component is invalid.
   */
  #normalizeComponentLike(component) {
    if (!component || typeof component !== "object") {
      throw new TypeError("Section: each component must be an object.");
    }

    if ("toJSON" in component && typeof component.toJSON === "function") {
      return component.toJSON();
    }

    if ("type" in component && typeof component.type === "number") {
      return { ...component };
    }

    throw new TypeError("Section: each component must be a compatible component instance or a raw component object.");
  }

  /**
   * Normalizes the section text components.
   *
   * @param {SectionTextComponent[]} components Raw text components.
   * @returns {Array<Record<string, any>>} Normalized text components.
   * @throws {TypeError} Throws if components are invalid.
   */
  #normalizeComponents(components) {
    if (!Array.isArray(components)) {
      throw new TypeError("Section: 'components' must be an array.");
    }

    if (components.length === 0) {
      throw new TypeError("Section: 'components' must contain at least one text component.");
    }

    if (components.length > 3) {
      throw new TypeError("Section: 'components' cannot contain more than 3 text components.");
    }

    return components.map((component) => {
      const normalizedComponent = this.#normalizeComponentLike(component);

      if (normalizedComponent.type !== 10) {
        throw new TypeError("Section: all 'components' entries must be TextDisplay components.");
      }

      return normalizedComponent;
    });
  }

  /**
   * Normalizes the section accessory component.
   *
   * @param {SectionAccessory} accessory Raw accessory component.
   * @returns {Record<string, any>} Normalized accessory component.
   * @throws {TypeError} Throws if the accessory is invalid.
   */
  #normalizeAccessory(accessory) {
    const normalizedAccessory = this.#normalizeComponentLike(accessory);

    if (normalizedAccessory.type !== 2 && normalizedAccessory.type !== 11) {
      throw new TypeError("Section: 'accessory' must be a Button or a Thumbnail component.");
    }

    return normalizedAccessory;
  }

  /**
   * Returns the text components.
   *
   * @returns {Array<Record<string, any>>} The section text components.
   */
  getComponents() {
    return this.#section.components.map((component) => ({ ...component }));
  }

  /**
   * Returns the accessory component.
   *
   * @returns {Record<string, any>} The section accessory.
   */
  getAccessory() {
    return { ...this.#section.accessory };
  }

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
  setComponents(components) {
    this.#section.components = this.#normalizeComponents(components);
    return this;
  }

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
  addComponent(component) {
    if (this.#section.components.length >= 3) {
      throw new TypeError("Section.addComponent(): a section cannot contain more than 3 text components.");
    }

    const normalizedComponent = this.#normalizeComponentLike(component);

    if (normalizedComponent.type !== 10) {
      throw new TypeError("Section.addComponent(): only TextDisplay components can be added.");
    }

    this.#section.components.push(normalizedComponent);
    return this;
  }

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
  setAccessory(accessory) {
    this.#section.accessory = this.#normalizeAccessory(accessory);
    return this;
  }

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
  toJSON() {
    return {
      ...this.#section,
      components: this.#section.components.map((component) => ({ ...component })),
      accessory: { ...this.#section.accessory },
    };
  }

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
  static from(options) {
    return new Section(options);
  }
}

module.exports = Section;