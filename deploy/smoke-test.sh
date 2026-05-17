#!/usr/bin/env bash
# REGARDS — smoke test post-déploiement
# Usage : APP_URL=https://regards.exemple.fr ./deploy/smoke-test.sh
# Sortie : succès si toutes les vérifications passent, échec sinon (exit code 1).

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
FAIL=0

ok()   { printf '\033[32m✓\033[0m %s\n' "$1"; }
ko()   { printf '\033[31m✗\033[0m %s\n' "$1"; FAIL=1; }
info() { printf '\033[36mℹ\033[0m %s\n' "$1"; }

info "Cible : $APP_URL"

# 1) Home page reachable
if curl -fsS -o /dev/null "$APP_URL/"; then
  ok "Page d'accueil joignable"
else
  ko "Page d'accueil INJOIGNABLE — vérifier DNS, Traefik, conteneur app"
fi

# 2) HTTPS effectif
if [[ "$APP_URL" == https://* ]]; then
  if curl -fsS -o /dev/null -I "$APP_URL/"; then
    ok "HTTPS répond"
  else
    ko "HTTPS ne répond pas correctement"
  fi
else
  info "URL en HTTP — OK pour test local, à corriger en prod"
fi

# 3) API /api/guests existe (GET liste les invités, route publique)
if curl -fsS -o /dev/null "$APP_URL/api/guests"; then
  ok "API /api/guests répond"
else
  ko "API /api/guests ne répond pas"
fi

# 4) Cron démarré ? Vérifier les logs (docker requis localement)
if command -v docker >/dev/null 2>&1; then
  if docker compose logs app --tail=200 2>/dev/null | grep -q '\[cron\] Cron jobs started'; then
    ok "Cron démarré (instrumentation OK)"
  else
    ko "Cron NON démarré — vérifier src/instrumentation.ts est bien dans le build"
  fi
else
  info "docker indisponible localement, skip check cron"
fi

# 5) Mode Drive vs local — informatif, pas bloquant
if command -v docker >/dev/null 2>&1; then
  DRIVE_KEY=$(docker compose exec -T app sh -c 'echo -n "${GOOGLE_SERVICE_ACCOUNT_KEY:-}"' 2>/dev/null || echo "")
  CONFIG_COUNT=$(docker compose exec -T postgres psql -U regards -d regards -tAc \
    "SELECT COUNT(*) FROM config WHERE key='drive';" 2>/dev/null || echo "0")
  if [[ -n "$DRIVE_KEY" ]] && [[ "$CONFIG_COUNT" == "1" ]]; then
    ok "Drive : activé (clé + config en base)"
  elif [[ -n "$DRIVE_KEY" ]] && [[ "$CONFIG_COUNT" == "0" ]]; then
    ko "Drive : clé présente mais config DB manquante — décommenter dans bootstrap.sql"
  elif [[ -z "$DRIVE_KEY" ]] && [[ "$CONFIG_COUNT" == "1" ]]; then
    info "Drive : config DB présente mais clé absente — sync inactive (comportement attendu si vous l'avez désactivé volontairement)"
  else
    ok "Drive : désactivé (mode 100% local, MinIO comme stockage primaire)"
  fi
fi

# 6) Moments seedés
if command -v docker >/dev/null 2>&1; then
  COUNT=$(docker compose exec -T postgres psql -U regards -d regards -tAc \
    "SELECT COUNT(*) FROM moments;" 2>/dev/null || echo "0")
  if [[ "$COUNT" -ge "1" ]]; then
    ok "$COUNT moment(s) en base"
  else
    ko "Aucun moment seedé — éditer puis exécuter deploy/bootstrap.sql"
  fi
fi

# 7) MinIO interne joignable depuis l'app
if command -v docker >/dev/null 2>&1; then
  if docker compose exec -T app sh -c 'wget -q -O - http://minio:9000/minio/health/live >/dev/null 2>&1'; then
    ok "MinIO joignable depuis l'app"
  else
    ko "MinIO INJOIGNABLE depuis le conteneur app (réseau Docker ?)"
  fi
fi

echo
if [[ $FAIL -eq 0 ]]; then
  printf '\033[32m=== Tous les checks OK ===\033[0m\n'
  exit 0
else
  printf '\033[31m=== Échec — corriger les points marqués ✗ ===\033[0m\n'
  exit 1
fi
