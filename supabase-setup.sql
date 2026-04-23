-- ============================================================
--  PanCanAir — Supabase leads table setup
--  Run this once in Supabase Dashboard → SQL Editor
--  Project: zfeewaswxkdiicegcsqz.supabase.co
-- ============================================================

-- 1. Create the leads table
create table if not exists leads (
  id          uuid        default gen_random_uuid() primary key,
  created_at  timestamptz default now(),
  name        text,
  email       text,
  company     text,
  phone       text,
  building    text,       -- e.g. "Residential Condo (High-rise)"
  units       text,       -- e.g. "100 – 250 units"
  service     text,       -- e.g. "Boilers + Hydronic"
  pain        text,       -- e.g. "Unpredictable costs / surprise bills"
  source      text default 'website'
);

-- 2. Enable Row Level Security
alter table leads enable row level security;

-- 3. Allow anonymous inserts (the website anon key can write rows)
create policy "anon_insert_leads"
  on leads
  for insert
  to anon
  with check (true);

-- 4. Block anonymous reads (only the dashboard / service role can read)
create policy "service_select_leads"
  on leads
  for select
  to service_role
  using (true);

-- ============================================================
--  WEBHOOK (set this up in Dashboard → Database → Webhooks)
-- ============================================================
--  Name:    new_lead_notify
--  Table:   leads
--  Events:  INSERT
--  Type:    HTTP Request — POST
--  URL:     your Make.com / Zapier / Slack webhook URL
--
--  Supabase will POST the full row as JSON:
--  {
--    "type": "INSERT",
--    "table": "leads",
--    "record": { "name": "...", "email": "...", ... }
--  }
-- ============================================================
