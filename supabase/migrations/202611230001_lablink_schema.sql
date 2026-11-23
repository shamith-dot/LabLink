-- LabLink initial schema. Safe to run once in the Supabase SQL Editor.
-- Creates missing objects and inserts catalog rows only when absent; it does not drop data.

create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Campus member',
  role text not null default 'student' check (role in ('student', 'faculty', 'admin')),
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  department text not null,
  lab text not null,
  stock integer not null default 1 check (stock > 0),
  description text not null default '',
  tags text[] not null default '{}',
  specs text[] not null default '{}',
  training text not null default 'Contact the lab manager',
  inspection text not null default 'Inspection record unavailable',
  lead_minutes integer not null default 0 check (lead_minutes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, lab)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  equipment_id uuid not null references public.equipment (id) on delete restrict,
  project text not null check (char_length(btrim(project)) between 3 and 100),
  booking_date date not null,
  start_time time not null,
  duration_hours integer not null check (duration_hours between 1 and 8),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time >= time '08:00' and start_time + make_interval(hours => duration_hours) <= time '18:00'),
  exclude using gist (
    equipment_id with =,
    tsrange(
      booking_date + start_time,
      booking_date + start_time + make_interval(hours => duration_hours),
      '[)'
    ) with &&
  ) where (status in ('pending', 'approved'))
);

create table if not exists public.project_access_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 3 and 100),
  course text not null check (char_length(btrim(course)) between 3 and 100),
  faculty text not null check (char_length(btrim(faculty)) between 3 and 100),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_active_name_idx on public.equipment (is_active, name);
create index if not exists bookings_student_date_idx on public.bookings (student_id, booking_date);
create index if not exists bookings_equipment_date_idx on public.bookings (equipment_id, booking_date);
create index if not exists bookings_status_created_idx on public.bookings (status, created_at);
create index if not exists project_access_student_created_idx on public.project_access_requests (student_id, created_at desc);
create index if not exists project_access_status_created_idx on public.project_access_requests (status, created_at);

create or replace function public.current_lablink_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
$$;

create or replace function public.handle_new_lablink_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Campus member'),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created_lablink'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created_lablink
      after insert on auth.users
      for each row execute function public.handle_new_lablink_user();
  end if;
end;
$$;

insert into public.profiles (id, display_name, role)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(u.email, '@', 1), ''), 'Campus member'),
  'student'
from auth.users as u
on conflict (id) do nothing;

create or replace function public.set_lablink_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_set_updated_at' and tgrelid = 'public.profiles'::regclass) then
    create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_lablink_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'equipment_set_updated_at' and tgrelid = 'public.equipment'::regclass) then
    create trigger equipment_set_updated_at before update on public.equipment for each row execute function public.set_lablink_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'bookings_set_updated_at' and tgrelid = 'public.bookings'::regclass) then
    create trigger bookings_set_updated_at before update on public.bookings for each row execute function public.set_lablink_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'project_access_set_updated_at' and tgrelid = 'public.project_access_requests'::regclass) then
    create trigger project_access_set_updated_at before update on public.project_access_requests for each row execute function public.set_lablink_updated_at();
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.equipment enable row level security;
alter table public.bookings enable row level security;
alter table public.project_access_requests enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.equipment to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, department) on public.profiles to authenticated;
grant select, insert on public.bookings to authenticated;
grant update (status, review_note, reviewed_by, reviewed_at) on public.bookings to authenticated;
grant select, insert on public.project_access_requests to authenticated;
grant update (status, review_note, reviewed_by, reviewed_at) on public.project_access_requests to authenticated;
grant insert, update on public.equipment to authenticated;

create policy "Equipment is readable by campus visitors"
  on public.equipment for select
  to anon, authenticated
  using (is_active or (select public.current_lablink_role()) in ('faculty', 'admin'));

create policy "Admins can manage the equipment catalog without deleting records"
  on public.equipment for all
  to authenticated
  using ((select public.current_lablink_role()) = 'admin')
  with check ((select public.current_lablink_role()) = 'admin');

create policy "Users can read their profile and reviewers can read campus profiles"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.current_lablink_role()) in ('faculty', 'admin'));

create policy "Users can update their profile without changing their role"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select public.current_lablink_role())
  );

create policy "Students and reviewers can read bookings"
  on public.bookings for select
  to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.current_lablink_role()) in ('faculty', 'admin')
  );

create policy "Students can create their own pending bookings"
  on public.bookings for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and review_note is null
    and (select public.current_lablink_role()) = 'student'
  );

create policy "Students can cancel pending bookings and reviewers can decide"
  on public.bookings for update
  to authenticated
  using (
    (student_id = (select auth.uid()) and status = 'pending')
    or ((select public.current_lablink_role()) in ('faculty', 'admin') and status = 'pending')
  )
  with check (
    (
      student_id = (select auth.uid())
      and status = 'cancelled'
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      (select public.current_lablink_role()) in ('faculty', 'admin')
      and status in ('approved', 'rejected')
      and reviewed_by = (select auth.uid())
      and reviewed_at is not null
    )
  );

