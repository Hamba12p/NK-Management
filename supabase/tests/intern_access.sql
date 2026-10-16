\set ON_ERROR_STOP on
-- Disposable local Supabase only. Run after the complete migration set.
begin;
insert into auth.users (id,email,raw_user_meta_data) values
('10000000-0000-0000-0000-000000000101','intern-test@example.invalid','{"full_name":"Test Intern","role":"intern"}'),
('10000000-0000-0000-0000-000000000102','dpo-test@example.invalid','{"full_name":"Test DPO","role":"dpo"}'),
('10000000-0000-0000-0000-000000000103','manager-test@example.invalid','{"full_name":"Test Manager","role":"manager"}');
update public.profiles set access_expires_at=now()+interval '14 days',must_change_password=false where id='10000000-0000-0000-0000-000000000101';

insert into public.documents(id,name,file_path,file_size,mime_type,category,uploaded_by,visibility,intern_visible) values
('20000000-0000-0000-0000-000000000101','Flagged','shared/flagged.pdf',100,'application/pdf','template','10000000-0000-0000-0000-000000000102','standard',true),
('20000000-0000-0000-0000-000000000102','Own upload','interns/10000000-0000-0000-0000-000000000101/own.pdf',100,'application/pdf','template','10000000-0000-0000-0000-000000000101','standard',false),
('20000000-0000-0000-0000-000000000103','Private','private.pdf',100,'application/pdf','report','10000000-0000-0000-0000-000000000102','standard',false);
insert into storage.objects(bucket_id,name) values
('documents','shared/flagged.pdf'),('documents','interns/10000000-0000-0000-0000-000000000101/own.pdf'),('documents','private.pdf'),('other-bucket','shared/flagged.pdf');
insert into public.workspace_docs(id,title,content,author_id,status) values
('30000000-0000-0000-0000-000000000101','Intern draft','{"type":"doc","content":[]}','10000000-0000-0000-0000-000000000101','draft'),
('30000000-0000-0000-0000-000000000102','Private draft','{"type":"doc","content":[]}','10000000-0000-0000-0000-000000000103','draft');
insert into public.workspace_comments(id,document_id,body,author_id) values
('30000000-0000-0000-0000-000000000111','30000000-0000-0000-0000-000000000101','Supervisor comment','10000000-0000-0000-0000-000000000102'),
('30000000-0000-0000-0000-000000000112','30000000-0000-0000-0000-000000000102','Private comment','10000000-0000-0000-0000-000000000103');
insert into public.workspace_doc_versions(id,document_id,version_number,content,status,created_by) values
('30000000-0000-0000-0000-000000000121','30000000-0000-0000-0000-000000000101',1,'{"type":"doc","content":[]}','draft','10000000-0000-0000-0000-000000000101'),
('30000000-0000-0000-0000-000000000122','30000000-0000-0000-0000-000000000102',1,'{"type":"doc","content":[]}','draft','10000000-0000-0000-0000-000000000103');
insert into public.tasks(id,title,assignee_id,assignee_label,created_by,status) values
('40000000-0000-0000-0000-000000000101','Assigned','10000000-0000-0000-0000-000000000101','Test Intern','10000000-0000-0000-0000-000000000102','todo'),
('40000000-0000-0000-0000-000000000102','Own subtask','10000000-0000-0000-0000-000000000101','Test Intern','10000000-0000-0000-0000-000000000101','todo'),
('40000000-0000-0000-0000-000000000103','Other','10000000-0000-0000-0000-000000000103','Test Manager','10000000-0000-0000-0000-000000000103','todo');
insert into public.meetings(id,title,scheduled_at,duration_min,status,created_by,intern_visible,intern_check_in) values
('50000000-0000-0000-0000-000000000101','Flagged check-in',now()+interval '1 day',60,'upcoming','10000000-0000-0000-0000-000000000102',true,true),
('50000000-0000-0000-0000-000000000102','Private meeting',now()+interval '1 day',60,'upcoming','10000000-0000-0000-0000-000000000103',false,false);
insert into public.agenda_items(id,meeting_id,content,order_index,created_by) values
('50000000-0000-0000-0000-000000000111','50000000-0000-0000-0000-000000000101','Visible agenda',1,'10000000-0000-0000-0000-000000000101'),
('50000000-0000-0000-0000-000000000112','50000000-0000-0000-0000-000000000102','Private agenda',1,'10000000-0000-0000-0000-000000000103');
insert into public.announcements(id,title,body,author_id,intern_visible,acknowledgement_required) values
('60000000-0000-0000-0000-000000000101','Intern notice','Safe handling','10000000-0000-0000-0000-000000000102',true,true),
('60000000-0000-0000-0000-000000000102','Private notice','Staff only','10000000-0000-0000-0000-000000000103',false,false);
insert into public.announcement_acknowledgements(announcement_id,user_id) values ('60000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000101","role":"authenticated"}',true);
set local role authenticated;
do $$
declare n integer; blocked boolean;
begin
 if public.current_role()<>'intern' or not public.intern_access_active() then raise exception 'Intern role/expiry helper failed'; end if;
 select count(*) into n from public.profiles; if n<>1 then raise exception 'Profile rows: %',n; end if;
 select count(*) into n from public.documents; if n<>2 then raise exception 'Document rows: %',n; end if;
 select count(*) into n from storage.objects; if n<>2 then raise exception 'Storage rows: %',n; end if;
 select count(*) into n from public.workspace_docs; if n<>1 then raise exception 'Workspace docs: %',n; end if;
 select count(*) into n from public.workspace_comments; if n<>1 then raise exception 'Comments: %',n; end if;
 select count(*) into n from public.workspace_doc_versions; if n<>1 then raise exception 'Versions: %',n; end if;
 select count(*) into n from public.tasks; if n<>2 then raise exception 'Tasks: %',n; end if;
 select count(*) into n from public.meetings; if n<>1 then raise exception 'Meetings: %',n; end if;
 select count(*) into n from public.agenda_items; if n<>1 then raise exception 'Agenda: %',n; end if;
 select count(*) into n from public.announcements; if n<>1 then raise exception 'Announcements: %',n; end if;
 select count(*) into n from public.announcement_acknowledgements; if n<>1 then raise exception 'Acknowledgements: %',n; end if;
 select count(*) into n from public.staff_directory(); if n<>3 then raise exception 'Directory rows: %',n; end if;
 blocked:=false;
 begin insert into public.tasks(title,assignee_id,created_by) values('bad','10000000-0000-0000-0000-000000000103',auth.uid()); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Intern created a task for another user'; end if;
 blocked:=false;
 begin update public.tasks set title='tampered' where id='40000000-0000-0000-0000-000000000101'; exception when others then blocked:=true; end;
 if not blocked then raise exception 'Intern changed task fields other than status'; end if;
 update public.tasks set status='in_progress' where id='40000000-0000-0000-0000-000000000101';
 if not exists(select from public.tasks where id='40000000-0000-0000-0000-000000000101' and status='in_progress') then raise exception 'Assigned task status update failed'; end if;
 blocked:=false;
 begin insert into public.agenda_items(meeting_id,content,created_by) values('50000000-0000-0000-0000-000000000102','bad',auth.uid()); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Agenda insert escaped intern boundary'; end if;
