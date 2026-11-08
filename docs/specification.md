# Specification — Authentication, Business Onboarding & Location Evaluation

**Version:** 0.6  
**Status:** Updated  
**Last updated:** 2026-11-08

## 1. Purpose

Define the expected behavior of authentication, personal onboarding, business onboarding, dashboard access and Location Evaluation (§12).

This specification describes observable system behavior independently of implementation details.

Data rules (industry categories, constraints and database error codes) are defined in `database.md`; this document references them instead of restating them.

## 2. Authentication

### SPEC-AUTH-01 — Registration

**Given** a visitor who is not authenticated  
**When** they submit a valid email and a password of at least 8 characters  
**Then** the system creates an authentication account  
**And** creates the initial profile in the same database transaction  
**And** establishes an authenticated session  
**And** redirects the user to `/onboarding`.

### SPEC-AUTH-02 — Duplicate Registration

**Given** an email already registered  
**When** a visitor attempts to register with that email  
**Then** the system rejects the registration  
**And** displays an appropriate error.

This explicit error is an accepted account-enumeration risk (`requirements.md` AR-01).

### SPEC-AUTH-03 — Login

**Given** a registered user  
**When** they submit valid credentials  
**Then** the system establishes a session  
**And** redirects them to `/onboarding` or `/dashboard` according to their onboarding status.

### SPEC-AUTH-04 — Invalid Login

**Given** a visitor submitting invalid credentials  
**When** authentication is attempted  
**Then** the system rejects the request  
**And** displays an appropriate error.

### SPEC-AUTH-05 — Session Persistence

**Given** an authenticated user  
**When** they close and reopen the browser  
**Then** the session is restored if it remains valid under the configured Supabase session policies.

### SPEC-AUTH-06 — Logout

**Given** an authenticated user  
**When** they log out  
**Then** the session is terminated: its refresh token is revoked and the session cookies are cleared  
**And** protected routes require authentication again.

An access token issued before logout remains valid until it expires (`requirements.md` AR-02).

### SPEC-AUTH-07 — Password Recovery Request

**Given** a visitor on `/forgot-password`  
**When** they submit an email address  
**Then** Supabase sends a recovery email if the address is registered  
**And** the page displays the same confirmation message whether or not the address is registered.

The recovery email uses Supabase's default template, which is not translated.

Supabase's built-in email service delivers recovery emails only to addresses that are members of the Supabase organization, within its rate limit (`requirements.md` AR-03).

### SPEC-AUTH-08 — Password Recovery Link

**Given** a user who received a recovery email  
**When** they open the recovery link in the same browser where they requested it  
**Then** `/auth/confirm` verifies the link  
**And** establishes a session  
**And** redirects the user to `/update-password`.

The recovery link goes through Supabase, which redirects to `http://localhost:3000/auth/confirm`, so it opens the application only on the computer where it runs.

**Given** an invalid, expired or already used recovery link, or one opened in a different browser from the one where recovery was requested  
**When** the user opens it  
**Then** no session is established  
**And** the user is redirected to `/forgot-password` with an error message inviting them to request a new link.

### SPEC-AUTH-09 — Set New Password

**Given** a user with a session on `/update-password`  
**When** they submit a new password of at least 8 characters  
**Then** the password is updated  
**And** the user is redirected according to their onboarding status.

### SPEC-AUTH-10 — Password Policy

**Given** a visitor registering or a user setting a new password  
**When** the password has fewer than 8 characters  
**Then** the system rejects it  
**And** displays the corresponding validation error.

## 3. Personal Information Onboarding

### SPEC-ONB-01 — Display Onboarding

**Given** an authenticated user with incomplete onboarding  
**When** they access `/onboarding`  
**Then** the system displays Page 1, the first of two steps on the same route  
**And** requests full name and date of birth  
**And** pre-populates any previously saved values.

Onboarding always starts at Page 1, including after a page refresh while on Page 2.

### SPEC-ONB-02 — Validate Personal Information

**Given** the user is completing Page 1  
**When** they submit:

- a full name that is empty, whitespace-only, or longer than 100 characters after trimming, or
- a date of birth that is missing, not a valid date, or that gives an age outside 16–100 years (inclusive) on the current day

