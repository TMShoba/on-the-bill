# Connect The LineUp to Supabase Postgres

## 1. Get the connection string

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. **Project Settings** → **Database**
4. Under **Connection string**, choose **URI**
5. Copy it and replace `[YOUR-PASSWORD]` with the database password

Example shapes:

```text
# Direct (session) — good for Node API on your laptop / Railway
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Or classic host
postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

## 2. Backend `.env`

```env
DATABASE_URL=postgresql://postgres....supabase.co:5432/postgres
JWT_SECRET=some-long-random-secret-at-least-32-chars
ALLOW_DEMO_TOKENS=true
CORS_ORIGINS=http://localhost:5173
```

SSL is enabled automatically when the URL contains `supabase.co`.

## 3. Install & run

```bash
cd backend
# remove old SQLite native module if present
rm -rf node_modules package-lock.json
npm install
npm run dev
```

On first boot the API:

- Creates tables (`artists`, `users`, `bookings`, `conversations`, `messages`)
- Seeds 25 artists + demo users + sample bookings

Check: http://localhost:4000/api/health  
Should show `"database": "postgres"` and `"artists": 25`.

## 4. Demo logins

| Role | Email | Password |
|------|--------|----------|
| Artist | artist@thelineup.co.za | Demo1234! |
| Promoter | promoter@thelineup.co.za | Demo1234! |

## 5. Frontend

Unchanged:

```env
VITE_API_URL=http://localhost:4000
```

## 6. Supabase tips

- **Table Editor** in Supabase UI lets you inspect rows
- Do not enable public anon access to these tables for the browser — the **Node API** is the only client
- For production set `ALLOW_DEMO_TOKENS=false` and a strong `JWT_SECRET`
- If connections hit limits, use the **pooler** URI (port 6543) and keep `DB_POOL_MAX` low (e.g. 5)

## 7. Troubleshooting

| Error | Fix |
|-------|-----|
| `DATABASE_URL is required` | Add URI to `backend/.env` |
| `password authentication failed` | Reset DB password in Supabase and update URI |
| `SSL required` | Ensure URL is Supabase host (auto SSL) or set `DATABASE_SSL=true` |
| `Tenant or user not found` | Wrong project ref in URI |
