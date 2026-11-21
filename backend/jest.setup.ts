// Tests always run against the test database, never the dev one.
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://trail:trail@localhost:5432/trail_permit_desk_test';
