-- ═══════════════════════════════════════════
-- BIGROCK STUDIOS — PRODUCTION PIPELINE
-- Supabase Schema
-- ═══════════════════════════════════════════

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────
-- ENUM TYPES
-- ──────────────────────────────────────────

create type department as enum (
  'concept', 'modeling', 'texturing', 'rigging', 'animation', 'compositing'
);

create type shot_status as enum (
  'not_started', 'in_progress', 'review', 'needs_revision', 'approved'
);

create type task_status as enum (
  'todo', 'wip', 'review', 'approved'
);

-- ──────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ──────────────────────────────────────────

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  avatar_url text,
  role text not null default 'studente',  -- 'admin', 'docente', 'coordinatore', 'studente', or custom
  department department,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
declare
  user_name text;
begin
  -- Extract name from email: nome.cognome@bigrock.it → Nome Cognome
  user_name := replace(split_part(new.email, '@', 1), '.', ' ');
  user_name := initcap(user_name);

  insert into profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    user_name,
    new.raw_user_meta_data ->> 'avatar_url',
    'studente'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ──────────────────────────────────────────
-- SHOTS
-- ──────────────────────────────────────────

create table shots (
  id uuid default uuid_generate_v4() primary key,
  code text not null,             -- e.g. SH010
  sequence text not null,          -- e.g. SEQ01
  description text,
  sort_order int default 0,
  concept_image_url text,          -- uploaded by professors
  -- Per-department status
  status_concept shot_status default 'not_started',
  status_modeling shot_status default 'not_started',
  status_texturing shot_status default 'not_started',
  status_rigging shot_status default 'not_started',
  status_animation shot_status default 'not_started',
  status_compositing shot_status default 'not_started',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ──────────────────────────────────────────
-- TASKS
-- ──────────────────────────────────────────

create table tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  department department not null,
  status task_status default 'todo',
  assigned_to uuid references profiles(id),
  shot_id uuid references shots(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ──────────────────────────────────────────
-- COMMENTS (on tasks)
-- ──────────────────────────────────────────

create table comments (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references tasks(id) on delete cascade not null,
  author_id uuid references profiles(id) not null,
  body text not null,
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────
-- CALENDAR EVENTS
-- ──────────────────────────────────────────

create table calendar_events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  event_date date not null,
  event_time time,
  is_milestone boolean default false,
  color text default '#6ea8fe',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────
-- NOTIFICATIONS
-- ──────────────────────────────────────────

create table notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,            -- 'comment', 'task_assigned', 'task_approved', 'task_revision', 'event'
  title text not null,
  body text,
  link_type text,                -- 'task', 'shot', 'calendar'
  link_id uuid,
  read boolean default false,
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ──────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger shots_updated_at before update on shots
  for each row execute function update_updated_at();

create trigger tasks_updated_at before update on tasks
  for each row execute function update_updated_at();

-- ──────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────

alter table profiles enable row level security;
alter table shots enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table calendar_events enable row level security;
alter table notifications enable row level security;

-- Helper: check if user is staff (not student)
create or replace function is_staff(user_id uuid)
returns boolean as $$
  select exists(
    select 1 from profiles
    where id = user_id and role != 'studente'
  );
$$ language sql security definer;

-- Helper: check if user is admin
create or replace function is_admin(user_id uuid)
returns boolean as $$
  select exists(
    select 1 from profiles
    where id = user_id and role = 'admin'
  );
$$ language sql security definer;

-- PROFILES: everyone can read, only admin can update roles
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
create policy "profiles_update_admin" on profiles for update
  using (is_admin(auth.uid()));

-- SHOTS: everyone reads, staff edits
create policy "shots_select" on shots for select using (true);
create policy "shots_insert" on shots for insert with check (is_staff(auth.uid()));
create policy "shots_update" on shots for update using (is_staff(auth.uid()));
create policy "shots_delete" on shots for delete using (is_staff(auth.uid()));

-- TASKS: everyone reads, staff creates/deletes, assigned user or staff can update
create policy "tasks_select" on tasks for select using (true);
create policy "tasks_insert" on tasks for insert with check (is_staff(auth.uid()));
create policy "tasks_update" on tasks for update
  using (is_staff(auth.uid()) or auth.uid() = assigned_to);
create policy "tasks_delete" on tasks for delete using (is_staff(auth.uid()));

-- COMMENTS: everyone reads, author or staff can insert
create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert
  with check (
    is_staff(auth.uid())
    or exists(
      select 1 from tasks where id = task_id and assigned_to = auth.uid()
    )
  );

-- CALENDAR: everyone reads, staff writes
create policy "calendar_select" on calendar_events for select using (true);
create policy "calendar_insert" on calendar_events for insert with check (is_staff(auth.uid()));
create policy "calendar_update" on calendar_events for update using (is_staff(auth.uid()));
create policy "calendar_delete" on calendar_events for delete using (is_staff(auth.uid()));

-- NOTIFICATIONS: user sees own
create policy "notif_select" on notifications for select using (auth.uid() = user_id);
create policy "notif_update" on notifications for update using (auth.uid() = user_id);
create policy "notif_insert" on notifications for insert with check (true);

-- ──────────────────────────────────────────
-- STORAGE (for concept images)
-- ──────────────────────────────────────────
-- Run this in the Supabase dashboard under Storage:
-- Create bucket: "shot-concepts" (public)
-- Policy: staff can upload, everyone can read

-- ──────────────────────────────────────────
-- REALTIME
-- ──────────────────────────────────────────
-- Enable realtime for these tables in Supabase dashboard:
-- shots, tasks, comments, notifications
