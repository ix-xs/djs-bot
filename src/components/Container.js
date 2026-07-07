// @ts-check

const { Colors } = require("discord.js");

/**
 * Component types allowed inside a container.
 *
 * @typedef {(
 *   import("./ActionRow") |
 *   import("./TextDisplay") |
 *   import("./Section") |
 *   import("./Gallery") |
 *   import("./Separator") |
 *   import("./File")
 * )} ContainerChild
 */

/**
 * Raw options used to create a {@link Container} instance.
 *
 * @typedef {Object} ContainerOptions
 * @property {ContainerChild[]} components Components contained in the container.
 * @property {import("discord.js").ColorResolvable} [color] Accent color alias input.
 * @property {boolean} [spoiler] Whether the container is spoilered.
 */

/**
 * Discord-compatible container payload.
 *
 * @typedef {Object} ContainerData
 * @property {17} type Discord component type for a container.
 * @property {Array<Record<string, any>>} components Container child components.
 * @property {number} [accent_color] Accent color of the container.
 * @property {boolean} [spoiler] Whether the container is spoilered.
 */

/**
 * Lightweight wrapper around a Discord-compatible container payload.
 *
 * @example
 * const container = new Container({
 *   color: "Blurple",
 *   spoiler: false,
 *   components: [
 *     new TextDisplay("Hello"),
 *   ],
 * });
 */
class Container {
  /**
   * Container payload in Discord-compatible format.
   *
   * @type {ContainerData}
   */
  #container;

  /**
   * Creates a new container.
   *
   * @param {ContainerOptions} options Container options.
   * @throws {TypeError} Throws if the provided container options are invalid.
   *
   * @example
   * const container = new Container({
   *   color: "Blurple",
   *   spoiler: false,
   *   components: [
   *     new TextDisplay("Hello"),
   *   ],
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Container: 'options' must be an object.");
    }

    const {
      components,
      color,
      spoiler,
    } = options;

    const normalizedComponents = this.#normalizeComponents(components);

    if (normalizedComponents.length === 0) {
      throw new TypeError("Container: 'components' must contain at least one component.");
    }

    if (spoiler !== undefined && typeof spoiler !== "boolean") {
      throw new TypeError("Container: 'spoiler' must be a boolean when provided.");
    }

    const accentColor = color !== undefined
      ? this.#resolveColor(color)
      : undefined;

    this.#container = {
      type: 17,
      components: normalizedComponents,
      accent_color: accentColor,
      spoiler: spoiler ?? undefined,
    };
  }

  /**
   * Normalizes one container child into API-compatible JSON.
   *
   * @param {ContainerChild} component Raw component.
   * @returns {Record<string, any>} Normalized child component.
   * @throws {TypeError} Throws if the component is invalid.
   */
  #normalizeComponent(component) {
    if (!component || typeof component !== "object") {
      throw new TypeError("Container: each component must be an object.");
    }

    if ("toJSON" in component && typeof component.toJSON === "function") {
      return component.toJSON();
    }

    if ("type" in component && typeof component.type === "number") {
      return { ...component };
    }

