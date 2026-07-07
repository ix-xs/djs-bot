// @ts-check

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
class Poll {
  /**
   * Poll payload in Discord-compatible format.
   *
   * @type {PollData}
   */
  #poll;

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
  constructor(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Poll: 'options' must be an object.");
    }

    const {
      question,
      answers,
      duration,
      allowMultiselect = false,
    } = options;

    if (typeof question !== "string" || question.length === 0) {
      throw new TypeError("Poll: 'question' must be a non-empty string.");
    }

    if (question.length > 300) {
      throw new TypeError("Poll: 'question' must not exceed 300 characters.");
    }

    if (!Array.isArray(answers)) {
      throw new TypeError("Poll: 'answers' must be an array.");
    }

    if (!Number.isInteger(duration)) {
      throw new TypeError("Poll: 'duration' must be a valid integer.");
    }

    if (duration < 1 || duration > 720) {
      throw new TypeError("Poll: 'duration' must be between 1 and 720 hours.");
    }

    if (typeof allowMultiselect !== "boolean") {
      throw new TypeError("Poll: 'allowMultiselect' must be a boolean.");
    }

    const normalizedAnswers = this.#normalizeAnswers(answers);

    if (normalizedAnswers.length === 0) {
      throw new TypeError("Poll: at least one valid answer is required.");
    }

    if (normalizedAnswers.length > 10) {
      throw new TypeError("Poll: a poll cannot contain more than 10 answers.");
    }

    this.#poll = {
      question: {
        text: question,
      },
      answers: normalizedAnswers,
      duration,
      allow_multiselect: allowMultiselect ? true : undefined,
    };
  }

  /**
   * Normalizes poll answers into Discord-compatible answer objects.
   *
   * @param {PollAnswerInputData[]} answers Raw poll answers.
   * @returns {PollAnswerData[]} Normalized poll answers.
   * @throws {TypeError} Throws if an answer contains invalid data.
   */
  #normalizeAnswers(answers) {
    return answers.map((answer) => {
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new TypeError("Poll: each answer must be an object.");
      }

      if (typeof answer.text !== "string" || answer.text.length === 0) {
        throw new TypeError("Poll: each answer must have a non-empty 'text' string.");
      }

      if (answer.text.length > 55) {
        throw new TypeError("Poll: each answer text must not exceed 55 characters.");
      }

      if (answer.emoji !== undefined && typeof answer.emoji !== "string") {
        throw new TypeError("Poll: each answer emoji must be a string when provided.");
      }

      return {
        poll_media: {
          text: answer.text,
          emoji: answer.emoji ?? undefined,
        },
      };
    });
  }

  /**
   * Returns the poll question text.
   *
   * @returns {string} The poll question.
   */
  getQuestion() {
    return this.#poll.question.text;
  }

  /**
   * Returns the poll answers.
   *
   * @returns {PollAnswerData[]} The poll answers.
   */
  getAnswers() {
    return this.#poll.answers.map((answer) => ({
      poll_media: { ...answer.poll_media },
    }));
  }

  /**
   * Returns the poll duration in hours.
   *
   * @returns {number} The poll duration.
   */
  getDuration() {
    return this.#poll.duration;
  }

  /**
   * Returns whether the poll allows multiple selections.
   *
   * @returns {boolean} `true` if multiple answers are allowed, otherwise `false`.
   */
  allowsMultiselect() {
    return Boolean(this.#poll.allow_multiselect);
  }

  /**
   * Sets the poll question.
   *
   * @param {string} question Poll question text.
   * @returns {this} The current poll instance.
   *
   * @example
   * poll.setQuestion("What is your favorite front-end framework?");
   */
  setQuestion(question) {
    if (typeof question !== "string" || question.length === 0) {
      throw new TypeError("Poll.setQuestion(): 'question' must be a non-empty string.");
    }

    if (question.length > 300) {
      throw new TypeError("Poll.setQuestion(): 'question' must not exceed 300 characters.");
    }

    this.#poll.question = { text: question };
    return this;
  }

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
  setAnswers(answers) {
    if (!Array.isArray(answers)) {
      throw new TypeError("Poll.setAnswers(): 'answers' must be an array.");
    }

    const normalizedAnswers = this.#normalizeAnswers(answers);

    if (normalizedAnswers.length === 0) {
      throw new TypeError("Poll.setAnswers(): at least one valid answer is required.");
    }

    if (normalizedAnswers.length > 10) {
      throw new TypeError("Poll.setAnswers(): a poll cannot contain more than 10 answers.");
    }

    this.#poll.answers = normalizedAnswers;
    return this;
  }

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
  addAnswer(text, emoji = undefined) {
    if (typeof text !== "string" || text.length === 0) {
      throw new TypeError("Poll.addAnswer(): 'text' must be a non-empty string.");
    }

    if (text.length > 55) {
      throw new TypeError("Poll.addAnswer(): 'text' must not exceed 55 characters.");
    }

    if (emoji !== undefined && typeof emoji !== "string") {
      throw new TypeError("Poll.addAnswer(): 'emoji' must be a string when provided.");
    }

    if (this.#poll.answers.length >= 10) {
      throw new TypeError("Poll.addAnswer(): a poll cannot contain more than 10 answers.");
    }

    this.#poll.answers.push({
      poll_media: {
        text,
        emoji: emoji ?? undefined,
      },
    });

    return this;
  }

  /**
   * Sets the poll duration in hours.
   *
   * @param {number} duration Poll duration in hours.
   * @returns {this} The current poll instance.
   *
   * @example
   * poll.setDuration(12);
   */
  setDuration(duration) {
    if (!Number.isInteger(duration)) {
      throw new TypeError("Poll.setDuration(): 'duration' must be a valid integer.");
    }

    if (duration < 1 || duration > 720) {
      throw new TypeError("Poll.setDuration(): 'duration' must be between 1 and 720 hours.");
    }

    this.#poll.duration = duration;
    return this;
  }

  /**
   * Sets whether the poll allows multiple selections.
   *
   * @param {boolean} [allowMultiselect=true] Whether multiple answers are allowed.
   * @returns {this} The current poll instance.
   *
   * @example
   * poll.setAllowMultiselect(true);
   */
  setAllowMultiselect(allowMultiselect = true) {
    if (typeof allowMultiselect !== "boolean") {
      throw new TypeError("Poll.setAllowMultiselect(): 'allowMultiselect' must be a boolean.");
    }

    this.#poll.allow_multiselect = allowMultiselect ? true : undefined;
    return this;
  }

  /**
   * Clears the poll answers.
   *
   * @returns {this} The current poll instance.
   *
   * @example
   * poll.clearAnswers();
   */
  clearAnswers() {
    this.#poll.answers = [];
    return this;
  }

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
  toJSON() {
    return {
      ...this.#poll,
      question: { ...this.#poll.question },
      answers: this.#poll.answers.map((answer) => ({
        poll_media: { ...answer.poll_media },
      })),
    };
  }

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
  static from(options) {
    return new Poll(options);
  }
}

module.exports = Poll;