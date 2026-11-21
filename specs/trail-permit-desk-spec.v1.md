# Trail Permit Desk — Spec

A small web app for **Ridgeline Park**'s day-hike permits. It replaces a shared spreadsheet. Hikers request a permit for a trail on a date through one of three channels (online, ranger desk, tour operator), find their permits by email, and cancel them.

**Why it exists:** each trail admits a limited number of hikers per day. Twice last month, a trail was over-issued on a busy Saturday because two people saved the spreadsheet at the same moment. **Over-issuing must be impossible**, even with many requests at once or requests sent straight to the API.

**Priorities:** correct data, enough edge cases handled, simple and extensible code. Not a perfect app.

**Stack**
- Frontend: Vue, TypeScript, Bootstrap, Jest, Cypress component tests (CCT)
- Backend: Node.js, TypeScript, REST API, node-postgres, Jest
- Database: PostgreSQL, running in Docker

---

## 1. Rules

### Workflow
- Commit once per task. Ask the user to review once per phase (Setup, Data, Request a permit, Find a permit, Cancel a permit), before committing that phase's tasks.
- Stick to the scope of the task.
- Never assume. Ask the user when something is unclear.
- Prefer readability and simplicity. No extra libraries or patterns unless needed.

### Backend
- Every endpoint logs when it's called, when it succeeds, and on errors.
- Every endpoint validates its input. Invalid input returns `VALIDATION_ERROR`, never a 500.
- The backend only sends error codes (see [Error codes](#3-error-codes)). It never sends user-facing text.
- Database rules (NOT NULL, foreign keys, UNIQUE, CHECK) are enforced in the schema, not only in code.

### Frontend
- Each endpoint gets a service function. Views call it through a composable.
- All user-facing text for error codes lives in one place in the frontend.
- Every view that calls an endpoint has:
  - a loading state (a simple loader)
  - an error toast: the message for the code, or "Something went wrong. Please try again later" for unknown codes
  - only one toast at a time
  - a generic empty state for lists

### Dates and data
- **All dates use Philippine time (`Asia/Manila`).** "Today" is today in the Philippines, wherever the user is.
- Bookings are open for 31 days: today plus the next 30 days.
- Put both in constants, `TIMEZONE = 'Asia/Manila'` and `BOOKING_WINDOW_DAYS = 31`, once in the backend and once in the frontend, with a comment that they must match.
- Dates are `'YYYY-MM-DD'` strings everywhere.
  - Compute them with `Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE })`.
  - Never use `toISOString()` (it gives the UTC date) or Postgres `CURRENT_DATE`.
  - Set a node-postgres type parser so `DATE` columns come back as strings, not JS `Date` objects.
- Emails are always stored trimmed and lowercased.

### Testing
- Test what protects the data, what the brief requires, and what's likely to break. Each task lists only those tests. Simple code (plain selects, static pages) has none.
- The shared error handler is tested once: an unexpected error returns `SERVER_ERROR` (500).
- The two list views (trail selection and search) have CCT tests for their loading, error and empty states.
- Backend tests run against a separate test database, reset before each run.

---

## 2. Business rules

These are the rules the data must always follow. Tasks refer back to them.

**Trails**
- Every trail has a cap (`daily_quota`). A trail without one is rejected when seeding.
- A trail is `open` or `closed`. "Full" is not stored. It's computed: booked hikers ≥ `daily_quota`.

**Booking a permit**
- The trail must be open, or the booking is rejected with `TRAIL_CLOSED`.
- Booked hikers for that trail and date, plus the new party, must not exceed `daily_quota`. Otherwise `TRAIL_FULL`.
- `party_size` is between 1 and the channel's `max_party`.
- The date is between today and today + 30.
- Only **active** permits count toward the quota.

**Duplicates**
- One active permit per email, per trail, per date. Otherwise `DUPLICATE_BOOKING`.
- Desk permits without an email skip this check (accepted gap, see `DECISIONS.md`).

**Idempotency** (safe retries)
- The frontend creates one `idempotency_key` per form and sends it with every save attempt.
- If a permit with that key already exists, the backend returns it as success and creates nothing new, even if the data is different.

**Permit status**
- The database stores `active` or `cancelled`. That only changes when someone cancels.
- **Expired** is not stored. It's computed, like "full": an `active` permit dated before today is shown as expired.
- So what users see is one of: **Active** (today or later), **Expired** (date has passed), **Cancelled**.

**Cancelling**
- Only Active permits can be cancelled (status `active`, dated today or later). An expired permit: `PERMIT_EXPIRED`.
- The cancel request must include the permit's email. A wrong email is treated like a missing permit: `PERMIT_NOT_FOUND`.
- Cancelling an already cancelled permit returns success and changes nothing.
- A cancelled permit frees its slots, and the same person can book that trail and date again.
- A cancelled permit can't become active again.
- Closing a trail doesn't cancel its permits.

---

## 3. Error codes

The backend keeps one mapping of code → HTTP status. Every error response is `{ "code": "<CODE>" }`.

The frontend shows each code as a plain-language message (the brief requires the user to be told why a request was rejected).

| Code | HTTP status | Message shown to the user |
|---|---|---|
| `VALIDATION_ERROR` | 400 | "Some details aren't valid. Please check the form and try again." |
| `PERMIT_NOT_FOUND` | 404 | "We couldn't find this permit. It may have been removed." |
| `PERMIT_EXPIRED` | 409 | "This permit has expired, so it can't be cancelled." |
| `TRAIL_CLOSED` | 409 | "This trail is currently closed. Please choose another trail." |
| `TRAIL_FULL` | 409 | "There aren't enough spots left on this trail for your party. Try a smaller party, another date, or another trail." |
| `DUPLICATE_BOOKING` | 409 | "You already have a permit for this trail on this date." |
| `SERVER_ERROR` | 500 | "Something went wrong. Please try again later." |
| (unknown code) | | "Something went wrong. Please try again later." |

---

## 4. API

JSON keys are snake_case, matching the database columns.

A **permit** is: `{ id, idempotency_key, trail, date, party_size, status, channel, email, details, created_at }`

| Endpoint | Request | Response |
|---|---|---|
| `GET /trails/availability?date=YYYY-MM-DD` | | `200` `[{ code, name, daily_quota, status, booked_hikers }]` |
| `GET /channels` | | `200` `[{ id, label, max_party, fields }]` |
| `POST /permits` | `{ idempotency_key, trail, date, channel, fields: { <key>: <value> } }` | `201` permit (also for an idempotent replay) |
| `GET /permits/search?email=...&page=1` | | `200` `{ items: [{ id, trail, trail_name, trail_status, date, party_size, status }], total, page, page_size }`. Here `status` is `active`, `expired` or `cancelled`. |
| `POST /permits/:id/cancel` | `{ email }` | `204`, no body |

---

## 5. Data model

Defined in `backend/db/schema.sql`.

**channels**

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT | primary key |
| `label` | TEXT | not null |
| `max_party` | INTEGER | not null, `> 0` |
| `fields` | JSONB | not null. Field definitions stored as-is from `channels.json` |

Each field has `key`, `label`, `type`, `required`, and optionally `min`, `max_length`, `pattern`, `options`.
Supported types: `text`, `email`, `number`, `tel`, `checkbox`, `select`, `textarea`.

Two field keys are special, because the backend stores them in their own columns:
- `party_size`: every channel must have it, as a required `number` field.
- `email`: optional. A channel may leave it out or make it not required.

**trails**

| Column | Type | Rules |
|---|---|---|
| `code` | TEXT | primary key |
| `name` | TEXT | nullable (the frontend falls back to the code) |
| `daily_quota` | INTEGER | not null, `>= 0` |
| `status` | TEXT | not null, `'open'` or `'closed'` |
| `updated_at` | DATE | not null |

**permits**

| Column | Type | Rules |
|---|---|---|
| `id` | BIGSERIAL | primary key |
| `idempotency_key` | UUID | not null, unique |
| `trail` | TEXT | not null, references `trails(code)` |
| `date` | DATE | not null |
| `party_size` | INTEGER | not null, `> 0` |
| `status` | TEXT | not null, `'active'` or `'cancelled'` |
| `channel` | TEXT | not null, references `channels(id)` |
| `email` | TEXT | nullable (optional on the desk channel), must equal `lower(btrim(email))` |
| `details` | JSONB | not null. The other channel fields, e.g. `lead_name`, `emergency_phone` |
| `created_at` | TIMESTAMPTZ | not null, default `now()` |

**Indexes**
- `UNIQUE (trail, date, email) WHERE status = 'active'`: enforces the duplicate rule. Postgres treats NULL emails as distinct, so desk permits without email aren't checked. Also speeds up the availability and quota lookups.
- `(email, date, id)`: for search (added in task 19).

---

## 6. Out of scope

- Login, user accounts, roles
- Editing a permit, or making a cancelled permit active again
- Screens for managing trails or channels
- Translations

---

## Tasks

### Setup

#### Task 1 — Create the repo
- Create a personal repo `trail-permit-desk`.
- At the root, create:
  - `README.md`, `AI-USAGE.md`: empty for now, filled in later
  - `SPEC.md`: the short human-readable summary (copy of `~/Desktop/SPEC.md`)
  - `DECISIONS.md`: the design decisions and data oddities (copy of `~/Desktop/DECISIONS.md`)
  - `specs/trail-permit-desk-spec.v1.md`: this full spec
- **Done when:** the repo exists with these five files.

#### Task 2 — Set up the app
- Folder structure:
  - `/backend` (the schema lives in `/backend/db/schema.sql`)
  - `/frontend`
  - `/docker-compose.yml`: Postgres for dev, plus a test database
- Remove unnecessary boilerplate.

#### Task 3 — Verify the app
- Start the database separately with `docker compose up -d` (documented in the README).
- npm scripts:

  | Folder | Script | What it does |
  |---|---|---|
  | backend | `start` | starts the server |
  | backend | `db:setup` | drops and recreates the tables from `schema.sql` |
  | backend | `seed` | seeds the database |
  | backend | `test` | runs all Jest tests against the test database |
  | frontend | `start` | starts the frontend |
  | frontend | `unit-test` | runs all Jest tests |
  | frontend | `component-test` | runs all CCT tests |

- Verify end to end with throwaway files (add `.tmp` to their names):
  - a table, an endpoint, and a Bootstrap button that calls the endpoint
  - the frontend shows data from the database
  - a Jest test for the endpoint and a CCT test for the button, both passing

#### Task 4 — Clean up throwaway files
- **Done when:** no `.tmp` files remain.

#### Task 5 — Add the given data
- Copy `trails.json` and `channels.json` into `/data` **exactly as given**. Never hand-edit them. The import handles every oddity in code.
- **Done when:** `/data` contains both files, unchanged from the originals.

### Data

#### Task 6 — Data cleaning function
- `applyTransformers(transformers: Record<string, function>, record: Record<string, unknown>)`
- Runs each value in `record` through the transformer with the same key. Values without a transformer are kept.
- Returns a new object. Doesn't change the input.
- On error: logs the error with the record and returns `{}`.

**Tests (Jest)**
- transforms values that have a transformer and keeps the rest unchanged
- returns `{}` and logs when a transformer throws

#### Task 7 — Create the tables
- Write `schema.sql` from the [Data model](#5-data-model), including the unique index.
- **Done when:** the three tables exist and are empty.

#### Task 8 — Seed the database
The seed can be re-run: it empties the tables first.

**Channels**
- Check that every field type is supported, field keys are unique within a channel, and every channel has a required `party_size` number field. Stop the seed with a clear error if not.
- Insert all channels.

**Trails**
- Read the `trails` array from the file. It's wrapped in `{ exported_at, note, trails }`.
- Steps 1–3 live in one pure function, `prepareTrails(file)` → `{ valid, rejected, duplicates }`, so they can be tested on the real file without a database.

1. Clean each trail with `applyTransformers`:
   - `code`: trim + uppercase (so `rdg-01` and `RDG-01` are the same trail)
   - `name`: trim, empty string → `null`
   - `daily_quota`: convert to a number (`"25"` → `25`). `null` stays `null`.
   - `status`: trim + lowercase (`"Open"` → `"open"`)
2. Deduplicate by code. The latest `updated_at` wins. On a tie, keep the last one in the file and log it. The winning record is used whole (name, quota, status), not merged with the older one.
3. Reject and log (with the reason) any trail where `daily_quota` is null or not a whole number ≥ 0, `status` isn't open/closed, or `code` is empty. Validation runs after deduplication: if the latest record is invalid, the trail is rejected. There's no fallback to an older record.
4. Insert the valid trails.
5. Log a summary: inserted, deduplicated, rejected.

**Permits**: at least **50,000 past permits**, plus some upcoming ones, to measure the email search.
- Past dates from 24 months ago up to yesterday. Upcoming dates from today up to today + 30.
- The past count is a constant (`PAST_PERMITS = 50_000`), so a bigger seed can be run to measure search at larger volumes.
- Emails from a pool of about 3,000, so each person has several permits. Some desk permits have no email.
- Every permit has valid details for its channel and `party_size` ≤ the channel's `max_party`.
- Active permits follow the [business rules](#2-business-rules) (quota and duplicates). Any permit that can't be active is cancelled.
- How (keep it simple, no clever algorithm):
  1. Generate random permits one at a time.
  2. Keep a running total of hikers per trail and date (a `Map`), and the (trail, date, email) combinations already used (a `Set`).
  3. If a permit would go over quota or repeat a combination, mark it `cancelled`. Otherwise mark it `active` and add it to the totals.
- MOS-05 (closed) has some future active permits, within its quota.
- Insert in batches inside one transaction.

**Tests (Jest, `prepareTrails` on the real `trails.json`)**
- returns 7 trails, all codes uppercase
- `rdg-01` / `RDG-01`: the later record wins whole (quota 45, "Ridgeline Loop (new signage)")
- FAL-02: name trimmed, quota `"25"` becomes `25`
- CAV-04 is rejected with the reason "daily_quota missing"
- OLD-07: name `null`, status `"Open"` becomes `"open"`
- an invalid latest record rejects the trail, with no fallback to the older one (small inline fixture)

**Done when**
- `trails` has 7 rows:
  - RDG-01 is "Ridgeline Loop (new signage)" with quota 45
  - FAL-02's name is trimmed and its quota is 25
  - OLD-07's name is null and its status is `open`
  - CAV-04 was rejected and logged
- `channels` has 3 rows.
- `permits` has at least 50,000 rows dated before today, plus upcoming ones.
- No trail and date is over quota (returns 0 rows):
  ```sql
  SELECT p.trail, p.date
  FROM permits p JOIN trails t ON t.code = p.trail
  WHERE p.status = 'active'
  GROUP BY p.trail, p.date, t.daily_quota
  HAVING SUM(p.party_size) > t.daily_quota;
  ```

### Request a permit

#### Task 9 — Landing page
- A large "Trail Permit Desk" title, a short description, and two buttons:
  - **Request a permit** (primary) → `/request-permit`
  - **Find a permit** (secondary) → `/find-permit`

#### Task 10 — Form skeleton (4 steps)
- Previous and Next buttons at the top, with a step counter between them.
- Steps are configured in one array, so adding a step means adding one entry:
  `[{ title: "Date", component: CalendarStep }, ...]`
- Register the `/request-permit` route.
- The current step renders in a card in the middle.
- Form state (date, trail, channel, fields) is kept across steps.
- Going back and changing a step clears the steps after it (e.g. a new date clears the trail, channel and fields), because availability depends on the earlier choices.
- Create the `idempotency_key` (`crypto.randomUUID()`) when the form starts. Keep it until a save succeeds. Moving between steps doesn't change it.
- Next is disabled until the current step has a selection. Previous is disabled on step 1.

**Tests (CCT)**
- changing the date clears the selected trail, channel and fields

#### Task 11 — Step 1: calendar
- Utility `computeDateRange(days: number, now: Date)`:
  - starts at today (Philippine time) and returns `days` dates in total
  - `now` is a parameter so tests don't depend on the current time
  - returns `[{ month: "Nov", year: 2026, days: [28, 29, 30] }, { month: "Dec", year: 2026, days: [1, 2, ...] }]`
- Show the dates 7 per row, starting from today. One date can be selected at a time.

**Tests (Jest, `computeDateRange`)**
- returns 31 days, grouped correctly across a month and year boundary (Dec → Jan)
- uses Philippine time: at 16:30 UTC the range already starts on the next day

#### Task 12 — Endpoint: trail availability
- `GET /trails/availability?date=YYYY-MM-DD`
- The date must be within the booking window (today to today + 30). Otherwise `VALIDATION_ERROR`.
- Start from trails and LEFT JOIN, so trails with no permits are included:
  ```sql
  SELECT t.code, t.name, t.daily_quota, t.status,
         COALESCE(SUM(p.party_size), 0) AS booked_hikers
  FROM trails t
  LEFT JOIN permits p
    ON p.trail = t.code AND p.date = $1 AND p.status = 'active'
  GROUP BY t.code
  ORDER BY t.code;
  ```

**Tests (Jest)**
- counts only active permits
- includes trails with no permits (`booked_hikers = 0`) and closed trails (with their booked count)
- a date outside the booking window → `VALIDATION_ERROR`

#### Task 13 — Step 2: trail selection
- Trail cards, one selectable at a time. Each card shows:
  - the trail name (or the code if there's no name)
  - hikers still available: `daily_quota - booked_hikers`, never below 0 (e.g. "12 of 45 available")
  - a status pill: **CLOSED** if closed, otherwise **FULL** if booked ≥ quota. The card is disabled in both cases.

**Tests (CCT)**
- loading, error and empty states
- shows the code when there's no name (OLD-07)
- shows 0 available, never negative, when booked ≥ quota
- FULL disables the card (including quota 0). CLOSED disables the card and wins over FULL.

#### Task 14 — Endpoint: channels
- `GET /channels`: returns all channels, including their fields.

#### Task 15 — Step 3: channel selection
- Channel cards, one selectable at a time.
- Each card shows the label and the available slots: `min(max_party, daily_quota - booked_hikers)`.

**Tests (CCT)**
- available slots are `min(max_party, remaining quota)`, both when `max_party` is smaller and when the remaining quota is smaller (`it.each`)

#### Task 16 — `dynamic-input` component
- Renders one field from a channel field definition, using Bootstrap components.
- Supports: `text`, `email`, `number`, `tel`, `checkbox`, `select`, `textarea`.
- Shows validation messages for: required, min, max (`party_size` max = available slots), max_length, pattern, email format.
- Renders nothing for an unsupported type.

**Tests (CCT)**
- renders each supported type (`it.each`), and nothing for an unsupported type
- shows the validation message for each rule (`it.each`)

#### Task 17a — Save endpoint: validation and booking ⚠️ data integrity
- `POST /permits` → `201` with the permit.
- **Validation** (`VALIDATION_ERROR` if any fail):
  - `idempotency_key` is a UUID
  - `date` is a valid date between today and today + 30
  - the trail and channel exist
  - `fields` match the channel's definitions: required, type, min, max_length, pattern, options, email format
  - `party_size` is a whole number from 1 to the channel's `max_party`
  - fields the channel doesn't define are dropped
- `email` (trimmed, lowercased) and `party_size` go in their own columns. Other fields go in `details`.
- **Booking**, in one transaction on one pooled client:
  1. `SELECT status, daily_quota FROM trails WHERE code = $1 FOR UPDATE`. This locks the trail, so bookings for one trail run one at a time.
  2. Closed → `TRAIL_CLOSED`
  3. Booked hikers for the date + `party_size` > `daily_quota` → `TRAIL_FULL`
  4. INSERT the permit. A unique violation on `(trail, date, email)` → `DUPLICATE_BOOKING`.
  5. COMMIT

**Tests (Jest, test database)**

*Concurrency* (required by the brief, and the "busy Saturday" incident). Through the **real HTTP API** (the actual Express app via supertest) and the real test database.
- many concurrent requests for the same trail and date, more than the quota allows, with mixed party sizes and a different email each (`Promise.all`, repeated 50 times):
  - the total party size of active permits never exceeds the quota (checked with a database query afterwards)
  - every request returns either `201` or `TRAIL_FULL`, never a 500
- concurrent requests for **different** trails all succeed (the lock is per trail, not global)

*Booking rules*
- closed trail → `TRAIL_CLOSED`, even with free slots
- `party_size` over the remaining quota → `TRAIL_FULL`
- cancelled permits don't count toward the quota

*Duplicates*
- same email, trail and date → `DUPLICATE_BOOKING`, including with different casing or spaces
- booking again after the first permit was cancelled → accepted
- two desk permits without email on the same trail and date → both accepted, and both count toward the quota (accepted gap)

*Validation, sent straight to the API* (the brief: requests that skip the frontend) → `VALIDATION_ERROR` (`it.each`)
- date in the past or after today + 30
- unknown trail or channel
- `party_size` of 0 or over `max_party`
- missing required field, pattern mismatch (`ranger_initials`), invalid select option

#### Task 17b — Save endpoint: idempotency
Builds on 17a.
- Order of each attempt:
  1. Check `idempotency_key` is a UUID.
  2. If a permit with this key exists, return it (`201`). This runs **before** the other checks, so a replay still succeeds after midnight or after the trail closes.
  3. Validate the rest of the request.
  4. Book (the transaction from 17a).
- A unique violation on `idempotency_key` during INSERT (the same request running twice at once) → return the existing permit (`201`).
- The same key with different data → return the original permit and ignore the new data.
- Log when a request is an idempotent replay.

**Tests (Jest, test database)**
- same key twice → one permit, and the second call returns the original (even if its data is different)
- same key sent at the same time → one permit
- same trail, date and email with a different key → `DUPLICATE_BOOKING`
- a replay succeeds even if the trail was closed after the first save

#### Task 17c — Save endpoint: retries
Builds on 17b.
- The retry loop wraps steps 2–4 from 17b (key lookup, validation, booking): 1 attempt + 3 retries, with backoff of 100 ms, 200 ms, 400 ms.
- Retry only temporary database errors: lost connection, deadlock (`40P01`), serialization failure (`40001`).
- Never retry business errors or constraint violations.
- Each attempt uses a fresh pooled client. Release a broken client with `client.release(err)`.
- Log each retry. After all attempts fail → `SERVER_ERROR`.

**Tests (Jest, test database)**
- temporary error, then success → one permit
- commit succeeded but the connection dropped → the retry finds the key, returns success, one permit
- business errors are not retried (e.g. `TRAIL_FULL` is returned after one attempt)
- gives up after 1 + 3 attempts → `SERVER_ERROR`

#### Task 18 — Step 4: permit form
- One `dynamic-input` per field of the selected channel.
- Send the form's `idempotency_key` (created in Task 10) with every save.
- `party_size`'s max is the available slots from step 3.
- The Save button is disabled and shows a loader while saving.
- On success: toast "Permit requested successfully" and go to the landing page.
- On error: toast with the message for the code (one toast at a time).

**Tests (CCT)** (the brief requires one covering more than one channel)
- renders the right fields for **each of the 3 channels** from the real `channels.json` (`it.each`): e.g. desk shows ranger initials and the cash checkbox, operator shows the operator select and notes
- renders a made-up **fourth channel** from config alone (with its required `party_size` field), with no code changes
- clicking Save again sends the same idempotency key
- each error code shows its plain-language message, and an unknown code shows the generic one (`it.each`)

### Find a permit

#### Task 19 — Search index
- `CREATE INDEX ON permits (email, date, id);`
- Matches the search query (filter by email, sort by date and id), so Postgres reads rows already in order.

#### Task 20 — Endpoint: search by email
- `GET /permits/search?email=...&page=1`
- Trim and lowercase the email before searching.
- Returns all permits for the email (past and future, any status), with the permit `id` and the trail's name and status.
- `status` is computed in the query, so the frontend doesn't need its own date logic:
  ```sql
  CASE WHEN p.status = 'active' AND p.date < $today THEN 'expired' ELSE p.status END AS status
  ```
- Sorted by `date DESC, id DESC`. The `id` tiebreaker stops pages from repeating or skipping rows.
- Server-side pagination: 10 per page, `page` defaults to 1. `LIMIT 10 OFFSET (page - 1) * 10`.

**Tests (Jest)**
- status is computed correctly (`it.each`): active + yesterday → `expired`, active + today → `active`, cancelled + past → `cancelled`
- page 2 continues with no overlap and no gaps (use several permits on the same date), and `total` is right
- matches the email regardless of casing or spaces, but only exactly: `ben@x.co` doesn't match `ben@x.com`
- invalid page (`0`, `-1`, `abc`) → `VALIDATION_ERROR`

**One-off check** (against the 50k seeded database, results recorded in DECISIONS.md)
- `EXPLAIN ANALYZE` the search query: it uses the index, with no Sort step.

#### Task 21 — Search view
- Register the `/find-permit` route.
- A search field at the top middle, with the placeholder "Find a permit by email".
- States:
  - initial: short text explaining what to do
  - loading: a loader
  - results: a table with trail, date, party size, permit status (Active, Expired or Cancelled), trail status. Trail status uses the same CLOSED pill as step 2.
  - empty: the generic empty state
- Bootstrap pagination below the table, 10 rows per page.

**Tests (CCT)**
- loading, error and empty states
- shows Active, Expired and Cancelled statuses, and the CLOSED pill for a closed trail
- clicking Next loads the next page. Pagination is hidden when `total ≤ 10`.
- a new search goes back to page 1

### Cancel a permit

#### Task 22 — Endpoint: cancel
- `POST /permits/:id/cancel` with body `{ email }` → `204 No Content`. Follows the [cancelling rules](#2-business-rules).
- No response body: the status code says it worked, and nothing about the permit (contact details, notes) is sent back.
- The email must match the permit's email (trimmed, lowercased). Permit ids are sequential, so without this anyone could cancel every permit by trying ids one after another.
- One statement, no lock needed:
  ```sql
  UPDATE permits SET status = 'cancelled'
  WHERE id = $1 AND email = $2 AND status = 'active' AND date >= $3
  RETURNING *;
  ```
- If no row comes back, look up the permit (by id and email) to return the right result:
  - doesn't exist, or the email doesn't match → `PERMIT_NOT_FOUND` (a wrong email doesn't reveal that the permit exists)
  - already cancelled → `204`
  - expired (active, but dated before today) → `PERMIT_EXPIRED`
- An `id` that isn't a whole number, or a missing email → `VALIDATION_ERROR`.

**Tests (Jest)**
- cancels active permits dated today or later
- expired permit → `PERMIT_EXPIRED`, and it stays `active` in the database
- already cancelled → `204`, still cancelled
- unknown id → `PERMIT_NOT_FOUND`
- someone else's email → `PERMIT_NOT_FOUND`, and the permit stays active
- after cancelling, the freed slots can be booked again, including by the same email

#### Task 23 — Actions menu with "Cancel permit"
- A last column, **Actions**, with a kebab menu (Bootstrap dropdown) on each row.
- Actions are configured in one array, so adding an action means adding one entry:
  `[{ label: "Cancel permit", isAvailable: (permit) => ..., run: (permit) => ... }]`
- "Cancel permit" is only available when the permit status is Active (the search endpoint already returns `expired` for past permits).
- If a row has no available actions, the kebab button is hidden.
- "Cancel permit" opens a confirmation modal: "Cancel this permit? This can't be undone."
  - The cancel request sends the email that was searched for.
  - The confirm button is disabled and shows a loader while cancelling.
  - On success: toast "Permit cancelled", close the modal, reload the current page.
  - On error: toast with the message for the code.

**Tests (CCT)**
- the kebab menu only appears for Active permits
- closing the modal without confirming doesn't call the endpoint
- confirming cancels (sending the searched email), shows the success toast, and the row shows as cancelled