    throw new TypeError("Container: each component must be a compatible component instance or a raw component object.");
  }

  /**
   * Normalizes container children into API-compatible JSON.
   *
   * @param {ContainerChild[]} components Raw components.
   * @returns {Array<Record<string, any>>} Normalized child components.
   * @throws {TypeError} Throws if components are invalid.
   */
  #normalizeComponents(components) {
    if (!Array.isArray(components)) {
      throw new TypeError("Container: 'components' must be an array.");
    }

    if (components.length > 10) {
      throw new TypeError("Container: 'components' cannot contain more than 10 entries.");
    }

    return components.map((component) => this.#normalizeComponent(component));
  }

  /**
   * Resolves a Discord color input to an integer accent color.
   *
   * @param {import("discord.js").ColorResolvable} color Color input.
   * @returns {number} Resolved accent color.
   * @throws {TypeError} Throws if the color cannot be resolved.
   */
  #resolveColor(color) {
    if (typeof color === "number" && Number.isInteger(color) && color >= 0 && color <= 0xffffff) {
      return color;
    }

    if (typeof color === "string") {
      if (color in Colors) {
        return Colors[/** @type {keyof typeof Colors} */ (color)];
      }

      if (color.startsWith("#")) {
        const hex = color.slice(1);

        if (!/^[\da-fA-F]{6}$/.test(hex)) {
          throw new TypeError("Container: hex colors must use the '#RRGGBB' format.");
        }

        return Number.parseInt(hex, 16);
      }

      const rgbMatch = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);

      if (rgbMatch) {
        const red = Number.parseInt(rgbMatch[1], 10);
        const green = Number.parseInt(rgbMatch[2], 10);
        const blue = Number.parseInt(rgbMatch[3], 10);

        if (red > 255 || green > 255 || blue > 255) {
          throw new TypeError("Container: rgb colors must use channel values between 0 and 255.");
        }

        return (red << 16) + (green << 8) + blue;
      }
    }

    if (Array.isArray(color) && color.length === 3) {
      const [red, green, blue] = color;

      if (
        !Number.isInteger(red) ||
        !Number.isInteger(green) ||
        !Number.isInteger(blue) ||
        red < 0 || red > 255 ||
        green < 0 || green > 255 ||
        blue < 0 || blue > 255
      ) {
        throw new TypeError("Container: RGB tuple colors must contain three integers between 0 and 255.");
      }

      return (red << 16) + (green << 8) + blue;
    }

    throw new TypeError("Container: 'color' must be a valid Discord color resolvable value.");
  }

  /**
   * Returns the container components.
   *
   * @returns {Array<Record<string, any>>} The container child components.
   */
  getComponents() {
    return this.#container.components.map((component) => ({ ...component }));
  }

  /**
   * Returns the accent color.
   *
   * @returns {number|undefined} The accent color.
   */
  getAccentColor() {
    return this.#container.accent_color;
  }

  /**
   * Returns whether the container is spoilered.
   *
   * @returns {boolean} `true` if spoilered, otherwise `false`.
   */
  isSpoiler() {
    return Boolean(this.#container.spoiler);
  }

  /**
   * Replaces the container child components.
   *
   * @param {ContainerChild[]} components New child components.
   * @returns {this} The current container instance.
   */
  setComponents(components) {
    const normalizedComponents = this.#normalizeComponents(components);

    if (normalizedComponents.length === 0) {
      throw new TypeError("Container.setComponents(): the container must contain at least one component.");
    }

    this.#container.components = normalizedComponents;
    return this;
  }

  /**
   * Adds one child component to the container.
   *
   * @param {ContainerChild} component Child component to add.
   * @returns {this} The current container instance.
   */
  addComponent(component) {
    if (this.#container.components.length >= 10) {
      throw new TypeError("Container.addComponent(): the container cannot contain more than 10 components.");
    }

    const normalizedComponent = this.#normalizeComponent(component);
    this.#container.components.push(normalizedComponent);
    return this;
  }

  /**
   * Sets the accent color.
   *
   * @param {import("discord.js").ColorResolvable} color Container accent color.
   * @returns {this} The current container instance.
   */
  setColor(color) {
    this.#container.accent_color = this.#resolveColor(color);
    return this;
  }

  /**
   * Clears the accent color.
   *
   * @returns {this} The current container instance.
   */
  clearColor() {
    delete this.#container.accent_color;
    return this;
  }

  /**
   * Sets the spoiler state.
   *
   * @param {boolean} [spoiler=true] Whether the container is spoilered.
   * @returns {this} The current container instance.
   */
  setSpoiler(spoiler = true) {
    if (typeof spoiler !== "boolean") {
      throw new TypeError("Container.setSpoiler(): 'spoiler' must be a boolean.");
    }

    this.#container.spoiler = spoiler;
    return this;
  }

  /**
   * Returns the container as a Discord-compatible JSON object.
   *
   * @returns {ContainerData} The raw container payload.
   */
  toJSON() {
    return {
      ...this.#container,
      components: this.#container.components.map((component) => ({ ...component })),
    };
  }

  /**
   * Creates a new container instance from raw options.
   *
   * @param {ContainerOptions} options Raw container options.
   * @returns {Container} A new container instance.
   */
  static from(options) {
    return new Container(options);
  }
}

module.exports = Container;