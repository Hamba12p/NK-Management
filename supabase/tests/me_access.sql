-- Run after me_bootstrap.sql and ALL migrations in a disposable database.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id, email) values ('10000000-0000-0000-0000-000000000001', 'me-test@example.invalid');
update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
insert into public.programs(id,name,created_by) values ('20000000-0000-0000-0000-000000000001','Test programme',auth.uid());
insert into public.program_kpis(id,program_id,name,unit,frequency,created_by) values
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Attendance','count','monthly',auth.uid());
insert into public.kpi_measurements(kpi_id,value,period_start,period_end,recorded_by) values
  ('30000000-0000-0000-0000-000000000001',12,'2026-09-01','2026-09-30',auth.uid());
insert into public.findings(id,program_id,title,description,category,severity,created_by) values
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Finding','Private details','monitoring','high',auth.uid());
insert into public.risks(id,program_id,title,description,likelihood,impact,created_by) values
  ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Risk','Private details','high','high',auth.uid());
insert into public.documents(id,name,file_path,file_size,mime_type,visibility,uploaded_by) values
  ('60000000-0000-0000-0000-000000000001','Board brief','me/restricted.docx',100,'application/vnd.openxmlformats-officedocument.wordprocessingml.document','restricted',auth.uid());
insert into public.documents(name,file_path,file_size,mime_type,uploaded_by) values
  ('Standard document','standard.pdf',100,'application/pdf',auth.uid());
insert into storage.objects(bucket_id,name) values ('documents','me/restricted.docx'),('documents','standard.pdf'),('documents','orphan.pdf');
insert into public.evidence_links(document_id,program_id,created_by) values
  ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',auth.uid());
insert into public.board_reports(title,document_id,generated_by) values
  ('Board report','60000000-0000-0000-0000-000000000001',auth.uid());

do $$
declare tested_role text; table_name text; visible integer; affected integer; expected integer; fixture jsonb;
begin
  foreach tested_role in array array['admin','board_advisor','manager','dpo','volunteer','volunteer_senior','volunteer_lead'] loop
    update public.profiles set role = tested_role where id = auth.uid();
    expected := case when tested_role in ('admin','board_advisor') then 1 else 0 end;
    foreach table_name in array array['programs','program_kpis','kpi_measurements','findings','risks','evidence_links','board_reports'] loop
      execute format('select to_jsonb(t) from public.%I t limit 1',table_name) into fixture;
      fixture := fixture || jsonb_build_object('id',gen_random_uuid());
      set local role authenticated;
      execute format('select count(*) from public.%I',table_name) into visible;
      if visible <> expected then raise exception '% read policy for %: %',table_name,tested_role,visible; end if;
      begin
        execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',table_name,table_name) using fixture;
        if expected = 0 then raise exception 'Unauthorized insert: % %',tested_role,table_name; end if;
      exception when insufficient_privilege then
        if expected = 1 then raise exception 'Authorized insert denied: % %',tested_role,table_name; end if;
      end;
      execute format('update public.%I set deleted_at = now(), deleted_by = auth.uid()',table_name);
      get diagnostics affected = row_count;
      if affected <> expected * 2 then raise exception 'Update mismatch: % % rows %',tested_role,table_name,affected; end if;
      begin
        execute format('delete from public.%I',table_name);
        raise exception 'Hard delete allowed: % %',tested_role,table_name;
      exception when insufficient_privilege then null;
      end;
      reset role;
      execute format('delete from public.%I where id = $1',table_name) using (fixture->>'id')::uuid;
      execute format('update public.%I set deleted_at = null, deleted_by = null',table_name);
    end loop;
    set local role authenticated;
    select count(*) into visible from public.documents;
    if visible <> expected + 1 then raise exception 'Document visibility mismatch for %',tested_role; end if;
    select count(*) into visible from storage.objects;
    if visible <> expected + 1 then raise exception 'Storage visibility mismatch for %',tested_role; end if;
    reset role;
  end loop;
end $$;

update public.profiles set role = 'board_advisor' where id = auth.uid();
set local role authenticated;
insert into public.tasks(title,assignee_id,created_by,source_finding_id,source_program_id) values
  ('Shared action',auth.uid(),auth.uid(),'40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
insert into public.tasks(title,assignee_id,created_by,source_risk_id,source_program_id) values
  ('Risk action',auth.uid(),auth.uid(),'50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    insert into public.tasks(title,assignee_id,created_by) values ('Unrelated action',auth.uid(),auth.uid());
    raise exception 'Unrelated task insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.tasks(title,assignee_id,created_by,source_finding_id) values
      ('Incorrect scope',auth.uid(),auth.uid(),'40000000-0000-0000-0000-000000000001');
    raise exception 'Mismatched programme accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.tasks(title,assignee_id,created_by,source_finding_id,source_program_id) values
      ('Duplicate',auth.uid(),auth.uid(),'40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
    raise exception 'Duplicate conversion accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.evidence_links(document_id,created_by) values ('60000000-0000-0000-0000-000000000001',auth.uid());
    raise exception 'Untargeted evidence accepted';
  exception when check_violation then null; end;
  begin
    insert into public.kpi_measurements(kpi_id,value,period_start,period_end) values
      ('30000000-0000-0000-0000-000000000001',1,'2026-09-30','2026-09-01');
    raise exception 'Invalid measurement period accepted';
  exception when check_violation then null; end;
end $$;
reset role;
rollback;
select 'PASS: seven roles x seven M&E tables; document and Storage isolation; action conversion, duplicate prevention, evidence and date constraints' as result;
