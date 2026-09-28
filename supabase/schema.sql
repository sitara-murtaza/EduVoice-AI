-- Run once in a new Supabase project. auth.users is the canonical users table.
-- The working MVP uses profiles.data as an atomic learning-state document.
-- Normalized tables below are prepared for future per-record sync, not double-written.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Students own profile" on public.profiles for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create table public.subjects(id uuid primary key default gen_random_uuid(),name text not null unique,created_at timestamptz not null default now());
create table public.topics(id uuid primary key default gen_random_uuid(),subject_id uuid not null references public.subjects(id),name text not null,created_at timestamptz not null default now());
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
create policy "Read subjects" on public.subjects for select to authenticated using (true);
create policy "Read topics" on public.topics for select to authenticated using (true);
create table public.learning_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,subject text,topic text,minutes numeric not null default 0 check(minutes>=0),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.voice_messages(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,session_id uuid references public.learning_sessions(id) on delete cascade,role text check(role in ('user','model')),content text not null,created_at timestamptz not null default now());
create table public.quiz_questions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,subject text,topic text,question text not null,reference_answer text,created_at timestamptz not null default now());
create table public.quiz_attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,subject text,topic text,score integer not null check(score>=0),total integer not null check(total>0),created_at timestamptz not null default now(),check(score<=total));
create table public.mistakes(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,subject text,topic text,question text not null,student_answer text,explanation text,difficulty text,reviewed boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.recommendations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,topic text,reason text,estimated_minutes integer,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.progress_records(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,metric text not null,value numeric not null,created_at timestamptz not null default now());
create table public.user_settings(user_id uuid primary key references auth.users(id) on delete cascade,settings jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
do $$ declare t text; begin
 foreach t in array array['learning_sessions','voice_messages','quiz_questions','quiz_attempts','mistakes','recommendations','progress_records','user_settings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy "Student owned records" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
 end loop;
end $$;
