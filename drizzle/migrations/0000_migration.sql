CREATE TABLE public.guild_configs (
  guild_id text PRIMARY KEY,
  channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  roles jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.guild_configs TO service_role;
ALTER TABLE public.guild_configs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id text NOT NULL,
  username text NOT NULL,
  avatar text,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dash_sessions TO service_role;
ALTER TABLE public.dash_sessions ENABLE ROW LEVEL SECURITY;