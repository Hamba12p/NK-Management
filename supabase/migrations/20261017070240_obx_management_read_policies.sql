-- Only authorised hub management roles may read OBX operational data.
create policy obx_roster_management_read on public.volunteer_roster for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo'));
create policy obx_progress_management_read on public.obx_progress for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo'));
create policy obx_stop_results_management_read on public.obx_stop_results for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo'));
create policy obx_answers_management_read on public.obx_answers for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo'));