**Then** the system rejects the submission  
**And** displays the corresponding validation error  
**And** saves nothing.

### SPEC-ONB-03 — Save Personal Information

**Given** valid personal information  
**When** the user clicks Next  
**Then** the system stores the trimmed full name and the date of birth in the user's profile  
**And** displays Page 2.

### SPEC-ONB-04 — Restore Personal Information

**Given** personal information was previously saved  
**When** the user returns to onboarding  
**Then** the system displays the previously saved information.

### SPEC-ONB-08 — Personal Information Locked After Completion

**Given** an authenticated user whose onboarding is complete  
**When** they attempt to modify their full name or date of birth through any client path  
**Then** the change is rejected or has no effect  
**And** the stored personal information remains unchanged.

## 4. Business Onboarding

### SPEC-BIZ-01 — Display Business Information Page

**Given** an authenticated user who has just saved Page 1  
**When** Page 2 is displayed  
**Then** the system requests:

- Business name.
- Business industry, chosen from the categories in `database.md` §4 (display names are shown in the current language; codes are submitted).
- Whether the business already has a physical establishment (Yes/No, with no answer preselected).

**And** provides a Back action that returns to Page 1.

### SPEC-BIZ-02 — Validate Business Information

**Given** the user is completing Page 2  
**When** they submit a business name that is empty, whitespace-only or longer than 120 characters after trimming, no industry selection, or no establishment answer  
**Then** the system rejects the submission  
**And** displays the corresponding validation error  
**And** saves nothing.

### SPEC-BIZ-03 — Register Business in Planning Status

**Given** valid business information  
**And** the user indicates that they do not yet have a physical establishment  
**When** they click Finish  
**Then** the system creates the business with the trimmed name and status `planning`  
**And** marks onboarding as completed  
**And** redirects the user to `/dashboard`.

### SPEC-BIZ-04 — Register Business in Active Status

**Given** valid business information  
**And** the user indicates that they already have a physical establishment  
**When** they click Finish  
**Then** the system creates the business with the trimmed name and status `active`  
**And** marks onboarding as completed  
**And** redirects the user to `/dashboard`.

### SPEC-BIZ-05 — One Business Per User

**Given** a user who already owns a business  
**When** they attempt to create another business  
**Then** the database rejects the operation.

### SPEC-BIZ-06 — No Location Required

**Given** a user completing business onboarding  
**When** they submit valid business information  
**Then** the system must not require an address, coordinates, or map selection.

### SPEC-BIZ-07 — Unsupported Industry or Status

**Given** a completion request with an industry code that is not a supported category, or a status other than `planning` or `active`  
**When** the request is processed  
**Then** the database rejects it with `invalid_industry` or `invalid_status`  
**And** no business is created  
**And** onboarding remains incomplete.

## 5. Onboarding Completion and Transactions

### SPEC-ONB-05 — Atomic Onboarding Completion

**Given** a user with valid personal information  
**When** they finish business onboarding  
**Then** business creation and onboarding completion happen in one database transaction.

**And** if any operation fails, neither change is committed.

### SPEC-ONB-06 — Prevent Unauthorized Completion

**Given** an authenticated user  
**When** they attempt to complete another user's onboarding  
**Then** the operation is rejected.

The completion operation accepts no user identifier; it always acts on the authenticated user.

### SPEC-ONB-07 — Prevent Invalid Completion

**Given** a user without valid personal information or business information  
**When** they attempt to finish onboarding  
**Then** the operation is rejected (for missing personal information, with `personal_info_incomplete`)  
**And** the onboarding status remains incomplete.

### SPEC-ONB-09 — Repeated Completion

**Given** a user whose onboarding is already complete  
**When** a completion request is submitted again (for example, a double click or a retry after a lost response)  
**Then** the database rejects it with `onboarding_already_completed`  
**And** no additional business is created  
**And** the frontend treats this result as success and redirects to `/dashboard`.

**Given** two completion requests submitted concurrently by the same user  
**When** both are processed  
**Then** exactly one business is created  
**And** the other request receives `onboarding_already_completed`.

## 6. Dashboard and Routing

### SPEC-ROUTE-01 — Unauthenticated Access

**Given** a visitor without an authenticated session  
**When** they access `/dashboard`  
**Then** they are redirected to `/login`.

