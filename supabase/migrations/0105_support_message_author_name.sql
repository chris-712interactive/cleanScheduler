-- Remember who sent each portal message so a thread can show each staff member by name.

alter table public.customer_support_messages
  add column if not exists author_display_name text;

comment on column public.customer_support_messages.author_display_name is
  'Name of the signed-in person who sent the message, saved when the message is created.';

update public.customer_support_messages as message
set author_display_name = nullif(
  btrim(
    coalesce(
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')
    )
  ),
  ''
)
from public.user_profiles as profile
where profile.user_id = message.author_user_id
  and message.author_display_name is null;
