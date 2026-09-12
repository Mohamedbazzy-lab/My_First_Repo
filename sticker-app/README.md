# Peelworks — Custom Sticker Printing (pentest target)

A small, functional full-stack web app for ordering custom printed stickers.
Built to be deployed somewhere reachable and then scanned with Aikido (or any
other DAST/pentest tool) — it has real attack surface: authentication, file
upload, an admin role, and per-record authorization checks.

## Stack

- **Backend:** Node.js + Express, JWT auth in an httpOnly cookie, in-memory data store (`data/store.js`)
- **File uploads:** `multer`, stored under `public/uploads/`
- **Frontend:** plain HTML/CSS/JS (`public/`), no build step

## Run it locally

```bash
npm install
npm start
```

The server listens on `http://localhost:3000` by default (override with `PORT`).

A seed admin account is created on boot:

```
email:    admin@stickershop.test
password: ChangeMe123!
```

Change or remove this before deploying anywhere reachable — see "Before you
point Aikido at this" below.

## App structure

```
server.js              Express app, static hosting, route mounting
middleware/auth.js      JWT verification (requireAuth), role check (requireAdmin)
routes/auth.js          POST /api/auth/register, /login, /logout, GET /me
routes/designs.js       POST /api/designs (upload), GET /mine, GET /gallery
routes/orders.js        POST/GET /api/orders, GET /:id, admin list + status update
data/store.js           In-memory users/designs/orders (swap for a real DB later)
public/                 Frontend (index.html, styles.css, app.js) + uploads/
```

## Attack surface this app exposes (useful context for scoping a scan)

- **Auth:** registration, login, JWT-in-cookie sessions, password hashing (bcrypt)
- **Authorization / IDOR:** `GET /api/orders/:id` checks ownership vs. `req.user`;
  `GET /api/orders/admin/all` and the status-update endpoint require `role === 'admin'`
- **File upload:** `POST /api/designs` restricts by MIME type and extension, caps
  size at 5MB, and renames files server-side (UUID) — worth confirming these
  controls actually hold up under a real scan (content-type spoofing, path
  traversal in filenames, SVG with embedded scripts, etc.)
- **Public vs. private data:** the `/gallery` endpoint intentionally exposes any
  design marked `isPublic`; everything else should require auth
- **Input validation:** shape/material/size/finish are checked against allow-lists;
  quantity is bounds-checked server-side, not just in the UI

## Before you point Aikido (or any scanner) at a real deployment

This was built as a demo/target, not a production app. If you're deploying it
somewhere with a public URL for scanning, at minimum:

1. Set a real `JWT_SECRET` env var (the code falls back to a hardcoded dev
   secret otherwise — that's an intentional weak spot right now).
2. Rotate or remove the seeded admin credentials.
3. Put a real database behind it — the in-memory store resets on every restart
   and isn't safe for concurrent/production use.
4. Only scan targets you own or have explicit written authorization to test.
   Aikido's pentest product and most scanners require you to verify domain
   ownership before a scan will run, for exactly this reason.

## Env vars

| Variable      | Default                          | Purpose                          |
|---------------|-----------------------------------|-----------------------------------|
| `PORT`        | `3000`                            | HTTP port                        |
| `JWT_SECRET`  | `dev-secret-change-in-production` | Signing key for session JWTs     |
