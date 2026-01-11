-- Create promotions table
create table if not exists public.promotions (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references public.businesses(id) not null,
  title text not null,
  description text,
  image_url text,
  price decimal(10,2) not null,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  is_active boolean default true,
  product_ids jsonb default '[]'::jsonb, -- Array of product IDs included
  quick_comments jsonb default '[]'::jsonb,
  sides jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.promotions enable row level security;

-- Policies
create policy "Public promotions are viewable by everyone"
  on public.promotions for select
  using (true);

create policy "Users can insert their own business promotions"
  on public.promotions for insert
  with check (auth.uid() in (
    select owner_id from public.businesses where id = business_id
  ));

create policy "Users can update their own business promotions"
  on public.promotions for update
  using (auth.uid() in (
    select owner_id from public.businesses where id = business_id
  ));

create policy "Users can delete their own business promotions"
  on public.promotions for delete
  using (auth.uid() in (
    select owner_id from public.businesses where id = business_id
  ));
