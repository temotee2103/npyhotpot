-- Create Profiles Table (Public Profile Information)
create table profiles_xhs (
  id uuid references auth.users not null primary key,
  role text check (role in ('merchant', 'influencer')) not null default 'influencer',
  xhs_id text,
  nickname text,
  avatar_url text,
  niche_tags text[],
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Enable Row Level Security (RLS)
alter table profiles_xhs enable row level security;
-- Create Policy: Public can view all profiles
create policy "Public profiles are viewable by everyone"
  on profiles_xhs for select
  using ( true );
-- Create Policy: Users can insert their own profile
create policy "Users can insert their own profile"
  on profiles_xhs for insert
  with check ( auth.uid() = id );
-- Create Policy: Users can update own profile
create policy "Users can update own profile"
  on profiles_xhs for update
  using ( auth.uid() = id );
-- Create Influencer Services Table
create table influencer_services_xhs (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles_xhs(id) on delete cascade not null,
  service_type text check (service_type in ('posting', 'barter', 'paid')) not null,
  price numeric,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Enable RLS
alter table influencer_services_xhs enable row level security;
-- Policy: Public view
create policy "Services are viewable by everyone"
  on influencer_services_xhs for select
  using ( true );
-- Policy: Owner update
create policy "Influencers can manage own services"
  on influencer_services_xhs for all
  using ( auth.uid() = profile_id );
-- Create Content Drafts Table (For Merchants)
create table content_drafts_xhs (
  id uuid default gen_random_uuid() primary key,
  merchant_id uuid references auth.users not null,
  title text,
  content text,
  media_urls text[],
  ai_generated boolean default false,
  status text default 'draft',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Enable RLS
alter table content_drafts_xhs enable row level security;
-- Policy: Merchants can manage their own drafts
create policy "Merchants can manage own drafts"
  on content_drafts_xhs for all
  using ( auth.uid() = merchant_id );
-- Create a bucket for media
insert into storage.buckets (id, name, public) values ('media_xhs', 'media_xhs', true)
on conflict (id) do nothing;
-- Policy for storage
create policy "Authenticated users can upload media"
on storage.objects for insert
with check ( bucket_id = 'media_xhs' and auth.role() = 'authenticated' );
create policy "Public can view media"
on storage.objects for select
using ( bucket_id = 'media_xhs' );
