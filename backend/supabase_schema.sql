-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS TABLE
create table public.users (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can view their own profile" 
  on public.users for select 
  using (auth.uid() = id);

create policy "Users can update their own profile" 
  on public.users for update 
  using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CONNECTED ACCOUNTS TABLE
create table public.connected_accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  provider text default 'google',
  is_active BOOLEAN DEFAULT TRUE,
  email text not null,
  access_token text, -- Consider encryption in production
  refresh_token text, -- Consider encryption in production
  token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.connected_accounts enable row level security;

create policy "Users can view their own connected accounts" 
  on public.connected_accounts for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own connected accounts" 
  on public.connected_accounts for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own connected accounts" 
  on public.connected_accounts for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own connected accounts" 
  on public.connected_accounts for delete 
  using (auth.uid() = user_id);


-- 3. EVENTS TABLE
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  account_id uuid references public.connected_accounts(id) on delete cascade not null,
  google_event_id text not null,
  title text,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_all_day boolean default false,
  location text,
  html_link text,
  meeting_link text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(account_id, google_event_id)
);

alter table public.events enable row level security;

create policy "Users can view their own events" 
  on public.events for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own events" 
  on public.events for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own events" 
  on public.events for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own events" 
  on public.events for delete 
  using (auth.uid() = user_id);


-- 4. REMINDERS TABLE
create table public.reminders (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  reminder_time timestamptz not null,
  type text default 'notification', -- 'notification', 'alarm', 'morning_mode'
  is_dismissed boolean default false,
  created_at timestamptz default now()
);

alter table public.reminders enable row level security;

create policy "Users can view their own reminders" 
  on public.reminders for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own reminders" 
  on public.reminders for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own reminders" 
  on public.reminders for update 
  using (auth.uid() = user_id);


-- 5. ALARM SETTINGS TABLE
create table public.alarm_settings (
  user_id uuid references public.users(id) primary key,
  morning_mode_enabled boolean default false,
  morning_mode_sound text default 'default',
  default_alarm_sound text default 'default',
  global_reminder_offset_minutes int default 30, -- Deprecated, keep for backup
  reminder_offsets int[] default '{30}', -- New array column
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.alarm_settings enable row level security;

create policy "Users can view their own settings" 
  on public.alarm_settings for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own settings" 
  on public.alarm_settings for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own settings" 
  on public.alarm_settings for update 
  using (auth.uid() = user_id);

