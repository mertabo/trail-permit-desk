# Trail Permit Desk — Summary

> A short, human-readable summary of the [v1 spec](specs/trail-permit-desk-spec.v1.md), written for people reading the project. The full specs in [`specs/`](specs/) are the detailed versions used to guide the AI during implementation. Changes made during implementation are in [v2](specs/trail-permit-desk-spec.v2.md) and the [changelog](specs/CHANGELOG.md).

A small web app for **Ridgeline Park** that replaces a shared spreadsheet for day-hike permits. Twice last month a trail was over-issued because two people saved at the same moment. This app makes that impossible.

**Stack:** Vue + TypeScript + Bootstrap (frontend) · Node.js + TypeScript REST API (backend) · PostgreSQL in Docker · Jest + Cypress component tests

## What users can do

1. **Request a permit** in 4 steps: pick a date (today + 30 days) → pick a trail (shows hikers still available, FULL and CLOSED trails disabled) → pick a channel (online, ranger desk, tour operator) → fill in a form built from that channel's config.
2. **Find permits** by email (exact, case-insensitive), 10 per page, newest first. Each row shows the trail, date, party size, permit status (Active, Expired or Cancelled) and whether the trail is closed.
3. **Cancel** an active permit from a menu on each row, after a confirmation step. Its spots are released right away, and the same person can book that trail and date again. A cancelled permit can't be made active again.

## The rules that matter most

| Rule | How it's guaranteed |
|---|---|
| A trail is never over its daily quota | Each booking locks the trail row, so bookings for one trail run one at a time |
| One active permit per email, trail and date | A unique index in the database |
| A retried or double-clicked save never creates two permits | An idempotency key, created once per form |
| Bad requests never get in, even ones that skip the frontend | The server validates every request against the channel's config |
| Email search stays fast | An index on `(email, date, id)`, measured on 50,000+ past permits |

Temporary database errors are retried in the backend (1 attempt + 3 retries, with backoff).

## Key decisions

- **All dates use Philippine time.** Dates are plain `YYYY-MM-DD` strings, never converted.
- **Full and expired are computed, not stored.** A permit whose date has passed shows as Expired and can't be cancelled.
- **Closing a trail doesn't cancel its permits.**
- **The backend only sends error codes.** The frontend turns each one into a plain-language message.

## Data import

The JSON files are used exactly as given. The import cleans them in code:
- codes are uppercased, and the later `updated_at` wins for duplicates
- names are trimmed, `"25"` becomes `25`, `"Open"` becomes `open`
- a trail with no quota (CAV-04) is **rejected and logged**: every trail must have a cap

Every oddity in the data, and the decision made about it, is recorded in DECISIONS.md.

## Known gaps (accepted)

- **No login.** Anyone with an email can see and cancel that person's permits, and anyone can choose the ranger or operator channel.
- **Desk permits without an email** have no duplicate check and can't be found by search. The quota still applies.
- **A lost response:** if a save succeeds but the response never reaches the browser, the user sees an error. Clicking Save again is safe: it returns the same permit.

## Out of scope

Login and accounts · editing permits · screens for managing trails or channels · translations

## Build order

| Phase | What gets built |
|---|---|
| Setup | Repo, Docker, scripts, an end-to-end smoke test |
| Data | Cleaning function, schema, seed (7 trails, 3 channels, 50k+ permits) |
| Request a permit | Landing page, the 4-step form, the availability, channels and save endpoints (save = validation → idempotency → retries) |
| Find a permit | Search index, search endpoint, search page with pagination |
| Cancel a permit | Cancel endpoint, actions menu with a confirmation step |

## Testing

About 60 tests, focused on what protects the data or is likely to break. Endpoint tests run against a **real test database**, because the lock and constraints are what's being tested. Two tests are required by the brief:
- concurrent requests through the real API never over-issue
- the permit form works for more than one channel, plus a made-up fourth channel to show it's config-driven

## References

The [`specs/`](specs/) folder holds the full specs, written to guide the AI during implementation. They're detailed on purpose: every rule, query, edge case and test. This file is the short version for people.

| File | What it is |
|---|---|
| [`specs/trail-permit-desk-spec-draft.md`](specs/trail-permit-desk-spec-draft.md) | The first rough draft |
| [`specs/trail-permit-desk-spec.v1.md`](specs/trail-permit-desk-spec.v1.md) | The refined spec the app was built from. This summary is based on it. |
| [`specs/trail-permit-desk-spec.v2.md`](specs/trail-permit-desk-spec.v2.md) | The current spec, including changes made during implementation |
| [`specs/CHANGELOG.md`](specs/CHANGELOG.md) | What changed from v1 to v2, and why, with links to the commits |
