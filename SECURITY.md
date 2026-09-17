# Security — The LineUp

This build includes protections against common website attacks and data exposure.

## Built-in protections

| Threat | Mitigation |
|--------|------------|
| Password theft (DB leak) | bcrypt (cost 12); hashes never returned in API |
| Brute-force login | Rate limit (10 / 15 min / IP); generic error messages |
| Account enumeration | Same “Invalid email or password” for missing user |
| Stolen session | Signed JWT with expiry; set strong `JWT_SECRET` |
| Demo token abuse | `ALLOW_DEMO_TOKENS=false` in production |
| Open email relay | Email endpoint requires login + rate limit + fixed templates only |
| SQL injection | Parameterized queries only (`?` placeholders) |
| XSS in stored text | Input sanitization; script patterns rejected |
| CSRF | Bearer tokens (not cookies) — CSRF not applicable the same way |
| Clickjacking | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Oversized payloads | JSON body limit 256kb |
| Data over-sharing | Bookings/messages scoped to owner; public user object only |
| CORS abuse | Explicit allow-list via `CORS_ORIGINS` |
| Payment fraud | Clients cannot mark bookings paid; ITN/server only |
| Info leaks | No stack traces in production; audit log redacts emails |

## Production checklist (must do)

```env
NODE_ENV=production
JWT_SECRET=<random 32+ characters>
ALLOW_DEMO_TOKENS=false
CORS_ORIGINS=https://your-real-frontend-domain.com
TRUST_PROXY=true
```

1. Use **HTTPS** on frontend and API (Vercel/Railway do this).
2. Never commit `.env` or real SMTP/PayFast secrets.
3. Rotate any password that was ever in a shared zip.
4. Keep dependencies updated: `npm audit` in backend and frontend.
5. Prefer a real SMTP provider (Resend/Postmark), not personal Gmail.

## What users should do

- Use a unique password (demo password is only for testing).
- Log out on shared computers.
- Don’t share JWT tokens from DevTools.

## Reporting

If you find a vulnerability, fix it in the API first, then redeploy. Do not leave `ALLOW_DEMO_TOKENS=true` on a public URL.
