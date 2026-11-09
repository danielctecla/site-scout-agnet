-- Creates the business and completes onboarding in one transaction
-- (database.md §7.4).
--
-- SECURITY DEFINER exception 2 (database.md §8.5): clients cannot insert
-- businesses or set onboarding_completed_at. The owner bypasses RLS, so every
-- statement is restricted to auth.uid(), captured once; the identity never
-- comes from a parameter. Content rules (including the industry list) live in
-- the constraints; violations are translated by constraint name (§7.5).

create function public.finish_onboarding(p_business_name text, p_industry text, p_status text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_full_name text;
  v_age integer;
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
  select full_name, age, onboarding_completed_at
  into v_full_name, v_age, v_completed_at
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;
  if v_completed_at is not null then
    raise exception using errcode = 'P0001', message = 'onboarding_already_completed';
  end if;
  if v_full_name is null or v_age is null then
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

-- Supabase grants EXECUTE on new functions to anon; PostgreSQL to PUBLIC.
revoke execute on function public.finish_onboarding(text, text, text) from public, anon;
grant execute on function public.finish_onboarding(text, text, text) to authenticated;
