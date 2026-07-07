export = Poll;
/**
 * Poll media object used by the question and answers.
 *
 * @typedef {Object} PollMediaData
 * @property {string} text Display text.
 * @property {string} [emoji] Optional emoji for an answer.
 */
/**
 * Single poll answer input.
 *
 * @typedef {Object} PollAnswerInputData
 * @property {string} text Answer text.
 * @property {string} [emoji] Optional emoji for the answer.
 */
/**
 * Raw options used to create a {@link Poll} instance.
 *
 * @typedef {Object} PollOptions
 * @property {string} question Poll question text.
 * @property {PollAnswerInputData[]} answers Poll answers.
 * @property {number} duration Poll duration in hours.
 * @property {boolean} [allowMultiselect=false] Whether users can select multiple answers.
 */
/**
 * Discord-compatible poll answer object.
 *
 * @typedef {Object} PollAnswerData
 * @property {PollMediaData} poll_media Poll answer media object.
 */
/**
 * Discord-compatible poll object.
 *
 * @typedef {Object} PollData
 * @property {PollMediaData} question Poll question media object.
 * @property {PollAnswerData[]} answers Poll answers.
 * @property {number} duration Poll duration in hours.
 * @property {boolean} [allow_multiselect] Whether users can select multiple answers.
 */
/**
 * Lightweight wrapper around a Discord-compatible poll payload.
 *
 * This class is designed as a structured wrapper that:
 * - normalizes question and answers into Discord's poll format,
 * - keeps internal payload data private,
 * - exposes a simple fluent API,
 * - returns raw JSON ready to be used in a message payload.
 *
 * @example
 * const poll = new Poll({
 *   question: "Which language do you prefer?",
 *   answers: [
 *     { text: "JavaScript", emoji: "🟨" },
 *     { text: "TypeScript", emoji: "🟦" },
 *     { text: "Rust", emoji: "🦀" },
 *   ],
 *   duration: 24,
 *   allowMultiselect: false,
 * });
 *
 * await interaction.reply({
 *   content: "Daily poll:",
 *   poll: poll.toJSON(),
 * });
 */
declare class Poll {
    /**
     * Creates a new poll instance from raw poll options.
     *
     * @param {PollOptions} options Raw poll options.
     * @returns {Poll} A new poll instance.
     *
     * @example
     * const poll = Poll.from({
     *   question: "Favorite front-end framework?",
     *   answers: [
     *     { text: "React" },
     *     { text: "Vue" },
     *     { text: "Svelte" },
     *   ],
     *   duration: 12,
     *   allowMultiselect: true,
     * });
     */
    static from(options: PollOptions): Poll;
    /**
     * Creates a new poll definition.
     *
     * @param {PollOptions} options Poll options.
     * @throws {TypeError} Throws if the provided poll object is invalid.
     *
     * @example
     * const poll = new Poll({
     *   question: "Which language do you prefer?",
     *   answers: [
     *     { text: "JavaScript", emoji: "🟨" },
     *     { text: "TypeScript", emoji: "🟦" },
     *     { text: "Rust", emoji: "🦀" },
     *   ],
     *   duration: 24,
     *   allowMultiselect: false,
     * });
     */
    constructor(options: PollOptions);
    /**
     * Returns the poll question text.
     *
     * @returns {string} The poll question.
     */
    getQuestion(): string;
    /**
     * Returns the poll answers.
     *
     * @returns {PollAnswerData[]} The poll answers.
     */
    getAnswers(): PollAnswerData[];
    /**
     * Returns the poll duration in hours.
     *
     * @returns {number} The poll duration.
     */
    getDuration(): number;
    /**
     * Returns whether the poll allows multiple selections.
     *
     * @returns {boolean} `true` if multiple answers are allowed, otherwise `false`.
     */
    allowsMultiselect(): boolean;
    /**
     * Sets the poll question.
     *
     * @param {string} question Poll question text.
     * @returns {this} The current poll instance.
     *
     * @example
     * poll.setQuestion("What is your favorite front-end framework?");
     */
    setQuestion(question: string): this;
    /**
     * Sets the poll answers.
     *
     * @param {PollAnswerInputData[]} answers Poll answers.
     * @returns {this} The current poll instance.
     *
     * @example
     * poll.setAnswers([
     *   { text: "Yes", emoji: "✅" },
     *   { text: "No", emoji: "❌" },
     *   { text: "Not sure", emoji: "🤔" },
     * ]);
     */
    setAnswers(answers: PollAnswerInputData[]): this;
    /**
     * Adds a single answer to the poll.
     *
     * @param {string} text Answer text.
     * @param {string} [emoji] Optional answer emoji.
     * @returns {this} The current poll instance.
     *
     * @example
     * poll
     *   .addAnswer("Go", "🐹")
     *   .addAnswer("Python", "🐍");
     */
    addAnswer(text: string, emoji?: string): this;
    /**
     * Sets the poll duration in hours.
     *
     * @param {number} duration Poll duration in hours.
     * @returns {this} The current poll instance.
     *
     * @example
     * poll.setDuration(12);
     */
    setDuration(duration: number): this;
    /**
     * Sets whether the poll allows multiple selections.
     *
     * @param {boolean} [allowMultiselect=true] Whether multiple answers are allowed.
     * @returns {this} The current poll instance.
     *
     * @example
     * poll.setAllowMultiselect(true);
     */
    setAllowMultiselect(allowMultiselect?: boolean): this;
    /**
     * Clears the poll answers.
     *
     * @returns {this} The current poll instance.
     *
     * @example
     * poll.clearAnswers();
     */
    clearAnswers(): this;
    /**
     * Returns the poll as a Discord-compatible JSON object.
     *
     * @returns {PollData} The raw poll payload.
     *
     * @example
     * await interaction.reply({
     *   content: "Cast your vote:",
     *   poll: poll.toJSON(),
     * });
     */
    toJSON(): PollData;
    #private;
}
declare namespace Poll {
    export { PollMediaData, PollAnswerInputData, PollOptions, PollAnswerData, PollData };
}
/**
 * Poll media object used by the question and answers.
 */
type PollMediaData = {
    /**
     * Display text.
     */
    text: string;
    /**
     * Optional emoji for an answer.
     */
    emoji?: string | undefined;
};
/**
 * Single poll answer input.
 */
type PollAnswerInputData = {
    /**
     * Answer text.
     */
    text: string;
    /**
     * Optional emoji for the answer.
     */
    emoji?: string | undefined;
};
/**
 * Raw options used to create a {@link Poll} instance.
 */
type PollOptions = {
    /**
     * Poll question text.
     */
    question: string;
    /**
     * Poll answers.
     */
    answers: PollAnswerInputData[];
    /**
     * Poll duration in hours.
     */
    duration: number;
    /**
     * Whether users can select multiple answers.
     */
    allowMultiselect?: boolean | undefined;
};
/**
 * Discord-compatible poll answer object.
 */
type PollAnswerData = {
    /**
     * Poll answer media object.
     */
    poll_media: PollMediaData;
};
/**
 * Discord-compatible poll object.
 */
type PollData = {
    /**
     * Poll question media object.
     */
    question: PollMediaData;
    /**
     * Poll answers.
     */
    answers: PollAnswerData[];
    /**
     * Poll duration in hours.
     */
    duration: number;
    /**
     * Whether users can select multiple answers.
     */
    allow_multiselect?: boolean | undefined;
};
//# sourceMappingURL=Poll.d.ts.map