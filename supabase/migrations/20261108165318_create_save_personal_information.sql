-- Saves onboarding Page 1 for the caller (database.md §7.3, write path A).
--
-- SECURITY INVOKER: runs with the caller's column grants and RLS, so the
-- personal-information lock (profiles_update_own_before_completion) applies.
-- Content rules live in the constraints; this function trims, checks the
-- profile state and translates constraint violations into contract codes
-- (database.md §7.5).

create function public.save_personal_information(p_full_name text, p_age integer)
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
  if p_age is null then
    raise exception using errcode = 'P0001', message = 'invalid_age';
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
    set full_name = v_full_name, age = p_age
    where id = v_uid;
    get diagnostics v_rows = row_count;
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      case v_constraint
        when 'profiles_full_name_check' then
          raise exception using errcode = 'P0001', message = 'invalid_full_name';
        when 'profiles_age_check' then
          raise exception using errcode = 'P0001', message = 'invalid_age';
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

-- Supabase grants EXECUTE on new functions to anon; PostgreSQL to PUBLIC.
revoke execute on function public.save_personal_information(text, integer) from public, anon;
grant execute on function public.save_personal_information(text, integer) to authenticated;
