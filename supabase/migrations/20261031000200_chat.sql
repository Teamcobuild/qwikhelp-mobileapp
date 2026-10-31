-- Customer <-> provider chat.
--
-- Rules (agreed with the product owner):
--   * A conversation opens when an offer reaches 'agreed' (one per offer, i.e. per customer/provider/job).
--   * Contact details are masked server-side before a message is stored. Each masked message is a strike;
--     3 strikes in 24h pause that user's sending for 24h. Off-platform keywords are flagged for review.
--   * Photos only once the offer is booked ('selected'): images can carry contact details we can't filter.
--   * Read-only once the provider is out of the running, or 3 days after the booking ends.
-- Every write goes through the RPCs below; clients can only read their own conversations.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  customer_id text not null references public.profiles (id) on delete cascade,
  provider_id text not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text,
  customer_last_read_at timestamptz,
  provider_last_read_at timestamptz,
  created_at timestamptz not null default now()
);
create index conversations_customer_idx on public.conversations (customer_id, last_message_at desc nulls last);
create index conversations_provider_idx on public.conversations (provider_id, last_message_at desc nulls last);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id text references public.profiles (id) on delete set null,   -- null for system messages
  kind text not null default 'text' check (kind in ('text', 'image', 'system')),
  body text check (body is null or char_length(body) <= 2000),
  image_path text,
  masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- Admin review only (no client access). Keeps the original text of masked/flagged messages.
create table public.chat_flags (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  reasons text[] not null,
  original_body text,
  is_strike boolean not null,
  created_at timestamptz not null default now()
);
create index chat_flags_user_idx on public.chat_flags (user_id, created_at desc) where is_strike;

