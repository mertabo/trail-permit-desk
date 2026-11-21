# Decisions

## Design decisions

- **Trails without a quota are rejected** when seeding. Every trail must have a cap.
- **Desk permits without email** have no duplicate check and don't appear in search. A ranger is there in person. The quota still applies, so the worst case is one person holding extra slots, never overbooking.
- **Closing a trail doesn't cancel its permits.** They stay active, and search shows the trail's status.
- **The trail row lock** (`SELECT ... FOR UPDATE`) makes bookings for one trail run one at a time. Simple and correct at this volume.
- **Retries are in the backend** (1 + 3, temporary database errors only). The idempotency key tells a retry apart from a new duplicate request.
- **Known gap:** if the response to the browser is lost, the user sees an error even though the permit was saved. Clicking Save again is safe: the same key returns the original permit.
- **A reused idempotency key with different data** returns the original permit. A stricter option for later: reject with `IDEMPOTENCY_KEY_REUSED`.
- **An idempotent replay returns `201`**, the same as a new permit. Simpler, and the frontend treats both as success.
- **All dates use Philippine time**, so everyone sees the same bookable dates wherever they are.
- **Search** shows all permits, newest date first, with server-side pagination of 10 and `id` as a tiebreaker.
- **Cancel is a single UPDATE with no lock.** A cancel during a booking can only lower the booked count, so the worst case is a booking rejected as `TRAIL_FULL` that would have fit. It can never overbook.
- **Expired is computed, not stored.** An active permit whose date has passed is shown as expired, and only Active permits can be cancelled, as the brief says. Computing it from the date means it's never out of date. A scheduled job that updated the status would need an extra process, and the data would be wrong between runs. Cancelling an already cancelled permit returns success.
- **Known gap:** there are no accounts, so anyone who knows an email can see and cancel that person's permits. Accepted for this project.
- **Cancelling requires the permit's email.** Permit ids are sequential (1, 2, 3, …), so without this check anyone calling the API directly could cancel every permit in the park by trying ids one after another, without knowing a single email. With it, the risk is the known gap above: you need to know the email. A wrong email returns `PERMIT_NOT_FOUND`, so it doesn't reveal that the permit exists. Desk permits without an email can't be cancelled in the app, which matches search, where they can't be found either. A real deployment would replace this with a proper check of identity: a magic link emailed to the hiker, or a random confirmation code shown after booking, plus rate limiting.
- **Known gap:** there are no accounts, so anyone can choose the "Ranger desk" or "Tour operator" channel, not just rangers and operators. The data rules (quota, `max_party`, fields) still apply to every channel, so this can't cause over-issuing. Restricting channels needs login, which is out of scope.

## Data oddities

The brief asks us to notice each oddity in the data, decide, and write it down. Two rules were given: codes are case-insensitive (stored and shown in uppercase), and the later `updated_at` wins. Everything else below is our decision.

**trails.json**

| # | Oddity | Decision | Why |
|---|---|---|---|
| 1 | Trails are wrapped in `{ exported_at, note, trails }`, not a plain array | Read `.trails`. Ignore the other keys. | The file is used as given, never hand-edited. |
| 2 | `rdg-01` and `RDG-01` are the same trail (given rule) | Uppercase codes, then the later `updated_at` wins | Given rule. |
| 3 | The winning `rdg-01` record has a different name ("Ridgeline Loop (new signage)") and quota (45) | Use the winning record whole. Keep the name as written. | Merging fields from two records would invent a record nobody wrote. |
| 4 | `"Falls Track "` has a trailing space | Trim all names | Whitespace is never meaningful in a name. |
| 5 | FAL-02 `daily_quota` is the string `"25"` | Convert to a number. Reject anything that isn't a whole number ≥ 0. | Clearly meant as 25. Anything unclear is rejected, not guessed. |
| 6 | CAV-04 `daily_quota` is `null` | Reject the trail and log it | Every trail must have a cap. Treating null as unlimited (or 0) would be a guess. |
| 7 | LKE-06 is `open` with `daily_quota` 0 | Keep it. It always shows as FULL. | It's a valid number. Could be a temporary freeze. Not ours to reinterpret. |
| 8 | OLD-07 `name` is `""` | Store `null`. The UI shows the code instead. | An empty name carries no information. |
| 9 | OLD-07 `status` is `"Open"` | Trim and lowercase statuses. Only `open` and `closed` are valid. | Casing is a typo, not a third status. |
| 10 | OLD-07 has the oldest `updated_at` and an empty name, and its code starts with "OLD" | Keep it as an open trail | It might be retired, but the data says `Open` and nothing else contradicts it. Guessing "retired" would drop a real trail. |
| 11 | `updated_at` is a date with no time, so two records for one code could tie | On a tie, keep the last record in the file and log it | Needs a fixed rule. File order is the only other signal. Doesn't happen in the current file. |
| 12 | `exported_at` is `+08:00` | Use Philippine time (`Asia/Manila`) for all dates | The export's timezone is the best evidence of where the park is. |
| 13 | BRD-08 has quota 3, smaller than every channel's `max_party` | Keep it. Available slots are `min(max_party, remaining quota)`. | Valid data. The quota check already handles it. |
| 14 | The latest record for a code could be invalid while an older one is valid | Reject the trail. No fallback to the older record. | The older record is out of date. Silently reviving it would be wrong. |

**channels.json**

| # | Oddity | Decision | Why |
|---|---|---|---|
| 15 | `email` is optional on the desk channel | `permits.email` is nullable. No duplicate check or search for desk permits without email. | See "Desk permits without email" under Design decisions. |
| 16 | `party_size` is a channel field, but also a core permit value | Taken out of the fields and stored in its own column, as is `email` | The quota and search queries need them as real columns. |
| 17 | `party_size` has `min: 1` but no max | The max is `min(max_party, remaining quota)`, checked on the server | `max_party` is "the largest party that channel may request in one permit". |
| 18 | `tel` has no pattern | Only checked as required, no format check | No format was given. Inventing one could reject real numbers. |
| 19 | `lead_name` is labelled "Guide name" on the operator channel | Use each channel's own label | Labels come from the data. The key is what matters for storage. |

## Search performance

The email lookup must stay fast with millions of permits. Search uses the index `permits (email, date, id)`, which matches both the filter (`email = ...`) and the sort (`ORDER BY date DESC, id DESC`), so Postgres reads one person's newest 10 permits straight from the index, already in order.

`EXPLAIN ANALYZE` of the search query, on the seeded database (51,000 permits, 19 for the email searched):

| | Plan | Execution time |
|---|---|---|
| With the index | `Index Scan Backward using permits_email_date_id`, no Sort step | 0.032 ms |
| Without the index | `Seq Scan on permits` (all 51,000 rows), then `Sort` | 3.43 ms |

Without the index, every search reads the whole table, so it gets slower with every permit added. With it, the cost depends on how many permits one email has, not on the size of the table. The `total` count uses the same index.
