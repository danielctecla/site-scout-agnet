# Requirements — Business Management Application

**Version:** 0.7  
**Status:** Updated  
**Last updated:** 2026-11-08  
**Scope:** Authentication and Business Onboarding MVP

## 1. Project Overview

The application allows business owners and aspiring business owners to create an account and register their business.

The MVP includes authentication, personal information collection, business onboarding, and protected dashboard access.

A business does not need to have a physical establishment to be registered. Users can register a business that is still in the planning stage.

## 2. User Types

- **Unauthenticated User:** A visitor who has not logged in.
- **Authenticated User:** A user with a valid session.
- **Onboarding User:** An authenticated user who has not completed onboarding.
- **Active User:** An authenticated user who has completed onboarding and can access the dashboard.

## 3. Functional Requirements

### FR-01 — User Registration

- Users must be able to register using email and password.
- Passwords must contain at least 8 characters.
- Email confirmation is not required for the MVP.
- Duplicate email registrations must be rejected with an explicit error (see AR-01).
- A successful registration must create an authenticated session when Supabase is configured without email confirmation.
- A successful registration must create the user's initial profile.

### FR-02 — User Authentication

- Users must be able to log in using email and password.
- Invalid credentials must produce an appropriate error.
- Authenticated users must be redirected according to their onboarding status.

### FR-03 — Session Persistence

- User sessions must persist across browser restarts, subject to Supabase session expiration and refresh policies.
- The Supabase SDK must manage session refresh.

### FR-04 — Logout

- Users must be able to log out.
- Logging out must end the session in the browser and revoke its refresh token.
- After logout, protected routes must no longer be accessible.

### FR-05 — Password Recovery

- Users must be able to request password recovery through email.
- Supabase Auth must send the recovery link.
- The recovery link must be opened in the same browser where recovery was requested; otherwise it produces an appropriate error and allows the user to request a new link.
- Users must be able to establish a new password, of at least 8 characters, through the recovery flow.
- Invalid or expired recovery links must produce an appropriate error and allow the user to request a new link.
- Recovery emails are sent by Supabase's built-in email service, within the delivery limits accepted in AR-03, using Supabase's default email template.

### FR-06 — Personal Information Onboarding

The first onboarding page must collect:

- Full name.
- Age.

Requirements:

- Both fields are mandatory.
- Full name must contain 1–100 characters after removing leading and trailing whitespace.
- Age must be a whole number between 16 and 100, inclusive.
- Personal information must be stored trimmed (without leading or trailing whitespace).
- Personal information must be saved when the user clicks Next.
- Saved information must be restored when the user returns to onboarding.
- Personal information cannot be edited after onboarding is completed.

### FR-07 — Business Onboarding

The second onboarding page must collect:

- Business name.
- Business industry.
- Whether the business already has a physical establishment.

Requirements:

- All three fields are mandatory.
- Business name must contain 1–120 characters after removing leading and trailing whitespace, and must be stored trimmed.
- Business industry must be selected from the predefined categories (defined in `database.md` §4).
- The user must explicitly answer whether a physical establishment already exists; no answer is preselected.
- If the user has an establishment, the business is created with status `active`.
- If the user does not have an establishment, the business is created with status `planning`.
- No physical address or geographic location is required during onboarding.
- The user must be able to return to the previous page.
- Business information must be saved when the user clicks Finish.

### FR-08 — One Business Per User

- Each user can register only one business in the MVP.
- The database must enforce this restriction.

### FR-09 — Business Status

A business must have one of the following statuses:

- `planning`: The business has been registered but does not yet have a physical establishment.
- `active`: The business already has a physical establishment.

The status must be determined from the user's onboarding answer.

### FR-10 — Onboarding Completion

- Onboarding is complete only after personal information and business information have been successfully persisted.
- Business creation and onboarding completion must be atomic.
- Users must not be able to mark onboarding as complete without a valid business record.
- Repeated completion attempts (for example, a double click or a retry after a lost response) must not create another business and must leave the user with completed onboarding.

### FR-11 — Dashboard Access Control

