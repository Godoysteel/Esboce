create table if not exists public.legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  terms_accepted_at timestamptz not null default now(),
  privacy_acknowledged_at timestamptz not null default now(),
  age_confirmed_at timestamptz not null default now(),
  primary key (user_id, terms_version, privacy_version)
);

alter table public.legal_acceptances enable row level security;

drop policy if exists "Usuarios consultam os proprios aceites" on public.legal_acceptances;
create policy "Usuarios consultam os proprios aceites"
  on public.legal_acceptances for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Usuarios registram os proprios aceites" on public.legal_acceptances;
create policy "Usuarios registram os proprios aceites"
  on public.legal_acceptances for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke all on table public.legal_acceptances from anon;
grant select, insert on table public.legal_acceptances to authenticated;
