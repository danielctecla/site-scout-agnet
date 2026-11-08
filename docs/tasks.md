# Tasks — Business Management MVP

**Version:** 0.6  
**Status:** In progress  
**Last updated:** 2026-11-08  
**Based on:** requirements.md v0.8, specification.md v0.5, architecture.md v0.6, database.md v0.7

## 1. Development principles

- Implement one task at a time.
- Follow TDD whenever practical: RED → GREEN → REFACTOR. Database tasks write pgTAP tests before the migration.
- Do not implement functionality outside the agreed MVP scope.
- Every task must satisfy its acceptance criteria before being marked complete.
- Database security must be tested independently from frontend route protection.
- Every migration must be secure at creation: RLS, policies and privileges live in the same migration as the table or function they protect (`database.md` §10).
- Do not expose Supabase service-role credentials to the browser.
- The application runs locally and is never deployed. The single Supabase project is the only backend environment and receives schema changes only through the migration workflow (`architecture.md` §11).
- Automated tests run only against the ephemeral local test stack, never against the Supabase project.
- Prefer Supabase Auth and PostgreSQL capabilities over unnecessary custom backend code.
- Document precedence: `database.md` is authoritative for schema, constraints, functions, RLS and privileges; `specification.md` for observable behavior; `architecture.md` for components and flows; `requirements.md` for scope. If a task reveals a conflict between documents, stop and update the documents before implementing.
- Task IDs are stable identifiers, not an execution order. Follow the dependency summary (§3). TASK-019 (added in v0.3) and TASK-020 (added in v0.5) belong to Phase 1; TASK-021 (added in v0.6) belongs to Phase 2.
- All user-facing text comes from translation files (`architecture.md` §9); every UI task covers both Spanish and English.
- Every UI task follows the approved design system (TASK-020, `requirements.md` NFR-07). Components use its tokens and primitives, never ad-hoc colors, spacing or type sizes.

## 2. Tasks

### Phase 0 — Resolve design decisions

#### TASK-001: Reconcile design documents

**Status:** Done (approved 2026-11-08).

**Objective:** Resolve inconsistencies and open decisions before implementation.

**Dependencies:** None.

**Activities:**
- Audit the five documents for contradictions, gaps and security issues.
- Record decisions: personal information locked after completion; `full_name` 1–100 and business name 1–120 characters, stored trimmed; minimum password length 8; single `/onboarding` route with two steps; recovery through `/auth/confirm`; Next.js at the repository root.
- Keep `finish_onboarding` receiving `p_status` from the frontend, validated by the database.
- Define the industry validation strategy, the error contract, the profile write paths, the SECURITY DEFINER exceptions and the secure-at-creation migration order.
- Record the language decision: Spanish default, English supported, preference stored in the browser, modular design ready to move the preference to the profile.
- Record the infrastructure scope: Next.js runs locally only, no hosting or deployment, a single Supabase project as the only backend environment and remote service, no custom SMTP.

**Acceptance criteria:**
- The five documents are consistent with each other.
- `database.md` reflects the final database decisions.
- Remaining open decisions are listed in `specification.md` §11 and `architecture.md` §13.

---

### Phase 1 — Project setup

#### TASK-002: Initialize the application

**Status:** Done (2026-11-08). Next.js 16.4.5, React 19.3, Tailwind CSS 4, Vitest 5, Node 22.

**Objective:** Create the application foundation.

**Dependencies:** TASK-001.

**References:** `architecture.md` §1 (stack, repository layout), §11.

**Activities:**
- Initialize Next.js (current stable version, App Router, TypeScript strict mode) at the repository root, alongside `supabase/` and `docs/`.
- Finalize the folder structure below the root.
- Add ESLint and Prettier.
- Add Vitest for unit and integration tests.
- Create `.env.example` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, using placeholders and comments only (`architecture.md` §11).
- Confirm `.gitignore` ignores `.env` and `.env.*` except `.env.example` (already configured).
- Add the secret scanner (`scripts/check-secrets.mjs`): Supabase secret keys, personal access tokens, `service_role` JWTs and remote database URLs with a password. It reports file and line, never the value.
- Add a pre-commit hook (`.githooks/pre-commit`, enabled by `npm install`) that runs the scanner on staged content, because the repository is public and CI only detects a secret after it is pushed.
- Configure GitHub Actions CI on every push: install, secret scan, lint, type check, format check, unit tests and build. CI holds no Supabase credentials and deploys nothing.
- Update the README structure and local setup instructions, including creating `.env.local` from `.env.example`.

**Acceptance criteria:**
- The application starts locally.
- TypeScript compilation succeeds.
- Linting and unit tests run locally and in CI; CI fails when any check fails.
- Environment variables are not committed.
- The project has a documented setup process.

**Tests:**
- Run the development server.
- Run linting and type checking.
- Run a placeholder unit test.
- Run `next build` (a build check only; nothing is deployed).
- The secret scan fails on a file containing an `sb_secret_` value (verified once, not committed).

---

#### TASK-003: Configure Supabase tooling, the project link and database tests

**Status:** Done (2026-11-08). Supabase CLI 2.122.1. The project is linked and `supabase config diff` reports no differences. The project's settings that differed from the CLI defaults (email `max_frequency` 1 minute, `otp_length` 8, vector storage disabled, pooler sizes) were adopted in `config.toml`, and TOTP MFA was disabled on the project.

