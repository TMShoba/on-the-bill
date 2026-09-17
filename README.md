# The LineUp

**Book South African artists with clarity and trust.**

Promoters discover artists, request bookings, pay deposits or full fees via PayFast, and message artists in one place. Artists accept or decline, track gigs, and get paid cleanly.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind, React Query |
| Backend | Express, better-sqlite3, Nodemailer |
| Payments | PayFast (SA) + EFT instructions |
| Hosting (current) | Frontend: Vercel · API: Railway |

## Project layout

```
On the Bill/
  backend/     # API (port 4000)
  frontend/    # Web app (port 5173)
```

## Database

See [SUPABASE.md](./SUPABASE.md) for connecting `DATABASE_URL`.

## Demo users

See [DEMO.md](./DEMO.md) — `artist@thelineup.co.za` / `promoter@thelineup.co.za` password `Demo1234!`

## Local setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Set JWT_SECRET to any long random string
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:4000
npm install
npm run dev
```

Open http://localhost:5173

### Demo accounts (when `ALLOW_DEMO_TOKENS=true`)

- Artist: `artist@thelineup.co.za` (demo login button)
- Promoter: `promoter@thelineup.co.za` (demo login button)

Or register a real account — passwords are hashed and tokens are signed JWTs.

## What was hardened in this build (v1.4)

- **Signed JWT auth** (replaces forgeable `demo-token-*` in production)
- **Email path fixed** (`/notifications/email` — no double `/api`)
- **Booking ownership** enforced; clients cannot self-mark as paid
- **PayFast ITN webhook** (`POST /api/payments/payfast/itn`) marks bookings paid server-side
- **CORS** driven by `CORS_ORIGINS`
- **Rate limiting** on auth and API
- **Safe seed** — does not wipe the artist catalog on every restart
- **Secrets removed** from committed `.env` examples

## Production checklist

See [LAUNCH.md](./LAUNCH.md).

## License

Private — all rights reserved.
