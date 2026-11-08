# Architecture — Authentication & Business Onboarding

**Version:** 0.6  
**Status:** Updated  
**Last updated:** 2026-11-08  
**Project:** Business Management Application

## 1. Architecture Overview

The application will use a frontend-to-managed-backend architecture based on Next.js and Supabase.

The frontend will communicate directly with Supabase using its JavaScript SDK. No custom backend API will be introduced for the MVP. Server-side code is limited to Next.js rendering, Server Actions, the session-refresh proxy and the `/auth/confirm` route handler.

Supabase will provide authentication, PostgreSQL persistence, and database-level authorization.

The application runs only on the developer's computer and is not deployed or hosted. A single Supabase project is the only backend environment and the only remote service the application uses (§11).

### Technology Stack

| Layer                    | Technology                                                |
| ------------------------ | --------------------------------------------------------- |
| Frontend                 | Next.js 16 (App Router, Cache Components enabled)         |
| Language                 | TypeScript (strict mode)                                  |
| UI                       | React 19                                                  |
| Styling                  | Tailwind CSS 4, themed by the design system tokens (TASK-020) |
| Linting & formatting     | ESLint (`eslint-config-next`) and Prettier                |
| Internationalization     | next-intl (without i18n routing)                          |
| Authentication           | Supabase Auth                                             |
| Database                 | Supabase PostgreSQL                                       |
| Data access              | Supabase JavaScript SDK                                   |
| SSR authentication       | `@supabase/ssr`                                           |
| Authorization            | PostgreSQL RLS with table, column and function privileges |
| Supabase tooling         | Supabase CLI 2.x, pinned as a dev dependency (migrations, linked project, local test stack) |
| Unit & integration tests | Vitest                                                    |
| Database tests           | pgTAP (`supabase test db`)                                |
| End-to-end tests         | Playwright                                                |
| CI                       | GitHub Actions (checks only; no deployment, no Supabase access) |
| Runtime                  | Next.js on the developer's computer (`localhost`); not deployed |
| Backend environment      | One Supabase project; no development/production split     |

### High-Level Architecture

```text
                  USER
                    |
                    v
     Next.js + TypeScript (localhost)
   (pages, i18n, proxy, /auth/confirm)
                    |
          Supabase JavaScript SDK
                    |
           +--------+--------+
           |                 |
           v                 v
      Supabase Auth    Supabase PostgreSQL
           |                 |
           |                 +-- profiles
           |                 +-- businesses
           |                 +-- constraints
           |                 +-- RLS policies and privileges
           |                 +-- PostgreSQL functions and triggers
           |
           +-- Sessions
```

### Repository Layout

The Next.js application lives at the repository root, alongside `supabase/`. Folders marked *(later)* are created by the task that first needs them.

```text
.
├── app/                    # Next.js App Router (see §2)
├── components/ui/          # Design system primitives (TASK-020) (later)
├── i18n/                   # Locale configuration, preference stores, resolver, request config (§9) (later)
├── messages/               # Translation files: es.json (source), en.json (later)
├── lib/                    # Supabase clients (lib/supabase/), auth helpers, error mapping, shared constants
├── proxy.ts                # Session refresh; route protection added in TASK-013
├── scripts/                # Development utilities: secret scanner
├── supabase/
│   ├── config.toml         # Local Supabase configuration (auth settings)
│   ├── migrations/         # Versioned SQL migrations
│   └── tests/
│       ├── database/       # pgTAP tests (*.test.sql)
│       └── helpers/        # Shared pgTAP setup, included by every test file
├── tests/
│   ├── support/            # Test guard and local-stack client
│   ├── integration/        # Vitest against the local test stack (npm run test:integration)
│   └── e2e/                # Playwright tests (later)
├── docs/
├── .githooks/              # pre-commit hook: secret scan of staged content
├── .github/workflows/      # CI (checks only)
├── .env.example            # Variable names with placeholders (committed)
├── .env.local              # Supabase project URL and publishable key (git-ignored)
└── README.md
```

Unit tests are colocated with the code they test (`*.test.ts`).

**Cache Components.** Next.js 16 enables Cache Components by default, and the next major version makes it mandatory, so the application keeps it enabled. Every page depends on request cookies (session and language), which are read at request time. Reading them outside a `<Suspense>` boundary is a build error, unless the segment opts out of prerendering with `export const instant = false`. TASK-004 and TASK-019 choose the pattern for the session and the language.

