create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_players integer not null check (total_players > 0),
  group_count integer not null check (group_count >= 2),
  court_count integer not null check (court_count > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table scoring_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  win_points integer not null default 1,
  loss_points integer not null default 0,
  use_point_differential boolean not null default true,
  tie_breakers text[] not null default array['points', 'pointDifferential', 'pointsFor', 'wins', 'pointsAgainst']
);

create table players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  is_generated_name boolean not null default false,
  sort_order integer not null
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  sort_order integer not null
);

create table group_players (
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (group_id, player_id)
);

create table courts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  sort_order integer not null
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  court_id uuid not null references courts(id),
  group_a_id uuid not null references groups(id),
  group_b_id uuid not null references groups(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed')),
  manually_edited boolean not null default false,
  check (group_a_id <> group_b_id)
);

create table match_players (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id),
  group_id uuid not null references groups(id),
  side text not null check (side in ('A', 'B')),
  primary key (match_id, player_id)
);

create table match_results (
  match_id uuid primary key references matches(id) on delete cascade,
  score_a integer not null check (score_a >= 0),
  score_b integer not null check (score_b >= 0),
  winner_group_id uuid not null references groups(id),
  recorded boolean not null default true,
  recorded_at timestamptz not null default now()
);

create index matches_event_time_idx on matches(event_id, starts_at, court_id);
create index match_players_player_idx on match_players(player_id);
