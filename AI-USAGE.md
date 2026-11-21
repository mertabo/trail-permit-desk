# AI usage

## Tools and what I used them for

**Gemini**, for:

- **Researching the tech** while I was understanding the requirements.

**Claude Code** (Claude Opus), for:

- **Refining the spec.** I wrote a rough draft myself ([`specs/trail-permit-desk-spec-draft.md`](specs/trail-permit-desk-spec-draft.md)), then went through it with the AI to find gaps, edge cases and data oddities. I made every decision; the AI explained the options.
- **Implementing it.** The AI built the app task by task from the spec. After each phase I tested it myself and reviewed it before it was committed.
- **Drafting the docs.** I edited them and checked every claim.

## One place the output was wrong or risky

**The cancel endpoint let anyone cancel every permit.**

- **What was wrong:** the first version cancelled a permit by its id alone. Ids are sequential (1, 2, 3, …), so anyone calling the API directly could cancel every permit in the park with a simple loop, without knowing a single email.
- **How I caught it:** Claude Code's `security-guidance` plugin (from Anthropic's official plugin marketplace) reviews each commit automatically. It flagged the email search, and while looking into it the AI pointed out the bigger problem with cancel. I asked how it could actually be abused (someone opens DevTools, sees the cancel request, and loops over the ids), then decided to fix it.
- **What I did:** cancelling now requires the permit's email, and a wrong email looks the same as a missing permit. The same plugin then flagged that cancel returned the whole permit, including contact details, so it now returns `204` with no body.

## Other catches

- **The README overstated things.** It said over-issuing was "impossible", that the server "checks everything", and made claims about scaling that were never measured. I asked whether every bullet was actually in the codebase. It wasn't, so those lines were reworded or removed.
- **It made up a reason.** The docs said Philippine time came from the data's `+08:00` timestamp. I had chosen it myself, so that line was removed.
- **Where I disagreed with it: retries.** The AI recommended retrying saves in the browser, and later suggested dropping backend retries completely. I kept retries in the backend. While discussing it, I noticed that a retry can't tell its own earlier save apart from a real duplicate, which led to the idempotency key. Both approaches are valid; this was my call.