create table public.conversation_reports (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  reporter_id text not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.chat_flags enable row level security;
alter table public.conversation_reports enable row level security;

create or replace function private.is_conversation_member(p_conversation uuid, p_uid text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations
     where id = p_conversation and p_uid in (customer_id, provider_id)
  )
$$;
grant execute on function private.is_conversation_member(uuid, text) to authenticated;

create policy "conversations: members read" on public.conversations
  for select to authenticated
  using (public.requesting_user_id() in (customer_id, provider_id));

create policy "messages: members read" on public.messages
  for select to authenticated
  using (private.is_conversation_member(conversation_id, public.requesting_user_id()));

revoke insert, update, delete on public.conversations, public.messages from authenticated;
revoke all on public.chat_flags, public.conversation_reports from authenticated, anon;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ---------------------------------------------------------------------------
-- Conversation state
-- ---------------------------------------------------------------------------
-- 'open' | 'booked' (open + photos) | 'closed'
create or replace function private.conversation_state(p_conversation uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  o public.offers;
  b public.bookings;
begin
  select o2.* into o
    from public.conversations c join public.offers o2 on o2.id = c.offer_id
   where c.id = p_conversation;
  if not found then return 'closed'; end if;

  if o.status = 'agreed' then return 'open'; end if;
  if o.status <> 'selected' then return 'closed'; end if;

  select * into b from public.bookings where offer_id = o.id;
  if not found then return 'open'; end if;
  if b.status in ('completed', 'cancelled')
     and greatest(b.updated_at, b.scheduled_at + make_interval(hours => b.duration_hours)) < now() - interval '3 days' then
    return 'closed';
  end if;
  return 'booked';
end $$;

-- ---------------------------------------------------------------------------
-- Contact masking
-- ---------------------------------------------------------------------------
-- Returns the masked text and why it was masked. Amounts like 150,000 or 1,500,000 are left alone
-- (commas aren't treated as number separators, and 7+ digits are needed to count as a number).
create or replace function private.mask_contacts(p_body text, out masked text, out reasons text[])
language plpgsql immutable
as $$
declare
  before text;
begin
  masked := p_body;
  reasons := '{}';

  before := masked;
  masked := regexp_replace(masked, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email hidden]', 'g');
  if masked <> before then reasons := reasons || 'email'; end if;

  before := masked;
  masked := regexp_replace(masked, '(https?://|www\.)\S+|\m(wa\.me|t\.me|chat\.whatsapp\.com|instagram\.com|facebook\.com|fb\.me|tiktok\.com|x\.com|twitter\.com)/\S*', '[link hidden]', 'gi');
  if masked <> before then reasons := reasons || 'link'; end if;

  before := masked;
  masked := regexp_replace(masked, '\+?\d([\s().-]*\d){6,}', '[number hidden]', 'g');
  if masked <> before then reasons := reasons || 'number'; end if;

  -- Numbers written as words: "zero eight zero three ..." (5+ in a row).
  before := masked;
  masked := regexp_replace(masked, '(\m(zero|oh|one|two|three|four|five|six|seven|eight|nine)\M[\s,.-]*){5,}', '[number hidden] ', 'gi');
  if masked <> before then reasons := reasons || 'spelled_number'; end if;

  before := masked;
  masked := regexp_replace(masked, '(^|\s)@[A-Za-z0-9_.]{3,}', '\1[handle hidden]', 'g');
  if masked <> before then reasons := reasons || 'handle'; end if;
end $$;

create or replace function private.offplatform_keywords(p_body text)
returns boolean
language sql immutable
as $$
  select p_body ~* '\m(whats\s?app|watsapp|telegram|signal app|instagram|snapchat|my (number|line|digits|account)|call me on|text me on|dm me|pay (cash|directly|outside)|cash (payment|only)|transfer (directly|to me|to my)|outside (the )?app|off (the )?app|without (the )?app|bypass)\M'
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Conversation for an offer; it exists from the moment the price was agreed.
create or replace function public.open_chat(p_offer uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  cid uuid;
begin
  select id into cid from public.conversations
   where offer_id = p_offer and uid in (customer_id, provider_id);
  if cid is null then
    raise exception 'Chat opens once you and the provider agree on a price';
  end if;
  return cid;
end $$;

create or replace function public.get_conversation(p_conversation uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  c public.conversations;
  other text;
  j public.jobs;
begin
  select * into c from public.conversations where id = p_conversation and uid in (customer_id, provider_id);
  if not found then raise exception 'Conversation not found'; end if;
  other := case when uid = c.customer_id then c.provider_id else c.customer_id end;
  select * into j from public.jobs where id = c.job_id;

  return jsonb_build_object(
    'id', c.id,
    'offer_id', c.offer_id,
    'job_id', c.job_id,
    'role', case when uid = c.customer_id then 'customer' else 'provider' end,
    'state', private.conversation_state(c.id),
    'category', j.category,
    'scheduled_at', j.scheduled_at,
    'other_last_read_at', case when uid = c.customer_id then c.provider_last_read_at else c.customer_last_read_at end,
    'counterpart', (
      select jsonb_build_object(
        'id', p.id,
        -- Customers see a provider's full name; providers see the customer's first name only.
        'name', case when uid = c.customer_id then coalesce(p.full_name, 'Provider') else private.person_first_name(p.id) end,
        'avatar_url', p.avatar_url
      ) from public.profiles p where p.id = other
    )
  );
end $$;

create or replace function public.get_my_conversations()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by (r->>'sort_at')::timestamptz desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', c.id,
      'offer_id', c.offer_id,
      'job_id', c.job_id,
      'category', j.category,
      'state', private.conversation_state(c.id),
      'last_message_at', c.last_message_at,
      'last_message_preview', c.last_message_preview,
      'sort_at', coalesce(c.last_message_at, c.created_at),
      'unread', (
        select count(*) from public.messages m
         where m.conversation_id = c.id
           and m.sender_id is distinct from me.uid
           and m.created_at > coalesce(case when me.uid = c.customer_id then c.customer_last_read_at else c.provider_last_read_at end, '-infinity')
      ),
      'counterpart', jsonb_build_object(
        'name', case when me.uid = c.customer_id then coalesce(p.full_name, 'Provider') else private.person_first_name(p.id) end,
        'avatar_url', p.avatar_url
      )
    ) as r
    from (select public.requesting_user_id() as uid) me
    join public.conversations c on me.uid in (c.customer_id, c.provider_id)
    join public.jobs j on j.id = c.job_id
    join public.profiles p on p.id = case when me.uid = c.customer_id then c.provider_id else c.customer_id end
  ) rows
$$;

create or replace function public.send_message(p_conversation uuid, p_body text default null, p_image_path text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  c public.conversations;
  state text;
  strikes int;
  paused_until timestamptz;
  clean text := nullif(trim(coalesce(p_body, '')), '');
  masked_body text;
  mask_reasons text[] := '{}';
  is_masked boolean := false;
  flagged boolean := false;
  mid uuid;
  warning text;
begin
  select * into c from public.conversations where id = p_conversation and uid in (customer_id, provider_id) for update;
  if not found then raise exception 'Conversation not found'; end if;

  state := private.conversation_state(c.id);
  if state = 'closed' then raise exception 'This chat is closed'; end if;
  if clean is null and p_image_path is null then raise exception 'Message is empty'; end if;
  if char_length(clean) > 2000 then raise exception 'Message is too long'; end if;

  if p_image_path is not null then
    if state <> 'booked' then raise exception 'You can send photos once the booking is confirmed'; end if;
    if split_part(p_image_path, '/', 1) <> c.id::text then raise exception 'Invalid photo'; end if;
  end if;

  -- Pause while there are 3 strikes in the last 24h (lifts when the oldest one is a day old).
  select count(*), min(created_at) + interval '24 hours' into strikes, paused_until
    from public.chat_flags where user_id = uid and is_strike and created_at > now() - interval '24 hours';
  if strikes >= 3 then
    raise exception 'Chat is paused until % for repeatedly sharing contact details',
      to_char(paused_until at time zone 'Africa/Lagos', 'HH12:MI AM');
  end if;

  if clean is not null then
    select mc.masked, mc.reasons into masked_body, mask_reasons from private.mask_contacts(clean) mc;
    is_masked := cardinality(mask_reasons) > 0;
    flagged := private.offplatform_keywords(clean);
  end if;

  insert into public.messages (conversation_id, sender_id, kind, body, image_path, masked)
  values (c.id, uid, case when p_image_path is null then 'text' else 'image' end,
          masked_body, p_image_path, is_masked)
  returning id into mid;

  if is_masked or flagged then
    insert into public.chat_flags (conversation_id, message_id, user_id, reasons, original_body, is_strike)
    values (c.id, mid, uid,
            mask_reasons || case when flagged then array['keyword'] else '{}'::text[] end,
            clean, is_masked);
  end if;

  if is_masked then
    warning := case when strikes + 1 >= 3
      then 'Contact details were hidden. Your chat is now paused because of repeated attempts to share contacts.'
      else 'Contact details were hidden. Keep chats and payments on QwikHelp — sharing contacts can get your chat paused.' end;
  elsif flagged then
    warning := 'Reminder: payments and calls outside QwikHelp aren''t protected. Keep everything in the app.';
  end if;

  update public.conversations
     set last_message_at = now(),
         last_message_preview = case when clean is null then '📷 Photo' else left(masked_body, 120) end,
         customer_last_read_at = case when uid = customer_id then now() else customer_last_read_at end,
         provider_last_read_at = case when uid = provider_id then now() else provider_last_read_at end
   where id = c.id;

  return jsonb_build_object('id', mid, 'masked', is_masked, 'warning', warning);
end $$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.conversations
     set customer_last_read_at = case when public.requesting_user_id() = customer_id then now() else customer_last_read_at end,
         provider_last_read_at = case when public.requesting_user_id() = provider_id then now() else provider_last_read_at end
   where id = p_conversation and public.requesting_user_id() in (customer_id, provider_id);
$$;

create or replace function public.report_conversation(p_conversation uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
begin
  if not private.is_conversation_member(p_conversation, uid) then raise exception 'Conversation not found'; end if;
  insert into public.conversation_reports (conversation_id, reporter_id, reason) values (p_conversation, uid, trim(p_reason));
end $$;

revoke execute on function public.open_chat(uuid) from public, anon;
revoke execute on function public.get_conversation(uuid) from public, anon;
revoke execute on function public.get_my_conversations() from public, anon;
revoke execute on function public.send_message(uuid, text, text) from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.report_conversation(uuid, text) from public, anon;
grant execute on function public.open_chat(uuid) to authenticated;
grant execute on function public.get_conversation(uuid) to authenticated;
grant execute on function public.get_my_conversations() to authenticated;
grant execute on function public.send_message(uuid, text, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.report_conversation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Lifecycle: open on agreement, system notes on booking / not selected
-- ---------------------------------------------------------------------------
create or replace function private.system_message(p_conversation uuid, p_body text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.messages (conversation_id, kind, body) values (p_conversation, 'system', p_body);
$$;

create or replace function private.chat_on_offer_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cid uuid;
begin
  if tg_op = 'UPDATE' and new.status = old.status then return new; end if;

  if new.status = 'agreed' then
    insert into public.conversations (offer_id, job_id, customer_id, provider_id)
    values (new.id, new.job_id, new.customer_id, new.provider_id)
    on conflict (offer_id) do nothing
    returning id into cid;
    if cid is not null then
      perform private.system_message(cid,
        'Price agreed at ' || private.naira(new.amount) || '. You can now chat. For your safety, keep all messages, calls and payments on QwikHelp — contact details are hidden automatically.');
    end if;
    return new;
  end if;

  select id into cid from public.conversations where offer_id = new.id;
  if cid is null then return new; end if;

  if new.status = 'selected' then
    perform private.system_message(cid, 'Booking confirmed. You can now share photos in this chat.');
  elsif new.status in ('not_selected', 'withdrawn', 'job_closed') then
    perform private.system_message(cid, 'This job is no longer open between you, so the chat is now closed.');
  end if;
  return new;
end $$;

create trigger offers_chat after insert or update of status on public.offers
  for each row execute function private.chat_on_offer_change();

-- Offers that were already agreed or booked before chat existed.
insert into public.conversations (offer_id, job_id, customer_id, provider_id)
select id, job_id, customer_id, provider_id from public.offers where status in ('agreed', 'selected')
on conflict (offer_id) do nothing;

-- ---------------------------------------------------------------------------
-- Push for new messages (sent directly, not stored in public.notifications)
-- ---------------------------------------------------------------------------
create or replace function private.push_to(p_user text, p_title text, p_body text, p_data jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  token text;
  access_token text;
  headers jsonb := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json');
begin
  select expo_push_token into token from public.profiles where id = p_user;
  if token is null then return; end if;

  select decrypted_secret into access_token from vault.decrypted_secrets where name = 'expo_access_token';
  if access_token is not null then
    headers := headers || jsonb_build_object('Authorization', 'Bearer ' || access_token);
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object('to', token, 'title', p_title, 'body', p_body, 'sound', 'default', 'channelId', 'default', 'data', p_data),
    headers := headers
  );
end $$;

-- Notifications now share the same sender.
create or replace function private.send_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.push_to(new.user_id, new.title, new.body,
    new.data || jsonb_build_object('notificationId', new.id, 'type', new.type));
  return new;
end $$;

create or replace function private.push_new_message()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.conversations;
  recipient text;
begin
  if new.sender_id is null then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  recipient := case when new.sender_id = c.customer_id then c.provider_id else c.customer_id end;
  perform private.push_to(
    recipient,
    private.person_first_name(new.sender_id),
    case when new.kind = 'image' then '📷 Photo' else left(new.body, 140) end,
    jsonb_build_object('url', '/chat/' || c.id, 'type', 'chat_message', 'conversationId', c.id)
  );
  return new;
end $$;

create trigger messages_push after insert on public.messages
  for each row execute function private.push_new_message();

revoke execute on function private.push_to(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function private.system_message(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: chat photos, private. Path: {conversationId}/{file}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create policy "chat: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat'
         and private.is_conversation_member(((storage.foldername(name))[1])::uuid, public.requesting_user_id()));

create policy "chat: members upload after booking" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat'
              and private.is_conversation_member(((storage.foldername(name))[1])::uuid, public.requesting_user_id())
              and private.conversation_state(((storage.foldername(name))[1])::uuid) = 'booked');

-- Needed by the upload policy, which runs as the uploading user.
grant execute on function private.conversation_state(uuid) to authenticated;