- Unauthenticated users attempting to access the dashboard must be redirected to login.
- Authenticated users with incomplete onboarding must be redirected to onboarding.
- Authenticated users with completed onboarding must be allowed to access the dashboard.
- Authenticated users with completed onboarding who access onboarding must be redirected to the dashboard.
- The dashboard must display the user's business name, industry and status.

### FR-12 — Onboarding Persistence

- Onboarding is a single page with two steps (Page 1 and Page 2).
- Onboarding always starts at Page 1, pre-populated with previously saved values.
- Page 1 information must be saved when the user clicks Next.
- Page 2 information must be saved when the user clicks Finish.
- If the user leaves before clicking Finish, Page 2 information is not guaranteed to persist.

### FR-13 — Language

- The interface must be available in Spanish (`es`) and English (`en`).
- Spanish is the default language.
- Users must be able to change the language from any page, including before logging in.
- The language preference is stored locally in the browser; it is not stored in the database in the MVP.
- The preference must persist across reloads and browser restarts in the same browser, and is independent of the logged-in account.
- All user-facing text must be translated, including page titles, validation and error messages, industry names and status labels.
- Changing the language during onboarding must keep the current step and the values entered.
- Authentication emails use Supabase's default template and are not translated.
- The design must allow moving the preference to the user's profile and synchronizing it across devices later, without changing translation files or UI components.

## 4. Non-Functional Requirements

### NFR-01 — Authentication

Supabase Auth must manage user identity, password storage, and sessions.

### NFR-02 — Data Security

- Users must only access their own profile and business information.
- PostgreSQL Row Level Security (RLS) must enforce data isolation.
- Frontend validation must not be the only security mechanism.
- Data validity rules (required values, lengths, trimming, ranges, categories and statuses) must be enforced by database constraints, regardless of the write path used.
- Users must not be able to mark onboarding as complete or write business records directly; these changes occur only through controlled database operations.
- Database privileges must follow least privilege: unauthenticated clients have no access to application tables or functions, and authenticated clients receive only the privileges they need.
- Database objects must be protected (RLS, policies and privileges) from the moment they are created.

### NFR-03 — Reliability

- Database operations that complete onboarding must be atomic.
- Failed operations must not leave partially completed onboarding records.
- Retried operations must not create duplicate records.

### NFR-04 — Maintainability

- Database changes must be version-controlled through migrations.
- Authentication and database responsibilities must remain separated.
- The MVP must avoid unnecessary backend services.
- Each business rule must have a single authoritative definition in the database. Any application copy (such as the industry list) must be verified against the database by automated tests.
- Translations are maintained in one file per language with identical keys, verified by automated tests. Components must not hard-code user-facing text.

### NFR-05 — Testability

- Database constraints, RLS policies, privileges and functions must be covered by automated database tests.
- Critical user journeys must be covered by end-to-end tests.
- Continuous integration must run linting, type checking and tests on every change.

### NFR-06 — Environment and Secret Safety

- Secrets must never be committed. Local configuration lives in a git-ignored `.env.local`; `.env.example` documents the variables without real values.
- The application must use only the Supabase project URL and publishable key. It must never use the service-role key, secret API keys or the database password.
- Automated tests must never run against the Supabase project; they run against an ephemeral local test stack.
- Schema changes must reach the Supabase project only through version-controlled migrations that have passed the database tests.

### NFR-07 — User Experience and Visual Design

- User experience is a primary quality goal. The interface must feel calm, focused and polished, in the style of Apple's onboarding: one primary task per screen, a clear visual hierarchy, concise copy and smooth, purposeful transitions.
- The interface must avoid generic template aesthetics, such as decorative gradients, emoji, filler copy and unmodified component-library styling.
- Every screen follows a single documented design system (tokens and base components), approved by the developer before any UI is implemented (TASK-020).
- The interface must meet WCAG 2.2 AA: sufficient contrast, visible focus, full keyboard operation, labelled fields and errors, and reduced motion when the user prefers it.

## 5. Technical Constraints

