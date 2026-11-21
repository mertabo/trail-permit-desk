# Spec changelog

Changes from [`trail-permit-desk-spec.v1.md`](trail-permit-desk-spec.v1.md) (first pushed in [`99dc62b`](https://github.com/mertabo/trail-permit-desk/commit/99dc62b)) to [`trail-permit-desk-spec.v2.md`](trail-permit-desk-spec.v2.md), newest first. Each change was made during implementation, in the commit linked.

The original rough draft the spec grew from is in [`trail-permit-desk-spec-draft.md`](trail-permit-desk-spec-draft.md).

---

## Row actions use a meatballs menu

Commit [`1feea06`](https://github.com/mertabo/trail-permit-desk/commit/1feea06) · Task 23

The row actions menu in the search table uses horizontal dots (⋯) instead of vertical dots (⋮).

- **Task 23:** "kebab menu" → "meatballs menu (⋯)". "The kebab button is hidden" → "the menu button is hidden".
- **Task 23 tests:** "the kebab menu only appears for Active permits" → "the meatballs menu only appears for Active permits".

## Cancel returns `204 No Content`

Commit [`f9df684`](https://github.com/mertabo/trail-permit-desk/commit/f9df684) · Task 22

**Why:** returning the permit would hand its contact details and notes (the `details` field) to anyone who knows the email. The status code already says the cancel worked, and the frontend reloads the search results afterwards anyway.

- **API table:** `POST /permits/:id/cancel` now responds with `204`, no body (was: `200` with the permit).
- **Task 22:**
  - `→ 200 with the permit` → `→ 204 No Content`
  - added: "No response body: the status code says it worked, and nothing about the permit (contact details, notes) is sent back."
  - "already cancelled → `200` with the permit" → "already cancelled → `204`"
- **Task 22 tests:** "already cancelled → `200`, still cancelled" → "already cancelled → `204`, still cancelled".

## Cancelling requires the permit's email

Commit [`6446f40`](https://github.com/mertabo/trail-permit-desk/commit/6446f40) · Tasks 22 and 23

**Why:** permit ids are sequential (1, 2, 3, …). Without a check, anyone calling the API directly could cancel every permit in the park by trying ids one after another, without knowing a single email. With the check, the risk matches the accepted gap: you need to know the email.

- **Business rules → Cancelling:** added "The cancel request must include the permit's email. A wrong email is treated like a missing permit: `PERMIT_NOT_FOUND`."
- **API table:** `POST /permits/:id/cancel` now takes the request body `{ email }`.
- **Task 22:**
  - the endpoint takes the body `{ email }`
  - added: "The email must match the permit's email (trimmed, lowercased). Permit ids are sequential, so without this anyone could cancel every permit by trying ids one after another."
  - the SQL gains `AND email = $2`: `WHERE id = $1 AND email = $2 AND status = 'active' AND date >= $3`
  - the follow-up lookup uses the id **and** the email
  - "doesn't exist → `PERMIT_NOT_FOUND`" → "doesn't exist, or the email doesn't match → `PERMIT_NOT_FOUND` (a wrong email doesn't reveal that the permit exists)"
  - "An `id` that isn't a whole number → `VALIDATION_ERROR`" → "An `id` that isn't a whole number, or a missing email → `VALIDATION_ERROR`"
- **Task 22 tests:** added "someone else's email → `PERMIT_NOT_FOUND`, and the permit stays active".
- **Task 23:** added "The cancel request sends the email that was searched for."
- **Task 23 tests:** "confirming cancels, shows the success toast…" → "confirming cancels (sending the searched email), shows the success toast…".
