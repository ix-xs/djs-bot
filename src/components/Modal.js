// @ts-check

/**
 * Component types allowed inside a modal.
 *
 * @typedef {import("./Label")} ModalChild
 */

/**
 * Raw options used to create a {@link Modal} instance.
 *
 * @typedef {Object} ModalOptions
 * @property {string} custom_id Modal custom id.
 * @property {string} title Modal title.
 * @property {ModalChild[]} components Modal components.
 */

/**
 * Discord-compatible modal payload.
 *
 * @typedef {Object} ModalData
 * @property {9} type Discord interaction callback modal type.
 * @property {string} custom_id Modal custom id.
 * @property {string} title Modal title.
 * @property {Array<Record<string, any>>} components Modal components.
 */

/**
 * Lightweight wrapper around a Discord-compatible modal payload.
 *
 * A modal is an interaction response that displays a focused form overlay to
 * collect user input. This wrapper normalizes modal children into raw
 * API-compatible JSON and provides a small fluent API for updates.
 *
 * @example
 * const modal = new Modal({
 *   custom_id: "profile:edit",
 *   title: "Edit profile",
 *   components: [
 *     new Label({
 *       label: "Nickname",
 *       component: new TextInput({
 *         custom_id: "nickname",
 *         style: "short",
 *       }),
 *     }),
 *   ],
 * });
 */
class Modal {
  /**
   * Modal payload in Discord-compatible format.
   *
   * @type {ModalData}
   */
  #modal;