**Objective:** Provide auth configuration as code, a linked Supabase project, an ephemeral local test stack and a database test harness.

**Dependencies:** TASK-001.

**References:** `architecture.md` §3 (auth configuration), §11; `database.md` §10.

**Activities:**
- Run `supabase init` to create `supabase/config.toml`.
- Configure auth: email confirmation disabled, `minimum_password_length = 8`, Site URL `http://localhost:3000`, redirect URLs `http://localhost:3000/**`.
- Keep Supabase's default email templates. Custom templates require a paid plan or custom SMTP.
- Start the local stack with `supabase start`.
- Create the pgTAP test directory `supabase/tests/database/` with helpers to create test users (insert into `auth.users`) and to impersonate `authenticated` (with JWT claims) and `anon`. Helpers live in `supabase/tests/helpers/setup.psql`, which each test file includes inside its own transaction.
- Add a CI job that starts the local stack, runs `supabase db reset` and `supabase test db`.
- Add npm scripts for the local stack (`db:start`, `db:reset`, `db:test`, `db:stop`) that always pass `--local`. Never run `supabase db reset --linked` or `supabase test db --linked`.
- Confirm that a failing migration is applied atomically (leaves no partial objects).
- Link the Supabase project with `supabase login` and `supabase link`, without writing any credential to repository files.
- Apply the same auth settings to the Supabase project (dashboard, or `supabase config push` where supported), so registration works before the first manual use. The project's defaults (email confirmation enabled, shorter minimum password) would otherwise break the registration flow.
- Document in the README the local test stack commands, the project link and the migration workflow (`architecture.md` §11).

**Acceptance criteria:**
- The local stack starts and `supabase db reset` applies all migrations from scratch.
- `supabase test db` runs locally and in CI, against the local stack only.
- Local auth configuration matches `architecture.md` §3, and the Supabase project's auth settings match it.
- The project is linked and no credential is stored in the repository.
- Recovery emails can be inspected in the local email testing UI.
- Migration atomicity is confirmed.

**Tests:**
- A smoke pgTAP test runs and passes.
- A deliberately failing migration leaves no objects behind (verified once, not committed).

---

#### TASK-004: Configure Supabase clients and session handling

**Status:** Done (2026-11-08). `@supabase/supabase-js` 2.119, `@supabase/ssr` 0.12. Unit tests cover the environment check and the test guard; integration tests (`npm run test:integration`) cover signup, `getCurrentUser` and `finish_onboarding` concurrency against the local stack. Refreshing an expired session through the proxy needs a real browser session, so it is verified by the TASK-012 session persistence tests.

**Objective:** Connect Next.js with Supabase Auth and PostgreSQL.

**Dependencies:** TASK-002, TASK-003.

**References:** `architecture.md` §2 (Supabase clients), §7.

**Activities:**
- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Configure the browser client.
- Configure the server client with cookie-based session handling.
- Add the session-refresh proxy (`proxy.ts`; `middleware.ts` before Next.js 16).
- Add a server helper that returns the current user using `getClaims()` (or `getUser()`), never `getSession()`.
- Read the Supabase URL and publishable key from `.env.local` (`architecture.md` §11).
- Add a shared test setup guard that aborts any automated test whose Supabase URL is not the local test stack.
- Add integration tests against the local test stack: signup through the Auth service creates an empty profile (TASK-006), and two parallel `finish_onboarding` calls create exactly one business while the other receives `onboarding_already_completed` (TASK-009).

**Acceptance criteria:**
- Browser and server clients connect to the Supabase project configured in `.env.local`; automated tests connect only to the local test stack.
- The proxy refreshes session cookies.
- The server helper returns no user when there is no valid session.
- No service-role key is referenced in application code or `NEXT_PUBLIC_*` variables.

**Tests:**
- Verify client initialization against the local stack.
- Verify the server helper with and without a session.
- Verify session cookies are refreshed by the proxy.
- The test setup guard aborts when given a non-local Supabase URL.

---

#### TASK-019: Implement the internationalization foundation

**Status:** Done (2026-11-08). next-intl 4.14 without i18n routing. The root layout reads the language cookie and exports `instant = false` (Cache Components). Verified against the production server: no cookie and invalid values render Spanish, `locale=en` renders English, and `<html lang>` matches. Unit tests cover `isLocale`, the resolver with stubbed stores, the Server Action (cookie attributes, invalid values ignored), key parity and the industry and error keys. Switching language in a browser (refresh, persistence across browser restarts, onboarding state kept) is verified by the TASK-017 end-to-end tests, the first ones that drive a browser.

**Objective:** Provide Spanish and English translations with a browser-local language preference, ready to move to the user's profile later.

**Dependencies:** TASK-002, TASK-020 (the language selector uses the design system).

**References:** `requirements.md` FR-13; `specification.md` SPEC-I18N-01 to SPEC-I18N-07; `architecture.md` §9.

