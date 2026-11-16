\set ON_ERROR_STOP on
-- Run after all migrations in a disposable local Supabase database.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('81000000-0000-4000-8000-000000000001','manager-a@example.invalid','{"full_name":"Manager A","role":"manager"}'),
 ('81000000-0000-4000-8000-000000000002','manager-b@example.invalid','{"full_name":"Manager B","role":"manager"}'),
 ('81000000-0000-4000-8000-000000000003','volunteer-a@example.invalid','{"full_name":"Volunteer A","role":"volunteer"}'),
 ('81000000-0000-4000-8000-000000000004','volunteer-b@example.invalid','{"full_name":"Volunteer B","role":"volunteer_senior"}'),
 ('81000000-0000-4000-8000-000000000005','intern-a@example.invalid','{"full_name":"Intern A","role":"intern"}'),
 ('81000000-0000-4000-8000-000000000006','intern-b@example.invalid','{"full_name":"Intern B","role":"intern"}'),
 ('81000000-0000-4000-8000-000000000007','admin-a@example.invalid','{"full_name":"Admin A","role":"admin"}'),
 ('81000000-0000-4000-8000-000000000008','dpo-a@example.invalid','{"full_name":"DPO A","role":"dpo"}'),
 ('81000000-0000-4000-8000-000000000009','board-a@example.invalid','{"full_name":"Board A","role":"board_advisor"}'),
 ('81000000-0000-4000-8000-000000000010','founder-a@example.invalid','{"full_name":"Founder A","role":"admin"}');
update public.profiles set intern_access_enabled=true, access_starts_on=(now() at time zone 'Africa/Nairobi')::date,
  access_expires_at=now()+interval '30 days', must_change_password=false
where role='intern';
update public.profiles set is_founder=true where id='81000000-0000-4000-8000-000000000010';

-- Every intern state is evaluated for the supplied UID, and matches the existing caller helper.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
 if public.chat_intern_active(auth.uid()) is distinct from public.intern_access_active() then raise exception 'Active intern helpers differ'; end if;
end $$;
reset role;
update public.profiles set intern_access_enabled=false where id='81000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$ begin if public.chat_intern_active(auth.uid()) is distinct from public.intern_access_active() then raise exception 'Disabled intern helpers differ'; end if; end $$;
reset role;
update public.profiles set intern_access_enabled=true,access_starts_on=(now() at time zone 'Africa/Nairobi')::date+1 where id='81000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$ begin if public.chat_intern_active(auth.uid()) is distinct from public.intern_access_active() then raise exception 'Future-start intern helpers differ'; end if; end $$;
reset role;
update public.profiles set access_starts_on=(now() at time zone 'Africa/Nairobi')::date,access_expires_at=now()-interval '1 second' where id='81000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$ begin if public.chat_intern_active(auth.uid()) is distinct from public.intern_access_active() then raise exception 'Expired intern helpers differ'; end if; end $$;
reset role;
update public.profiles set access_expires_at=now()+interval '30 days',must_change_password=true,
  password_change_required_on=(now() at time zone 'Africa/Nairobi')::date where id='81000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$ begin if public.chat_intern_active(auth.uid()) is distinct from public.intern_access_active() then raise exception 'Past-deadline intern helpers differ'; end if; end $$;
reset role;
update public.profiles set must_change_password=false,password_change_required_on=null where role='intern';

-- Matrix checks and idempotent open in either order.
do $$
declare room_one uuid; room_two uuid;
begin
 if not public.chat_pair_allowed('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002') then raise exception 'Manager-manager denied'; end if;
 if not public.chat_pair_allowed('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003') then raise exception 'Manager-volunteer denied'; end if;
 if not public.chat_pair_allowed('81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000004') then raise exception 'Manager-volunteer_senior denied'; end if;
 if not public.chat_pair_allowed('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000005') then raise exception 'Manager-intern denied'; end if;
 if not public.chat_pair_allowed('81000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000005') then raise exception 'Volunteer-intern denied'; end if;
 if public.chat_pair_allowed('81000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000004') then raise exception 'Volunteer-volunteer allowed'; end if;
 if public.chat_pair_allowed('81000000-0000-4000-8000-000000000005','81000000-0000-4000-8000-000000000006') then raise exception 'Intern-intern allowed'; end if;
 if public.chat_pair_allowed('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001') then raise exception 'Self chat allowed'; end if;
 if not public.chat_pair_allowed('81000000-0000-4000-8000-000000000010','81000000-0000-4000-8000-000000000003') then raise exception 'Founder-manager pair denied'; end if;
end $$;

