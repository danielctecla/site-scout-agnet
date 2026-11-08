# Database Design — Business Management MVP

**Version:** 0.8  
**Status:** Defined  
**Last updated:** 2026-11-08  
**Database:** Supabase PostgreSQL

## 1. Overview

The database uses Supabase PostgreSQL as its primary data store and Supabase Auth for identity management.

The MVP contains two application tables:

- `profiles`: stores personal information associated with an authenticated user.
- `businesses`: stores the user's business information.

Each authenticated user has one profile and can create at most one business.

The database is responsible for enforcing data integrity, ownership, onboarding completion rules and access control.

This document is authoritative for the schema, constraints, database functions, RLS policies and privileges. Other documents reference it instead of restating these details.

Design principles:

- **Constraints are the authority for data validity.** Every rule that can be expressed as a constraint is enforced by one, regardless of the write path.
- **Functions orchestrate; they do not duplicate rules.** Functions handle identity, normalization, ordering, locking and error translation, and rely on constraints for content validation.
- **Least privilege.** Clients receive only the privileges listed in §8.
- **Secure at creation.** RLS, policies and privileges are created in the same migration as the object they protect.

## 2. Entity relationship

```text
auth.users
    |
    | 1:1
    v
profiles
    |
    | 1:0..1
    v
businesses
```

Relationships:

- Every profile belongs to exactly one Supabase Auth user.
- A user receives a profile automatically after registration.
- A profile can have zero or one business.
- A business cannot exist without its associated profile.
- Deleting an Auth user deletes its profile, and deleting a profile deletes its business (`ON DELETE CASCADE`).

## 3. Tables

### 3.1. profiles

Stores personal information and onboarding progress.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | UUID | NO | none (equals `auth.users.id`) |
| `full_name` | TEXT | YES | NULL |
| `birth_date` | DATE | YES | NULL |
| `onboarding_completed_at` | TIMESTAMPTZ | YES | NULL |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:

```sql
constraint profiles_pkey primary key (id),
constraint profiles_id_fkey foreign key (id)
  references auth.users (id) on delete cascade,
constraint profiles_full_name_check check (
  full_name is null
  or (char_length(full_name) between 1 and 100 and full_name !~ '^\s|\s$')
),
constraint profiles_completion_requires_personal_info check (
  onboarding_completed_at is null
  or (full_name is not null and birth_date is not null)
)
```

Rules:

- `id` is the same UUID as the corresponding `auth.users.id`.
- `full_name` and `birth_date` are NULL until Page 1 is saved, because the profile is created at registration.
- When present, `full_name` is trimmed and has 1–100 characters.
- A `birth_date` written by an update must give an age between 16 and 100 full years on the day it is written (`profiles_validate_birth_date`, §6.3). This rule depends on the current date, so it cannot be a CHECK constraint: PostgreSQL requires CHECK expressions to be immutable, and a time-dependent one could make restoring a backup fail years later.
- A profile with `onboarding_completed_at` set always has `full_name` and `birth_date`.
- `onboarding_completed_at` remains NULL until the business is created, and is written only by `finish_onboarding`.
- `full_name` and `birth_date` cannot change after onboarding is completed (RLS, §8.2).
- The column replaced `age` (integer) in migration 7 (§10).

### 3.2. businesses

Stores the user's business information.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` |
| `user_id` | UUID | NO | none |
| `name` | TEXT | NO | none |
| `industry` | TEXT | NO | none |
| `status` | TEXT | NO | none |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:

```sql
constraint businesses_pkey primary key (id),
constraint businesses_user_id_key unique (user_id),
constraint businesses_user_id_fkey foreign key (user_id)
  references public.profiles (id) on delete cascade,
constraint businesses_name_check check (
  char_length(name) between 1 and 120 and name !~ '^\s|\s$'
),
constraint businesses_industry_check check (
  industry in (/* the codes listed in §4, and only there */)
),
constraint businesses_status_check check (
  status in ('planning', 'active')
)
```

Valid statuses:

- `active`: the user declares that the business already has a physical establishment.
- `planning`: the user declares that the business does not yet have a physical establishment.

