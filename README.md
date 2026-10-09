# EquibHub (MERN)

Equb management platform, multi-group from day one.
**MongoDB · Express · React · Node.js** — TypeScript on both sides, Vite + Tailwind on the front end, Mongoose on the back end.

> Tagline: *Manage. Contribute. Grow Together.* Branding lives in `client/src/config/brand.ts`, `client/index.html` and `client/public/{favicon,logo}.svg`.

## Setup
Requires Node 20+ and MongoDB (local, Docker, or a free MongoDB Atlas cluster).

```bash
npm install                              # installs client + server workspaces
docker compose up -d                     # optional: local MongoDB (skip if you use Atlas / installed Mongo)
cp server/.env.example server/.env       # then edit MONGODB_URI and JWT_ACCESS_SECRET
npm run db:seed                          # demo data (no migrations needed with MongoDB)
npm run dev                              # API http://localhost:4000 · Web http://localhost:5173
```
Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
In development, verification and reset emails are **printed in the API terminal**.

## Demo accounts (password for all: `Demo@12345`)
| Role | Email |
|---|---|
| Super Admin | admin@equibhub.test |
| Leader — Office Monthly Equb | leader1@equibhub.test |
| Leader — Neighbours Equb | leader2@equibhub.test |
| Members | member1@equibhub.test … member10@equibhub.test |

Seed: 2 groups, 14 memberships (some people are in both groups, one pending request), 3 months of payments in every status. All fictional.

## Plans: 1-month free trial, then Pro (ETB 500 per group per month)
- Every new Equb gets a free trial (`TRIAL_DAYS`, default 30). **One free trial per person**; extra groups created by the same person start paused until upgraded.
- When trial and Pro have both ended, the group is **paused**: members, payments, receipts and reports return HTTP 402, and the UI shows an upgrade screen. Data is never deleted. Super Admins are exempt.
- Leaders upgrade on **Group → Billing**: choose 1, 3, 6 or 12 months, pay by Telebirr / CBE Birr / bank, and upload the receipt. The Super Admin approves it on the dashboard, which extends `proUntil` by 30 days per month paid (remaining trial days are not lost).
- Set your real payment details in `BILLING_INSTRUCTIONS` and the price in `PRO_PRICE_ETB` (`server/.env`). This is manual verification, not automatic card billing; automatic Telebirr/Chapa checkout can be added later.
- Demo data: *Office Monthly Equb* = Pro, *Neighbours Equb* = trial (5 days left), *Expired Demo Equb* = paused (log in as `leader1@equibhub.test` to upgrade it).

## What works
- **Profile and password:** edit name, phone, gender, address and emergency contact; change password (signs out other devices).
- **Announcements:** leaders post, members read, everyone in the group is notified.
- **Charts:** payment-status bar for each group and verified contributions by month for the Super Admin.
- **Auth:** sign up, log in/out, silent refresh, forgot/reset password, email verification, route guards, light/dark theme.
- **Groups:** Super Admin creates groups and assigns a leader; members browse and request to join; leaders approve, suspend, reactivate or remove (with confirmations); only Super Admin changes leaders.
- **Payments:** leaders create the month's records; members upload a receipt (JPG/PNG/WebP/PDF, max 5 MB, type checked by file signature); leaders view, verify or reject with a reason; overdue detected automatically; search, status filter, month selector.
- **Reports:** monthly contributions CSV (spreadsheet-formula safe).
- **Notifications:** in-app bell (hook for email/SMS in `server/src/lib/notify.ts`).
- **Audit log:** admin actions recorded; `GET /api/audit` (Super Admin). **Stats** at `GET /api/stats` power the admin cards.
- **Legal:** Privacy Policy and Terms (draft text — get legal review before launch). Footer: "Developed by Sol Ethio Coder".