end $$;
reset role;

set local role authenticated;
do $$
declare n integer; t text;
begin
 foreach t in array array['activity_log','processing_activities','data_subject_requests','dpo_incidents','volunteer_profiles','volunteer_hours','events','hub_classes','hub_class_rotation','hub_class_sessions','hub_session_assignments','learners','learner_guardian_contacts','learner_enrolments','learner_attendance','learner_progress','hub_curriculum','equipment','programs','program_kpis','kpi_measurements','findings','risks','evidence_links','board_reports','deleted_content_archive','admin_notifications'] loop
  execute format('select count(*) from public.%I',t) into n;
  if n<>0 then raise exception 'Closed table % returned % rows',t,n; end if;
 end loop;
end $$;
reset role;

-- Direct execution also rejects interns before closed hub/learner/archive work.
set local role authenticated;
do $$
declare blocked boolean;
begin
 blocked:=false; begin perform public.archive_owned_content('task','40000000-0000-0000-0000-000000000102'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Archive guard failed'; end if;
 blocked:=false; begin perform public.complete_meeting_and_carry_forward('50000000-0000-0000-0000-000000000101'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Carry-forward guard failed'; end if;
 blocked:=false; begin perform * from public.generate_hub_rotation('70000000-0000-0000-0000-000000000101',now()); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Hub rotation guard failed'; end if;
 blocked:=false; begin perform public.complete_hub_class_session('70000000-0000-0000-0000-000000000101'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Hub session guard failed'; end if;
 blocked:=false; begin perform public.enrol_hub_learner('Test learner','70000000-0000-0000-0000-000000000101'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Learner guard failed'; end if;
end $$;
reset role;

-- DPO supervision policies and existing manager insert permissions.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000102',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000102","role":"authenticated"}',true);
set local role authenticated;
insert into public.tasks(title,assignee_id,assignee_label,created_by) values('DPO task','10000000-0000-0000-0000-000000000101','Test Intern',auth.uid());
update public.tasks set status='done' where title='DPO task';
insert into public.meetings(title,scheduled_at,duration_min,status,created_by,intern_visible,intern_check_in) values('DPO meeting',now()+interval '2 days',60,'upcoming',auth.uid(),true);
insert into public.announcements(title,body,author_id,intern_visible,acknowledgement_required) values('DPO notice','test',auth.uid(),true,true);
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000103',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000103","role":"authenticated"}',true);
set local role authenticated;
insert into public.tasks(title,assignee_id,assignee_label,created_by) values('Manager task','10000000-0000-0000-0000-000000000103','Test Manager',auth.uid());
insert into public.meetings(title,scheduled_at,duration_min,status,created_by) values('Manager meeting',now()+interval '2 days',60,'upcoming',auth.uid());
insert into public.announcements(title,body,author_id) values('Manager notice','test',auth.uid());
reset role;

update public.profiles set access_expires_at=now()-interval '1 second' where id='10000000-0000-0000-0000-000000000101';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000101","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
 if public.intern_access_active() then raise exception 'Expired intern remains active'; end if;
 if exists(select from public.documents) or exists(select from storage.objects) or exists(select from public.tasks)
  or exists(select from public.meetings) or exists(select from public.announcements) or exists(select from public.staff_directory())
  or exists(select from public.profiles) then raise exception 'Expired intern retained access'; end if;
end $$;
reset role;
rollback;
select 'PASS: intern table/storage boundaries, own task status, directory, DPO/manager writes, closed-data RPCs and expired access' as result;
