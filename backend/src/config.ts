export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://trail:trail@localhost:5432/trail_permit_desk';

export const PORT = Number(process.env.PORT ?? 3000);