**Activities:**
- Install next-intl and configure it without i18n routing (no locale in URLs).
- Create `i18n/config.ts` with `SUPPORTED_LOCALES`, `DEFAULT_LOCALE = 'es'`, the `Locale` type and `isLocale()`.
- Create `i18n/preference.ts` with the `LocalePreferenceStore` interface and the cookie implementation (`locale` cookie; `Path=/`, `SameSite=Lax`, one-year `Max-Age`; no `Secure` attribute, because the application is served over `http://localhost`).
- Create `i18n/resolve.ts` (ordered list of stores, fallback to `es`) and the next-intl request configuration that uses it.
- Create the `setLocalePreference` Server Action, which validates the locale and writes it to every configured store.
- Add `NextIntlClientProvider` and `<html lang>` to the root layout.
- Build the language selector (Español / English), available on every page.
- Create `messages/es.json` and `messages/en.json` with the namespaces in `architecture.md` §9, including `industries.*`, `status.*`, `errors.*` for every database contract code, `errors.auth.*` and `errors.generic`.
- Derive message key types from `es.json`.
- Add a key-parity unit test to CI.

**Acceptance criteria:**
- Without a preference, every page is rendered in Spanish on the server, with no language flicker after loading.
- Selecting a language re-renders the current page in that language, and the choice persists across reloads and browser restarts.
- An invalid cookie value falls back to Spanish.
- `<html lang>` matches the displayed language.
- Only `i18n/preference.ts`, `i18n/resolve.ts` and `i18n/actions.ts` know where the preference is stored.
- `es.json` and `en.json` contain identical keys.
- No language data is written to the database.

**Tests:**
- Unit: `isLocale`; resolver with a valid, invalid and missing cookie.
- Unit: resolver with a stubbed list of stores, showing that a new store can be added without changing callers.
- Unit: key parity between `es.json` and `en.json`.
- Integration: server-rendered HTML is in English when the cookie is `en`, and in Spanish otherwise.
- Switch language, then reload and restart the browser context.

---

#### TASK-020: Define the UX and visual design system

**Status:** Done (2026-11-08). Design approved (prototype and summary in `architecture.md` §2, Visual Design). Tokens in `app/globals.css` (the default Tailwind palette is removed), Inter self-hosted with `@fontsource-variable/inter`, primitives in `components/ui/` (Button, TextField, SelectField, RadioCards, ProgressSteps, StatusBadge, FormAlert, PageIntro) and layouts in `components/layout/` (AuthLayout, OnboardingLayout). Unit tests cover the accessible names and states. The visual review in Spanish and English happens on the real screens (TASK-011, TASK-014 to TASK-016).

**Objective:** Define the interaction and visual design before any screen is built, so the whole application follows one deliberate system inspired by Apple's onboarding (`requirements.md` NFR-07).

**Dependencies:** TASK-002.

**References:** `requirements.md` NFR-07; `specification.md` (all screens and states).

**Activities:**
- Propose a design direction for approval: principles, layout, type scale, color tokens, spacing, radii, motion, and copy tone in Spanish and English.
- Specify each screen and its states: login, register, forgot password, update password, onboarding Page 1 and Page 2 (progress, going back, the establishment question as two explicit choices with none preselected), dashboard, loading, error and empty states, and the language selector.
- Specify form behavior: label placement, when inline validation appears, where errors are shown, and pending and disabled states.
- Choose the typeface. It is self-hosted, so the running application does not depend on a remote font service.
- After approval, implement the design tokens in `app/globals.css` (Tailwind theme) and the base primitives used by later UI tasks (for example button, text field, choice group, progress indicator, page layout).

**Acceptance criteria:**
- The developer approves the design direction before TASK-011 starts.
- Tokens and primitives exist, and later UI tasks use them instead of ad-hoc styles.
- Primitives meet WCAG 2.2 AA: contrast, visible focus, keyboard operation, labelled fields and errors, and reduced motion when the user prefers it.
- The design avoids generic template aesthetics (decorative gradients, emoji, filler copy, unmodified component-library styling).

**Tests:**
- Unit: primitives expose accessible names and states (for example `aria-invalid` and `aria-describedby` on a field with an error).
- Manual review of each primitive in Spanish and English, with the keyboard and with reduced motion.

---

### Phase 2 — Database and security

Each task writes its pgTAP tests first. Each migration includes its RLS, policies and privileges (`database.md` §10).

#### TASK-005: Create the updated_at function and the profiles table

**Status:** Done (2026-11-08). The `age` column, `profiles_age_check` and `invalid_age` were later replaced by the date of birth (TASK-021).

**Objective:** Store personal information with validity and access rules enforced by the database.

**Dependencies:** TASK-003.

**References:** `database.md` §3.1, §3.3, §6.2, §7.2, §8.1, §8.2, §8.4, §10.

**Activities:**
- Migration `create_updated_at_function`: `public.handle_updated_at()` (SECURITY INVOKER, `search_path = ''`), EXECUTE revoked.
- Migration `create_profiles`:
  - Create the table with named constraints `profiles_full_name_check`, `profiles_age_check` and `profiles_completion_requires_personal_info`.
  - Add the foreign key to `auth.users` with `ON DELETE CASCADE`.
  - Add the `profiles_set_updated_at` trigger.
  - Enable RLS; create `profiles_select_own` and `profiles_update_own_before_completion`.
  - Revoke all from `anon` and `authenticated`; grant SELECT and UPDATE (`full_name`, `age`) to `authenticated`.

**Acceptance criteria:**
- `full_name` and `age` can be NULL before onboarding completion.
- Untrimmed, empty, whitespace-only or longer-than-100-character full names are rejected on every write path.
- Ages outside 16–100 are rejected.
- `onboarding_completed_at` cannot be set while `full_name` or `age` is NULL.
- Users can read only their own profile; `anon` has no access.
- `authenticated` can update only `full_name` and `age`, only on their own row, and only while onboarding is incomplete.
- Direct updates to `id`, `onboarding_completed_at`, `created_at` and `updated_at` are denied.
- Clients cannot insert or delete profiles.
- `updated_at` changes on update.
- RLS, policies and grants are in the creation migration.

