import { applyTransformers } from '../../src/data/applyTransformers';
import { logger } from '../../src/logger';

test('transforms values that have a transformer and keeps the rest unchanged', () => {
  const transformers = {
    code: (value: unknown) => String(value).trim().toUpperCase(),
    daily_quota: (value: unknown) => Number(value),
  };
  const record = { code: ' rdg-01 ', daily_quota: '25', status: 'open' };

  expect(applyTransformers(transformers, record)).toEqual({
    code: 'RDG-01',
    daily_quota: 25,
    status: 'open',
  });
});

test('returns {} and logs when a transformer throws', () => {
  const logError = jest.spyOn(logger, 'error').mockImplementation(() => {});
  const transformers = {
    code: () => {
      throw new Error('bad value');
    },
  };

  expect(applyTransformers(transformers, { code: 'x' })).toEqual({});
  expect(logError).toHaveBeenCalledWith(
    'Failed to transform record',
    expect.objectContaining({ record: { code: 'x' } }),
  );

  logError.mockRestore();
});
