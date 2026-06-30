-- ── Life Together: Supabase schema ──────────────────────────────────────────
-- Run this once in the Supabase SQL editor for the Life Together project.

-- Profiles: one per couple, auto-created on signup
create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text,
  name_a     text,
  name_b     text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own"
  on public.profiles for all
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, email)
  values (new.id, new.email)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Progress: one row per couple per page, stores textarea values as JSONB
create table public.progress (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  page       text not null,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, page)
);

alter table public.progress enable row level security;

create policy "own"
  on public.progress for all
  using (auth.uid() = user_id);

create index on public.progress(user_id, page);

-- ── 2026-06-30: Couple profile & joint progress ───────────────────────────────
-- Run these in the Supabase SQL editor (append to existing schema).

-- Fix missing completed column on progress
alter table public.progress
  add column if not exists completed boolean not null default false;

-- Extend profiles with display names and couple link
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists partner_name text,
  add column if not exists partner_email text,
  add column if not exists couple_id uuid;

-- Couples: links two user accounts
create table if not exists public.couples (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid references auth.users(id) on delete cascade not null,
  user_b       uuid references auth.users(id) on delete cascade,
  invite_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  created_at   timestamptz not null default now()
);

alter table public.couples enable row level security;

create policy "couple_members"
  on public.couples for all
  using (user_a = auth.uid() or user_b = auth.uid());

-- Couple progress: shared between both partners for M2 + M3
create table if not exists public.couple_progress (
  id         bigserial primary key,
  couple_id  uuid references public.couples(id) on delete cascade not null,
  page       text not null,
  data       jsonb not null default '{}',
  completed  boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(couple_id, page)
);

alter table public.couple_progress enable row level security;

create policy "couple_members"
  on public.couple_progress for all
  using (
    exists (
      select 1 from public.couples
      where couples.id = couple_progress.couple_id
        and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
    )
  );

-- Secure join function: allows partner B to accept invite without exposing service key
create or replace function public.accept_couple_invite(invite_token_param text)
returns uuid language plpgsql security definer as $$
declare
  couple_row public.couples;
begin
  select * into couple_row
    from public.couples
    where invite_token = invite_token_param and user_b is null;
  if not found then
    raise exception 'Invalid or already used invite token';
  end if;
  if couple_row.user_a = auth.uid() then
    raise exception 'Cannot accept your own invite';
  end if;
  update public.couples set user_b = auth.uid() where id = couple_row.id;
  update public.profiles set couple_id = couple_row.id
    where id in (couple_row.user_a, auth.uid());
  return couple_row.id;
end;
$$;

-- Grants
grant all on public.couples to anon, authenticated;
grant all on public.couple_progress to anon, authenticated;
grant all on sequence public.couple_progress_id_seq to anon, authenticated;
grant execute on function public.accept_couple_invite to authenticated;