Rules:

- `user_id` is UNIQUE, enforcing one business per user.
- `name` is trimmed and has 1–120 characters.
- `industry` must belong to the supported industry list.
- `status` must be either `active` or `planning`.
- The database validates the status value but does not verify whether a physical establishment actually exists.

### 3.3. Text normalization

- **Definition.** A value is *trimmed* when it has no leading or trailing whitespace, where whitespace is the PostgreSQL regular-expression class `\s`. Internal whitespace is preserved.
- **Enforcement.** `profiles_full_name_check` and `businesses_name_check` reject any value that is not trimmed, on every write path. The database never stores an untrimmed value.
- **Normalization.** The RPC functions trim their inputs before writing, with `regexp_replace(value, '^\s+|\s+$', '', 'g')`, so users of the application are never rejected for surrounding whitespace.
- **Direct writes are not normalized.** A direct write containing leading or trailing whitespace is rejected, not silently trimmed (§7.2, Path B).
- **Length.** Lengths are measured with `char_length` (characters). The frontend counts Unicode code points to match.

## 4. Industry categories

The MVP uses a predefined list of industries. No separate `industries` table is required.

Supported categories:

| Code | Display name (es) | Display name (en) |
|---|---|---|
| `food_beverage` | Alimentos y bebidas | Food & beverage |
| `clothing_accessories` | Ropa y accesorios | Clothing & accessories |
| `technology_electronics` | Tecnología y electrónica | Technology & electronics |
| `beauty_personal_care` | Belleza y cuidado personal | Beauty & personal care |
| `health` | Salud | Health |
| `education` | Educación | Education |
| `professional_services` | Servicios profesionales | Professional services |
| `construction_maintenance` | Construcción y mantenimiento | Construction & maintenance |
| `retail` | Comercio minorista | Retail |
| `other` | Otro | Other |

The database stores and validates codes only. Display names are UI text maintained in the translation files (`messages/<locale>.json`, key `industries.<code>`; `architecture.md` §9); this table records their initial values.

Single source of truth:

- The CHECK constraint `businesses_industry_check` is the only database definition of the list.
- The frontend constant `INDUSTRIES` (codes in display order) is the only application copy of the code list.
- `finish_onboarding` does **not** contain the list. It relies on the constraint and translates its violation into `invalid_industry` by constraint name (§7.5).
- The frontend displays the translated display names and submits the codes.
- An integration test verifies that every code in `INDUSTRIES` is accepted by the database and that an unknown code produces `invalid_industry` (TASK-015).
- Changing the categories requires a new migration that replaces the constraint, and an update to `INDUSTRIES` in the same change. Removing a category requires migrating existing rows first.

## 5. Integrity rules and enforcement

The database enforces the following rules independently of frontend validation:

| # | Rule | Enforced by |
|---|---|---|
| 1 | A profile references an existing Auth user | `profiles_id_fkey` |
| 2 | A user cannot have multiple profiles | `profiles_pkey` |
| 3 | A profile has at most one business | `businesses_user_id_key` |
| 4 | A business references an existing profile | `businesses_user_id_fkey` |
| 5 | Deleting an Auth user deletes its profile and business | `ON DELETE CASCADE` on both foreign keys |
| 6 | Full name, when present, is trimmed and has 1–100 characters | `profiles_full_name_check` |
| 7 | A date of birth, when written, gives an age between 16 and 100 on that day | Trigger `profiles_validate_birth_date` (§6.3) |
| 8 | Completed onboarding requires personal information | `profiles_completion_requires_personal_info` |
| 9 | Business name is trimmed and has 1–120 characters | `businesses_name_check` |
| 10 | Industry is a supported category | `businesses_industry_check` |
| 11 | Status is `planning` or `active` | `businesses_status_check` |
| 12 | Clients cannot set onboarding completion or write businesses | Privileges (§8) |
| 13 | Personal information cannot change after completion | RLS policy `profiles_update_own_before_completion` |
| 14 | Business creation and onboarding completion are atomic | `finish_onboarding` in a single transaction |
| 15 | A business exists only for a completed profile | `finish_onboarding` is the only write path (rules 12 and 14) |
| 16 | `updated_at` reflects the last update | `profiles_set_updated_at` and `businesses_set_updated_at` triggers |

