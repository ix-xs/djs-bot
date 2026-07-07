export = Container;
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
declare class Container {
    /**
     * Creates a new container instance from raw options.
     *
     * @param {ContainerOptions} options Raw container options.
     * @returns {Container} A new container instance.
     */
    static from(options: ContainerOptions): Container;
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
    constructor(options: ContainerOptions);
    /**
     * Returns the container components.
     *
     * @returns {Array<Record<string, any>>} The container child components.
     */
    getComponents(): Array<Record<string, any>>;
    /**
     * Returns the accent color.
     *
     * @returns {number|undefined} The accent color.
     */
    getAccentColor(): number | undefined;
    /**
     * Returns whether the container is spoilered.
     *
     * @returns {boolean} `true` if spoilered, otherwise `false`.
     */
    isSpoiler(): boolean;
    /**
     * Replaces the container child components.
     *
     * @param {ContainerChild[]} components New child components.
     * @returns {this} The current container instance.
     */
    setComponents(components: ContainerChild[]): this;
    /**
     * Adds one child component to the container.
     *
     * @param {ContainerChild} component Child component to add.
     * @returns {this} The current container instance.
     */
    addComponent(component: ContainerChild): this;
    /**
     * Sets the accent color.
     *
     * @param {import("discord.js").ColorResolvable} color Container accent color.
     * @returns {this} The current container instance.
     */
    setColor(color: import("discord.js").ColorResolvable): this;
    /**
     * Clears the accent color.
     *
     * @returns {this} The current container instance.
     */
    clearColor(): this;
    /**
     * Sets the spoiler state.
     *
     * @param {boolean} [spoiler=true] Whether the container is spoilered.
     * @returns {this} The current container instance.
     */
    setSpoiler(spoiler?: boolean): this;
    /**
     * Returns the container as a Discord-compatible JSON object.
     *
     * @returns {ContainerData} The raw container payload.
     */
    toJSON(): ContainerData;
    #private;
}
declare namespace Container {
    export { ContainerChild, ContainerOptions, ContainerData };
}
/**
 * Component types allowed inside a container.
 */
type ContainerChild = (import("./ActionRow") | import("./TextDisplay") | import("./Section") | import("./Gallery") | import("./Separator") | import("./File"));
/**
 * Raw options used to create a {@link Container} instance.
 */
type ContainerOptions = {
    /**
     * Components contained in the container.
     */
    components: ContainerChild[];
    /**
     * Accent color alias input.
     */
    color?: import("discord.js").ColorResolvable | undefined;
    /**
     * Whether the container is spoilered.
     */
    spoiler?: boolean | undefined;
};
/**
 * Discord-compatible container payload.
 */
type ContainerData = {
    /**
     * Discord component type for a container.
     */
    type: 17;
    /**
     * Container child components.
     */
    components: Array<Record<string, any>>;
    /**
     * Accent color of the container.
     */
    accent_color?: number | undefined;
    /**
     * Whether the container is spoilered.
     */
    spoiler?: boolean | undefined;
};
//# sourceMappingURL=Container.d.ts.map