### SPEC-ROUTE-02 — Incomplete Onboarding

**Given** an authenticated user whose onboarding is incomplete  
**When** they access `/dashboard`  
**Then** they are redirected to `/onboarding`.

### SPEC-ROUTE-03 — Completed Onboarding

**Given** an authenticated user whose onboarding is complete  
**When** they access `/dashboard`  
**Then** they are allowed to proceed.

### SPEC-ROUTE-04 — Completed User Accessing Onboarding

**Given** an authenticated user whose onboarding is complete  
**When** they access `/onboarding`  
**Then** they are redirected to `/dashboard`.

### SPEC-ROUTE-05 — Route Access Matrix

| Route | Unauthenticated | Authenticated, onboarding incomplete | Authenticated, onboarding complete |
|---|---|---|---|
| `/` | Redirect to `/login` | Redirect to `/onboarding` | Redirect to `/dashboard` |
| `/login` | Allowed | Redirect to `/onboarding` | Redirect to `/dashboard` |
| `/register` | Allowed | Redirect to `/onboarding` | Redirect to `/dashboard` |
| `/forgot-password` | Allowed | Redirect to `/onboarding` | Redirect to `/dashboard` |
| `/auth/confirm` | Allowed (processes the link) | Allowed (processes the link) | Allowed (processes the link) |
| `/update-password` | Redirect to `/login` | Allowed | Allowed |
| `/onboarding` | Redirect to `/login` | Allowed | Redirect to `/dashboard` |
| `/dashboard` | Redirect to `/login` | Redirect to `/onboarding` | Allowed |

`/update-password` is exempt from onboarding redirects because a recovery link establishes a session before the user sets a new password.

### SPEC-DASH-01 — Dashboard Content

**Given** an authenticated user whose onboarding is complete  
**When** they access `/dashboard`  
**Then** the system displays their business name, the industry display name and the business status as a readable label, in the current language.

## 7. Data Persistence

### SPEC-DATA-01 — Page-Level Persistence

Page 1 is saved when the user clicks Next.

Page 2 is saved when the user clicks Finish.

The system does not guarantee persistence of unsent Page 2 information. Page 2 values entered during the current visit may be kept in memory when the user goes Back, but they are not persisted.

### SPEC-DATA-02 — Business Status Consistency

The business status must match the user's establishment selection:

| Establishment selection | Business status |
| ----------------------- | --------------- |
| No                      | `planning`      |
| Yes                     | `active`        |

The frontend performs this mapping and sends the resulting status. The database accepts only `planning` or `active`; it cannot verify the user's answer.

### SPEC-DATA-03 — User Data Isolation

**Given** two different authenticated users  
**When** either user attempts to read or modify the other user's records  
**Then** PostgreSQL RLS and database privileges must deny unauthorized access.

### SPEC-DATA-04 — Stored Text Is Trimmed

**Given** any write to a full name or business name  
**When** it is stored  
**Then** the stored value has no leading or trailing whitespace.

Values submitted through the application are trimmed before storage. Any other write containing leading or trailing whitespace is rejected by the database.

## 8. Error Handling

### SPEC-ERR-01 — Database Error Contract

**Given** an onboarding operation fails with an error code from the database error contract (`database.md` §7.5)  
**When** the frontend receives it  
**Then** it displays the corresponding message in the current language (except `onboarding_already_completed` on Finish, see SPEC-ONB-09)  
**And** the onboarding status is unchanged.

**Given** an error outside the contract (connectivity failure or unexpected database error)  
**When** the frontend receives it  
**Then** it displays a generic error message  
**And** the user stays on the current step and can retry.

**Given** the session has expired or is invalid during onboarding  
**When** an operation is attempted  
**Then** the user is redirected to `/login`.

## 9. Language

### SPEC-I18N-01 — Default Language

**Given** a browser with no stored language preference  
**When** the user opens any page  
**Then** the interface is displayed in Spanish (`es`).

The browser's language settings are not used to choose the language.

### SPEC-I18N-02 — Change Language

**Given** a user on any page, authenticated or not  
**When** they select Español or English in the language selector  
**Then** the page is displayed in the selected language  
**And** the session is unaffected  
**And** the preference is stored in the browser.

