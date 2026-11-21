type Details = Record<string, unknown>;

function write(level: 'info' | 'error', message: string, details?: Details) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...details });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, details?: Details) => write('info', message, details),
  error: (message: string, details?: Details) => write('error', message, details),
};
