# tools/

Local operator tools. **Not deployed, not part of any build.** `supabase functions
deploy api` only ships `supabase/functions/api/`, and CI's gates
(`eslint src/**/*.ts`, `deno check api/…`, `jest src/`) don't look here.

## feedback-admin.html

Change the status of bugs and feature requests on the feedback board.

```sh
# just open it
start tools/feedback-admin.html          # Windows
open  tools/feedback-admin.html          # macOS

# or, if your browser blocks fetch from file://
cd tools && python -m http.server 5173   # → http://localhost:5173/feedback-admin.html
```

Sign in with your own Aqademiq account. Then: filter the board, pick a post, set
its status/category, flip pinned/locked/approved, leave a note, add an internal
note, and read the status history.

### Why a local page and not a screen in the app

The app is shipped to every user, so any check inside it is cosmetic — an
attacker calls the API directly rather than tapping your hidden button. Keeping
the surface out of the app removes the question entirely without weakening
anything, because the app was never the thing enforcing it.

### Why not just edit the row in Supabase Studio

`GET /feedback/posts/:ref` returns **`status_history`**, which users can see.
Changing `status_key` by hand flips the badge and leaves that timeline empty —
a post that says "Shipped" with no record of when or by whom. It also skips the
changelog draft that `shipped` auto-creates. This page drives
`PATCH /admin/feedback/posts/:ref`, so the audit row and the draft happen.

### Security

Nothing here grants access. Authorisation is entirely server-side:

- The API verifies your Supabase JWT and requires the subject to be listed in
  the **`FEEDBACK_ADMIN_IDS`** function secret (`requireAdmin()` →  403).
  A copy of this file in someone else's hands is inert.
- **No service-role key**, ever. The page uses the same publishable key the
  mobile app ships with, and talks only to the edge function — never to
  Postgres. RLS on the feedback tables is deny-all, so there is no other door.
- The access token lives in a **JS variable only** — never localStorage or
  sessionStorage. Closing the tab signs you out. The password is never stored
  and is cleared from the field on submit.
- All server data is rendered with `textContent`, never `innerHTML`. The board
  is user-submitted, and this is the one page that holds an admin token.
- CORS needed no change: the API already sends `Access-Control-Allow-Origin: *`,
  which is safe here because auth is an `Authorization` header rather than a
  cookie — a browser will not attach your token to a cross-site request, so
  there is no CSRF surface to widen.

### Setup (once)

Your user id must be in the `FEEDBACK_ADMIN_IDS` secret, comma-separated:

```sh
supabase secrets set FEEDBACK_ADMIN_IDS="14605591-ffd4-4220-873f-9461beaedc80"
```

Without it every admin call returns 403 — including yours.