-- Make durable rooms used by the access-revocation assertion.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.chat_open_dm('81000000-0000-4000-8000-000000000004') as other_pair_room \gset
insert into public.chat_messages(room_id,body) values (:'other_pair_room','Private pair message');
reset role;
select set_config('test.other_pair_room', :'other_pair_room', true);
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.chat_open_dm('81000000-0000-4000-8000-000000000002') as manager_room \gset
select public.chat_open_dm('81000000-0000-4000-8000-000000000003') as manager_vol_room \gset
select public.chat_open_dm('81000000-0000-4000-8000-000000000005') as manager_intern_room \gset
select public.chat_open_dm('81000000-0000-4000-8000-000000000010') as manager_founder_room \gset
insert into public.chat_messages(room_id,body) values (:'manager_intern_room','Existing intern thread');
insert into public.chat_messages(room_id,body) values (:'manager_intern_room','Another message in the same thread');
do $$
declare a uuid; b uuid;
begin
 a:=public.chat_open_dm('81000000-0000-4000-8000-000000000002');
 b:=public.chat_open_dm('81000000-0000-4000-8000-000000000002');
 if a<>b then raise exception 'DM open was not idempotent'; end if;
end $$;
reset role;
select 1 / case when count(*)=1 and bool_and(actor_name='Manager A') then 1 else 0 end as chat_notifications_collapse_without_message_text
from public.notifications
where recipient_id='81000000-0000-4000-8000-000000000005' and type='message' and entity_id=:'manager_intern_room';

select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select public.chat_open_dm('81000000-0000-4000-8000-000000000003') as intern_volunteer_room \gset
insert into public.chat_messages(room_id,body) values (:'intern_volunteer_room','Intern and volunteer can chat');
reset role;

