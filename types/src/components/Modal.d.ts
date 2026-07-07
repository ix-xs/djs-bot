export = Modal;
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
declare class Modal {
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
    static from(options: ModalOptions): Modal;
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
    constructor(options: ModalOptions);
    /**
     * Returns the modal custom id.
     *
     * @returns {string} The modal custom id.
     */
    getCustomId(): string;
    /**
     * Returns the modal title.
     *
     * @returns {string} The modal title.
     */
    getTitle(): string;
    /**
     * Returns the modal components.
     *
     * @returns {Array<Record<string, any>>} The modal components.
     */
    getComponents(): Array<Record<string, any>>;
    /**
     * Sets the modal custom id.
     *
     * @param {string} customId New modal custom id.
     * @returns {this} The current modal instance.
     *
     * @example
     * modal.setCustomId("profile:update");
     */
    setCustomId(customId: string): this;
    /**
     * Sets the modal title.
     *
     * @param {string} title New modal title.
     * @returns {this} The current modal instance.
     *
     * @example
     * modal.setTitle("Update profile");
     */
    setTitle(title: string): this;
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
    setComponents(components: ModalChild[]): this;
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
    addComponent(component: ModalChild): this;
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
    toJSON(): ModalData;
    #private;
}
declare namespace Modal {
    export { ModalChild, ModalOptions, ModalData };
}
/**
 * Component types allowed inside a modal.
 */
type ModalChild = import("./Label");
/**
 * Raw options used to create a {@link Modal} instance.
 */
type ModalOptions = {
    /**
     * Modal custom id.
     */
    custom_id: string;
    /**
     * Modal title.
     */
    title: string;
    /**
     * Modal components.
     */
    components: ModalChild[];
};
/**
 * Discord-compatible modal payload.
 */
type ModalData = {
    /**
     * Discord interaction callback modal type.
     */
    type: 9;
    /**
     * Modal custom id.
     */
    custom_id: string;
    /**
     * Modal title.
     */
    title: string;
    /**
     * Modal components.
     */
    components: Array<Record<string, any>>;
};
//# sourceMappingURL=Modal.d.ts.map