**Tests (pgTAP):**
- Constraint checks as the table owner: valid values, boundaries (1 and 100 characters; ages 16 and 100), invalid values, untrimmed values.
- Completion invariant: setting completion with NULL personal information fails; setting personal information to NULL after completion fails.
- Privilege assertions (`has_table_privilege`, `has_column_privilege`) for `anon` and `authenticated`.
- Direct update (Path B) as `authenticated`: own row before completion succeeds with trimmed values; untrimmed value fails with `23514`; another user's row is unaffected; `onboarding_completed_at` update fails with `42501`; after completion, the update affects 0 rows.
- SELECT isolation with two users; `anon` SELECT denied.
- `updated_at` trigger fires on an update performed as `authenticated`.

---

#### TASK-006: Create the profile creation trigger

**Status:** Done (2026-11-08). pgTAP cannot assume the Auth service role (`supabase_auth_admin`), so signup through the Auth service is verified by the TASK-004 integration test.

**Objective:** Create a profile automatically when a user registers.

**Dependencies:** TASK-005.

**References:** `database.md` §6.1, §8.4, §8.5.

**Activities:**
- Migration `create_profile_trigger`:
  - Create `public.handle_new_user()` as SECURITY DEFINER with `search_path = ''`, fully qualified names, trigger-context validation and `NEW.id` as the only identity source.
  - Create `on_auth_user_created` AFTER INSERT on `auth.users` FOR EACH ROW.
  - Backfill profiles for existing Auth users.
  - Revoke EXECUTE from PUBLIC, `anon` and `authenticated`.

**Acceptance criteria:**
- Every newly registered user receives exactly one profile.
- The profile ID matches `auth.users.id`; `full_name`, `age` and `onboarding_completed_at` are NULL.
- Profile creation is part of the signup transaction.
- Deleting the Auth user deletes the associated profile.
- The function cannot be executed by `anon` or `authenticated`.
- The backfill creates missing profiles and is idempotent.

**Tests (pgTAP):**
- Insert an Auth user and verify the profile.
- Delete the Auth user and verify the profile is removed.
- Verify duplicate profiles cannot be created.
- Assert `prosecdef`, `search_path` and EXECUTE privileges.

---

#### TASK-007: Create the businesses table

**Status:** Done (2026-11-08).

**Objective:** Store one business per user, written only through the controlled onboarding operation.

**Dependencies:** TASK-005.

**References:** `database.md` §3.2, §3.3, §4, §8.3.

**Activities:**
- Migration `create_businesses`:
  - Create the table with `businesses_user_id_key`, `businesses_name_check`, `businesses_industry_check` and `businesses_status_check`.
  - Add the foreign key to `profiles` with `ON DELETE CASCADE`.
  - Add the `businesses_set_updated_at` trigger.
  - Enable RLS; create `businesses_select_own`.
  - Revoke all from `anon` and `authenticated`; grant SELECT to `authenticated`.

**Acceptance criteria:**
- A user can have at most one business.
- A business must belong to an existing profile.
- Business names are trimmed and have 1–120 characters.
- Only supported industry codes are accepted.
- Only `planning` and `active` are valid statuses.
- Users can read only their own business; `anon` has no access.
- Clients cannot insert, update or delete businesses.
- Deleting an Auth user deletes their business (cascade through the profile).
- RLS, policies and grants are in the creation migration.

**Tests (pgTAP):**
- As the table owner: insert a valid business; a second business for the same user fails with `23505` on `businesses_user_id_key`; invalid status, industry and name fail with `23514` and the expected constraint name.
- As `authenticated`: INSERT, UPDATE and DELETE are denied.
- SELECT isolation with two users; `anon` denied.
- Cascade deletion from `auth.users`.
- `updated_at` trigger fires on a privileged update.

---

#### TASK-008: Implement save_personal_information

**Status:** Done (2026-11-08). The `age` column, `profiles_age_check` and `invalid_age` were later replaced by the date of birth (TASK-021).

**Objective:** Save Page 1 through the controlled, normalizing write path.

**Dependencies:** TASK-005.

**References:** `database.md` §7.1, §7.2, §7.3, §7.5, §8.4.

**Activities:**
- Migration `create_save_personal_information`:
  - SECURITY INVOKER, `search_path = ''`, fully qualified names.
  - Implement the behavior in §7.3, including trimming, the completion check, constraint translation and the zero-row check.
  - Revoke EXECUTE from PUBLIC and `anon`; grant to `authenticated`.

**Acceptance criteria:**
- Saves trimmed values for the caller only; the function has no user ID parameter.
- Missing or invalid values produce `invalid_full_name` or `invalid_age`.
- After completion, the call raises `onboarding_already_completed` and data is unchanged.
- A caller without a profile receives `profile_not_found`.
- `onboarding_completed_at` is never modified.
- `anon` cannot execute the function.

**Tests (pgTAP):**
- Valid save, including trimming (`'  Ana  '` → `'Ana'`).
- Empty, whitespace-only and 101-character names → `invalid_full_name`; 1- and 100-character names accepted.
- Ages 15, 101 and NULL → `invalid_age`; 16 and 100 accepted.
- Completed user → `onboarding_already_completed`, data unchanged.
- User A's call never changes user B's profile.
- `anon` execution denied.

