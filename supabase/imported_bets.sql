-- Bets imported from betmma.tips. Run once in the Supabase SQL editor.
--
-- Kept out of the bets table on purpose: the leaderboard and activity feed read
-- bet_summary (built on bets), so imported history can never appear publicly.
-- Row level security means each user can only ever read or change their own rows.

create table if not exists public.imported_bets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source       text not null default 'betmma',
  source_id    text not null,                -- the bet's id on the source site, for skipping re-imports
  event_name   text,
  event_date   date,
  bet_type     text not null check (bet_type in ('moneyline', 'props', 'parlay')),
  pick         text not null check (char_length(pick) <= 1000),
  odds         numeric not null,             -- American, unrounded so profit matches the source
  stake_units  numeric not null check (stake_units > 0),  -- betmma.tips allows stakes like 0.333u
  result       text not null check (result in ('win', 'loss', 'push', 'void')),
  notes        text check (char_length(notes) <= 4000),
  imported_at  timestamptz not null default now(),
  unique (user_id, source, source_id)
);

create index if not exists imported_bets_user_date_idx on public.imported_bets (user_id, event_date desc);

alter table public.imported_bets enable row level security;

drop policy if exists "Owners read their imported bets" on public.imported_bets;
create policy "Owners read their imported bets" on public.imported_bets
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Owners add their imported bets" on public.imported_bets;
create policy "Owners add their imported bets" on public.imported_bets
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Owners delete their imported bets" on public.imported_bets;
create policy "Owners delete their imported bets" on public.imported_bets
  for delete to authenticated using (auth.uid() = user_id);

-- No update policy: imported history is read-only; remove and re-import instead.
revoke all on public.imported_bets from anon;
