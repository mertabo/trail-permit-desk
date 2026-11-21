# Decisions

## Data oddities

Given rules: trail codes are case-insensitive (stored in uppercase), and the later `updated_at` wins.

**trails.json**

- `rdg-01` and `RDG-01` are the same trail → uppercased; the later record wins **whole** ("Ridgeline Loop (new signage)", quota 45), never merged with the older one.
- `"Falls Track "` has a trailing space → names are trimmed.
- FAL-02's quota is the string `"25"` → converted to `25`. Anything that isn't a whole number ≥ 0 is rejected.
- CAV-04's quota is `null` → **rejected and logged**. Every trail must have a cap, and guessing "unlimited" or 0 would be wrong.
- LKE-06 is open with a quota of 0 → kept. It always shows as FULL.
- OLD-07's name is `""` → stored as `null`. The UI shows the code instead.
- OLD-07's status is `"Open"` → statuses are lowercased. Only `open` and `closed` are allowed.
- `updated_at` has no time, so two records could tie → the last one in the file wins, and it's logged.

## What I cut, and why

- **Login and roles** → out of scope. So anyone who knows an email can see and cancel its permits, and anyone can pick the ranger or operator channel. Cancelling requires the permit's email, so permits can't be cancelled just by guessing ids.
- **A duplicate check for desk permits without an email** (email is optional on that channel) → there's nothing reliable to match on, and matching names would block different people who share a name. The same person could get two desk permits for one trail and date, but the quota still applies. These permits also can't be found by search or cancelled in the app.
- **Editing permits, admin screens, translations** → out of scope.
- **Retries in the browser** → the browser sends each save once. If the connection drops or times out, the user sees "Something went wrong" and can press Save again, which can't create a second permit. Only the backend retries, and only for database errors.
- **A same-day cutoff time** (e.g. no bookings for today after a certain hour) → today can be booked at any time, even late in the evening. A cutoff is a business rule the brief doesn't mention, so I left it out rather than guess. Related: if the date passes while the form is open (after midnight), the user only gets the general "check the form" message.
- **Low-value tests** → kept the tests that protect the data or the brief's rules.

## With one more day

- One shared copy of the form validation (it's written twice now: frontend and backend).
- Measure the email search with millions of permits (measured with 51,000 so far).
- Test cancels and bookings running at the same time. A cancel shouldn't be able to cause over-issuing, but no test checks that yet.
- Browser end-to-end tests of the full request → find → cancel flow.
- Run the tests many times to check for flaky ones (skipped for time).
- An in-depth code review. I reviewed the code for correctness and the critical parts (booking, the lock, idempotency, validation), but not yet for naming, structure and style.
- UX: a better-looking UI, no layout shifts in the form, a navbar to move between pages, and sorting in the search table.
- Retry a save in the browser after a network error or timeout. Safe to add, because the idempotency key stops a second permit.

## Where the hours went

| Part | Hours |
|---|---|
| Understanding the requirements and researching the tech | 1.5 |
| Writing and refining the spec | 4 |
| Implementation with AI (with manual checks between phases) | 1 |
| Review | 0.5 |
| Writing the docs | 1 |
| **Total** | **8** |
