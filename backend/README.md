# The LineUp — API

Express + SQLite backend for The LineUp (artist booking platform).

## Quick start

```bash
cd backend
cp .env.example .env   # edit JWT_SECRET, SMTP, PayFast as needed
npm install
npm run dev
```

API: **http://localhost:4000**  
Health: `GET /api/health`

Artist catalog seeds automatically when the database is empty.

## Environment

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs auth tokens (required strong value in production) |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `ALLOW_DEMO_TOKENS` | `true` only for local demos |
| `SMTP_*` | Transactional email (optional) |
| `PAYFAST_*` | Live payment ITN verification |
| `INTERNAL_API_KEY` | Trusted server-to-server payment updates |

## Auth

- Register / login return a **signed JWT** (not demo tokens).
- Send `Authorization: Bearer <token>` on protected routes.
- `GET /api/auth/me` returns the current user.

## Payments

- Frontend starts PayFast checkout.
- PayFast calls `POST /api/payments/payfast/itn` when payment completes.
- Bookings are marked paid/deposit **only** after ITN (or trusted internal key).

## Security notes

- Passwords are bcrypt-hashed.
- Rate limits on auth and general API.
- Clients cannot manually set `status=paid`.
- Set `ALLOW_DEMO_TOKENS=false` and a strong `JWT_SECRET` before public launch.