---

#### TASK-009: Implement finish_onboarding

**Status:** Done (2026-11-08). Concurrency was verified with two parallel database sessions (one business; the second call received `onboarding_already_completed`). The automated version is part of the TASK-004 integration tests, which need the Supabase client and the test guard.

**Objective:** Create the business and complete onboarding atomically.

**Dependencies:** TASK-006, TASK-007.

**References:** `database.md` §7.1, §7.4, §7.5, §8.4, §8.5.

**Activities:**
- Migration `create_finish_onboarding`:
  - SECURITY DEFINER, `search_path = ''`, fully qualified names, `auth.uid()` validated and captured once.
  - Receive `p_business_name`, `p_industry` and `p_status`.
  - Implement the behavior in §7.4: argument checks, trimming, `FOR UPDATE` lock, completion and personal-information checks, business insert with constraint translation, completion timestamp, return the business ID.
  - Revoke EXECUTE from PUBLIC and `anon`; grant to `authenticated`.

**Acceptance criteria:**
- Business creation and onboarding completion succeed together or fail together.
- The business is stored with the trimmed name and the status sent by the client.
- Every failure produces a code from the error contract, and nothing is persisted.
- A repeated call raises `onboarding_already_completed` and creates no business.
- Concurrent calls create exactly one business.
- The industry list does not appear in the function body.
- Only `authenticated` can execute the function.

**Tests (pgTAP unless noted):**
- Both statuses (`planning`, `active`).
- Each invalid input: name (empty, whitespace-only, 121 characters), unknown industry, invalid status, NULL arguments.
- Personal information missing → `personal_info_incomplete`.
- Profile missing → `profile_not_found`.
- Repeated call → `onboarding_already_completed`.
- Rollback: with a business inserted by the table owner while onboarding is incomplete, the call raises `business_already_exists` and `onboarding_completed_at` stays NULL.
- `anon` execution denied; no user ID parameter exists.
- Assert `prosecdef`, `search_path` and EXECUTE privileges.
- Concurrency (integration test against the local stack): two parallel calls create exactly one business; the other receives `onboarding_already_completed`.

---

#### TASK-010: Verify database security, apply migrations and generate types

**Status:** Done (2026-11-08). 262 pgTAP tests pass locally. The six migrations are applied to the project and `supabase migration list` matches. Advisors: security reports only the accepted `finish_onboarding` warning; performance reports nothing. Read-only catalog checks on the project match §8. Types: `lib/supabase/database.types.ts` (`npm run db:types`).

**Objective:** Prove the complete database security model on the local test stack, apply the migrations to the Supabase project and provide typed access for the frontend.

**Dependencies:** TASK-008, TASK-009.

**References:** `database.md` §5, §8, §10, §12; `architecture.md` §11 (migration workflow).

**Activities:**
- Build a consolidated security suite with two users and `anon` across all tables and functions (local test stack).
- Assert the privilege catalog: `anon` has no table or function privileges; `authenticated` has only the privileges in §8.
- Assert that only the two documented functions are SECURITY DEFINER and that every function sets `search_path = ''`.
- Apply the migrations to the Supabase project following the migration workflow: `supabase db push --linked --dry-run`, review, then `supabase db push --linked`.
- Confirm with `supabase migration list` that the local and remote histories match.
- Run the Supabase security and performance advisors on the Supabase project; document accepted warnings.
- Generate TypeScript types with `supabase gen types typescript --local` and commit them.

**Acceptance criteria:**
- User A cannot read or modify User B's profile or business.
- `anon` cannot access any application table or function.
- Users cannot modify protected onboarding fields or write businesses directly.
- All migrations are applied to the Supabase project, and `supabase migration list` shows no differences.
- The only accepted advisor warning is `finish_onboarding` being executable by `authenticated`.
- Generated types are committed and regenerating them produces no diff.

**Tests:**
- Execute SELECT, INSERT, UPDATE and DELETE as two different users and as `anon`.
- Verify function permissions and that functions act only on the authenticated identity.
- Verify every row of the `database.md` §5 enforcement table is covered by at least one test.

---

#### TASK-021: Replace age with date of birth

**Status:** Done (2026-11-08). Migration 7 is applied to the project and `supabase migration list` matches; the read-only catalog checks match `database.md` §8; advisors unchanged (only the accepted `finish_onboarding` warning).

**Objective:** Collect the date of birth instead of the age (`requirements.md` FR-06), keeping the 16–100 rule enforced by the database on every write path.

**Dependencies:** TASK-010.

**References:** `database.md` §3.1, §5, §6.3, §7.2–§7.5, §8.2, §8.4, §10 (migration 7).

**Activities:**
- Update the pgTAP tests first (TASK-005, TASK-008, TASK-009 and TASK-010 suites) for `birth_date`, the §6.3 trigger and `invalid_birth_date`.
- Migration `replace_age_with_birth_date`: add `birth_date`, replace the completion constraint, drop `age` (and with it `profiles_age_check` and its column grant), grant UPDATE (`birth_date`), create `validate_profile_birth_date` and `profiles_validate_birth_date`, recreate `save_personal_information(text, date)`, and update `finish_onboarding`.
- Update the integration tests, regenerate the types, and apply the migration to the project with the migration workflow.