create policy "Students and reviewers can read project requests"
  on public.project_access_requests for select
  to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.current_lablink_role()) in ('faculty', 'admin')
  );

create policy "Students can create their own pending project requests"
  on public.project_access_requests for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and review_note is null
    and (select public.current_lablink_role()) = 'student'
  );

create policy "Reviewers can decide project requests"
  on public.project_access_requests for update
  to authenticated
  using ((select public.current_lablink_role()) in ('faculty', 'admin') and status = 'pending')
  with check (
    (select public.current_lablink_role()) in ('faculty', 'admin')
    and status in ('approved', 'rejected')
    and reviewed_by = (select auth.uid())
    and reviewed_at is not null
  );

create or replace function public.get_equipment_schedule(
  p_start_date date,
  p_end_date date,
  p_equipment_id uuid default null
)
returns table (
  booking_id uuid,
  equipment_id uuid,
  booking_date date,
  start_time time,
  duration_hours integer,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.equipment_id, b.booking_date, b.start_time, b.duration_hours, b.status
  from public.bookings as b
  where b.booking_date between p_start_date and p_end_date
    and b.status in ('pending', 'approved')
    and (p_equipment_id is null or b.equipment_id = p_equipment_id)
$$;

grant execute on function public.get_equipment_schedule(date, date, uuid) to authenticated;

insert into public.equipment (name, category, department, lab, stock, description, tags, specs, training, inspection, lead_minutes)
values
  ('Arduino Mega 2560', 'Development Kits', 'Electronics', 'IoT Laboratory', 12, 'Microcontroller development board for embedded systems, sensor networks, and rapid prototyping.', array['embedded','sensor','iot','microcontroller','electronics','robotics'], array['ATmega2560 · 16 MHz','54 digital I/O pins','USB and 12 V input'], 'Introductory orientation', 'Inspected Nov 14, 2026', 10),
  ('Raspberry Pi 4', 'Development Kits', 'Computer Science', 'Innovation Lab', 6, 'Single-board computer for edge computing, computer vision, and connected campus prototypes.', array['iot','computer vision','ai','edge','python','embedded','sensor'], array['8 GB RAM · Quad-core','Dual micro-HDMI','Wi-Fi 5 and Bluetooth 5.0'], 'Self-guided quick start', 'Inspected Nov 18, 2026', 5),
  ('Digital Oscilloscope', 'Instruments', 'Electronics', 'Electronics Lab', 4, 'Four-channel signal measurement and waveform analysis for electronics research and teaching.', array['electronics','signal','waveform','circuit','measurement','electrical'], array['4 channels · 100 MHz','1 GSa/s real-time','USB data export'], 'Bench safety orientation', 'Calibrated Nov 12, 2026', 15),
  ('3D Printer', 'Machines', 'Mechanical', 'Maker Space', 2, 'FDM printing for functional prototypes, enclosures, fixtures, and iterative product design.', array['prototype','design','mechanical','manufacturing','3d','material'], array['Build volume · 256 mm³','PLA, PETG, TPU','0.4 mm nozzle'], 'Maker Space orientation', 'Serviced Nov 16, 2026', 20),
  ('FPGA Development Board', 'Development Kits', 'Computer Science', 'VLSI Lab', 8, 'Programmable logic platform for digital circuits, hardware acceleration, and embedded design.', array['digital','logic','hardware','computer science','circuit','signal'], array['Artix-7 FPGA','DDR3 memory · 512 MB','HDMI and Ethernet'], 'VLSI lab induction', 'Inspected Nov 11, 2026', 10),
  ('Digital Multimeter', 'Instruments', 'Electrical', 'Electrical Lab', 15, 'Handheld measurement of voltage, current, resistance, continuity, and diode response.', array['electrical','measurement','circuit','voltage','current','electronics'], array['True RMS measurement','CAT III 600 V','Auto-ranging'], 'Basic lab safety', 'Inspected Nov 19, 2026', 5),
  ('Thermal Camera', 'Instruments', 'Mechanical', 'Materials Lab', 3, 'Infrared imaging for thermal analysis, energy audits, and equipment diagnostics.', array['thermal','energy','materials','diagnostics','inspection','heat'], array['160 × 120 resolution','-20 °C to 400 °C','Radiometric JPEG capture'], 'Thermal handling briefing', 'Calibrated Nov 10, 2026', 10),
  ('Laser Cutter', 'Machines', 'Mechanical', 'Maker Space', 1, 'Enclosed CO₂ laser cutter for precise fabrication of approved sheet materials and prototypes.', array['prototype','design','fabrication','manufacturing','mechanical','materials'], array['60 W CO₂ laser','Work area · 600 × 400 mm','Enclosed with extraction'], 'Certified operator required', 'Serviced Nov 17, 2026', 25)
on conflict (name, lab) do nothing;
