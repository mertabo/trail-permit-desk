type Details = Record<string, unknown>;

// Jest sets NODE_ENV to 'test'. Logs are muted there so test output stays readable.
// Tests that care about logging spy on logger.info / logger.error instead.
const isTest = process.env.NODE_ENV === 'test';

function write(level: 'info' | 'error', message: string, details?: Details) {
  if (isTest) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...details });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, details?: Details) => write('info', message, details),
  error: (message: string, details?: Details) => write('error', message, details),
};
