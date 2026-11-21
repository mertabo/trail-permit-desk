# Trail Permit Desk

Day-hike permits for Ridgeline Park: request a permit for a trail and date, find permits by email, and cancel them. It replaces a shared spreadsheet that over-issued trails when two people saved at the same moment.

## Run it

Needs **Docker** and **Node 20.19+**.

```sh
docker compose up -d --wait   # PostgreSQL (dev + test databases), waits until ready
npm run setup                 # install everything, create the tables, seed 51,000 permits
npm start                     # backend (port 3000) + frontend → open http://localhost:5173
```

- **Tests:** `npm test` (backend, frontend unit and component tests; the database must be running)
- **Reset the data:** `npm --prefix backend run seed`

## How over-issuing is prevented

- **One lock per booking.** Each booking runs in a single transaction that locks the trail's row (`SELECT … FOR UPDATE`). Bookings for the same trail run one at a time, so the quota check and the insert can't interleave.
- **The server validates each request.** Closed trail, remaining quota, party size against `max_party`, and the channel's fields are checked on the server. Requests that skip the frontend get the same rules.
- **The database backs it up.** `CHECK` constraints, foreign keys, and a unique index on active `(trail, date, email)`.
- **Retries can't double-book.** Each form has one idempotency key, so a retried or double-clicked save returns the original permit.
- **Proof:** a test fires 20 concurrent requests for the same trail and date through the real HTTP API and database, repeated 50 times. Active hikers never exceed the quota. When I temporarily removed the lock, the same test failed: it booked **25 hikers on a quota of 10**. See `backend/test/routes/savePermit.test.ts`.

## What makes the lookup fast

- **One index that matches the query:** `permits (email, date, id)` covers both the filter (`email = …`) and the sort (`date DESC, id DESC`), so Postgres reads the newest 10 permits straight from the index, already in order.
- **Evidence:** `EXPLAIN ANALYZE` on the seeded database (51,000 permits), trimmed to the key lines:

  ```
  Limit (actual time=0.015..0.024 rows=10 loops=1)
    ->  Nested Loop (actual time=0.015..0.023 rows=10 loops=1)
          ->  Index Scan Backward using permits_email_date_id on permits p (actual time=0.010..0.013 rows=10 loops=1)
                Index Cond: (email = 'hiker42@example.com'::text)
          ->  Seq Scan on trails t (actual time=0.001..0.002 rows=7 loops=1)
  Execution Time: 0.032 ms
  ```

- **Without the index:** a full scan of all 51,000 rows plus a sort, **3.43 ms** in the same run.
