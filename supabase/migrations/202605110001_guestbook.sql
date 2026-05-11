create extension if not exists pgcrypto;

do $$
begin
  create type public.comment_status as enum ('approved', 'pending', 'rejected', 'hidden');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '하객',
  avatar_url text,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  constraint admin_users_identity_check check (user_id is not null or email is not null)
);

create unique index if not exists admin_users_user_id_unique
  on public.admin_users(user_id)
  where user_id is not null;

create unique index if not exists admin_users_email_unique
  on public.admin_users(lower(email))
  where email is not null;

create table if not exists public.guestbook_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  message text not null,
  status public.comment_status not null default 'pending',
  moderation_score numeric,
  moderation_payload jsonb not null default '{}'::jsonb,
  rejection_reason text,
  approved_at timestamptz,
  hidden_at timestamptz,
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guestbook_comments_one_per_user unique (user_id),
  constraint guestbook_comments_message_length check (char_length(message) between 2 and 500),
  constraint guestbook_comments_display_name_length check (char_length(display_name) between 1 and 80)
);

create index if not exists guestbook_comments_status_approved_at_idx
  on public.guestbook_comments(status, approved_at desc);

create table if not exists public.comment_edit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.guestbook_comments(id) on delete cascade,
  event_date date not null,
  event_type text not null check (event_type in ('create', 'edit')),
  created_at timestamptz not null default now()
);

create unique index if not exists comment_edit_events_one_edit_per_user_per_day
  on public.comment_edit_events(user_id, event_date)
  where event_type = 'edit';

create index if not exists comment_edit_events_comment_id_idx
  on public.comment_edit_events(comment_id);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.guestbook_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.comment_status not null,
  score numeric,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.guestbook_comments enable row level security;
alter table public.comment_edit_events enable row level security;
alter table public.moderation_events enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "admin users can read own marker" on public.admin_users;
create policy "admin users can read own marker"
  on public.admin_users for select
  to authenticated
  using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "approved comments are public" on public.guestbook_comments;
create policy "approved comments are public"
  on public.guestbook_comments for select
  to anon, authenticated
  using (status = 'approved');

drop policy if exists "users can read own comment" on public.guestbook_comments;
create policy "users can read own comment"
  on public.guestbook_comments for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), '하객'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_app_meta_data ->> 'provider'
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        provider = excluded.provider,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_guestbook_admin(p_user_id uuid, p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = p_user_id
       or (email is not null and lower(email) = lower(coalesce(p_email, '')))
  );
$$;

revoke all on function public.is_guestbook_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.is_guestbook_admin(uuid, text) to service_role;

create or replace function public.upsert_guestbook_comment(
  p_user_id uuid,
  p_display_name text,
  p_message text,
  p_status public.comment_status,
  p_moderation_score numeric,
  p_moderation_payload jsonb,
  p_rejection_reason text,
  p_event_date date
)
returns public.guestbook_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_comment public.guestbook_comments;
  saved_comment public.guestbook_comments;
begin
  select *
  into existing_comment
  from public.guestbook_comments
  where user_id = p_user_id
  for update;

  if not found then
    insert into public.guestbook_comments (
      user_id,
      display_name,
      message,
      status,
      moderation_score,
      moderation_payload,
      rejection_reason,
      approved_at,
      hidden_at
    )
    values (
      p_user_id,
      p_display_name,
      p_message,
      p_status,
      p_moderation_score,
      coalesce(p_moderation_payload, '{}'::jsonb),
      p_rejection_reason,
      case when p_status = 'approved' then now() else null end,
      null
    )
    returning * into saved_comment;

    insert into public.comment_edit_events (user_id, comment_id, event_date, event_type)
    values (p_user_id, saved_comment.id, p_event_date, 'create');
  else
    insert into public.comment_edit_events (user_id, comment_id, event_date, event_type)
    values (p_user_id, existing_comment.id, p_event_date, 'edit');

    update public.guestbook_comments
    set display_name = p_display_name,
        message = p_message,
        status = p_status,
        moderation_score = p_moderation_score,
        moderation_payload = coalesce(p_moderation_payload, '{}'::jsonb),
        rejection_reason = p_rejection_reason,
        approved_at = case when p_status = 'approved' then now() else null end,
        hidden_at = null,
        last_submitted_at = now(),
        updated_at = now()
    where id = existing_comment.id
    returning * into saved_comment;
  end if;

  insert into public.moderation_events (
    comment_id,
    user_id,
    status,
    score,
    reason,
    payload
  )
  values (
    saved_comment.id,
    p_user_id,
    p_status,
    p_moderation_score,
    p_rejection_reason,
    coalesce(p_moderation_payload, '{}'::jsonb)
  );

  return saved_comment;
exception
  when unique_violation then
    raise exception 'edit_limit_exceeded' using errcode = 'P0001';
end;
$$;

revoke all on function public.upsert_guestbook_comment(
  uuid,
  text,
  text,
  public.comment_status,
  numeric,
  jsonb,
  text,
  date
) from public, anon, authenticated;
grant execute on function public.upsert_guestbook_comment(
  uuid,
  text,
  text,
  public.comment_status,
  numeric,
  jsonb,
  text,
  date
) to service_role;