## 6. Database triggers

### 6.1. Profile creation trigger

**Trigger:** `on_auth_user_created`  
**Function:** `public.handle_new_user()`

Execution:

- Runs AFTER INSERT on `auth.users`, FOR EACH ROW.
- Inserts a row into `public.profiles` with `id = NEW.id`; all other columns take their defaults (`full_name`, `birth_date` and `onboarding_completed_at` are NULL).
- Does not read user metadata or any other client-controlled data.
- Runs inside the signup transaction: if it fails, the signup fails. No Auth user can exist without a profile.
- SECURITY DEFINER: exception 1, requirements in §8.5.

The same migration backfills profiles for any Auth users that existed before the trigger:

```sql
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
```

### 6.2. Automatic updated_at trigger

**Function:** `public.handle_updated_at()`  
**Triggers:** `profiles_set_updated_at`, `businesses_set_updated_at`

Execution:

- Runs BEFORE UPDATE on `public.profiles` and on `public.businesses`, FOR EACH ROW.
- Sets `NEW.updated_at := now()`.
- SECURITY INVOKER, with `search_path = ''`.

Notes:

- The application and RPC functions never set `updated_at`.
- Column privileges are checked against the columns named in the client's statement, not columns changed by BEFORE triggers, so clients need no privilege on `updated_at`.
- `businesses` has no update path in the MVP; its trigger is tested with a privileged role.
- `now()` returns the transaction start time, so the business `created_at`, `onboarding_completed_at` and the profile `updated_at` written by `finish_onboarding` share the same timestamp.

### 6.3. Date of birth validation trigger

**Function:** `public.validate_profile_birth_date()`  
**Trigger:** `profiles_validate_birth_date`

Execution:

- Runs BEFORE UPDATE OF `birth_date` on `public.profiles`, FOR EACH ROW, only when the new value is not NULL and differs from the old one.
- Computes the age in full years on the current day (`extract(year from age(current_date, new.birth_date))`) and rejects anything outside 16–100.
- Raises `check_violation` (`23514`) with the constraint name `profiles_birth_date_age_range`, so it is translated like a constraint violation (§7.5). There is no CHECK constraint with that name.
- Fires on updates only, never on inserts: profiles are inserted with NULL personal information, and restoring a backup (which inserts rows) never re-evaluates past dates against the current day.
- SECURITY INVOKER, with `search_path = ''`; EXECUTE revoked.

## 7. Database functions

Database functions centralize operations that need identity checks, normalization or multiple coordinated writes.

### 7.1. Rules for all functions

1. The definition sets `search_path = ''`.
2. Every non-built-in object is schema-qualified: `public.profiles`, `public.businesses`, `auth.uid()`, `auth.users`. Built-ins (`now()`, `char_length`, `regexp_replace`) resolve from `pg_catalog`, which PostgreSQL always searches implicitly and which is the only schema searched with an empty `search_path`.
3. RPC functions take the user's identity only from `auth.uid()`, captured once into a local variable. They never accept a user ID as a parameter.
4. Failures are signalled only with `RAISE EXCEPTION`. A function never returns an error payload, because a normal return commits the transaction.
5. EXCEPTION handlers are allowed only to translate constraint violations into contract codes (§7.5), and every handler branch must raise.
6. No dynamic SQL.
7. Functions are owned by `postgres` (the migration role).
8. Security mode and EXECUTE privileges are set explicitly in the migration that creates the function (§8.4).

### 7.2. Profile write paths

Three paths can write to `profiles`. The invariants hold on all of them because they are enforced by constraints, privileges and RLS, not by function code.