## 2. Frontend Architecture

The application will use Next.js App Router.

The frontend will be responsible for:

- Rendering authentication pages.
- Managing personal onboarding forms.
- Managing business onboarding forms.
- Displaying validation errors.
- Mapping database and authentication error codes to user-facing messages.
- Rendering all user-facing text in the selected language (§9).
- Managing navigation and redirects.
- Displaying the dashboard.
- Displaying business status.

### Route Structure

```text
app/
├── page.tsx                  # "/": redirects by session and onboarding state
├── (auth)/
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── (account)/
│   └── update-password/      # requires a session; exempt from onboarding redirects
├── (protected)/
│   ├── onboarding/           # single route with two client-side steps
│   └── dashboard/
├── auth/
│   └── confirm/route.ts      # exchanges the recovery code for a session
└── layout.tsx                # html lang, translation provider, language selector
```

The route groups organize pages without changing their public URLs. URLs contain no locale prefix; the same URL serves both languages (§9). Route access rules are defined in `specification.md` SPEC-ROUTE-05.

### Supabase Clients

The application will use three Supabase client configurations, all with the publishable key and the user's session:

- **Browser client** (`createBrowserClient`): operations initiated from browser components.
- **Server client** (`createServerClient` with cookies): Server Components, route handlers and Server Actions.
- **Proxy client**: inside `proxy.ts`, refreshes the session and writes updated cookies. This is required because Server Components cannot write cookies.

No client uses the service-role key.

### Shared Frontend Modules

- **`INDUSTRIES`**: industry codes in display order. The only application copy of the code list; the database constraint is authoritative (`database.md` §4). Display names come from translation messages (`industries.<code>`).
- **`statusFromEstablishment`**: the only mapping from the establishment answer to `planning` or `active`.
- **Error mapping**: translates database error contract codes (`database.md` §7.5) and Supabase Auth error codes into translation keys (§9). It is language-independent; anything it does not recognize maps to a generic message key.
- **Validation helpers**: trimming, length counted in Unicode code points (to match PostgreSQL `char_length`, unlike JavaScript `String.length`), and age as a whole number in 16–100. They return translation keys, not text.

## 3. Authentication Architecture

Supabase Auth will manage:

- User registration.
- Email/password login.
- Session persistence and refresh.
- Logout.
- Password recovery.

The application will not implement its own password storage or session management.

### Auth Configuration

Defined in `supabase/config.toml` (used by the local test stack) and mirrored in the Supabase project (§11):

- Email confirmation disabled.
- Minimum password length: 8 characters.
- Multi-factor authentication (TOTP) disabled; it is not part of the MVP.
- Site URL `http://localhost:3000` and redirect URL allowlist `http://localhost:3000/**`.
- Supabase's default recovery email template, not translated. Custom templates are not available on the Free plan with the built-in email service.
- Email delivery through Supabase's built-in email service; no custom SMTP (§11).

### Registration Flow

1. User submits email and password (client validation: email format, at least 8 characters).
2. Next.js calls Supabase Auth `signUp`.
3. Supabase creates the authentication user. In the same transaction, the `on_auth_user_created` trigger creates the initial profile; if the trigger fails, the registration fails.
4. Supabase establishes the session (email confirmation is disabled).
5. The user is redirected to `/onboarding`.

### Login Flow

1. User submits credentials.
2. Next.js calls Supabase Auth `signInWithPassword`.
3. Supabase validates credentials and establishes the session.
4. The application retrieves onboarding status from the user's profile.
5. The user is redirected to `/onboarding` or `/dashboard`.

### Logout Flow

1. Next.js calls Supabase Auth `signOut`, which revokes the refresh token and clears the session cookies.
2. The user is redirected to `/login`.

An access token issued before logout remains valid until it expires (`requirements.md` AR-02). The language preference is not affected by logout.

### Password Recovery Flow

