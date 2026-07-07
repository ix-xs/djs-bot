export = FileUpload;
/**
 * Raw options used to create a {@link FileUpload} instance.
 *
 * @typedef {Object} FileUploadOptions
 * @property {string} custom_id Component custom id.
 * @property {number} [min_values] Minimum number of uploaded files.
 * @property {number} [max_values] Maximum number of uploaded files.
 * @property {boolean} [required] Whether the file upload is required.
 */
/**
 * Discord-compatible file upload payload.
 *
 * @typedef {Object} FileUploadData
 * @property {19} type Discord component type for a file upload.
 * @property {string} custom_id Component custom id.
 * @property {number} [min_values] Minimum number of uploaded files.
 * @property {number} [max_values] Maximum number of uploaded files.
 * @property {boolean} [required] Whether the file upload is required.
 */
/**
 * Lightweight wrapper around a Discord-compatible file upload payload.
 *
 * @example
 * const fileUpload = new FileUpload({
 *   custom_id: "resume",
 *   min_values: 1,
 *   max_values: 3,
 *   required: true,
 * });
 */
declare class FileUpload {
    /**
     * Creates a new file upload instance from raw options.
     *
     * @param {FileUploadOptions} options Raw file upload options.
     * @returns {FileUpload} A new file upload instance.
     *
     * @example
     * const fileUpload = FileUpload.from({
     *   custom_id: "attachments",
     *   min_values: 0,
     *   max_values: 2,
     * });
     */
    static from(options: FileUploadOptions): FileUpload;
    /**
     * Creates a new file upload component.
     *
     * @param {FileUploadOptions} options File upload options.
     * @throws {TypeError} Throws if the provided file upload options are invalid.
     *
     * @example
     * const fileUpload = new FileUpload({
     *   custom_id: "resume",
     *   min_values: 1,
     *   max_values: 3,
     *   required: true,
     * });
     */
    constructor(options: FileUploadOptions);
    /**
     * Returns the file upload custom id.
     *
     * @returns {string} The custom id.
     */
    getCustomId(): string;
    /**
     * Returns the minimum number of uploaded files.
     *
     * @returns {number|undefined} The minimum file count.
     */
    getMinValues(): number | undefined;
    /**
     * Returns the maximum number of uploaded files.
     *
     * @returns {number|undefined} The maximum file count.
     */
    getMaxValues(): number | undefined;
    /**
     * Returns whether the file upload is required.
     *
     * @returns {boolean} `true` if required, otherwise `false`.
     */
    isRequired(): boolean;
    /**
     * Sets the file upload custom id.
     *
     * @param {string} customId New custom id.
     * @returns {this} The current file upload instance.
     */
    setCustomId(customId: string): this;
    /**
     * Sets the minimum number of uploaded files.
     *
     * @param {number} minValues Minimum file count.
     * @returns {this} The current file upload instance.
     *
     * @example
     * fileUpload.setMinValues(1);
     */
    setMinValues(minValues: number): this;
    /**
     * Sets the maximum number of uploaded files.
     *
     * @param {number} maxValues Maximum file count.
     * @returns {this} The current file upload instance.
     *
     * @example
     * fileUpload.setMaxValues(5);
     */
    setMaxValues(maxValues: number): this;
    /**
     * Sets whether the file upload is required.
     *
     * @param {boolean} [required=true] Whether the file upload is required.
     * @returns {this} The current file upload instance.
     *
     * @example
     * fileUpload.setRequired(true);
     */
    setRequired(required?: boolean): this;
    /**
     * Returns the file upload as a Discord-compatible JSON object.
     *
     * @returns {FileUploadData} The raw file upload payload.
     *
     * @example
     * const payload = fileUpload.toJSON();
     *
     * console.log(payload);
     * // {
     * //   type: 19,
     * //   custom_id: "resume",
     * //   min_values: 1,
     * //   max_values: 3,
     * //   required: true
     * // }
     */
    toJSON(): FileUploadData;
    #private;
}
declare namespace FileUpload {
    export { FileUploadOptions, FileUploadData };
}
/**
 * Raw options used to create a {@link FileUpload} instance.
 */
type FileUploadOptions = {
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Minimum number of uploaded files.
     */
    min_values?: number | undefined;
    /**
     * Maximum number of uploaded files.
     */
    max_values?: number | undefined;
    /**
     * Whether the file upload is required.
     */
    required?: boolean | undefined;
};
/**
 * Discord-compatible file upload payload.
 */
type FileUploadData = {
    /**
     * Discord component type for a file upload.
     */
    type: 19;
    /**
     * Component custom id.
     */
    custom_id: string;
    /**
     * Minimum number of uploaded files.
     */
    min_values?: number | undefined;
    /**
     * Maximum number of uploaded files.
     */
    max_values?: number | undefined;
    /**
     * Whether the file upload is required.
     */
    required?: boolean | undefined;
};
//# sourceMappingURL=FileUpload.d.ts.map