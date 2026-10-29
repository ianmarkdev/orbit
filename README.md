# Orbit

The public side of Career Engine. A VA captures job listings with the Career Clipper extension, applies on the job platform with the tailored resume and answers approved in Career Engine, and moves applications between stages, with an optional note on how they applied. Career Engine (Laravel) stays private on your machine. The two apps share one Postgres database on Neon, which is their only connection.

```
VA browser + Career Clipper ──▶ Orbit (Next.js, Vercel) ──career_va role──▶ Neon
                               Career Engine (Laravel, local) ──owner role──▲
```

## Rules of the shared database

- **Career Engine owns the schema.** Every migration lives in Laravel. This app has no migrations and no drizzle-kit. [src/db/schema.ts](src/db/schema.ts) hand-describes only the columns this app may use. Update it by hand when a Laravel migration changes one of those tables.
- **This app connects as `career_va`** ([db/career_va_role.sql](db/career_va_role.sql)). The role can:
  - read and capture applications, and move their stage
  - read the tailored resume and form answers of an application (the app shows only approved versions; the resume is read from the frozen snapshot of the facts it uses)
  - read sign-in facts and Sanctum token hashes
  - append audit events

  It cannot read the career library (jobs, claims, skills), the answer library, AI runs, password hashes, 2FA secrets or the audit log. It also cannot edit, assign, review or delete applications. Those stay in Career Engine.
- **Writes match Laravel's.** The code ports `JobApplicationService::capture()`/`changeStage()`, `SourceUrl`, `PlainText` and `CaptureJobApplicationRequest`, and uses the same advisory lock and audit actions. Laravel can't tell which app wrote a row. When you change one of those PHP classes, change its port in [src/lib](src/lib) and the ported tests in [tests](tests).

## Sign-in

- **Career Clipper** uses the same Sanctum tokens as before. Issue them in Career Engine with `php artisan app:extension-token va@example.com` (while it points at the Neon database). In the extension settings, change only the address to this app's URL.
- **The web app** uses the VA's Career Engine email and password, so there's one account for both apps. Postgres checks the password itself with the `career_va_check_password` function, which returns only a user id; this app never sees a hash. The account must be verified, active and a member of a workspace, which is checked again on every request. Accounts with two-factor authentication are refused, because this app can't ask for the code. Sessions last 12 hours.

## Database setup

Done once. The database is Neon project **Atlas**, branch **production**, database `career_engine`.

1. **Move Career Engine to Neon.** Create the project and run `php artisan migrate` against it, or copy an existing database with `pg_dump -Fc --no-owner --no-privileges` and `pg_restore --no-owner --no-privileges --single-transaction`. Neon supports the `vector`, `pg_trgm`, `citext` and `pgcrypto` extensions needed. Try migrations on a Neon branch before running them on `production`.
2. **Point Career Engine at Neon.** In its `.env`, use the **direct** (non-pooler) host as the owner role, with `DB_SSLMODE=require`. Migrations and Laravel's prepared statements are safest without the pooler.
3. **Create the role:** `psql "$OWNER_URL" -v password="'…'" -f db/career_va_role.sql`, with `$OWNER_URL` on the direct host. Re-run its GRANT lines after a migration this app depends on.

## Deployment (Vercel)

The app deploys from GitHub (`ianmarkdev/orbit`). After the first setup, every push to `main` deploys to production, and every other branch or pull request gets a preview deployment.

### First deploy

1. **Push** `main` to GitHub.
2. **Import** the repository at [vercel.com/new](https://vercel.com/new). Keep the defaults: framework preset Next.js, root directory `./`, build command `next build`.
3. **Add the environment variables** below for Production, then click **Deploy**.
4. **Set `APP_URL`** to the production domain Vercel assigns (or your own, from Settings → Domains), then **redeploy** (Deployments → ⋯ → Redeploy). Variables only reach new deployments.
5. **Check it:** sign in at the production URL with a VA's Career Engine email and password. Then in Career Clipper's settings enter the same URL, press **Save and allow access** and **Test connection**. "Connected" means the address and token work.

### Environment variables

Set in Project → Settings → Environment Variables. `.env.example` lists the required ones for local development.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon's **pooled** (`-pooler`) connection string for the `career_va` role. Never the owner. |
| `SESSION_SECRET` | At least 32 random characters, e.g. `openssl rand -base64 32`. Keep it stable: changing it signs everyone out. Don't reuse the local one. |
| `APP_URL` | The production URL, no trailing slash. It must match the address in Career Clipper, which only opens links on that origin. |
| `REQUIRE_CANDIDATE_TWO_FACTOR` | `true`, the same as Career Engine's `APP_REQUIRE_CANDIDATE_TWO_FACTOR`. |
| `DATABASE_POOL_MAX` | Optional. Connections per function instance, default `5`. |

The `pg` pool is registered with `attachDatabasePool` from `@vercel/functions` (see [src/db/index.ts](src/db/index.ts)), so idle connections close before an instance is suspended.

### After a Career Engine migration

The schema belongs to Laravel, so a migration can break this app without any change here. When one touches a table this app uses:

1. Update [src/db/schema.ts](src/db/schema.ts) by hand.
2. Re-run the GRANT lines of [db/career_va_role.sql](db/career_va_role.sql) as the owner, if this app needs a new column.
3. Push. The deployment picks up the change.

Deploy this app **after** the migration runs, so it never queries a column that doesn't exist yet.

### Troubleshooting

- **Career Clipper says "The API token was not accepted" against a preview URL.** Vercel protects preview deployments with a login by default. Use the production domain, or turn off Deployment Protection for it.
- **Career Clipper says "Career Engine refused the request" with no reason.** A 403 without a message comes from a proxy in front of the app, not from the app. Add the domain to the proxy's bypass list (e.g. IPRoyal).
- **Every page is a 500.** Check the function logs in Vercel. `DATABASE_URL` missing, or a password that no longer matches the `career_va` role, are the usual causes.
- **Sign-in says the account belongs to no workspace, or isn't verified.** The app applies Career Engine's rules; fix the account in Career Engine.

## Development

```bash
cp .env.example .env.local   # point DATABASE_URL at a local database as career_va
npm run dev
npm test                     # ported Laravel unit tests
npm run typecheck
```
