alter table public.obx_auth_attempts
  rename column volunteer_number_hash to contact_pair_hash;

alter index public.obx_auth_attempts_number_created_idx
  rename to obx_auth_attempts_contact_pair_created_idx;
