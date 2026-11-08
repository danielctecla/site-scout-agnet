-- Replaces profiles.age with profiles.birth_date (requirements.md FR-06;
-- database.md §3.1, §6.3, §7.3, §7.4). No profile holds personal information
-- yet, so no data is converted.

-- ---------------------------------------------------------------------------
-- Column and completion invariant
-- ---------------------------------------------------------------------------
alter table public.profiles add column birth_date date;

alter table public.profiles drop constraint profiles_completion_requires_personal_info;
alter table public.profiles add constraint profiles_completion_requires_personal_info check (
  onboarding_completed_at is null
  or (full_name is not null and birth_date is not null)
);

-- The old function writes age; drop it before the column. Dropping the column
-- also drops profiles_age_check and the UPDATE (age) grant.
drop function public.save_personal_information(text, integer);
alter table public.profiles drop column age;

grant update (birth_date) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Age rule (database.md §6.3). It depends on the current date, so it is a
-- trigger, not a CHECK constraint, and it runs only when the date is written:
-- never on insert, so restoring a backup cannot fail on old dates.
-- ---------------------------------------------------------------------------
create function public.validate_profile_birth_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_age integer := extract(year from age(current_date, new.birth_date))::integer;
begin
  if v_age < 16 or v_age > 100 then
    raise exception using
      errcode = 'check_violation',
      constraint = 'profiles_birth_date_age_range',
      message = 'birth_date must give an age between 16 and 100';
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_profile_birth_date() from public, anon, authenticated;

create trigger profiles_validate_birth_date
  before update of birth_date on public.profiles
  for each row
  when (new.birth_date is not null and new.birth_date is distinct from old.birth_date)
  execute function public.validate_profile_birth_date();

-- ---------------------------------------------------------------------------
-- save_personal_information(text, date) — database.md §7.3, write path A
-- ---------------------------------------------------------------------------
create function public.save_personal_information(p_full_name text, p_birth_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_full_name text;
  v_completed_at timestamptz;
  v_rows integer;
  v_constraint text;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if p_full_name is null then
    raise exception using errcode = 'P0001', message = 'invalid_full_name';
  end if;
  if p_birth_date is null then
    raise exception using errcode = 'P0001', message = 'invalid_birth_date';
  end if;

  v_full_name := regexp_replace(p_full_name, '^\s+|\s+$', '', 'g');

  select onboarding_completed_at into v_completed_at
  from public.profiles
  where id = v_uid;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;
  if v_completed_at is not null then
    raise exception using errcode = 'P0001', message = 'onboarding_already_completed';
  end if;

  begin
    update public.profiles
    set full_name = v_full_name, birth_date = p_birth_date
    where id = v_uid;
    get diagnostics v_rows = row_count;
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      case v_constraint
        when 'profiles_full_name_check' then
          raise exception using errcode = 'P0001', message = 'invalid_full_name';
        when 'profiles_birth_date_age_range' then
          raise exception using errcode = 'P0001', message = 'invalid_birth_date';
        else
          raise;
      end case;
  end;

  -- Onboarding was completed concurrently and RLS filtered the row.
  if v_rows = 0 then
    raise exception using errcode = 'P0001', message = 'onboarding_already_completed';
  end if;
end;
$$;

revoke execute on function public.save_personal_information(text, date) from public, anon;
grant execute on function public.save_personal_information(text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- finish_onboarding — database.md §7.4: personal information now means
-- full_name and birth_date. Same signature, so privileges are kept; they are
-- restated for clarity.
-- ---------------------------------------------------------------------------
create or replace function public.finish_onboarding(p_business_name text, p_industry text, p_status text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_full_name text;
  v_birth_date date;
  v_completed_at timestamptz;
  v_business_id uuid;
  v_constraint text;
begin
  -- 1. Authentication
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  -- 2. Missing arguments
  if p_business_name is null then
    raise exception using errcode = 'P0001', message = 'invalid_business_name';
  end if;
  if p_industry is null then
    raise exception using errcode = 'P0001', message = 'invalid_industry';
  end if;
  if p_status is null then
    raise exception using errcode = 'P0001', message = 'invalid_status';
  end if;

  v_name := regexp_replace(p_business_name, '^\s+|\s+$', '', 'g');

  -- 3. Profile state. The row lock serializes concurrent completions.
  select full_name, birth_date, onboarding_completed_at
  into v_full_name, v_birth_date, v_completed_at
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;
  if v_completed_at is not null then
    raise exception using errcode = 'P0001', message = 'onboarding_already_completed';
  end if;
  if v_full_name is null or v_birth_date is null then
    raise exception using errcode = 'P0001', message = 'personal_info_incomplete';
  end if;

  -- 4. Business content, validated by the constraints
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

  update public.profiles
  set onboarding_completed_at = now()
  where id = v_uid;

  return v_business_id;
end;
$$;

revoke execute on function public.finish_onboarding(text, text, text) from public, anon;
grant execute on function public.finish_onboarding(text, text, text) to authenticated;
