-- Customer/provider support chat + QwikHelp AI usage cap.

-- ---------------------------------------------------------------------------
-- Support chat. One thread per user. Users write 'user' messages; the support team replies
-- as 'agent' with the service role (Supabase dashboard / admin tooling), which bypasses RLS.
-- ---------------------------------------------------------------------------
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default public.requesting_user_id()
    references public.profiles (id) on delete cascade,
  sender text not null default 'user' check (sender in ('user', 'agent')),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index support_messages_user_created on public.support_messages (user_id, created_at);

alter table public.support_messages enable row level security;

create policy "support: read own thread" on public.support_messages
  for select to authenticated using (user_id = public.requesting_user_id());

create policy "support: send as user" on public.support_messages
  for insert to authenticated
  with check (user_id = public.requesting_user_id() and sender = 'user');

revoke update, delete on public.support_messages from authenticated;

alter publication supabase_realtime add table public.support_messages;

-- ---------------------------------------------------------------------------
-- QwikHelp AI: per-user daily message cap, enforced by the qwikhelp-ai edge function.
-- ---------------------------------------------------------------------------
create table public.assistant_usage (
  user_id text not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.assistant_usage enable row level security;
-- No policies: only the edge function (service role) touches this table.

-- Atomically counts one message; returns false once the user is over the cap.
create or replace function public.take_assistant_quota(p_user text, p_limit int)
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.assistant_usage as u (user_id, day, count)
  values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = u.count + 1
  returning count <= p_limit;
$$;

revoke execute on function public.take_assistant_quota(text, int) from public, anon, authenticated;
grant execute on function public.take_assistant_quota(text, int) to service_role;
