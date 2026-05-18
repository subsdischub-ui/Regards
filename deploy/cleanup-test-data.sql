-- Cleanup test data — Regards mariage Malachie & Jessica
-- Usage : docker compose exec postgres psql -U regards -d regards -f /cleanup.sql
-- Ou copier-coller le contenu dans le terminal psql Dokploy.
--
-- Sécurité : tout est wrappé dans BEGIN/COMMIT. Si le SELECT "AFTER"
-- montre quelque chose d'inattendu, vous pouvez ROLLBACK avant le COMMIT
-- final pour TOUT annuler.

BEGIN;

-- Snapshot AVANT
SELECT
  'BEFORE'                                         AS phase,
  (SELECT COUNT(*) FROM guests)                    AS guests,
  (SELECT COUNT(*) FROM media)                     AS media,
  (SELECT COUNT(*) FROM comments)                  AS comments,
  (SELECT COUNT(*) FROM reactions)                 AS reactions,
  (SELECT COUNT(*) FROM challenges)                AS challenges,
  (SELECT COUNT(*) FROM moments)                   AS moments,
  (SELECT COUNT(*) FROM config)                    AS config;

-- Affiche qui va être supprimé (devrait être uniquement des test entries)
SELECT id, name, relation, created_at FROM guests ORDER BY created_at;

-- Supprime tous les guests.
-- ON DELETE CASCADE sur media / comments / reactions = ils partent aussi.
-- challenges / moments / config ne sont PAS liés aux guests → préservés.
DELETE FROM guests;

-- Snapshot APRÈS — doit montrer :
--   guests=0, media=0, comments=0, reactions=0
--   challenges=6, moments=6, config=0 (ou ce que vous aviez)
SELECT
  'AFTER'                                          AS phase,
  (SELECT COUNT(*) FROM guests)                    AS guests,
  (SELECT COUNT(*) FROM media)                     AS media,
  (SELECT COUNT(*) FROM comments)                  AS comments,
  (SELECT COUNT(*) FROM reactions)                 AS reactions,
  (SELECT COUNT(*) FROM challenges)                AS challenges,
  (SELECT COUNT(*) FROM moments)                   AS moments,
  (SELECT COUNT(*) FROM config)                    AS config;

-- ⚠️ Tapez maintenant :
--    COMMIT;    si le snapshot AFTER est OK
--    ROLLBACK; si quelque chose vous gêne (tout revient comme avant)
