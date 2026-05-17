-- ============================================================
-- REGARDS — Post-deployment bootstrap
-- Run ONCE after `drizzle-kit push` has created the schema.
-- ============================================================
-- Connect with:
--   docker compose exec postgres psql -U regards -d regards -f /bootstrap.sql
-- Or paste interactively into psql.

-- ------------------------------------------------------------
-- 1) Google Drive configuration — OPTIONNEL
-- ------------------------------------------------------------
-- Décommentez UNIQUEMENT si vous activez la sync Drive (var d'env
-- GOOGLE_SERVICE_ACCOUNT_KEY définie). Sans Drive, l'app fonctionne en
-- mode 100% local : les fichiers restent dans MinIO, servis via Next.js.
--
-- folder_id            = ID du dossier racine Drive partagé avec le Service Account
--                        (visible dans l'URL Drive : https://drive.google.com/drive/folders/<ID>)
-- all_moments_folder_id = ID du sous-dossier "_Tous les moments" (optionnel)
--
-- INSERT INTO config (key, value) VALUES (
--   'drive',
--   jsonb_build_object(
--     'folder_id', 'REPLACE_WITH_DRIVE_ROOT_FOLDER_ID',
--     'all_moments_folder_id', 'REPLACE_WITH_ALL_MOMENTS_FOLDER_ID_OR_NULL'
--   )
-- )
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ------------------------------------------------------------
-- 2) Moments du mariage (Malachie & Jessica — 23 mai 2026, Nantes)
-- ------------------------------------------------------------
-- Renseignez les vraies plages horaires. Toutes en Europe/Paris (CEST = UTC+2).
-- Format ISO 8601 avec timezone.
-- À éditer avant exécution.
INSERT INTO moments (label, start_time, end_time, auto_generated) VALUES
  ('Préparatifs',        '2026-05-23T10:00:00+02:00', '2026-05-23T13:00:00+02:00', false),
  ('Cérémonie',          '2026-05-23T14:30:00+02:00', '2026-05-23T16:00:00+02:00', false),
  ('Vin d''honneur',     '2026-05-23T16:00:00+02:00', '2026-05-23T18:30:00+02:00', false),
  ('Dîner',              '2026-05-23T20:00:00+02:00', '2026-05-23T22:30:00+02:00', false),
  ('Première danse',     '2026-05-23T22:30:00+02:00', '2026-05-23T23:00:00+02:00', false),
  ('Soirée dansante',    '2026-05-23T23:00:00+02:00', '2026-05-24T03:00:00+02:00', false)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 3) Challenges photo (gamification)
-- ------------------------------------------------------------
-- `unlock_at = NULL` → disponible dès le début. Sinon, le cron débloque
-- automatiquement à l'heure indiquée. Les points par défaut = 30.
-- Éditez selon vos défis. `sort_order` contrôle l'ordre d'affichage.
INSERT INTO challenges (title, description, points, unlock_at, sort_order, is_active) VALUES
  ('Selfie de groupe',         'Une photo avec au moins 5 invités souriants',           30, NULL,                          1, true),
  ('Les détails',              'Photographiez un détail de la déco qui vous touche',     20, NULL,                          2, true),
  ('Les mariés en action',     'Capturez Malachie ou Jessica en pleine émotion',         40, NULL,                          3, true),
  ('Le baiser',                'Le premier baiser des mariés',                            50, '2026-05-23T14:30:00+02:00',  4, false),
  ('Première danse',           'Filmez (ou photographiez) la première danse',             40, '2026-05-23T22:30:00+02:00',  5, false),
  ('Folie du dance floor',     'Une photo qui transpire le fun, après minuit',            30, '2026-05-24T00:00:00+02:00',  6, false)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 4) Vérifications
-- ------------------------------------------------------------
SELECT COALESCE((SELECT value FROM config WHERE key='drive')::text, 'DRIVE DÉSACTIVÉ (mode local)') AS drive_status;
SELECT COUNT(*) AS moments_count FROM moments;
SELECT COUNT(*) AS challenges_count, COUNT(*) FILTER (WHERE is_active) AS active_now FROM challenges;
