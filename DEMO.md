# Demo accounts — The LineUp (SQLite)

No Postgres or SSMS required. Everything runs on a local **SQLite** file.

## Accounts

| Role | Name | Email | Password |
|------|------|-------|----------|
| **Artist** | DJ Maphorisa | `artist@thelineup.co.za` | `Demo1234!` |
| **Promoter** | Thabo Events | `promoter@thelineup.co.za` | `Demo1234!` |

The artist account is linked to catalog artist **id `2` (DJ Maphorisa)** so:
- Bookings for Maphorisa show on the artist dashboard
- Promoter requests for Maphorisa appear as pending/confirmed for the artist
- Sample gigs are pre-seeded (pending, confirmed, paid)

## How to try the full flow

1. Start backend: `cd backend && npm install && npm run dev`
2. Start frontend: `cd frontend && npm install && npm run dev`
3. Open http://localhost:5173/login
4. Click **Promoter** (or sign in with the promoter email + password)
5. Go to **Artists** → open **DJ Maphorisa** → request a booking
6. Log out → click **Artist**
7. Open dashboard → accept/decline the request, open messages

## Reset demo data

Delete the SQLite file and restart the API (seed runs on boot):

```bash
rm backend/data/onthebill.db backend/data/onthebill.db-*
cd backend && npm run dev
```

## Why not SSMS / SQL Server?

**SSMS** is only a client for **Microsoft SQL Server**. That needs a full SQL Server install (or Azure), which is heavy on a work laptop.

**SQLite** is a single file next to the API — no server, no admin rights, works offline. This build uses SQLite only.
