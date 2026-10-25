-- Strona rekrutacyjna serwera (Premium): podania kandydatów i uprawnienia ekipy rekrutacyjnej.
CREATE TABLE IF NOT EXISTS public.recruit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  position_id text NOT NULL,
  position_label text NOT NULL,
  discord_nick text NOT NULL,
  discord_id text,
  roblox_nick text NOT NULL,
  age integer NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_score integer NOT NULL DEFAULT 0,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  tab_switches integer NOT NULL DEFAULT 0,
  ip_hash text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  note text NOT NULL DEFAULT '',
  reviewed_by text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recruit_applications_guild_idx ON public.recruit_applications (guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recruit_applications_cooldown_idx ON public.recruit_applications (guild_id, ip_hash, created_at DESC);
GRANT ALL ON public.recruit_applications TO service_role;
ALTER TABLE public.recruit_applications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.recruit_staff (
  guild_id text NOT NULL,
  discord_user_id text NOT NULL,
  username text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'review',
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, discord_user_id)
);
GRANT ALL ON public.recruit_staff TO service_role;
ALTER TABLE public.recruit_staff ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.recruit_applications IS 'Podania z publicznej strony rekrutacyjnej serwera; dostęp tylko przez funkcje serwerowe';
COMMENT ON TABLE public.recruit_staff IS 'Osoby z dostępem do panelu rekrutacji serwera (level: view | review)';
