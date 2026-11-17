begin;

alter table public.chat_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.chat_messages
  drop constraint if exists chat_messages_attachments_limit_check;
alter table public.chat_messages
  add constraint chat_messages_attachments_limit_check
  check (
    case when jsonb_typeof(attachments) = 'array'
      then jsonb_array_length(attachments) <= 5 and octet_length(attachments::text) <= 8192
      else false
    end
  );

notify pgrst, 'reload schema';

commit;