### SPEC-I18N-03 — Preference Persistence

**Given** a language preference stored in the browser  
**When** the user reloads the page, navigates, restarts the browser, logs out, or logs in with any account in the same browser  
**Then** the interface uses the stored language.

The preference belongs to the browser, not to the account.

### SPEC-I18N-04 — Preference Scope

**Given** a language preference stored in one browser  
**When** the user opens the application in another browser  
**Then** that browser uses its own stored preference, or Spanish if it has none.

Synchronizing the preference across devices is out of scope for the MVP.

### SPEC-I18N-05 — Invalid Stored Preference

**Given** a stored preference that is not a supported language  
**When** the user opens any page  
**Then** the interface is displayed in Spanish.

### SPEC-I18N-06 — Language Change During Onboarding

**Given** a user on onboarding Page 1 or Page 2 with values entered but not yet submitted  
**When** they change the language  
**Then** they remain on the same step  
**And** the entered values are kept.

### SPEC-I18N-07 — Translated Content

In the current language, the system displays all user-facing text: page content, page titles, validation messages, database error messages, authentication error messages, industry display names and status labels. Each page declares its language (`<html lang>`).

Values entered by users, such as names, are displayed as entered. Stored codes (industries, statuses) are language-independent and are translated only for display.

## 10. Acceptance Criteria Summary

- Registration, login, logout, and recovery work; recovery links work in the browser where recovery was requested.
- Passwords have at least 8 characters.
- User profiles are created automatically.
- Personal information is required, validated and stored trimmed.
- Personal information cannot be changed after onboarding is completed.
- Business name and industry are required; the business name is stored trimmed.
- Establishment status is required, with no preselected answer.
- Businesses can be created in `planning` or `active` status.
- No geographic location is required during onboarding.
- A user can own only one business.
- Onboarding completion is atomic and safe to repeat.
- Onboarding always starts at Page 1 with saved values restored.
- Protected routes enforce authentication and onboarding status according to SPEC-ROUTE-05.
- The dashboard shows the user's business name, industry and status.
- User-owned records are isolated through RLS and database privileges.
- The interface is available in Spanish (default) and English, switchable from any page.
- The language preference persists in the browser and falls back to Spanish when missing or invalid.

## 11. Open Decisions

None.

Resolved in this version:

- Session expiration: Supabase defaults (1-hour access tokens, refreshed automatically by the SDK; refresh token rotation enabled).
- UI language: Spanish (default) and English; the preference is stored in the browser (§9).

Resolved previously:

- Industry categories: defined in `database.md` §4.
- Password minimum length: 8 characters.
- Changing a business from `planning` to `active`: out of scope (`requirements.md` §6).
- Editing business information after onboarding: out of scope (`requirements.md` §6).
- Editing personal information after onboarding: not allowed (`requirements.md` FR-06).

## 12. Location Evaluation

Components, contracts, classification and scoring details are in `architecture.md` §15; storage in `database.md` §13.

### SPEC-LOC-01 — Access

**Given** an authenticated user whose onboarding is complete
**When** they choose "Evaluate a location" on the dashboard
**Then** `/evaluations/new` opens. Every `/evaluations` route follows the `/dashboard` rules of SPEC-ROUTE-05.

### SPEC-LOC-02 — Reference Location Search

**Given** the evaluation form
**When** the user types an address, colonia or place and presses Search
**Then** the system shows up to 5 matching places in Mexico and the user picks one.
**And** if nothing matches, the system says so and keeps the text for another search. The search runs only on submit, never while typing.

### SPEC-LOC-03 — Form

- Fields: reference location (required, picked from the results), exploration radius (0.5, 1, 2 or 3 km; default 1 km) and monthly rent in MXN (optional, whole number from 1 to 10,000,000).
- The industry comes from the user's business and is shown, not asked.
- Submitting starts the evaluation and shows its progress. On success the results open; on error the form keeps every value (SPEC-LOC-12).

### SPEC-LOC-04 — Candidate Zones

**Given** the DENUE establishments within the radius plus 300 m
**Then** the system splits the exploration circle into 300 m cells. Each cell with at least 10 establishments is a candidate: its center is the average position of the cell's establishments and its zone is the 300 m circle around that center.
**And** if the area has fewer than 20 establishments or no candidate, the evaluation stops with "insufficient data", stating the counts found.

