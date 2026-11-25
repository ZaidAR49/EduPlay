-- =========================================================================
-- Idempotent PostgreSQL 17 + Supabase CI Schema
-- Mirrors lib/db/schema.ts + triggers/indexes/RLS/Realtime from schema.sql
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'viewer', 'editor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.game_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.play_status AS ENUM ('draft', 'live', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.usage_activity AS ENUM ('ai_generation', 'game_play');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Trigger Functions
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_play_is_live()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM classroom_plays
    WHERE id = NEW.classroom_play_id AND status = 'live'
  ) THEN
    RAISE EXCEPTION 'Cannot join or modify: this play is not live';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_game_play_count_on_player()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE games SET play_count = play_count + 1
  WHERE id = (SELECT game_id FROM classroom_plays WHERE id = NEW.classroom_play_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_user_usage_counters()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.activity = 'ai_generation' THEN
    UPDATE users
    SET ai_tokens_used_current_period = COALESCE(ai_tokens_used_current_period, 0) + COALESCE(NEW.tokens_used, 0),
        ai_requests_current_period = COALESCE(ai_requests_current_period, 0) + 1
    WHERE id = NEW.user_id;
  ELSIF NEW.activity = 'game_play' THEN
    UPDATE users
    SET game_plays_current_period = COALESCE(game_plays_current_period, 0) + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Tables
CREATE TABLE IF NOT EXISTS public.users (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                            text,
  email                           text UNIQUE,
  "emailVerified"                 timestamptz,
  image                           text,
  password_hash                   text,
  role                            public.user_role NOT NULL DEFAULT 'user',
  is_locked                       boolean NOT NULL DEFAULT false,
  is_subscribed                   boolean NOT NULL DEFAULT false,
  subscription_plan               text,
  subscription_expires_at         timestamptz,
  locale                          text NOT NULL DEFAULT 'ar',
  last_login_at                   timestamptz,
  last_active_at                  timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  deleted_at                      timestamptz,
  ai_tokens_used_current_period   integer DEFAULT 0,
  ai_requests_current_period      integer DEFAULT 0,
  game_plays_current_period       integer DEFAULT 0,
  usage_period_started_at         timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at_users ON public.users;
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                text NOT NULL,
  provider            text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token       text,
  access_token        text,
  expires_at          integer,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS public.sessions (
  "sessionToken" text PRIMARY KEY,
  "userId"       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires        timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.verification_token (
  identifier text NOT NULL,
  token      text NOT NULL,
  expires    timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid REFERENCES public.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  logo_path      text,
  introduction   jsonb NOT NULL DEFAULT '{"title":"اختبر معلوماتك","subtitle":"لعبة تفاعلية تعليمية للجميع","welcome_box":{"description":"مرحباً بك! 👋 ستواجه في هذا الاختبار مجموعة من الأسئلة المتنوعة. اختر الإجابة الصحيحة في كل سؤال واجمع أكبر عدد من النقاط!","closing_question":"هل أنت مستعد لاختبار معلوماتك?"},"button_text":"ابدأ الاختبار 🚀","decorative_emojis":["✨","☀️","⭐"],"back_link_text":"العودة للرئيسية"}'::jsonb,
  result_screen  jsonb NOT NULL DEFAULT '{"pass":{"title":"ممتاز!","small_description":"لقد أثبتّ جدارتك!","message":"أحسنت صنعاً! لقد أتممت الاختبار بنجاح مبهر."},"fail":{"title":"لا بأس، استمر!","small_description":"كل محاولة تعلّم جديد!","message":"لا تيأس! كل سؤال أخطأت فيه هو معلومة جديدة تعلمتها. جرب مرة أخرى!"}}'::jsonb,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations (owner_id);

CREATE TABLE IF NOT EXISTS public.games (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  slug             text NOT NULL UNIQUE,
  icon             text,
  status           public.game_status NOT NULL DEFAULT 'draft',
  language         text NOT NULL DEFAULT 'ar',
  is_public        boolean NOT NULL DEFAULT true,
  is_demo          boolean NOT NULL DEFAULT false,
  access_code      text,
  settings         jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_points       integer NOT NULL DEFAULT 0,
  play_count       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

DROP TRIGGER IF EXISTS set_updated_at_games ON public.games;
CREATE TRIGGER set_updated_at_games
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_games_organization_id ON public.games (organization_id);
CREATE INDEX IF NOT EXISTS idx_games_owner_id ON public.games (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games (status);

CREATE TABLE IF NOT EXISTS public.scenarios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  order_index  integer NOT NULL DEFAULT 0,
  icon         text,
  title        text NOT NULL,
  description  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at_scenarios ON public.scenarios;
CREATE TRIGGER set_updated_at_scenarios
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_scenarios_game_order ON public.scenarios (game_id, order_index);

CREATE TABLE IF NOT EXISTS public.choices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id       uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  order_index       integer NOT NULL DEFAULT 0,
  text              text NOT NULL,
  icon              text,
  is_correct        boolean NOT NULL DEFAULT false,
  feedback_title    text,
  feedback_message  text,
  feedback_tip      text,
  points            integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_choices_scenario_order ON public.choices (scenario_id, order_index);

CREATE TABLE IF NOT EXISTS public.classroom_plays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       public.play_status NOT NULL DEFAULT 'draft',
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at_classroom_plays ON public.classroom_plays;
CREATE TRIGGER set_updated_at_classroom_plays
  BEFORE UPDATE ON public.classroom_plays
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_live_play_per_game
  ON public.classroom_plays (game_id) WHERE status = 'live';

CREATE TABLE IF NOT EXISTS public.players (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_play_id      uuid NOT NULL REFERENCES public.classroom_plays(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  total_score            integer NOT NULL DEFAULT 0,
  total_correct_answers  integer NOT NULL DEFAULT 0,
  total_wrong_answers    integer NOT NULL DEFAULT 0,
  is_finished            boolean NOT NULL DEFAULT false,
  started_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz,
  duration_seconds       integer GENERATED ALWAYS AS (EXTRACT(epoch FROM (completed_at - started_at))::integer) STORED,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_play_id, name)
);

DROP TRIGGER IF EXISTS enforce_play_live ON public.players;
CREATE TRIGGER enforce_play_live
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.check_play_is_live();

DROP TRIGGER IF EXISTS on_player_created ON public.players;
CREATE TRIGGER on_player_created
  AFTER INSERT ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.increment_game_play_count_on_player();

CREATE INDEX IF NOT EXISTS idx_players_classroom_play_id ON public.players (classroom_play_id);
CREATE INDEX IF NOT EXISTS idx_players_is_finished ON public.players (classroom_play_id, is_finished);

-- Ensure Supabase Realtime broadcasts player row changes to the teacher live dashboard
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for realtime" ON public.players;
CREATE POLICY "Enable read access for realtime"
  ON public.players
  FOR SELECT
  TO public
  USING (true);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.usage_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity         public.usage_activity NOT NULL,
  tokens_used      integer DEFAULT 0,
  game_id          uuid REFERENCES public.games(id) ON DELETE SET NULL,
  organization_id  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  metadata         jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_increment_user_usage_counters ON public.usage_events;
CREATE TRIGGER trg_increment_user_usage_counters
  AFTER INSERT ON public.usage_events
  FOR EACH ROW EXECUTE FUNCTION public.increment_user_usage_counters();

CREATE TABLE IF NOT EXISTS public.system_announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL,
  title        text NOT NULL,
  body         text,
  severity     text NOT NULL DEFAULT 'info',
  language     text NOT NULL DEFAULT 'all',
  is_active    boolean NOT NULL DEFAULT true,
  starts_at    timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz,
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at_system_announcements ON public.system_announcements;
CREATE TRIGGER set_updated_at_system_announcements
  BEFORE UPDATE ON public.system_announcements
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.system_announcement_reads (
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  announcement_id  uuid NOT NULL REFERENCES public.system_announcements(id) ON DELETE CASCADE,
  read_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type         text NOT NULL,
  title        text NOT NULL,
  body         text,
  link         text,
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at_user_notifications ON public.user_notifications;
CREATE TRIGGER set_updated_at_user_notifications
  BEFORE UPDATE ON public.user_notifications
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_id  uuid REFERENCES public.users(id) ON DELETE CASCADE,
  action          text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Stored analytics helper
CREATE OR REPLACE FUNCTION public.get_game_stats(p_game_id uuid)
 RETURNS TABLE(total_plays bigint, completed_plays bigint, completion_rate numeric, avg_score numeric, avg_duration_secs numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    count(*)                                                      AS total_plays,
    count(*) FILTER (WHERE p.is_finished = true)                  AS completed_plays,
    round(100.0 * count(*) FILTER (WHERE p.is_finished = true)
      / nullif(count(*), 0), 1)                                   AS completion_rate,
    round(avg(p.total_score) FILTER (WHERE p.is_finished = true), 1) AS avg_score,
    round(avg(p.duration_seconds) FILTER (WHERE p.is_finished = true), 1) AS avg_duration_secs
  FROM players p
  JOIN classroom_plays cp ON cp.id = p.classroom_play_id
  WHERE cp.game_id = p_game_id;
$function$;
