do $$
begin
  create type public.rsvp_side as enum ('groom', 'bride');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rsvp_meal as enum ('yes', 'no', 'na');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  attending boolean not null,
  side public.rsvp_side not null,
  party_size smallint not null default 1,
  meal public.rsvp_meal not null,
  contact text,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rsvp_one_per_user unique (user_id),
  constraint rsvp_party_size_range check (party_size between 1 and 8),
  constraint rsvp_display_name_length check (char_length(display_name) between 1 and 20),
  constraint rsvp_contact_length check (contact is null or char_length(contact) between 1 and 30),
  constraint rsvp_message_length check (message is null or char_length(message) between 1 and 200),
  constraint rsvp_contact_format check (contact is null or contact ~ '^[0-9+\-\s().]*$'),
  constraint rsvp_meal_consistency check (
    (attending = false and meal = 'na' and party_size = 1)
    or (attending = true and meal in ('yes', 'no'))
  )
);

create index if not exists rsvp_responses_updated_at_idx
  on public.rsvp_responses(updated_at desc);

alter table public.rsvp_responses enable row level security;

drop policy if exists "users can read own rsvp" on public.rsvp_responses;
create policy "users can read own rsvp"
  on public.rsvp_responses for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.upsert_rsvp_response(
  p_user_id uuid,
  p_display_name text,
  p_attending boolean,
  p_side public.rsvp_side,
  p_party_size smallint,
  p_meal public.rsvp_meal,
  p_contact text,
  p_message text
)
returns public.rsvp_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_row public.rsvp_responses;
  v_party smallint := case when p_attending then p_party_size else 1 end;
  v_meal public.rsvp_meal := case when p_attending then p_meal else 'na'::public.rsvp_meal end;
  v_contact text := nullif(trim(coalesce(p_contact, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  insert into public.rsvp_responses (
    user_id, display_name, attending, side, party_size, meal, contact, message
  )
  values (
    p_user_id, p_display_name, p_attending, p_side, v_party, v_meal, v_contact, v_message
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        attending = excluded.attending,
        side = excluded.side,
        party_size = excluded.party_size,
        meal = excluded.meal,
        contact = excluded.contact,
        message = excluded.message,
        updated_at = now()
  returning * into saved_row;

  return saved_row;
end;
$$;

revoke all on function public.upsert_rsvp_response(
  uuid,
  text,
  boolean,
  public.rsvp_side,
  smallint,
  public.rsvp_meal,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.upsert_rsvp_response(
  uuid,
  text,
  boolean,
  public.rsvp_side,
  smallint,
  public.rsvp_meal,
  text,
  text
) to service_role;