### SPEC-LOC-05 — Agent Proposal and Validation

- The agent receives the industry and each candidate's metrics, never scores, and returns up to three candidates. Each has a one-sentence summary, opportunities, considerations and a conclusion.
- A response that breaks the schema is retried once; a second failure is an analysis error.
- The system drops a proposed zone when:
  - its candidate does not exist;
  - its center is outside the exploration radius;
  - it is within 400 m of a zone already accepted;
  - its text contains a number that is not one of that zone's metrics.
- The zone's name is built from data: its most common colonia and street.
- One or two valid zones are shown as one or two. With no valid zone the evaluation stops with "no valid alternatives".

### SPEC-LOC-06 — Score

- Each zone gets a 0–100 score from four factors: commercial activity, direct competition, related businesses and staff size (`architecture.md` §15).
- A factor without data is shown as "not available" and its weight is excluded.
- The score is computed only by the system. The same establishments and parameters always give the same score.
- Rent is never part of the score.

### SPEC-LOC-07 — Results

**Given** a completed evaluation
**When** the user opens `/evaluations/{id}`
**Then** they see:
- the reference location and radius;
- a map with the reference point and numbered zone markers;
- one card per zone sorted by score, with name, location, score, summary, "View detail" and "Compare";
- the source with the query date;
- the agent chat (SPEC-LOC-10).

### SPEC-LOC-08 — Zone Detail

`/evaluations/{id}/zones/{rank}` shows:

1. **Identification:** the zone name, its location, its number and a map.
2. **Score and breakdown:** the overall score, then for each factor what it measures, the data used, its contribution and its limitations.
3. **Map of the zone:** the zone radius and its establishments, with same-industry establishments distinguished from the rest. Selecting a marker shows the name, activity, address, distance to the zone center and DENUE ID.
4. **Agent explanation:** opportunities, considerations and conclusion.
5. **Establishments:** counts of same-industry, related and other establishments, and the full list.
6. **Source:** INEGI DENUE, the query date, the dataset date or "not reported by the API", the limitations, and the note that a DENUE record does not guarantee the establishment still operates.
7. **Rent:** the amount labeled as entered by the user, or "not provided".
8. **Actions:** back to results, compare, ask the agent and view establishments. There is no previous/next navigation.

### SPEC-LOC-09 — Comparison

`/evaluations/{id}/compare` shows every zone of the evaluation side by side:
- the score;
- each factor's value and contribution;
- the counts of all, same-industry and related establishments;
- the minimum staff.

It has no charts.

### SPEC-LOC-10 — Agent Chat

- On desktop the chat is a right-side panel on the results and detail pages; on mobile it opens as a separate sheet.
- The system sends the agent the stored evaluation of the signed-in user, never data from the browser.
- The agent answers only from that evaluation. It says when data is not available and never changes scores.
- Messages are not stored. Each message has at most 1,000 characters.

### SPEC-LOC-11 — Data Isolation

A user can read and create only their own evaluations. Opening another user's evaluation shows "not found".

### SPEC-LOC-12 — Errors

| Situation | Behavior |
|---|---|
| Address not found | Message on the form; search again |
| DENUE unavailable or rejects the request | "DENUE could not be reached"; Retry keeps the form |
| Insufficient data | Explains which counts were too low; the user can change the location or radius |
| Analysis failure (Claude unavailable, invalid response twice) | "The analysis could not be completed"; Retry keeps the form |
| No valid alternatives | Explains that no zone passed validation |
| Rent omitted | Evaluation continues; detail shows "not provided" |
| Factor without data | Shown as "not available" |

No error path shows example, cached or invented results.

### SPEC-LOC-13 — Acceptance Criteria

- The industry is taken from onboarding and never asked again.
- Up to three zones, sorted by score, each backed by DENUE establishments inside the radius.
- Scores are computed by the system, are reproducible and are explained per factor.
- Every agent statement with a number matches a metric of its zone.
- The source and dates are visible on results and detail.
- Every error in SPEC-LOC-12 allows a retry without refilling the form.
- Spanish and English; responsive from 320 px.
