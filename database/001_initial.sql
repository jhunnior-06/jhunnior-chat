-- Jhunnior Chat: migración inicial PostgreSQL. Ejecutar una sola vez como migrador.
BEGIN;
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth_subject text NOT NULL UNIQUE,
 display_name text NOT NULL DEFAULT '', role text NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 disabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_settings (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 theme text NOT NULL DEFAULT 'system' CHECK(theme IN ('light','dark','system')),
 language text NOT NULL DEFAULT 'es', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL DEFAULT 'Nuevo chat' CHECK(length(title)<=200),
 archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id)
);
CREATE TABLE messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL, user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('user','assistant')),
 parts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(parts)='array'),
 status text NOT NULL DEFAULT 'complete' CHECK(status IN ('pending','streaming','complete','cancelled','failed')),
 sequence_no bigint NOT NULL CHECK(sequence_no>=0), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conversation_id,user_id) REFERENCES conversations(id,user_id) ON DELETE CASCADE,
 UNIQUE(conversation_id,sequence_no), UNIQUE(id,user_id)
);
CREATE TABLE files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 original_name text NOT NULL, storage_key text NOT NULL UNIQUE, mime_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes>0), sha256 text CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','rejected','deleting')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id)
);
CREATE TABLE message_files (
 message_id uuid NOT NULL, file_id uuid NOT NULL, user_id uuid NOT NULL,
 PRIMARY KEY(message_id,file_id),
 FOREIGN KEY(message_id,user_id) REFERENCES messages(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(file_id,user_id) REFERENCES files(id,user_id) ON DELETE CASCADE
);
CREATE TABLE generations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, message_id uuid NOT NULL,
 request_key uuid NOT NULL, provider text NOT NULL, model text NOT NULL,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','running','complete','cancelled','failed')),
 input_tokens bigint CHECK(input_tokens>=0), output_tokens bigint CHECK(output_tokens>=0),
 estimated_cost_usd numeric(16,8) CHECK(estimated_cost_usd>=0), error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 FOREIGN KEY(message_id,user_id) REFERENCES messages(id,user_id) ON DELETE CASCADE,
 UNIQUE(user_id,request_key)
);
CREATE UNIQUE INDEX one_live_generation ON generations(message_id) WHERE status IN ('reserved','running');
CREATE TABLE feedback (
 message_id uuid PRIMARY KEY, user_id uuid NOT NULL, rating smallint NOT NULL CHECK(rating IN (-1,1)),
 comment text CHECK(length(comment)<=2000), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(message_id,user_id) REFERENCES messages(id,user_id) ON DELETE CASCADE
);
CREATE TABLE daily_usage (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, usage_date date NOT NULL,
 reserved_requests integer NOT NULL DEFAULT 0 CHECK(reserved_requests>=0),
 completed_requests integer NOT NULL DEFAULT 0 CHECK(completed_requests>=0),
 input_tokens bigint NOT NULL DEFAULT 0 CHECK(input_tokens>=0),
 output_tokens bigint NOT NULL DEFAULT 0 CHECK(output_tokens>=0), PRIMARY KEY(user_id,usage_date)
);
CREATE TABLE rate_windows (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, window_start timestamptz NOT NULL,
 requests integer NOT NULL DEFAULT 0 CHECK(requests>=0), PRIMARY KEY(user_id,window_start)
);
CREATE TABLE deletion_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), storage_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE webhook_events (
 event_id text PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_history ON conversations(user_id,updated_at DESC,id DESC);
CREATE INDEX files_owner ON files(user_id,created_at DESC);
CREATE INDEX generations_usage ON generations(user_id,created_at DESC);
CREATE INDEX deletion_jobs_pending ON deletion_jobs(next_attempt_at) WHERE status IN ('pending','failed');
-- La aplicación establece app.user_id LOCAL dentro de CADA transacción.
CREATE FUNCTION current_app_user() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.user_id',true),'')::uuid
$$;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON users USING (id=current_app_user()) WITH CHECK (id=current_app_user());
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON user_settings USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON conversations USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON messages USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE files FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON files USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
ALTER TABLE message_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_files FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON message_files USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON generations USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON feedback USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON daily_usage USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
ALTER TABLE rate_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_windows FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON rate_windows USING (user_id=current_app_user()) WITH CHECK (user_id=current_app_user());
-- Evita objetos huérfanos cuando se borra un archivo o un usuario.
CREATE FUNCTION enqueue_blob_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.deletion_jobs(storage_key) VALUES(OLD.storage_key) ON CONFLICT DO NOTHING;
 RETURN OLD;
END $$;
CREATE TRIGGER file_delete_outbox BEFORE DELETE ON files FOR EACH ROW EXECUTE FUNCTION enqueue_blob_delete();
COMMIT;
-- Crear roles separados: migrador (DDL), app_runtime (sin BYPASSRLS), worker y webhook.
-- NO conectar la aplicación con el rol propietario/superusuario.
