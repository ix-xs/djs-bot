/**
 * Typed customId codec.
 *
 * A component's customId is the only piece of state Discord round-trips for you,
 * and it is capped at 100 characters. Instead of hand-concatenating strings and
 * parsing them with a fragile `split("_")`, the framework encodes a short
 * routing `key` plus a typed parameter payload, and decodes it back with the
 * exact types you declared.
 *
 * Wire format: `key` on its own, or `key$<base64url(json-array)>` when the
 * component has params. The `$` separator never appears in a routing key or in
 * base64url output, so parsing is unambiguous.
 *
 * @module customId
 */
import { CUSTOM_ID_MAX_LENGTH } from "./constants.js";
import { BotError } from "./errors.js";
import type { ParamMap } from "./schema.js";

const SEP = "$";

function toBase64Url(json: string): string {
  return Buffer.from(json, "utf8").toString("base64url");
}
function fromBase64Url(b64: string): string {
  return Buffer.from(b64, "base64url").toString("utf8");
}

/**
 * Encodes a routing key and typed params into a Discord-safe customId.
 *
 * @param key    The stable routing key (e.g. `"ticket:close"`).
 * @param schema The param codec map declared on the component.
 * @param values The values to encode, keyed like `schema`.
 * @throws {BotError} `DJSBOT_E020` if the result exceeds the 100-char limit.
 */
export function encodeCustomId(
  key: string,
  schema: ParamMap | undefined,
  values: Record<string, unknown> | undefined,
): string {
  if (!schema || Object.keys(schema).length === 0) {
    guardLength(key, key);
    return key;
  }
  const ordered = Object.keys(schema);
  const payload = ordered.map((name) => {
    const codec = schema[name]!;
    const value = (values ?? {})[name];
    return codec.encode(value as never);
  });
  const encoded = `${key}${SEP}${toBase64Url(JSON.stringify(payload))}`;
  guardLength(encoded, key);
  return encoded;
}

/**
 * Decodes a customId back into its routing key and typed params.
 *
 * @param raw    The raw customId from the interaction.
 * @param schema The param codec map declared on the resolved component.
 * @throws {BotError} `DJSBOT_E021` if the payload cannot be decoded.
 */
export function decodeCustomId(
  raw: string,
  schema: ParamMap | undefined,
): { key: string; params: Record<string, unknown> } {
  const sepIndex = raw.indexOf(SEP);
  if (sepIndex === -1) return { key: raw, params: {} };

  const key = raw.slice(0, sepIndex);
  const rest = raw.slice(sepIndex + 1);
  if (!schema || rest.length === 0) return { key, params: {} };

  try {
    const decoded = JSON.parse(fromBase64Url(rest)) as string[];
    const ordered = Object.keys(schema);
    const params: Record<string, unknown> = {};
    ordered.forEach((name, i) => {
      params[name] = schema[name]!.decode(decoded[i] ?? "");
    });
    return { key, params };
  } catch (cause) {
    throw new BotError("DJSBOT_E021", { detail: `customId "${raw}"`, cause });
  }
}

/** Extracts just the routing key from a raw customId without decoding params. */
export function customIdKey(raw: string): string {
  const i = raw.indexOf(SEP);
  return i === -1 ? raw : raw.slice(0, i);
}

function guardLength(encoded: string, key: string): void {
  if (encoded.length > CUSTOM_ID_MAX_LENGTH) {
    throw new BotError("DJSBOT_E020", {
      detail: `key "${key}" produced ${encoded.length} chars`,
      hint: `Shorten params or move large state into a store keyed by a short id. Limit is ${CUSTOM_ID_MAX_LENGTH}.`,
    });
  }
}