select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true); set local role authenticated;
do $$ declare blocked boolean; begin
 blocked:=false; begin perform public.chat_open_dm('81000000-0000-4000-8000-000000000004'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Volunteer-volunteer DM creation was accepted'; end if;
end $$; reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000005',true); set local role authenticated;
do $$ declare blocked boolean; begin
 blocked:=false; begin perform public.chat_open_dm('81000000-0000-4000-8000-000000000006'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Intern-intern DM creation was accepted'; end if;
end $$; reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare expected uuid; actual uuid; begin
 select id into expected from public.chat_rooms where room_key='81000000-0000-4000-8000-000000000001:81000000-0000-4000-8000-000000000002';
 actual:=public.chat_open_dm('81000000-0000-4000-8000-000000000001');
 if actual <> expected then raise exception 'Reverse-order open created another room'; end if;
 if exists(select from public.chat_messages where room_id=current_setting('test.other_pair_room')::uuid) then raise exception 'Manager read another pair DM'; end if;
end $$;
reset role;

-- Intern revocation removes both read and send access to an already-created room.
update public.profiles set intern_access_enabled=false where id='81000000-0000-4000-8000-000000000005';
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
do $$ declare blocked boolean; rid uuid; begin
 select id into rid from public.chat_rooms where room_key='81000000-0000-4000-8000-000000000001:81000000-0000-4000-8000-000000000005';
 if exists(select from public.chat_messages where room_id=rid) then raise exception 'Disabled intern read old thread'; end if;
 blocked:=false; begin insert into public.chat_messages(room_id,body) values (rid,'No'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Disabled intern sent to old thread'; end if;
end $$;
reset role;
update public.profiles set intern_access_enabled=true where id='81000000-0000-4000-8000-000000000005';
update public.profiles set access_expires_at=now()-interval '1 second' where id='81000000-0000-4000-8000-000000000005';
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
do $$ declare blocked boolean; rid uuid; begin
 select id into rid from public.chat_rooms where room_key='81000000-0000-4000-8000-000000000001:81000000-0000-4000-8000-000000000005';
 if exists(select from public.chat_messages where room_id=rid) then raise exception 'Expired intern read old thread'; end if;
 blocked:=false; begin insert into public.chat_messages(room_id,body) values (rid,'No'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Expired intern sent to old thread'; end if;
end $$;
reset role;
update public.profiles set access_expires_at=now()+interval '30 days' where id='81000000-0000-4000-8000-000000000005';

-- Sender identity and body constraints.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare blocked boolean; rid uuid; begin
 select id into rid from public.chat_rooms where room_key='81000000-0000-4000-8000-000000000001:81000000-0000-4000-8000-000000000002';
 blocked:=false; begin insert into public.chat_messages(room_id,sender_id,body) values (rid,'81000000-0000-4000-8000-000000000002','spoof'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Sender spoof succeeded'; end if;
 blocked:=false; begin insert into public.chat_messages(room_id,body) values (rid,'   '); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Empty body accepted'; end if;
 blocked:=false; begin insert into public.chat_messages(room_id,body) values (rid,repeat('x',2001)); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Overlong body accepted'; end if;
 insert into public.chat_messages(room_id,body) values (rid,'valid');
end $$;
reset role;

-- General room access: manager and founder only; admin, volunteer, intern, DPO, board advisor denied.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select id as general_room from public.chat_rooms where room_key='general' \gset
select set_config('test.general_room', :'general_room', true);
insert into public.chat_messages(room_id,body) values (:'general_room','manager general message');
reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000010',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000010","role":"authenticated"}',true);
set local role authenticated;
do $$ declare rid uuid; begin select id into rid from public.chat_rooms where room_key='general'; if not public.chat_can_access(rid) then raise exception 'Founder cannot access general'; end if; end $$;
insert into public.chat_messages(room_id,body) values (:'general_room','founder general message');
reset role;
\set denied_user '81000000-0000-4000-8000-000000000007'
\set denied_role 'authenticated'
-- Repeat the access check as each prohibited role.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000007',true); set local role authenticated;
do $$ declare rid uuid:=current_setting('test.general_room')::uuid; blocked boolean:=false; begin if public.chat_can_access(rid) or exists(select from public.chat_messages where room_id=rid) then raise exception 'Admin got general access'; end if; begin insert into public.chat_messages(room_id,body) values(rid,'denied'); exception when others then blocked:=true; end; if not blocked then raise exception 'Admin wrote general'; end if; end $$; reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000008',true); set local role authenticated;
do $$ declare rid uuid:=current_setting('test.general_room')::uuid; blocked boolean:=false; begin if public.chat_can_access(rid) or exists(select from public.chat_messages where room_id=rid) then raise exception 'DPO got general access'; end if; begin insert into public.chat_messages(room_id,body) values(rid,'denied'); exception when others then blocked:=true; end; if not blocked then raise exception 'DPO wrote general'; end if; end $$; reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000009',true); set local role authenticated;
do $$ declare rid uuid:=current_setting('test.general_room')::uuid; blocked boolean:=false; begin if public.chat_can_access(rid) or exists(select from public.chat_messages where room_id=rid) then raise exception 'Board advisor got general access'; end if; begin insert into public.chat_messages(room_id,body) values(rid,'denied'); exception when others then blocked:=true; end; if not blocked then raise exception 'Board advisor wrote general'; end if; end $$; reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true); set local role authenticated;
do $$ declare rid uuid:=current_setting('test.general_room')::uuid; blocked boolean:=false; begin if public.chat_can_access(rid) or exists(select from public.chat_messages where room_id=rid) then raise exception 'Volunteer got general access'; end if; begin insert into public.chat_messages(room_id,body) values(rid,'denied'); exception when others then blocked:=true; end; if not blocked then raise exception 'Volunteer wrote general'; end if; end $$; reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000005',true); set local role authenticated;
do $$ declare rid uuid:=current_setting('test.general_room')::uuid; blocked boolean:=false; begin if public.chat_can_access(rid) or exists(select from public.chat_messages where room_id=rid) then raise exception 'Intern got general access'; end if; begin insert into public.chat_messages(room_id,body) values(rid,'denied'); exception when others then blocked:=true; end; if not blocked then raise exception 'Intern wrote general'; end if; end $$; reset role;

-- Profiles remain protected even for admin self-updates and ordinary own-profile updates.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true); set local role authenticated;
do $$ declare blocked boolean:=false; begin begin update public.profiles set is_founder=true where id=auth.uid(); exception when others then blocked:=true; end; if not blocked then raise exception 'Normal user set is_founder'; end if; end $$; reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000007',true); set local role authenticated;
do $$ declare blocked boolean:=false; begin begin update public.profiles set is_founder=true where id=auth.uid(); exception when others then blocked:=true; end; if not blocked then raise exception 'Admin set own is_founder'; end if; end $$; reset role;

-- Anonymous has no table or RPC access.
set local role anon;
do $$ declare denied boolean:=false; begin begin perform count(*) from public.chat_messages; exception when insufficient_privilege then denied:=true; end; if not denied then raise exception 'anon read chat messages'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role anon;
do $$ declare denied boolean:=false; begin begin insert into public.chat_messages(room_id,body) select id,'anon' from public.chat_rooms where room_key='general'; exception when insufficient_privilege then denied:=true; end; if not denied then raise exception 'anon wrote chat message'; end if; end $$;
reset role;

rollback;
select 'PASS: chat roles, RLS, active intern boundaries, founder protection, messages, general room, anon denial and idempotent DMs' as result;