**Acceptance criteria:**
- Dates of birth giving ages 16 and 100 today are accepted; 15 and 101 are rejected with `invalid_birth_date` through the function and with `23514` through a direct update.
- Re-saving the same date does not re-evaluate it; inserts never evaluate it.
- `finish_onboarding` requires `full_name` and `birth_date`.
- The project's migration history matches, and the privilege catalog matches `database.md` §8.

---

### Phase 3 — Authentication

#### TASK-011: Implement registration and login

**Status:** Done (2026-11-08). `/register` and `/login` use Server Actions (`app/(auth)/actions.ts`) with `useActionState`; validation runs in the action and returns translation keys; the email is kept and focus moves to the first invalid field. Unit tests cover validation and the Auth error mapping (unknown codes → generic); integration tests confirm the Auth codes the app maps (duplicate, short password, invalid credentials, no email confirmation). A one-off browser run against the local stack (Chromium, Playwright) verified both flows, both languages and phone width; the automated end-to-end suite is TASK-017. `/onboarding` is a placeholder until TASK-014, and signed-in users are not yet redirected away from `/login` (TASK-013).

**Objective:** Allow users to create accounts and authenticate.

**Dependencies:** TASK-004, TASK-010, TASK-019.

**References:** `specification.md` SPEC-AUTH-01 to SPEC-AUTH-04, SPEC-AUTH-10, SPEC-I18N-07; `architecture.md` §3, §9.

**Activities:**
- Create the registration page.
- Create the login page.
- Validate email format and password length (at least 8 characters).
- Implement registration with `signUp` and login with `signInWithPassword`.
- Display validation and authentication errors (duplicate email, invalid credentials) through translation keys. Map Supabase Auth error codes (for example `user_already_exists`, `invalid_credentials`, `weak_password`) to `errors.auth.*`; never display Supabase's own message.
- After registration, redirect to `/onboarding`; after login, redirect according to onboarding status.
- Keep email confirmation disabled for the MVP.

**Acceptance criteria:**
- A user can register with email and password.
- Passwords shorter than 8 characters are rejected by the frontend and by Supabase.
- Successful registration creates a profile and redirects to `/onboarding`.
- A user can log in with valid credentials and is redirected according to onboarding status.
- Invalid credentials and duplicate emails produce understandable errors.
- Authentication state is available to server-side checks.

**Tests:**
- Successful registration.
- Duplicate email registration.
- Password shorter than 8 characters.
- Successful login (incomplete and completed users).
- Invalid login.
- Empty fields and invalid input.
- Validation and authentication error messages in Spanish and English.
- An unknown Supabase Auth error code shows the generic message.

---

#### TASK-012: Implement logout, session persistence and password recovery

**Objective:** Support persistent sessions, logout and account recovery.

**Dependencies:** TASK-011.

**References:** `specification.md` SPEC-AUTH-05 to SPEC-AUTH-09; `architecture.md` §3.

**Activities:**
- Implement logout with `signOut`.
- Handle session restoration after refresh and browser restart.
- Handle expired sessions (redirect to `/login`).
- Implement `/forgot-password` with `resetPasswordForEmail` and a neutral confirmation message.
- Implement the `/auth/confirm` route handler: call `exchangeCodeForSession` with the `code`, redirect to `/update-password` on success and to `/forgot-password?error=<code>` on failure, including the `error_code` Supabase sends for expired links; no redirect target from the query string.
- On `/forgot-password`, map the `error` query parameter to a translated message; never display text taken from the URL.
- Implement `/update-password` with `updateUser` (at least 8 characters), then redirect according to onboarding status.

**Acceptance criteria:**
- A logged-in user remains authenticated after refreshing and after restarting the browser.
- Logging out revokes the refresh token and clears the session cookies.
- The recovery confirmation message does not reveal whether the email is registered.
- A recovery link opened in a different browser from the one that requested it shows an error and allows requesting a new link.
- Invalid or expired links show an error and allow requesting a new link.
- After resetting, the new password works and the old one does not.

**Tests:**
- Refresh with an active session.
- Logout and attempt to reuse the session.
- Complete password recovery in the same browser context, using the local email testing UI; the same link in a separate browser context shows the error.
- Open an invalid and an expired recovery link.
- Open `/auth/confirm` without a code.
- The recovery email contains Spanish and English text.
- An arbitrary `error` query parameter value shows the generic message, not the value.
- The language preference is kept after logout.

---

#### TASK-013: Implement route protection and the dashboard shell

**Objective:** Ensure users access only the correct pages before onboarding pages are built.

**Dependencies:** TASK-012.

**References:** `specification.md` SPEC-ROUTE-01 to SPEC-ROUTE-05; `architecture.md` §7.

**Activities:**
- Configure the proxy to redirect unauthenticated requests for protected routes to `/login`.
- Implement the shared server helper that validates the user and reads `onboarding_completed_at`.
- Call the helper from every page whose access depends on state (not only from layouts).
- Implement `/` redirects.
- Create a placeholder dashboard page.

**Acceptance criteria:**
- Every cell of the route access matrix (SPEC-ROUTE-05) behaves as specified, including `/`, `/login`, `/register`, `/forgot-password`, `/auth/confirm` and `/update-password`.
- Authorization decisions on the server use validated claims, never `getSession()`.
- Direct URL access and page refreshes follow the matrix.

