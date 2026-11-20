begin;

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
      or exists (select 1 from public.profiles p where p.id in (a, b) and p.role = 'intern')
    ), false)
$$;
revoke all on function public.chat_pair_allowed(uuid,uuid) from public, anon;
grant execute on function public.chat_pair_allowed(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
