-- 1. Create delivery_persons table
create table if not exists public.delivery_persons (
  id uuid not null default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id),
  name text not null,
  vehicle_type text not null check (vehicle_type in ('moto', 'bicicleta', 'moto_electrica', 'ciclomotor', 'carro')),
  unique_code text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint delivery_persons_pkey primary key (id),
  constraint delivery_persons_unique_code_key unique (unique_code)
);

-- 2. Add columns to orders table
alter table public.orders 
add column if not exists delivery_person_id uuid references public.delivery_persons(id),
add column if not exists assigned_at timestamp with time zone;

-- 3. Enable RLS
alter table public.delivery_persons enable row level security;

-- 4. Policies for delivery_persons
drop policy if exists "Enable read access for authenticated users based on business_id" on public.delivery_persons;
create policy "Enable read access for authenticated users based on business_id"
on public.delivery_persons
for select
to authenticated
using (
  auth.uid() = (select user_id from public.businesses where id = delivery_persons.business_id)
);

drop policy if exists "Enable insert access for authenticated users based on business_id" on public.delivery_persons;
create policy "Enable insert access for authenticated users based on business_id"
on public.delivery_persons
for insert
to authenticated
with check (
  auth.uid() = (select user_id from public.businesses where id = delivery_persons.business_id)
);

drop policy if exists "Enable update access for authenticated users based on business_id" on public.delivery_persons;
create policy "Enable update access for authenticated users based on business_id"
on public.delivery_persons
for update
to authenticated
using (
  auth.uid() = (select user_id from public.businesses where id = delivery_persons.business_id)
)
with check (
  auth.uid() = (select user_id from public.businesses where id = delivery_persons.business_id)
);

drop policy if exists "Enable delete access for authenticated users based on business_id" on public.delivery_persons;
create policy "Enable delete access for authenticated users based on business_id"
on public.delivery_persons
for delete
to authenticated
using (
  auth.uid() = (select user_id from public.businesses where id = delivery_persons.business_id)
);

-- 5. Create View for Statistics (Optional but recommended for easier querying)
create or replace view public.delivery_persons_with_stats 
with (security_invoker = on)
as
select 
  dp.*,
  count(o.id) filter (where o.status in ('despachado', 'entregado')) as total_deliveries
from public.delivery_persons dp
left join public.orders o on dp.id = o.delivery_person_id
group by dp.id;

-- 6. Indexes for performance
create index if not exists idx_orders_delivery_person_id on public.orders(delivery_person_id);
create index if not exists idx_delivery_persons_business_id on public.delivery_persons(business_id);