1. On `/forgot-password`, a Server Action calls `resetPasswordForEmail(email, { redirectTo: 'http://localhost:3000/auth/confirm' })` and shows a neutral confirmation message. With the PKCE flow (the `@supabase/ssr` default), this stores a code verifier in a cookie of the requesting browser.
2. The recovery email (Supabase's default template) links to Supabase, which verifies it and redirects to `/auth/confirm?code=…`.
3. The `/auth/confirm` route handler calls `exchangeCodeForSession(code)`. On success, it sets the session cookies and redirects to `/update-password`. On failure (invalid, expired or used link, or a missing code verifier because the link was opened in another browser), it redirects to `/forgot-password?error=<code>`.
4. On `/update-password`, Next.js calls `updateUser({ password })` (at least 8 characters), then redirects according to onboarding status.

`/auth/confirm` is used only for password recovery in the MVP and redirects only to fixed internal paths. It does not accept a redirect target from the query string, which prevents open redirects. Error query parameters carry codes that are mapped to translated messages; text from the URL is never displayed.

Because the code verifier lives in the requesting browser, the recovery link must be opened in that same browser, on the computer running the application.

## 4. Database Architecture

Supabase PostgreSQL will store application data. `database.md` is authoritative for columns, constraints, functions, RLS policies and privileges; this section only summarizes.

### Entity Relationship

```text
auth.users
    |
    | 1:1
    |
profiles
    |
    | 1:0..1
    |
businesses
```

- **profiles**: one per authentication user, created at registration. Holds personal information (NULL until Page 1 is saved) and `onboarding_completed_at`.
- **businesses**: zero or one per profile. Holds the business name, industry code and status.
- Deleting an authentication user cascades to the profile and the business.
- No language data is stored in the database in the MVP (§9).

### Business Status

- `planning`: The business has been registered but does not yet have a physical establishment.
- `active`: The business already has a physical establishment.

The status is determined from the user's answer during onboarding.

Physical location information is not collected during the MVP onboarding process.

## 5. Database Operations

| Operation                                       | Mechanism                                  | Execution mode                  |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------- |
| Profile creation                                | `handle_new_user` trigger on `auth.users`  | SECURITY DEFINER (exception 1)  |
| Save personal information (Page 1)              | `save_personal_information` via RPC        | SECURITY INVOKER                |
| Create business and complete onboarding (Page 2) | `finish_onboarding` via RPC               | SECURITY DEFINER (exception 2)  |
| Read profile and business                       | Direct SELECT through the Supabase SDK     | RLS                             |
| Maintain `updated_at`                           | `handle_updated_at` triggers               | SECURITY INVOKER                |

### Personal Information Persistence

When the user clicks Next, Next.js calls `save_personal_information(p_full_name, p_age)`. This is the only way the application writes personal information.

The function identifies the user through `auth.uid()`, trims the name, rejects changes after onboarding completion and translates constraint violations into the error contract.

Because the function runs with the caller's privileges, authenticated users also hold UPDATE privilege on `profiles.full_name` and `profiles.age`. The application never uses direct updates. Direct updates are bound by the same constraints, column grants and RLS policy, but receive no trimming and no contract error codes (`database.md` §7.2).

The onboarding completion timestamp cannot be modified through either path.

### Business Creation and Onboarding Completion

When the user clicks Finish, Next.js calls `finish_onboarding(p_business_name, p_industry, p_status)`. The function (`database.md` §7.4):

1. Identifies the authenticated user using `auth.uid()` and rejects the call if there is none.
2. Rejects missing arguments.
3. Trims the business name.
4. Locks the user's profile row.
5. Rejects the call if onboarding is already completed.
6. Rejects the call if personal information has not been saved.
7. Inserts the business; table constraints validate name, industry and status, and violations are translated into contract codes.
8. Sets `profiles.onboarding_completed_at`.
9. Returns the new business ID.

Both writes execute in one PostgreSQL transaction (PostgREST wraps each RPC call in one); any error rolls back both. `updated_at` is maintained by triggers, not by the function.

The function enforces authorization independently of frontend validation.

### Error Contract

Database functions report failures with stable, language-independent error codes (`database.md` §7.5). The frontend maps them to translation keys in a single module. `onboarding_already_completed` returned by `finish_onboarding` is treated as success.

## 6. Authorization and Data Security

PostgreSQL Row Level Security (RLS) and explicit privileges will protect user-owned records.

### Privilege Model

- Supabase's default privileges grant broad table and function access to `anon` and `authenticated`. Every migration revokes them and grants only what is needed (`database.md` §8).
- `anon`: no access to application tables or functions.
- `authenticated`: read own rows; update `full_name` and `age` on their own profile before onboarding completion; execute the two RPC functions.
- RLS, policies and privileges are created in the same migration as the table or function they protect.

### Profiles

- Authenticated users can read their own profile.
- Authenticated users can update only their full name and age, only on their own profile, and only before onboarding is completed.
- Users cannot access or modify another user's profile.
- Users cannot insert or delete profiles, or modify `onboarding_completed_at`.

### Businesses

- Users can read only their own business.
- Business creation must use `finish_onboarding`.
- Direct client inserts, updates and deletions are not permitted in the MVP.

### SECURITY DEFINER Exceptions

Functions use SECURITY INVOKER by default. Exactly two functions use SECURITY DEFINER:

1. **`handle_new_user`**: runs as the Auth service's database role, which has no privileges on application tables.
2. **`finish_onboarding`**: must write `businesses` and `onboarding_completed_at`, which clients cannot write.

Both use an empty `search_path`, fully qualified object names, explicit identity validation and restricted EXECUTE privileges (`database.md` §8.5).

### Secrets and API Keys

- The Supabase publishable key may be used in the frontend with RLS enabled.
- Supabase service-role credentials must never be exposed to the browser or placed in `NEXT_PUBLIC_*` variables.
- The application needs no secrets: it uses only the project URL and publishable key. Local environment variables and tooling credentials are handled as described in §11.

## 7. Route Protection

Route access rules are defined in `specification.md` SPEC-ROUTE-05.

Mechanism:

1. **Proxy** (`proxy.ts`) runs on matched requests. It refreshes the session, writes updated cookies and redirects unauthenticated requests for protected routes to `/login`. This is an optimistic check only. The proxy does not handle language: URLs carry no locale.
2. **Page-level server checks**: every page whose access depends on session or onboarding state calls a shared server helper that validates the user with `getClaims()` (or `getUser()`), never `getSession()`, reads `profiles.onboarding_completed_at` through RLS, and redirects according to the matrix.
3. These checks run in page server components (or the helper they call), not only in layouts, because layouts are not re-rendered on every navigation.
4. RLS and database privileges are the final security boundary.

## 8. Onboarding Data Flow

Onboarding is a single `/onboarding` route with two steps held in client state. It always starts at Page 1.

### Page 1 — Personal Information

1. The server loads the user's profile and the form is pre-populated with saved values.
2. User enters full name and age.
3. Frontend validates: trimmed full name of 1–100 characters; age a whole number from 16 to 100.
4. User clicks Next; Next.js calls `save_personal_information`.
5. On success, the user proceeds to Page 2. On error, the mapped message is displayed and the user stays on Page 1.

### Page 2 — Business Information

1. User enters the business name.
2. User selects an industry from `INDUSTRIES` (translated display names shown, code submitted).
3. User answers whether the business already has a physical establishment (Yes/No, none preselected).
4. Back returns to Page 1; Page 2 values may remain in memory but are not persisted.
5. Frontend validates the inputs and derives the status with `statusFromEstablishment`:
   - No establishment: `planning`.
   - Has establishment: `active`.
6. User clicks Finish; Next.js calls `finish_onboarding`. The Finish action is disabled while the request is in flight.
7. On success, or on `onboarding_already_completed`, the user is redirected to `/dashboard` and server data is refreshed.
8. On any other error, the mapped message is displayed, the user stays on Page 2 and onboarding remains incomplete.

No address or geographic location is required.

Page 2 information will not be persisted until the user clicks Finish.

Changing the language during onboarding keeps the current step and the entered values (§9).

## 9. Internationalization

### Scope

- Supported locales: `es` (default) and `en`.
- All user-facing text is translated: page content, page titles, validation messages, error messages, industry display names and status labels.
- Values entered by users (such as names) are displayed as entered. Stored codes (industries, statuses, error codes) are language-independent and translated only for display.
- URLs contain no locale (`/login` serves both languages). The language is a preference, not part of the route, so SPEC-ROUTE-05 applies unchanged.
- No automatic detection from the browser's `Accept-Language` header: without a stored preference, the interface is Spanish.

### Library

next-intl in its mode without i18n routing. Server Components use `getTranslations`; Client Components use `useTranslations` through `NextIntlClientProvider` in the root layout. Messages use ICU message syntax.

### Modules

The i18n design separates *where the preference is stored* from *how text is translated*. Only the preference modules know where the preference lives.

| Module | Responsibility | Changes when the preference moves to the profile |
|---|---|---|
| `i18n/config.ts` | `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` (`es`), the `Locale` type and the `isLocale()` guard | No |
| `i18n/preference.ts` | `LocalePreferenceStore` interface (`read()`, `write(locale)`) and the MVP implementation `cookieLocaleStore` | Adds `profileLocaleStore` |
| `i18n/resolve.ts` | `resolveLocale()`: reads an ordered list of stores and returns the first valid locale, otherwise `DEFAULT_LOCALE` | Only the store list changes |
| `i18n/actions.ts` | `setLocalePreference(locale)` Server Action: validates the locale and writes it to every configured store | Also writes the profile |
| `i18n/request.ts` | next-intl request configuration: calls `resolveLocale()` and loads the messages | No |
| `messages/es.json`, `messages/en.json` | Translations, organized by namespace | No |
| Language selector component | Calls `setLocalePreference`, then refreshes the route | No |

Components, message files and the error-mapping module never read or write the preference directly; they only receive the resolved locale.

### Preference Storage (MVP)

- A first-party cookie named `locale`, with value `es` or `en`, written only by `setLocalePreference`.
- Attributes: `Path=/`, `SameSite=Lax`, `Max-Age` of one year. `Secure` is not set, because the application is served over `http://localhost` and the value is not sensitive.
- **Why a cookie rather than localStorage.** Pages are rendered on the server (auth checks, redirects, translated content). The server cannot read localStorage, so a localStorage-only preference would render every page in Spanish first and switch language after hydration, causing visible flicker and hydration mismatches. A cookie is also stored only in the browser and is never written to the database, but it is readable during server rendering.
- The preference belongs to the browser, not to the account: it is kept on logout, shared by accounts that use the same browser and not synchronized across devices.
- Stored values are validated with `isLocale()` before use. An invalid value is ignored and Spanish is used. Locale values are never used to build file paths or imports without validation.

### Request Flow

1. A request arrives; the next-intl request configuration calls `resolveLocale()`.
2. `cookieLocaleStore.read()` returns the cookie value if it is a supported locale.
3. Otherwise `DEFAULT_LOCALE` (`es`) is used.
4. The messages for the resolved locale are loaded; the root layout sets `<html lang>` and provides the messages to Client Components.

### Language Switch Flow

1. The user selects a language in the language selector, which is available on every page, including authentication pages.
2. The selector calls `setLocalePreference(locale)`, which validates the value and writes the cookie.
3. The client refreshes the current route. Server Components re-render in the new language, and client state (such as the onboarding step and entered values) is preserved.

### Messages

- Namespaces: `common`, `metadata`, `auth`, `onboarding`, `business`, `dashboard`, `validation`, `errors`, `industries`, `status`.
- `es.json` is the source file. `en.json` must contain exactly the same keys; a unit test in CI fails on missing or extra keys. Message key types are derived from `es.json`.
- Industry display names use `industries.<code>`; status labels use `status.planning` and `status.active`.
- Database error contract codes use `errors.<code>` (for example `errors.invalid_industry`), plus `errors.generic` for anything outside the contract.
- Supabase Auth errors are mapped by their error `code` (for example `user_already_exists`, `invalid_credentials`, `weak_password`) to `errors.auth.<code>`, with a generic fallback. Supabase's own English messages are never displayed.
- Runtime fallback for a missing key is the Spanish message; the key parity test makes this unreachable in practice.

### Authentication Emails

Authentication emails use Supabase's default template and are not translated. Only the application's pages are bilingual.

### Future Migration: Preference in the User Profile

The design allows the preference to move to the user's profile and synchronize across devices by changing only the preference modules and adding a database migration:

1. A migration stores the preference server-side (for example `profiles.locale`, nullable, with `CHECK (locale in ('es', 'en'))`), with its RLS, privileges and tests in the same migration.
2. **Write path constraint:** the current `profiles` UPDATE policy blocks all direct updates after onboarding completion, which enforces the lock on personal information (`requirements.md` FR-06). RLS cannot allow one column while locking the others, so the future write path must not relax that policy. Use either a dedicated SECURITY DEFINER function (documented as a new exception in `database.md` §8.5) or a separate preferences table with its own RLS. The choice is made when the feature is planned.
3. Add `profileLocaleStore`, active only for authenticated users.
4. The resolver order becomes: profile, then cookie, then `es`. The cookie stays as a cache and for unauthenticated pages.
5. `setLocalePreference` writes to both stores for authenticated users.
6. On sign-in, synchronize: if the profile has a preference, write it to the cookie; if it has none and the cookie does, save the cookie value to the profile.

Message files, translation calls in components, the language selector, the error-mapping module and `<html lang>` handling do not change.

## 10. Error Handling

The application must handle:

- Invalid login credentials.
- Duplicate email registration.
- Passwords shorter than 8 characters.
- Invalid or expired recovery links.
- Expired or invalid sessions (redirect to `/login`).
- Supabase connectivity errors.
- Database function errors from the error contract (`database.md` §7.5).
- Errors outside the contract (generic message).

All error messages are displayed in the current language through translation keys (§9).

Retry safety:

- `save_personal_information` is idempotent: repeating it with the same input produces the same state.
- `finish_onboarding` is safe to retry: a repeat returns `onboarding_already_completed`, which the frontend treats as success.
- No operation leaves partially completed onboarding state.

## 11. Environments and Configuration

### Runtime

- Next.js runs only on the developer's computer, at `http://localhost:3000` (`next dev`, or `next build` followed by `next start`).
- The application is not deployed or hosted: no Vercel, AWS or other hosting service.
- Supabase is the only remote service the application uses.

### Supabase Project and Local Test Stack

There is exactly one Supabase project. There are no separate development, staging or production projects.

| | Supabase project | Local test stack |
|---|---|---|
| Role | The only backend environment | Ephemeral test harness; not an environment |
| Used by | The application in normal use and during manual development (`.env.local`) | Automated tests: pgTAP, integration and end-to-end |
| Data | Real data | Disposable; reset freely with `supabase db reset` |
| Schema changes | Only `supabase db push` of tested migrations | Every migration, rebuilt from scratch |
| Emails | Supabase's built-in email service (limits in `requirements.md` AR-03) | Local email testing UI, with no delivery limits |
| Runs on | Supabase (remote) | Docker on the developer's computer and in CI |

### Migration Workflow

1. Create the migration with `supabase migration new <name>` and write its pgTAP tests first.
2. Run `supabase db reset` and `supabase test db` on the local test stack until every test passes.
3. Commit the migration and its tests.
4. If the Supabase project already holds data, take a database dump with the Supabase CLI and store it outside the repository (it contains user data).
5. Run `supabase db push --linked --dry-run`, review the pending migrations, then run `supabase db push --linked`. Always pass `--linked`: the next major CLI version targets the local database by default.
6. Run `supabase migration list` to confirm the local and remote migration histories match.

Never run `supabase db reset --linked` (it erases the project), change the schema through the dashboard (SQL editor, Table Editor) or other tools, or edit a migration after it has been applied.

### Auth Configuration Parity

`supabase/config.toml` is the reference configuration (§3). Because the application always runs at `http://localhost:3000`, the same Site URL and redirect URLs apply to the local test stack and to the Supabase project. `supabase config diff` previews the differences and `supabase config push` applies them to the project (done in TASK-003; verified again in TASK-018). Where the project's defaults are acceptable, `config.toml` adopts them instead of overriding them.

### Email Delivery

The application sends only password recovery emails; signup confirmation is disabled.

Supabase's built-in email service delivers only to addresses that are members of the project's Supabase organization, and it has a low hourly rate limit. For a local-only application whose accounts belong to the developer and organization members, these limits are acceptable, so **custom SMTP is not required**. A custom SMTP provider would also add a second remote service, contrary to the runtime constraint above.

- Automated recovery tests use the local test stack's email testing UI.
- Manual recovery checks against the Supabase project use an organization member's address.
- Revisit this decision if accounts with addresses outside the organization need password recovery.

### Local Environment Variables

| File | Committed | Contents |
|---|---|---|
| `.env.example` | Yes | Variable names with placeholder values and comments; never real values |
| `.env.local` | No (git-ignored) | Supabase project URL and publishable key, read by `next dev` and `next start` |

| Variable | Value | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Browser; safe |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's publishable key | Browser; safe, because access is controlled by RLS and privileges |

Rules:

- Setup: copy `.env.example` to `.env.local` and fill in the values from the Supabase dashboard (project API settings).
- The application needs no secrets. The service-role key, secret API keys, the database password and Supabase access tokens never go into any `.env` file read by Next.js.
- Only browser-safe values use the `NEXT_PUBLIC_` prefix, and the application has no other variables.
- `.gitignore` ignores `.env` and `.env.*` except `.env.example` (already in place).
- `scripts/check-secrets.mjs` detects Supabase secret keys (`sb_secret_` prefix), personal access tokens, `service_role` JWTs and remote database URLs with a password. The pre-commit hook runs it on staged content and blocks the commit. CI runs it on every file in the repository and fails if one is found. The repository is public, so the hook is the main defense: CI only detects a secret after it has been pushed.
- Automated tests never read `.env.local`. Test runners receive the local test stack's URL and key explicitly (from `supabase status -o env`), and a shared setup guard aborts any test whose Supabase URL is not `http://127.0.0.1` or `http://localhost`. This prevents tests from writing to the Supabase project.
- If a secret is ever committed, rotate it in the Supabase dashboard immediately; removing it from Git history is not enough.

### Tooling Credentials

- **Supabase CLI:** `supabase login` stores a personal access token on the developer's computer, outside the repository. `supabase link --project-ref <ref>` links the project. The database password is entered interactively (or provided through the `SUPABASE_DB_PASSWORD` environment variable for a single shell session) and is never written to repository files.
- The personal access token grants access to every project in the Supabase account. It is never placed in `.env` files or CI.
- **Supabase MCP server** (development tools): configured read-only (`read_only=true` in `.mcp.json`), so schema and data changes reach the project only through migrations.
- CI holds no Supabase credentials.

### Continuous Integration

GitHub Actions runs on every push (`.github/workflows/ci.yml`). It never deploys anything, holds no Supabase credentials and never connects to the Supabase project.

- **checks:** secret scan, linting, type checking, format check, unit tests and `next build`.
- **database:** starts a local test stack (Postgres, Auth and the Data API) inside the runner, runs `supabase db reset --local` (every migration from scratch), `supabase test db --local` and the integration tests.
- **end-to-end** (added in TASK-017): Playwright against a local test stack with Auth, the Data API and the email testing UI.

The repository is public, so GitHub Actions minutes are free.

Locally, `npm run check` runs the same checks as the checks job, and `npm run db:reset && npm run db:test && npm run test:integration` runs the database job. The local stack scripts always pass `--local`. `supabase db reset --linked` and `supabase test db --linked` are never used, because they would erase or alter the Supabase project.

## 12. Architectural Constraints

- No custom authentication implementation.
- No custom backend API for the MVP.
- The application is not deployed or hosted; Supabase is the only remote service it uses.
- One Supabase project is the only backend environment.
- Automated tests run only against the local test stack, never against the Supabase project.
- One business per authenticated user.
- Business status must be either `planning` or `active`.
- No physical location required during onboarding.
- All user-owned data must be protected by RLS and least-privilege grants from the migration that creates it.
- SECURITY INVOKER by default; only the two documented SECURITY DEFINER exceptions.
- Data validity is enforced by database constraints on every write path.
- The frontend cannot be trusted as the only enforcement layer.
- Onboarding completion must be atomic.
- All user-facing text comes from translation files; components do not hard-code user-facing strings.
- No language data is stored in the database in the MVP.

## 13. Open Decisions

1. Design direction (type, color, motion, screen layouts): proposed in TASK-020 as a visual prototype, pending approval. Already decided: onboarding keeps two steps (`specification.md`), and the interface is light only.

Resolved in this version: session expiration uses Supabase defaults (1-hour access tokens with automatic refresh and refresh token rotation); the Supabase CLI local stack in Docker is the ephemeral test harness; GitHub Actions runs checks only, plus a local pre-commit secret scan; the built-in email service with Supabase's default templates is accepted (no custom SMTP or custom templates; recovery uses the PKCE code exchange); Tailwind CSS for styling; Cache Components stays enabled.

Resolved previously: no application hosting or deployment (Next.js runs locally); a single Supabase project as the only backend environment; UI language (§9); industry categories (`database.md` §4); password minimum length (8); business status changes and business editing after onboarding (out of scope).

## 14. Definition of Architectural Completion

Architecture is ready for implementation when:

- Component responsibilities are defined.
- Authentication and session flows are documented.
- Database entities and relationships are defined.
- Authorization boundaries are documented.
- Onboarding data flow is defined.
- Business status behavior is defined.
- Internationalization and language preference storage are defined.
- Security and environment decisions are sufficiently specified.