- Frontend: Next.js and TypeScript, located at the repository root alongside `supabase/`, styled with Tailwind CSS.
- Runtime: the Next.js application runs only on the developer's computer (`http://localhost:3000`). It is not deployed or hosted.
- Backend: a single Supabase project is the only backend environment and the only remote service the application uses. There are no separate development and production projects.
- Tooling: Supabase CLI (migrations, linked project, local test stack, database tests) and Git version control.
- Authentication: Supabase Auth.
- Database: Supabase PostgreSQL.
- Data access: Supabase JavaScript SDK.
- Authorization: PostgreSQL RLS combined with table, column and function privileges.
- Personal information persistence: PostgreSQL function invoked through Supabase RPC.
- Business creation and onboarding completion: PostgreSQL function invoked through Supabase RPC.
- Internationalization: Spanish (default) and English; the language preference is stored only in the browser.
- Authentication emails: Supabase's built-in email service. No custom SMTP provider (it would add a second remote service; see AR-03).
- Business location management is outside the onboarding scope.

## 6. Out of Scope

The MVP will not include:

- Google Maps integration.
- Business address or geographic location collection.
- Multiple businesses per user.
- Multiple physical establishments or branches.
- Business invitations or team management.
- Advanced user roles and permissions.
- Business analytics.
- External business integrations.
- Editing or transitioning business status after onboarding.
- Editing business name or industry after onboarding.
- Editing personal information after onboarding.
- Self-service account deletion.
- Storing the language preference in the database or synchronizing it across devices.
- Languages other than Spanish and English.
- Automatic language detection from browser settings.
- Language prefixes in URLs.
- Translated or customized authentication emails.
- Deploying or hosting the application (Vercel, AWS or any other hosting service).
- Separate development, staging or production Supabase projects.
- Remote services other than Supabase, including a custom SMTP provider.

## 7. Accepted Risks

- **AR-01 — Account enumeration through registration.** Because duplicate registrations are rejected with an explicit error and email confirmation is disabled, a visitor can determine whether an email address is registered. Accepted for the MVP. Password recovery does not reveal whether an address is registered.
- **AR-02 — Access token lifetime after logout.** Supabase access tokens are stateless JWTs. A token issued before logout remains valid until it expires; the application discards it on logout and its refresh token is revoked. Accepted for the MVP.
- **AR-03 — Built-in email delivery limits.** Supabase's built-in email service delivers only to addresses that are members of the project's Supabase organization, and it has a low hourly rate limit. Password recovery therefore works only for those addresses. Accepted for the local-only scope, where accounts belong to the developer and organization members. Automated recovery tests use the local test stack's email testing UI instead.
- **AR-04 — Single backend environment.** The Supabase project holds the only real data and also receives every migration, with no separate environment to rehearse on. Mitigations: migrations are tested on the ephemeral local test stack first, reviewed with a dry run, and preceded by a database dump when data exists; the schema is never changed outside migrations; development tools access the project read-only.
- **AR-05 — Project availability.** If the Supabase project is on the Free plan, Supabase pauses it after a period of inactivity, and it must be resumed from the dashboard before the application can be used. Accepted for the MVP.

## 8. Definition of Done

The MVP is complete when:

- Users can register, log in, log out, and recover passwords, with the application running locally against the Supabase project.
- Sessions persist according to Supabase configuration.
- Users can complete both onboarding pages.
- Users can register a business in either `planning` or `active` status.
- Each user can have only one business.
- Onboarding data is persisted according to the defined page-level behavior.
- Personal information cannot be modified after onboarding is completed.
- Dashboard access is protected.
- The interface is available in Spanish (default) and English, and the language preference persists in the browser.
- Every screen follows the approved design system and meets WCAG 2.2 AA.
- RLS and database privileges prevent users from accessing other users' data.
- Database constraints preserve data integrity on every write path.
- Database security, constraints and critical user journeys are covered by automated tests that run in CI against the local test stack.
- All migrations are applied to the Supabase project, and its configuration has been validated.
- No secrets are committed to the repository.