| Aspect | A. `save_personal_information` (RPC) | B. Direct `UPDATE` (Data API) | C. Privileged functions |
|---|---|---|---|
| Used by the application | Yes: the only path for Page 1 | No | Yes, internally |
| Why it exists | Saves Page 1 | Side effect of Path A being SECURITY INVOKER: the caller must hold UPDATE on `full_name` and `birth_date` | `handle_new_user` creates the row; `finish_onboarding` sets `onboarding_completed_at` |
| Writable columns | `full_name`, `birth_date` | `full_name`, `birth_date` (column grants) | `id` (insert); `onboarding_completed_at` |
| Rows | Caller's own, onboarding incomplete (RLS) | Caller's own, onboarding incomplete (RLS) | Owner privileges; restricted explicitly to `NEW.id` or `auth.uid()` |
| Trimming | Trims inputs before writing | None: untrimmed values are rejected by CHECK | `finish_onboarding` trims the business name |
| Missing values | NULL input raises `invalid_full_name` or `invalid_birth_date` | Can set NULL before completion; `finish_onboarding` then raises `personal_info_incomplete` | Not applicable |
| After completion | Raises `onboarding_already_completed` | Updates 0 rows, without error | Not applicable |
| Errors | Contract codes (§7.5) | Raw PostgreSQL errors (for example `23514`, `42501`); not part of the contract | Contract codes (`finish_onboarding`) |

Application code must use Path A only. Database tests exercise Path B to prove the invariants hold without the function (TASK-005).

### 7.3. save_personal_information

**Purpose:** Save the personal information entered on onboarding Page 1.

