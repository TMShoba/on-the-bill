# Launch checklist — The LineUp

## Must do before public traffic

- [ ] Set a strong `JWT_SECRET` (32+ random chars) on the API host
- [ ] Set `ALLOW_DEMO_TOKENS=false` in production
- [ ] Set `CORS_ORIGINS` to your real frontend domain(s)
- [ ] Configure real SMTP (Resend / Postmark / SendGrid) — not personal Gmail
- [ ] Create PayFast merchant account; set `PAYFAST_*` on the **server**
- [ ] Set frontend `VITE_PAYFAST_LIVE=true` only with live merchant IDs
- [ ] Set `VITE_API_PUBLIC_URL` to the public API URL (for PayFast `notify_url`)
- [ ] Replace manual EFT bank details with your real business account
- [ ] Confirm Terms / Privacy / Cancellation match real policy
- [ ] Rotate any previously leaked SMTP passwords

## Strongly recommended

- [ ] Move SQLite → Postgres when traffic grows
- [ ] Add Sentry (or similar) on frontend + backend
- [ ] Nightly backup of the database
- [ ] Custom domain + HTTPS on both app and API
- [ ] Disable demo login buttons in production UI (or gate behind env)

## Smoke test after deploy

1. Register a new promoter and artist
2. Create a booking request → artist accepts
3. Sandbox PayFast payment → booking shows deposit/paid after ITN
4. Email arrives (or appears in server logs if SMTP empty)
5. Messages work both ways
6. Logout / login still works after refresh

## Support

Keep `GET /api/health` monitored (UptimeRobot / Better Stack).
