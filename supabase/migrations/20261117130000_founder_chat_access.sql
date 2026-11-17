begin;

create or replace function public.chat_is_founder(uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_founder from public.profiles p where p.id = uid)
    or exists (
      select 1 from auth.users u
      where u.id = uid
        and lower(u.email) in ('nkateregga003@gmail.com', 'naira@the-nkfoundation.org')
    ),
    false
  )
$$;
revoke all on function public.chat_is_founder(uuid) from public, anon, authenticated;

create or replace function public.chat_is_manager(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select p.role = 'manager' from public.profiles p where p.id = uid), false)
  or public.chat_is_founder(uid) $$;

create or replace function public.chat_contacts()
returns table(user_id uuid, display_name text, role text, is_shared_account boolean, room_id uuid)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, case when public.chat_is_manager(p.id) then 'manager' else p.role end,
    coalesce(p.account_type='shared',false),
    (select r.id from public.chat_rooms r
      join public.chat_participants a on a.room_id=r.id and a.user_id=auth.uid()
      join public.chat_participants b on b.room_id=r.id and b.user_id=p.id
      where r.kind='dm' limit 1)
  from public.profiles p
  where p.id <> auth.uid() and public.chat_pair_allowed(auth.uid(),p.id)
  union all
  select null::uuid, 'General', 'general', false, r.id
  from public.chat_rooms r
  where r.kind='general' and public.chat_is_manager(auth.uid()) and public.chat_intern_active(auth.uid())
$$;

create or replace function public.chat_pair_allowed(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(a is not null and b is not null and a <> b
    and public.chat_intern_active(a) and public.chat_intern_active(b)
    and exists (select 1 from public.profiles p where p.id = a)
    and exists (select 1 from public.profiles p where p.id = b)
    and (
      (public.chat_is_manager(a) and (public.chat_is_manager(b)
        or (select p.role in ('volunteer','volunteer_senior','volunteer_lead','intern') from public.profiles p where p.id=b)))
      or (public.chat_is_manager(b) and (select p.role in ('volunteer','volunteer_senior','volunteer_lead','intern') from public.profiles p where p.id=a))
      or ((select p.role in ('volunteer','volunteer_senior','volunteer_lead') from public.profiles p where p.id=a)
        and (select p.role = 'intern' from public.profiles p where p.id=b))
      or ((select p.role = 'intern' from public.profiles p where p.id=a)
        and (select p.role in ('volunteer','volunteer_senior','volunteer_lead') from public.profiles p where p.id=b))
      or (public.chat_is_amina_dpo(a) and (public.chat_is_manager(b)
        or exists (select 1 from public.profiles p where p.id=b and p.account_type='shared'
          and p.role in ('volunteer','volunteer_senior','volunteer_lead'))))
      or (public.chat_is_amina_dpo(b) and (public.chat_is_manager(a)
        or exists (select 1 from public.profiles p where p.id=a and p.account_type='shared'
          and p.role in ('volunteer','volunteer_senior','volunteer_lead'))))
      or (select p.role='board_advisor' from public.profiles p where p.id=a)
      or (select p.role='board_advisor' from public.profiles p where p.id=b)
      or public.chat_is_founder(a)
      or public.chat_is_founder(b)
    ), false)
$$;
revoke all on function public.chat_pair_allowed(uuid,uuid) from public, anon;
grant execute on function public.chat_pair_allowed(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