## Power features
- **Private file storage:** receipts and profile photos are stored in your MongoDB database (GridFS), so they survive redeploys. `STORAGE_DRIVER=local` is for development only. Files are only served after a permission check.
- **Real emails:** set `MAIL_DRIVER=resend` (one API key) or `smtp` (Gmail app password, Brevo, Mailgun). Every notification is also emailed. Email failures never break the app.
- **SMS (optional):** `SMS_DRIVER=africastalking` texts members about reminders, verification and approval. Untested here: verify coverage and sender rules with your provider.
- **Automatic reminders:** every 6 hours the server flags overdue months, reminds members from 3 days before the due day (day 5 by default), and warns leaders 2 days before a trial or Pro plan ends.
- **Reports in CSV and PDF:** monthly contributions, outstanding payments, group financial summary, and per-member history (members can download their own). PDFs use a Latin-only font: non-Latin names (e.g. Amharic) print as "?" in PDFs but are kept in CSV.
- **Invite links and add-by-email:** leaders share a 7-day link (up to 20 joins, pre-approved), or add an existing user by email.
- **Profile photos:** private; visible to the person, their group leaders and admins.
- **Amharic and Ethiopian calendar:** language (EN / አማ) and calendar (GC / EC) switches in every header, remembered per browser. Key screens are translated; others fall back to English. Have a native speaker review the Amharic text.
- **Admin page:** search users, suspend or reactivate them (signs them out everywhere), and read the activity log.
- **Tests:** `npm test -w server` and `npm test -w client` (phone formats, plan logic, file-type checks, calendar conversion).

## Not built yet
Online card/Telebirr checkout (Pro payments are verified manually) · full Amharic translation of every screen · Amharic text in PDFs · reported-issues inbox and in-app system settings (settings are environment variables) · end-to-end tests with a database.

## Data model (MongoDB collections)
`users` · `refreshtokens` · `authtokens` · `equbgroups` · `memberships` (user + group + role + status; unique per pair) · `payments` (unique per membership + month) · `receipts` (many per payment) · `notifications` · `announcements` · `auditlogs`. Defined in `server/src/models/index.ts`.
- **Roles on the membership:** `User.platformRole` is `USER` or `SUPER_ADMIN`; `Membership.role` is `MEMBER` or `LEADER` per group, so one person can lead one Equb and join another.
- **Money = integer minor units + currency code** (no floats, no country lock-in).
- **Phones stored as E.164** (`+2519…`); local formats like `0911…` are normalised.

## Security
bcrypt (cost 12) · 15-min access JWT + rotating opaque refresh token (hash stored; reuse revokes all sessions) in httpOnly SameSite=Lax cookies (Secure in production), refresh cookie scoped to `/api/auth` · rate limits on auth routes · Zod validation on every body · helmet + CORS locked to `CLIENT_URL` · no account enumeration · suspended users blocked on every request · receipts served only to uploader, group leaders or Super Admin · secrets only in `.env` · malformed ids return 404, not 500.
Note: Mongoose casts query values, and request bodies are validated with Zod before use, which keeps NoSQL-operator injection (`{"$ne": ...}`) out of queries.

## Deploy (outline)
1. **Database:** MongoDB Atlas (free tier is fine for a pilot). Allow your host's IPs and copy the connection string.
2. **API:** Render / Railway / Fly. Set `NODE_ENV=production`, `MONGODB_URI`, a long random `JWT_ACCESS_SECRET`, `CLIENT_URL`. Build `npm run build -w server`, start `npm start -w server`.
3. **Web:** Vercel / Netlify, build `npm run build -w client`, and proxy `/api/*` to the API so cookies stay same-site.
4. **Files:** keep `STORAGE_DRIVER=mongodb` so receipts live in Atlas, not on the host's disk.
5. **Email:** set `MAIL_DRIVER` to `resend` or `smtp` with its keys. Never run the seed in production (it wipes data).
6. **Backups:** Atlas M0 has no automatic backups; schedule exports (`mongodump`) or upgrade the cluster.

## Not yet verified
Written without network access, so `npm install` and the app have **not been run**. Unit tests for the pure logic pass; database, email, PDF and upload paths are untested. After installing, run `npm run typecheck -w server` and `npm run typecheck -w client`, then try: sign up → request to join → approve → create records → upload receipt → verify → export CSV, and confirm a member cannot open another member's receipt.
