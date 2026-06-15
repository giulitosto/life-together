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