**Signature:** `public.save_personal_information(p_full_name text, p_birth_date date) returns void`  
**Mode:** SECURITY INVOKER (runs with the caller's privileges and RLS).

Behavior:

1. `v_uid := auth.uid()`. If NULL, raise `not_authenticated`.
2. If `p_full_name` is NULL, raise `invalid_full_name`. If `p_birth_date` is NULL, raise `invalid_birth_date`.
3. `v_full_name := regexp_replace(p_full_name, '^\s+|\s+$', '', 'g')`.
4. Read `onboarding_completed_at` from `public.profiles` where `id = v_uid`. If there is no row, raise `profile_not_found`. If it is not NULL, raise `onboarding_already_completed`. (The SELECT policy has no completion condition, so the row stays visible after completion.)
5. `update public.profiles set full_name = v_full_name, birth_date = p_birth_date where id = v_uid`. Violations of `profiles_full_name_check` or `profiles_birth_date_age_range` (§6.3) are translated into `invalid_full_name` or `invalid_birth_date`.
6. If no row was updated (onboarding was completed concurrently and RLS filtered the row), raise `onboarding_already_completed`.

Notes:

- The function never modifies `onboarding_completed_at`; the caller has no privilege to do so.
- Repeating the call with the same input produces the same state.
- Argument type errors (for example, an invalid date) are rejected by PostgreSQL or PostgREST before the function body runs. They are outside the contract; the frontend prevents them.

Security:

- SECURITY INVOKER, relying on the column-level UPDATE grant and RLS policies in §8.2.
- EXECUTE granted only to `authenticated` (§8.4).

### 7.4. finish_onboarding

**Purpose:** Create the business and mark onboarding as completed.

**Signature:** `public.finish_onboarding(p_business_name text, p_industry text, p_status text) returns uuid` (the ID of the created business)  
**Mode:** SECURITY DEFINER: exception 2, requirements in §8.5.

The frontend derives `p_status` from the user's establishment answer with `statusFromEstablishment`:

- Yes → `active`
- No → `planning`

The database validates the value through `businesses_status_check`; it cannot verify the answer itself.

Behavior:

1. `v_uid := auth.uid()`. If NULL, raise `not_authenticated`.
2. Missing arguments: a NULL `p_business_name` raises `invalid_business_name`, a NULL `p_industry` raises `invalid_industry`, a NULL `p_status` raises `invalid_status`.
3. `v_name := regexp_replace(p_business_name, '^\s+|\s+$', '', 'g')`.
4. `select full_name, birth_date, onboarding_completed_at from public.profiles where id = v_uid for update`, which locks the row and serializes concurrent completions. If there is no row, raise `profile_not_found`.
5. If `onboarding_completed_at` is not NULL, raise `onboarding_already_completed`.
6. If `full_name` or `birth_date` is NULL, raise `personal_info_incomplete`.
7. `insert into public.businesses (user_id, name, industry, status) values (v_uid, v_name, p_industry, p_status) returning id`. Constraint violations are translated (§7.5).
8. `update public.profiles set onboarding_completed_at = now() where id = v_uid`.
9. Return the business ID.

Error precedence: authentication, then missing arguments, then profile state, then business content.

Transaction requirements:

- PostgREST executes each RPC call in a single transaction. Any exception in steps 1–8 rolls back both writes. The function does not commit or catch errors except to translate them.
- A second business cannot be created for the same user.
- A completed onboarding cannot be repeated.

Concurrency and retries:

- A concurrent second call waits on the row lock taken in step 4, then sees the completed profile and raises `onboarding_already_completed`. `businesses_user_id_key` remains the backstop.
- A retry after a successful call whose response was lost raises `onboarding_already_completed`, which the frontend treats as success.

The industry list does not appear in the function.

### 7.5. Error contract

**Transport.** Contract errors are raised as:

```sql
raise exception using errcode = 'P0001', message = '<code>';
```

PostgREST responds with HTTP 400 and a body containing `"code": "P0001"` and `"message": "<code>"`. The frontend recognizes contract errors by `code === 'P0001'` and maps `message` through its single error-mapping module. Any other error (another SQLSTATE, an unknown message, a network failure) is shown as a generic error.

| Code | Raised by | Meaning |
|---|---|---|
| `not_authenticated` | both | No authenticated user in the request context |
| `profile_not_found` | both | The caller has no profile |
| `onboarding_already_completed` | both | Onboarding is already complete; for `finish_onboarding`, the frontend treats it as success |
| `personal_info_incomplete` | `finish_onboarding` | Page 1 has not been saved |
| `invalid_full_name` | `save_personal_information` | Missing, blank, or longer than 100 characters after trimming |
| `invalid_birth_date` | `save_personal_information` | Missing, or gives an age outside 16–100 on the current day |
| `invalid_business_name` | `finish_onboarding` | Missing, blank, or longer than 120 characters after trimming |
| `invalid_industry` | `finish_onboarding` | Missing or not a supported category |
| `invalid_status` | `finish_onboarding` | Missing, or not `planning` or `active` |
| `business_already_exists` | `finish_onboarding` | A business exists although onboarding is incomplete (an inconsistent state, not reachable through the application) |

Requests from `anon` never reach a function body: EXECUTE is revoked, and PostgREST responds with HTTP 401 (`42501`). The frontend treats this as an expired session and redirects to `/login`.

**Constraint translation.** Content validation is delegated to constraints; the functions translate violations by constraint name:

| Constraint | SQLSTATE | Contract code |
|---|---|---|
| `profiles_full_name_check` | `23514` | `invalid_full_name` |
| `profiles_birth_date_age_range` (raised by the §6.3 trigger) | `23514` | `invalid_birth_date` |
| `businesses_name_check` | `23514` | `invalid_business_name` |
| `businesses_industry_check` | `23514` | `invalid_industry` |
| `businesses_status_check` | `23514` | `invalid_status` |
| `businesses_user_id_key` | `23505` | `business_already_exists` |

Pattern used by `finish_onboarding` step 7 (`save_personal_information` step 5 uses the same pattern with the profile constraints):

```sql
begin
  insert into public.businesses (user_id, name, industry, status)
  values (v_uid, v_name, p_industry, p_status)
  returning id into v_business_id;
exception
  when check_violation or unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    case v_constraint
      when 'businesses_name_check' then
        raise exception using errcode = 'P0001', message = 'invalid_business_name';
      when 'businesses_industry_check' then
        raise exception using errcode = 'P0001', message = 'invalid_industry';
      when 'businesses_status_check' then
        raise exception using errcode = 'P0001', message = 'invalid_status';
      when 'businesses_user_id_key' then
        raise exception using errcode = 'P0001', message = 'business_already_exists';
      else
        raise;
    end case;
end;
```

The handler maps by constraint name only and never inspects the industry value, so the list exists only in the constraint. Every branch raises, so the enclosing transaction always rolls back.

## 8. Row Level Security and privileges

### 8.1. Privilege model

Supabase's default privileges on the `public` schema grant ALL on new tables, and EXECUTE on new functions, to `anon`, `authenticated` and `service_role`. PostgreSQL additionally grants EXECUTE on new functions to PUBLIC. Table-level privileges override column-level restrictions: a column-level grant restricts nothing unless the table-level privilege is revoked first.

Therefore every migration:

1. Revokes all table privileges from `anon` and `authenticated` on the tables it creates.
2. Grants only the privileges listed below.
3. Revokes EXECUTE on the functions it creates from PUBLIC and `anon` (and from `authenticated` for trigger functions), then grants EXECUTE explicitly where needed.

`service_role` keeps its default privileges and bypasses RLS. It is used only by trusted tooling, never by the application or the browser.

FORCE ROW LEVEL SECURITY is not enabled: the two SECURITY DEFINER functions rely on owner access and enforce ownership explicitly.

### 8.2. profiles

```sql
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, birth_date) on table public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own_before_completion on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and onboarding_completed_at is null)
  with check (id = (select auth.uid()) and onboarding_completed_at is null);
```

- INSERT: no privilege and no policy. Profiles are created by `handle_new_user`.
- DELETE: no privilege and no policy. Profiles are deleted by cascade when the Auth user is deleted through an administrative flow.
- `id`, `onboarding_completed_at`, `created_at` and `updated_at` are not updatable by clients.
- `(select auth.uid())` is evaluated once per statement instead of once per row (Supabase performance recommendation).

### 8.3. businesses

```sql
alter table public.businesses enable row level security;

revoke all on table public.businesses from anon, authenticated;
grant select on table public.businesses to authenticated;

create policy businesses_select_own on public.businesses
  for select to authenticated
  using (user_id = (select auth.uid()));
```

- INSERT, UPDATE and DELETE: no privilege and no policy. Business creation uses `finish_onboarding`.

### 8.4. Function privileges

| Function | Mode | EXECUTE granted to |
|---|---|---|
| `public.handle_updated_at()` | INVOKER | Nobody (trigger only) |
| `public.handle_new_user()` | DEFINER | Nobody (trigger only) |
| `public.validate_profile_birth_date()` | INVOKER | Nobody (trigger only) |
| `public.save_personal_information(text, date)` | INVOKER | `authenticated` |
| `public.finish_onboarding(text, text, text)` | DEFINER | `authenticated` |

```sql
-- Trigger functions
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.validate_profile_birth_date() from public, anon, authenticated;

-- RPC functions
revoke execute on function public.save_personal_information(text, date) from public, anon;
grant execute on function public.save_personal_information(text, date) to authenticated;

revoke execute on function public.finish_onboarding(text, text, text) from public, anon;
grant execute on function public.finish_onboarding(text, text, text) to authenticated;
```

Trigger functions cannot be called directly, and PostgreSQL checks EXECUTE on a trigger function when the trigger is created, not when it fires. The revocation is defense in depth; tests confirm that the triggers still fire.

### 8.5. SECURITY DEFINER exceptions

SECURITY INVOKER is the default. Exactly two functions are SECURITY DEFINER. Adding another requires updating this section first.

Requirements common to both:

- The definition sets `search_path = ''`.
- Every non-built-in object is schema-qualified (`public.profiles`, `public.businesses`, `auth.uid()`).
- The function is owned by `postgres`. Because the owner bypasses RLS, every statement is explicitly restricted to the validated identity.
- The identity never comes from a parameter or other client-controlled data.
- No dynamic SQL.
- EXECUTE is restricted as listed in §8.4.
- pgTAP tests assert the security mode (`prosecdef`), the `search_path` setting (`proconfig`) and the EXECUTE privileges.

**`handle_new_user`**

- *Why DEFINER:* it is executed by the Auth service's database role (`supabase_auth_admin`) during signup, which has no privileges on application tables.
- *Identity validation:* there is no end-user request context during signup, so `auth.uid()` does not apply (it is NULL). The identity source is `NEW.id` of the inserted `auth.users` row. The function validates that it is running as the expected trigger (`TG_OP = 'INSERT'`, `TG_TABLE_SCHEMA = 'auth'`, `TG_TABLE_NAME = 'users'`) and raises otherwise.
- *Writes:* only `insert into public.profiles (id) values (NEW.id)`.
- *Callable by:* nobody directly (trigger function, EXECUTE revoked).

**`finish_onboarding`**

- *Why DEFINER:* it must insert into `public.businesses` and set `profiles.onboarding_completed_at`, which clients cannot write.
- *Identity validation:* `auth.uid()` is captured once (step 1); NULL raises `not_authenticated`. Every statement filters or writes with that value (`where id = v_uid`, `user_id = v_uid`).
- *Writes:* one business insert and one profile update, both for `v_uid`.
- *Callable by:* `authenticated` only.
- Supabase's security advisor flags SECURITY DEFINER functions executable by `authenticated`. This warning is expected and accepted for `finish_onboarding` only.

### 8.6. General security rules

- Enable RLS on all application tables in the migration that creates them.
- Use the authenticated user's identity through `auth.uid()`.
- Revoke default privileges and grant only the necessary table, column and function privileges.
- Use SECURITY INVOKER by default; SECURITY DEFINER only for the exceptions in §8.5.
- Set `search_path = ''` on every function.
- Never use the service-role key in browser code.

RLS is a database security boundary, not a replacement for authentication or server-side route protection.

## 9. Indexes

The following indexes are required or provided by constraints:

- Primary key indexes on `profiles.id` and `businesses.id`.
- Unique index on `businesses.user_id`.
- The foreign key relationship between profiles and Auth users is backed by the profile primary key.

All RLS predicates (`id = auth.uid()`, `user_id = auth.uid()`) use these indexes.

Additional indexes should be introduced only when query patterns or query plans demonstrate a need.

## 10. Migrations

Rules:

1. Migrations use the Supabase CLI naming format `<timestamp>_<name>.sql` and are created with `supabase migration new <name>`.
2. A migration that creates a table also, in the same file, enables RLS on it, creates its policies and applies its revoke/grant statements (§8). No table exists, even briefly, without RLS and least-privilege grants.
3. A migration that creates a function also, in the same file, sets its security mode, its `search_path` and its EXECUTE privileges.
4. The Supabase CLI applies each migration file atomically, so a failing migration leaves no partial objects (confirmed in TASK-003).
5. Applied migrations are never edited; changes are made in new migrations.
6. Every migration has pgTAP tests in `supabase/tests/database/`, written before the migration. Database tests run only against the local test stack.
7. The single Supabase project holds real data and receives migrations only through `supabase db push`, after the local test suite passes (workflow in `architecture.md` §11). `supabase db reset` runs only against the local test stack, never with `--linked`. The schema is never changed through the dashboard or other tools.

Order:

| # | Migration | Contents |
|---|---|---|
| 1 | `create_updated_at_function` | `handle_updated_at`; EXECUTE revoked |
| 2 | `create_profiles` | Table, constraints, cascading FK, `profiles_set_updated_at`, RLS, policies, grants |
| 3 | `create_profile_trigger` | `handle_new_user`, `on_auth_user_created`, backfill, EXECUTE revoked |
| 4 | `create_businesses` | Table, constraints, unique key, cascading FK, `businesses_set_updated_at`, RLS, policy, grants |
| 5 | `create_save_personal_information` | Function, EXECUTE privileges |
| 6 | `create_finish_onboarding` | Function, EXECUTE privileges |
| 7 | `replace_age_with_birth_date` | Replaces `profiles.age` with `birth_date` (column grant, completion constraint, §6.3 trigger); recreates `save_personal_information(text, date)` and updates `finish_onboarding` |

After the migrations are applied, TypeScript types are generated with `supabase gen types typescript`.

## 11. Business rules outside the MVP

The following functionality is intentionally excluded:

- Changing `planning` to `active` after onboarding.
- Editing business name or industry after onboarding.
- Editing personal information after onboarding.
- Multiple businesses per user.
- Business branches.
- Business locations and addresses.
- Google Maps integration.
- Team management.
- Advanced roles and permissions.
- Self-service account deletion.
- Storing the language preference in the database. The MVP stores it in a browser cookie. The future migration path, including the constraint that it must not relax the `profiles_update_own_before_completion` lock, is described in `architecture.md` §9.

These capabilities may require additional database operations, policies and migrations in a future version.

## 12. Final database acceptance criteria

The database design is considered implemented when:

- [ ] Registration automatically creates a profile, and existing Auth users are backfilled.
- [ ] A profile can exist with incomplete personal information.
- [ ] Full names and business names are always stored trimmed, on every write path.
- [ ] Personal information accepts only valid full names (1–100 characters) and dates of birth giving an age of 16–100.
- [ ] Personal information cannot be modified after onboarding is completed.
- [ ] A completed profile always has personal information.
- [ ] A user can have at most one business.
- [ ] Business name (1–120 characters) and industry are validated by constraints.
- [ ] Only `active` and `planning` statuses are accepted.
- [ ] The onboarding operation creates the business and completes the profile atomically.
- [ ] Repeated or concurrent completion creates exactly one business.
- [ ] A user cannot complete onboarding without personal information.
- [ ] Every function failure uses the error contract (§7.5).
- [ ] The industry list exists only in `businesses_industry_check` in the database.
- [ ] A user cannot access another user's records; `anon` cannot access any application table or function.
- [ ] Direct business writes are prohibited.
- [ ] Protected onboarding fields cannot be modified directly.
- [ ] Exactly two SECURITY DEFINER functions exist, both with `search_path = ''` and restricted EXECUTE.
- [ ] Every table has RLS, policies and grants in its creation migration.
- [ ] Deleting an Auth user deletes its profile and business.
- [ ] `updated_at` is maintained automatically.
- [ ] Database migrations are version-controlled and reproducible on the local test stack with `supabase db reset`.
- [ ] All migrations are applied to the Supabase project with no schema drift (`supabase migration list`, `supabase db diff --linked`).

## 13. location_evaluations

Stores completed Location Evaluations (`specification.md` §12). The application has no history screen; rows give results, detail and comparison a URL, and give the agent chat trusted context.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` |
| `user_id` | UUID | NO | `auth.uid()` |
| `input` | JSONB | NO | none |
| `result` | JSONB | NO | none |
| `created_at` | TIMESTAMPTZ | NO | `now()` |

```sql
constraint location_evaluations_pkey primary key (id),
constraint location_evaluations_user_id_fkey foreign key (user_id)
  references public.profiles (id) on delete cascade,
constraint location_evaluations_input_check check (jsonb_typeof(input) = 'object'),
constraint location_evaluations_result_check check (
  jsonb_typeof(result) = 'object' and pg_column_size(result) <= 5000000
)
```

- `input` and `result` follow the TypeScript contract in `architecture.md` §15. The database checks only their type and size.
- Only evaluations with at least one valid zone are stored. Rows are never updated.
- Index: `location_evaluations_user_id_idx` on `user_id`, used by the RLS predicate and the foreign key.

```sql
alter table public.location_evaluations enable row level security;

revoke all on table public.location_evaluations from anon, authenticated;
grant select, insert on table public.location_evaluations to authenticated;

create policy location_evaluations_select_own on public.location_evaluations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy location_evaluations_insert_own on public.location_evaluations
  for insert to authenticated
  with check (user_id = (select auth.uid()));
```

- UPDATE and DELETE: no privilege and no policy. Deleting the Auth user cascades through `profiles`.
- No SECURITY DEFINER function is added.
- Accepted: the server action inserts with the user's own session, so a user could insert a fabricated evaluation through the Data API. Only that user can read it, and only that user's chat uses it.

Acceptance criteria:

- [ ] A user reads and inserts only their own evaluations; `anon` has no access.
- [ ] Updates and deletes are rejected.
- [ ] Deleting an Auth user deletes their evaluations.
