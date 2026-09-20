# Supabase Postgres setup

1. In Supabase → Project Settings → Database → Connection string → **URI**
2. Copy the string and replace `[YOUR-PASSWORD]` with your database password
   (reset it in Supabase if you forgot it).
3. Put it in `backend/.env`:

```env
DATABASE_URL=postgresql://postgres.sudczrczyfrztzgfscew:YOUR_REAL_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

4. Install & run:

```powershell
cd backend
npm install
npm run dev
```

On first start the API will:
- create tables (`migrate`)
- seed 45 artists + demo users + sample bookings

Health check: `GET http://localhost:4000/api/health` → `"database":"postgres"`

## IPv4 note
If you see connection timeouts from a work network, in Supabase enable the
**IPv4 add-on** or use the Session pooler host on port **5432**.

## Password special characters
If the password has `@ # %` etc., [percent-encode](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding) them in the URI.