  /**
   * Creates a new modal.
   *
   * A modal must contain between 1 and 5 components, and its title must not
   * exceed 45 characters.
   *
   * @param {ModalOptions} options Modal options.
   * @throws {TypeError} Throws if the provided modal options are invalid.
   *
   * @example
   * const modal = new Modal({
   *   custom_id: "feedback:create",
   *   title: "Send feedback",
   *   components: [
   *     new Label({
   *       label: "Message",
   *       component: new TextInput({
   *         custom_id: "message",
   *         style: "paragraph",
   *       }),
   *     }),
   *   ],
   * });
   */
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Modal: 'options' must be an object.");
    }

    const {
      custom_id,
      title,
      components,
    } = options;

    if (typeof custom_id !== "string" || custom_id.length === 0) {
      throw new TypeError("Modal: 'custom_id' must be a non-empty string.");
    }

    if (custom_id.length > 100) {
      throw new TypeError("Modal: 'custom_id' must not exceed 100 characters.");
    }

    if (typeof title !== "string" || title.length === 0) {
      throw new TypeError("Modal: 'title' must be a non-empty string.");
    }

    if (title.length > 45) {
      throw new TypeError("Modal: 'title' must not exceed 45 characters.");
    }

    const normalizedComponents = this.#normalizeComponents(components);

    if (normalizedComponents.length === 0) {
      throw new TypeError("Modal: 'components' must contain at least one component.");
    }

    this.#modal = {
      type: 9,
      custom_id,
      title,
      components: normalizedComponents,
    };
  }

  /**
   * Normalizes one modal child into API-compatible JSON.
   *
   * @param {ModalChild} component Raw modal component.
   * @returns {Record<string, any>} Normalized modal component.
   * @throws {TypeError} Throws if the component is invalid.
   */
  #normalizeComponent(component) {
    if (!component || typeof component !== "object") {
      throw new TypeError("Modal: each component must be an object.");
    }

    if ("toJSON" in component && typeof component.toJSON === "function") {
      return component.toJSON();
    }

    if ("type" in component && typeof component.type === "number") {
      return { ...component };
    }

    throw new TypeError("Modal: each component must be a compatible component instance or a raw component object.");
  }

  /**
   * Normalizes modal children into API-compatible JSON.
   *
   * A modal can contain between 1 and 5 components.
   *
   * @param {ModalChild[]} components Raw modal components.
   * @returns {Array<Record<string, any>>} Normalized modal components.
   * @throws {TypeError} Throws if components are invalid.
   */
  #normalizeComponents(components) {
    if (!Array.isArray(components)) {
      throw new TypeError("Modal: 'components' must be an array.");
    }

    if (components.length > 5) {
      throw new TypeError("Modal: 'components' cannot contain more than 5 entries.");
    }

    return components.map((component) => this.#normalizeComponent(component));
  }

  /**
   * Returns the modal custom id.
   *
   * @returns {string} The modal custom id.
   */
  getCustomId() {
    return this.#modal.custom_id;
  }

  /**
   * Returns the modal title.
   *
   * @returns {string} The modal title.
   */
  getTitle() {
    return this.#modal.title;
  }

  /**
   * Returns the modal components.
   *
   * @returns {Array<Record<string, any>>} The modal components.
   */
  getComponents() {
    return this.#modal.components.map((component) => ({ ...component }));
  }

  /**
   * Sets the modal custom id.
   *
   * @param {string} customId New modal custom id.
   * @returns {this} The current modal instance.
   *
   * @example
   * modal.setCustomId("profile:update");
   */
  setCustomId(customId) {
    if (typeof customId !== "string" || customId.length === 0) {
      throw new TypeError("Modal.setCustomId(): 'customId' must be a non-empty string.");
    }

    if (customId.length > 100) {
      throw new TypeError("Modal.setCustomId(): 'customId' must not exceed 100 characters.");
    }

    this.#modal.custom_id = customId;
    return this;
  }

  /**
   * Sets the modal title.
   *
   * @param {string} title New modal title.
   * @returns {this} The current modal instance.
   *
   * @example
   * modal.setTitle("Update profile");
   */
  setTitle(title) {
    if (typeof title !== "string" || title.length === 0) {
      throw new TypeError("Modal.setTitle(): 'title' must be a non-empty string.");
    }

    if (title.length > 45) {
      throw new TypeError("Modal.setTitle(): 'title' must not exceed 45 characters.");
    }

    this.#modal.title = title;
    return this;
  }

  /**
   * Replaces the modal components.
   *
   * The modal must keep between 1 and 5 components.
   *
   * @param {ModalChild[]} components New modal components.
   * @returns {this} The current modal instance.
   *
   * @example
   * modal.setComponents([
   *   new Label({
   *     label: "Bio",
   *     component: new TextInput({
   *       custom_id: "bio",
   *       style: "paragraph",
   *     }),
   *   }),
   * ]);
   */
  setComponents(components) {
    const normalizedComponents = this.#normalizeComponents(components);

    if (normalizedComponents.length === 0) {
      throw new TypeError("Modal.setComponents(): the modal must contain at least one component.");
    }

    this.#modal.components = normalizedComponents;
    return this;
  }

  /**
   * Adds one component to the modal.
   *
   * A modal cannot contain more than 5 components.
   *
   * @param {ModalChild} component Component to add.
   * @returns {this} The current modal instance.
   *
   * @example
   * modal.addComponent(
   *   new Label({
   *     label: "Website",
   *     component: new TextInput({
   *       custom_id: "website",
   *       style: "short",
   *     }),
   *   }),
   * );
   */
  addComponent(component) {
    if (this.#modal.components.length >= 5) {
      throw new TypeError("Modal.addComponent(): the modal cannot contain more than 5 components.");
    }

    const normalizedComponent = this.#normalizeComponent(component);
    this.#modal.components.push(normalizedComponent);
    return this;
  }

  /**
   * Returns the modal as a Discord-compatible JSON object.
   *
   * Modals are shown as the first interaction response via `showModal()`.
   *
   * @returns {ModalData} The raw modal payload.
   *
   * @example
   * await interaction.showModal(modal.toJSON());
   */
  toJSON() {
    return {
      ...this.#modal,
      components: this.#modal.components.map((component) => ({ ...component })),
    };
  }

  /**
   * Creates a new modal instance from raw options.
   *
   * @param {ModalOptions} options Raw modal options.
   * @returns {Modal} A new modal instance.
   *
   * @example
   * const modal = Modal.from({
   *   custom_id: "support:create",
   *   title: "Create a ticket",
   *   components: [
   *     new Label({
   *       label: "Subject",
   *       component: new TextInput({
   *         custom_id: "subject",
   *         style: "short",
   *       }),
   *     }),
   *   ],
   * });
   */
  static from(options) {
    return new Modal(options);
  }
}

module.exports = Modal;