# Career VA

The public side of Career Engine. A VA captures job listings with the Career Clipper extension and moves applications between stages. Career Engine (Laravel) stays private on your machine. The two apps share one Postgres database on Neon, which is their only connection.

```
VA browser + Career Clipper ──▶ Career VA (Next.js, Firebase App Hosting) ──career_va role──▶ Neon
                                         Career Engine (Laravel, local) ──owner role──────────▲
```

## Rules of the shared database

- **Career Engine owns the schema.** Every migration lives in Laravel. This app has no migrations and no drizzle-kit. [src/db/schema.ts](src/db/schema.ts) hand-describes only the columns this app may use. Update it by hand when a Laravel migration changes one of those tables.
- **This app connects as `career_va`** ([db/career_va_role.sql](db/career_va_role.sql)). The role can:
  - read and capture applications, and move their stage
  - read sign-in facts and Sanctum token hashes
  - append audit events

  It cannot read career knowledge, claims, answers, passwords, 2FA secrets or the audit log. It also cannot edit, assign, review or delete applications. Those stay in Career Engine.
- **Writes match Laravel's.** The code ports `JobApplicationService::capture()`/`changeStage()`, `SourceUrl`, `PlainText` and `CaptureJobApplicationRequest`, and uses the same advisory lock and audit actions. Laravel can't tell which app wrote a row. When you change one of those PHP classes, change its port in [src/lib](src/lib) and the ported tests in [tests](tests).

## Sign-in

- **Career Clipper** uses the same Sanctum tokens as before. Issue them in Career Engine with `php artisan app:extension-token va@example.com` (while it points at the Neon database). In the extension settings, change only the address to this app's URL.
- **The web app** uses Google sign-in through Firebase Auth. Firebase only proves the email address. Access requires a Career Engine user with that email who:
  - is verified and active
  - is a member of a workspace
  - has 2FA, if that user is the candidate

  This is checked on every request.

## Setup

1. **Move Career Engine to Neon.** Create the project and run `php artisan migrate` against it. Neon supports the `vector`, `pg_trgm` and `citext` extensions it needs. Try migrations on a Neon branch before running them on `main`.
2. **Create the role:** `psql "$OWNER_URL" -v password="'…'" -f db/career_va_role.sql`. Re-run its GRANT lines after a migration this app depends on.
3. **Firebase:** enable Authentication with the Google provider. Add this app's domain to the authorised domains. Create an App Hosting backend for this directory.
4. **Secrets and config:** set them in [apphosting.yaml](apphosting.yaml). `DATABASE_URL` is Neon's **pooled** string for `career_va`. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is any stable random value.

## Development

```bash
cp .env.example .env.local   # point DATABASE_URL at a local database as career_va
npm run dev
npm test                     # ported Laravel unit tests
npm run typecheck
```