**Tests:**
- Test every route in each of the three user states.
- Attempt direct URL access.
- Refresh protected pages.
- Verify redirects with and without active sessions.

---

### Phase 4 — Onboarding

#### TASK-014: Implement the personal information page

**Objective:** Collect and persist the user's personal information (Page 1).

**Dependencies:** TASK-008, TASK-013, TASK-021.

**References:** `specification.md` SPEC-ONB-01 to SPEC-ONB-04, SPEC-ERR-01; `architecture.md` §8.

**Activities:**
- Build `/onboarding` as one route with two client-side steps, always starting at Page 1.
- Load the saved profile and pre-populate the form.
- Add full name and date of birth inputs (native date input).
- Validate: trimmed full name of 1–100 characters (counted in code points); a date of birth giving an age of 16–100 years today.
- Call `save_personal_information` when the user selects Next.
- Implement the error-mapping module: database contract codes map to `errors.<code>` translation keys, anything else to `errors.generic`. The module returns keys, not text.

**Acceptance criteria:**
- Onboarding always starts at Page 1 with previously saved values, including after a refresh on Page 2.
- Both fields are required.
- Invalid names and dates of birth cannot be saved.
- Information is persisted trimmed after selecting Next.
- Contract errors show their mapped message; other errors show a generic message.
- The user cannot proceed with invalid information.

**Tests:**
- Empty name and whitespace-only name.
- Name with 101 characters.
- Empty date of birth; dates giving ages 15 and 101 are rejected; ages 16 and 100 are accepted (boundary dates computed from today).
- Valid information, including surrounding whitespace that is trimmed.
- Restore saved information after leaving and returning.
- Error-mapping unit tests for every contract code.
- Validation and error messages in Spanish and English.
- Change language with values entered: the step and values are kept.

---

#### TASK-015: Implement the business information page

**Objective:** Collect business information and complete onboarding (Page 2).

**Dependencies:** TASK-009, TASK-014.

**References:** `specification.md` SPEC-BIZ-01 to SPEC-BIZ-07, SPEC-ONB-05 to SPEC-ONB-09, SPEC-DATA-02; `architecture.md` §8; `database.md` §4, §7.4.

**Activities:**
- Build Page 2 within `/onboarding`.
- Add the business name input.
- Add the industry selection from the `INDUSTRIES` constant (codes in display order), with names from `industries.<code>` in the current language; codes are submitted.
- Add the establishment question (Yes/No, no default).
- Implement `statusFromEstablishment`.
- Add a Back action to Page 1.
- Validate required fields and the 1–120 character business name.
- Call `finish_onboarding` when the user selects Finish; disable Finish while the request is in flight.
- Redirect to `/dashboard` on success or on `onboarding_already_completed`; otherwise show the mapped error and stay on Page 2.

**Acceptance criteria:**
- Business name is required and has 1–120 characters after trimming.
- Industry is required and must be supported.
- Establishment answer is required and not preselected.
- Answering Yes creates a business with status `active`; answering No creates one with status `planning`.
- Business creation and onboarding completion are atomic.
- A repeated or concurrent Finish results in one business and a redirect to the dashboard.
- A failed call leaves onboarding incomplete.
- Every code in `INDUSTRIES` is accepted by the database and has a display name in both languages.
- Changing language on Page 2 keeps the step and the entered values.

**Tests:**
- Unit: `statusFromEstablishment` (Yes → `active`, No → `planning`).
- Empty business name; 121-character name; missing industry; missing establishment answer.
- Integration against the local stack: every `INDUSTRIES` code is accepted; an unknown code returns `invalid_industry`.
- Failed RPC → onboarding remains incomplete.
- Complete onboarding twice → redirected to the dashboard, one business.
- Back to Page 1 and forward again.
- Industry names and error messages in Spanish and English.
- Change language on Page 2 with values entered: the step and values are kept.

---

#### TASK-016: Implement the dashboard

**Objective:** Show the user's business after onboarding.

**Dependencies:** TASK-015.

**References:** `specification.md` SPEC-DASH-01.

**Activities:**
- Read the user's business through the RLS-protected SELECT.
- Display business name, industry display name (`industries.<code>`) and status label (`status.<status>`) in the current language.

**Acceptance criteria:**
- The dashboard shows the user's own business name, industry and status.
- Industry and status labels follow the selected language; the business name is shown as entered.
- The dashboard never shows another user's data.

**Tests:**
- Dashboard for a `planning` and an `active` business.
- Dashboard in Spanish and English.
- Two users see only their own business.

---

### Phase 5 — End-to-end validation and final Supabase validation

#### TASK-017: Validate the complete user journey

**Objective:** Verify that all features work together.

**Dependencies:** TASK-016 (and transitively TASK-001 through TASK-015).

**Activities:**
- Create Playwright end-to-end tests.
- Test registration through dashboard.
- Test onboarding abandonment after Page 1.
- Test session restoration.
- Test password recovery through the local email testing UI.
- Test invalid input and failed operations.
- Test data isolation with multiple users.
- Test language: Spanish by default, switching to English, persistence after reload, browser restart and logout, and switching during onboarding.
- Fix regressions.

**Acceptance criteria:**
- A new user can register, complete onboarding and reach the dashboard, in Spanish and in English.
- Without a stored preference the interface is Spanish; a chosen language persists in the same browser.
- A user who abandons onboarding after Page 1 resumes at Page 1 with saved values.
- A completed user cannot repeat onboarding or edit personal information.
- A user can recover their password and log in with the new one.
- Data remains isolated between users.
- Critical user journeys pass end-to-end tests against the local test stack, locally and in CI.

