-- Drops and recreates all tables. Run with `npm run db:setup`.
-- The database enforces the data rules itself, so a bug in the app can't write invalid rows.

DROP TABLE IF EXISTS permits, trails, channels;

CREATE TABLE channels (
  id        TEXT PRIMARY KEY,
  label     TEXT NOT NULL,
  max_party INTEGER NOT NULL CHECK (max_party > 0),
  fields    JSONB NOT NULL -- field definitions, stored as-is from channels.json
);

CREATE TABLE trails (
  code        TEXT PRIMARY KEY,
  name        TEXT, -- nullable: the frontend shows the code instead
  daily_quota INTEGER NOT NULL CHECK (daily_quota >= 0),
  status      TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  updated_at  DATE NOT NULL
);

CREATE TABLE permits (
  id              BIGSERIAL PRIMARY KEY,
  idempotency_key UUID NOT NULL UNIQUE,
  trail           TEXT NOT NULL REFERENCES trails (code),
  date            DATE NOT NULL,
  party_size      INTEGER NOT NULL CHECK (party_size > 0),
  status          TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
  channel         TEXT NOT NULL REFERENCES channels (id),
  email           TEXT CHECK (email = lower(btrim(email))), -- nullable: optional on the desk channel
  details         JSONB NOT NULL, -- the other channel fields, e.g. lead_name
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active permit per email, trail and date (the duplicate rule).
-- Postgres treats NULL emails as distinct, so desk permits without an email aren't checked.
-- Also speeds up the availability and quota lookups, which filter on (trail, date) for active permits.
CREATE UNIQUE INDEX permits_one_active_per_person
  ON permits (trail, date, email)
  WHERE status = 'active';
