import { logger } from '../logger';

export type Transformer = (value: unknown) => unknown;

/**
 * Runs each value of `record` through the transformer with the same key.
 * Values without a transformer are kept as they are. Returns a new object.
 * If a transformer throws, logs the error and returns {}.
 */
export function applyTransformers(
  transformers: Record<string, Transformer>,
  record: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const transform = transformers[key];
      result[key] = transform ? transform(value) : value;
    }
    return result;
  } catch (error) {
    logger.error('Failed to transform record', { error: String(error), record });
    return {};
  }
}