---

#### TASK-018: Finalize and validate the Supabase project

**Objective:** Confirm that the single Supabase project is fully configured, secured and working with the locally run application. Nothing is deployed.

**Dependencies:** TASK-017.

**References:** `architecture.md` §3, §11; `database.md` §8, §10, §12; `requirements.md` AR-03 to AR-05.

**Activities:**
- Apply any pending migrations through the migration workflow, including a database dump stored outside the repository if the project holds data.
- Confirm with `supabase migration list` that the local and remote histories match, and with `supabase db diff --linked` that there is no schema drift.
- Verify the project's auth settings match `config.toml`: email confirmation disabled, minimum password length 8, Site URL `http://localhost:3000`, redirect URLs, default email templates, built-in email service.
- Run the Supabase security and performance advisors.
- Run read-only catalog checks on the project: RLS enabled on both tables, the expected policies, table, column and function privileges, and the two SECURITY DEFINER functions with `search_path = ''`.
- Run a manual smoke test with the application running locally against the project: registration, onboarding with both statuses (two accounts), dashboard, logout, login, password recovery to an organization member's address, and language switching.
- Delete the smoke-test accounts (the cascade removes their profiles and businesses).
- Confirm that no secret is tracked by Git and that `.env.local` is ignored.
- Document in the README how to run the application locally, configure `.env.local`, apply future migrations and back up the database.
- Record the project's plan limits that affect the application (email rate limit; pausing on inactivity if on the Free plan).

**Acceptance criteria:**
- All migrations are applied and there is no schema drift.
- The project's auth settings match the documented configuration.
- The advisors report no warnings other than the accepted `finish_onboarding` warning.
- RLS, policies, privileges and function security attributes on the project match `database.md` §8.
- The complete user journey works locally against the project, in Spanish and English.
- No secrets are committed; the application uses only the project URL and publishable key.
- The local run, migration and backup procedures are documented.

## 3. Task dependency summary

| Task | Title | Depends on |
|---|---|---|
| TASK-001 | Reconcile design documents | None |
| TASK-002 | Initialize the application | TASK-001 |
| TASK-003 | Supabase tooling, project link and database tests | TASK-001 |
| TASK-004 | Supabase clients and session handling | TASK-002, TASK-003 |
| TASK-020 | UX and visual design system | TASK-002 |
| TASK-019 | Internationalization foundation | TASK-002, TASK-020 |
| TASK-005 | updated_at function and profiles table | TASK-003 |
| TASK-006 | Profile creation trigger | TASK-005 |
| TASK-007 | businesses table | TASK-005 |
| TASK-008 | save_personal_information | TASK-005 |
| TASK-009 | finish_onboarding | TASK-006, TASK-007 |
| TASK-010 | Database security, migration push and types | TASK-008, TASK-009 |
| TASK-021 | Replace age with date of birth | TASK-010 |
| TASK-011 | Registration and login | TASK-004, TASK-010, TASK-019 |
| TASK-012 | Logout, session persistence and recovery | TASK-011 |
| TASK-013 | Route protection and dashboard shell | TASK-012 |
| TASK-014 | Personal information page | TASK-008, TASK-013, TASK-021 |
| TASK-015 | Business information page | TASK-009, TASK-014 |
| TASK-016 | Dashboard | TASK-015 |
| TASK-017 | End-to-end validation | TASK-016 |
| TASK-018 | Final Supabase configuration and validation | TASK-017 |

Tasks that can run in parallel:

- TASK-002 and TASK-003.
- TASK-004, TASK-020 and the database tasks TASK-005 to TASK-010; TASK-019 after TASK-020.
- TASK-006, TASK-007 and TASK-008.

## 4. Implementation workflow

For each task, follow this cycle:

1. Read the relevant requirements, specification, architecture and database sections listed in the task.
2. Understand the expected behavior.
3. Write the failing test (RED). For database tasks, write pgTAP tests and run `supabase db reset && supabase test db`.
4. Implement the minimum code required to pass (GREEN).
5. Refactor without changing behavior (REFACTOR).
6. Run the relevant test suite.
7. Verify acceptance criteria.
8. Mark the task as completed.

## 5. Task completion checklist

A task can be marked as completed only when:

- [ ] Implementation is finished.
- [ ] Acceptance criteria are satisfied.
- [ ] Relevant tests pass locally and in CI.
- [ ] No unrelated functionality was introduced.
- [ ] Documentation is updated if necessary.
- [ ] Changes have been reviewed.

## 6. Scope control

The following are explicitly outside this implementation:

- Multiple businesses per user.
- Branch and location management.
- Google Maps integration.
- Business team management.
- Advanced roles and permissions.
- Analytics and reporting.
- External business integrations.
- Business status changes after onboarding.
- Editing business information after onboarding.
- Editing personal information after onboarding.
- Self-service account deletion.
- Storing the language preference in the database or synchronizing it across devices.
- Languages other than Spanish and English, automatic language detection and language prefixes in URLs.
- Translated or customized authentication emails.
- Deploying or hosting the application.
- Separate development, staging or production Supabase projects.
- Remote services other than Supabase, including a custom SMTP provider.

Any new feature must first be evaluated against the requirements and specification before implementation.
