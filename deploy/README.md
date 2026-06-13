# Déploiement REGARDS — Guide maître

Mariage : **Malachie & Jessica — 23 mai 2026, Nantes**.
Stack : Next.js 16 + Postgres 16 + MinIO + sync Google Drive.

> ⚠️ **Bug critique corrigé dans ce déploiement** : `src/instrumentation.ts` câble
> `startCronJobs()` au démarrage du serveur Next.js. Sans ce fichier, le cron de
> sync Drive et de déverrouillage des challenges **ne tournait jamais**.

---

## Setup cible (validé avec vous)

- **Hôte** : Hostinger KVM 8 (8 vCPU, 32 Go RAM, 400 Go SSD) — Dokploy déjà installé
- **Domaine** : sous-domaine Dokploy auto (HTTPS auto via Traefik / Let's Encrypt)
- **Cutoff** : aucun — l'app reste en ligne après le mariage
- **Stockage** : **100% local MinIO** (Drive désactivé)

> Sur un VPS partagé avec d'autres apps : voir § 9 « Co-locataires » avant le jour J.
> Pour activer Drive plus tard : voir § 10 « Activer Google Drive ultérieurement ».

## Ordre des opérations

1. **Créer l'app Dokploy depuis le repo** — § 2
2. **Configurer Google Drive** (Service Account) — voir `deploy/google-drive-setup.md`
3. **Variables d'environnement** — § 3
4. **Premier déploiement** (build + run) — § 4
5. **Bootstrap base** : migrations + seed — § 5
6. **Activer le domaine Dokploy + HTTPS** — § 6
7. **Smoke test** — § 7
8. **Imprimer le QR code** — § 8
9. **Co-locataires (VPS partagé)** — § 9

Durée totale : ~45 min (votre VPS est déjà prêt).

## 2) Pousser le repo & créer l'app Dokploy

1. Sur Dokploy : **Create Project** → nom `regards`
2. **Create Service** → **Application** → **Git** → URL `https://github.com/subsdischub-ui/Regards.git`
3. **Build type** : **Dockerfile** (Dokploy détecte le `Dockerfile` du repo)
4. **Branch** : `main`
5. **Compose alternative** : Dokploy peut aussi consommer directement `docker-compose.yml`
   — c'est plus simple ici, car postgres + minio + app sont déjà câblés ensemble.
   Choisissez **Service → Compose**, pointez sur `docker-compose.yml`.

## 3) Variables d'environnement

Dans Dokploy → onglet **Environment** → coller le contenu de `deploy/.env.production.example`
en remplaçant tous les `CHANGE_ME`. Détails :

| Variable | Comment l'obtenir |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32 \| tr -d '/+='` |
| `MINIO_ACCESS_KEY` | au choix, ex: `regards-prod-access` |
| `MINIO_SECRET_KEY` | `openssl rand -base64 32 \| tr -d '/+='` |
| `ADMIN_PASSWORD` | à votre convenance, ≥12 chars |
| `NEXT_PUBLIC_APP_URL` | https://<votre-domaine>, **sans / final** — obligatoire (CORS) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON single-line, voir `deploy/google-drive-setup.md` |

> Si vous lancez sans `GOOGLE_SERVICE_ACCOUNT_KEY`, l'app fonctionne mais le sync Drive
> est désactivé silencieusement (log : `[drive] No service account key configured`).

## 4) Premier déploiement

Dans Dokploy → **Deploy**.

Le build prend ~5 min (npm ci + next build + standalone).

Vérifiez les logs : vous devez voir au démarrage :
```
[cron] Starting cron jobs...
[cron] Cron jobs started.
```
**Si ce log n'apparaît pas, votre build n'inclut pas `src/instrumentation.ts`.**
Vérifiez que ce fichier est bien committé.

## 5) Bootstrap de la base

**Le schéma Drizzle est appliqué automatiquement à chaque déploiement** par le
service `migrate` du docker-compose (un conteneur one-shot qui exécute
`drizzle-kit push --force` avant le démarrage de `app`). Plus besoin de
commande manuelle après un changement de schéma.

> Note : l'ancienne commande `docker compose exec app npm run db:push` ne
> fonctionne plus — l'image de prod est un build Next.js *standalone* qui ne
> contient ni drizzle-kit ni le code source.

Il reste à seeder les données initiales (une seule fois) :

```bash
# Éditer deploy/bootstrap.sql pour mettre vos VRAIS folder_id Drive + moments du mariage
# puis :
docker compose cp deploy/bootstrap.sql postgres:/bootstrap.sql
docker compose exec postgres psql -U regards -d regards -f /bootstrap.sql
```

Le script affichera des `SELECT` de vérification (config drive, count moments, count challenges).

## 6) Activer le domaine Dokploy + HTTPS

Pas de DNS à configurer : Dokploy expose automatiquement un sous-domaine
`<app>.<dokploy-host>` via Traefik.

1. Dans Dokploy → service `app` → onglet **Domains** → **Add Domain**
2. Laissez Dokploy générer l'hôte auto (ou personnalisez le slug : `regards`)
3. Port interne : **3000**
4. HTTPS : **ON** (Let's Encrypt), cochez **Force HTTPS**
5. Sauvegardez → Dokploy obtient le cert en ~30 s
6. Copiez l'URL finale → mettez-la dans `NEXT_PUBLIC_APP_URL` → **Redeploy**

> Important : le 2e déploiement (après MAJ de `NEXT_PUBLIC_APP_URL`) est obligatoire,
> sinon la vérification CORS de `middleware.ts` ne saura pas reconnaître votre domaine.

## 7) Smoke test

```bash
# Local ou depuis n'importe où
APP_URL=https://regards.<votre-domaine> bash deploy/smoke-test.sh
```

Doit afficher uniquement des `✓`. Sinon, le script vous dit quoi corriger.

Test manuel complémentaire :
- `/join` → créer un invité de test (votre prénom)
- `/upload` → uploader une vraie photo de votre téléphone
- Attendre 5 min, vérifier dans Drive que le fichier apparaît dans le bon sous-dossier
  (`<Votre nom>/Autres` si avant tout moment configuré)

## 8) QR code

À générer une fois l'URL stable :
```bash
docker compose exec app node -e "
const QRCode = require('qrcode');
QRCode.toFile('/tmp/qr.png', '$NEXT_PUBLIC_APP_URL', {
  width: 1200,
  margin: 2,
  color: { dark: '#5B6B52', light: '#FAF8F5' }
}).then(() => console.log('OK /tmp/qr.png'));
"
docker compose cp app:/tmp/qr.png ./qr-regards.png
```
Format A6 chez n'importe quel imprimeur, posé sur les tables.

---

## Estimation de la charge

Pour 150 invités sur ~8 h, comptez :
- ~12 000 médias (80 par invité, mix photo/vidéo courte)
- ~170 Go MinIO peak (avant compression Drive)
- ~5–10 req/s d'uploads en pic (après cérémonie, après dessert)

Le CX32 tient sans problème. Surveillez via Dokploy → onglet **Metrics**.

---

## Disaster recovery

**Si le VPS plante pendant le mariage :**
1. La file `processing.ts` est en mémoire. Les médias déjà uploadés vers MinIO mais pas
   encore "thumbnaillés" auront `processing_status='pending'`. Au redémarrage, ils ne
   seront pas repris automatiquement. Pour rejouer :
   ```sql
   -- Côté postgres : remettre 'pending' à 'pending' ne suffit pas, il faut réimporter.
   -- Solution court terme : faire un PUT direct via l'API admin (voir /api/admin).
   ```
   En pratique : Dokploy redémarre tout en <30 s, et un upload incomplet finira par être
   abandonné par le client TUS (qui réessaiera).

2. **Backup Postgres** (à scheduler dès J-1) :
   ```bash
   docker compose exec postgres pg_dump -U regards regards | gzip > regards-$(date +%F).sql.gz
   ```

3. **Backup MinIO** : pas critique tant que la sync Drive tourne. Vérifier
   `SELECT COUNT(*) FROM media WHERE drive_synced = false;` reste bas.

---

## 9) Co-locataires (VPS partagé)

Votre KVM 8 héberge d'autres apps. Trois points d'attention :

- **CPU** : la queue de processing (`sharp` + `ffmpeg`) consomme 1 vCPU à 100 %
  pendant chaque thumbnail. Avec 8 vCPU partagés, c'est OK, mais surveillez vos
  autres apps pendant les pics (cérémonie, fin de dîner) via Dokploy → Metrics.
  Mitigation possible : limiter le conteneur app via `deploy:` dans le compose
  (`cpus: '6'`) pour laisser 2 cores aux voisins.

- **RAM** : 32 Go suffit largement. REGARDS consomme ~1 Go (app) + 256 Mo
  (postgres) + 128 Mo (minio) = ~1.5 Go au repos, ~3 Go en charge.

- **Disque** : MinIO grossit linéairement avec les uploads. Estimation 150 Go
  peak pour 200 invités. Sur 400 Go partagés, vérifiez l'espace libre avant le
  jour J : `df -h /var/lib/docker`. Si <250 Go libres, faites du ménage.

- **Postgres** : si vous avez déjà un Postgres pour d'autres apps, REGARDS
  ajoutera **sa propre instance** (port interne dans le réseau Docker du
  compose, pas de conflit). C'est volontaire — l'isolation évite qu'un bug
  REGARDS affecte vos autres données.

---

## Après le mariage (optionnel, vous avez choisi "pas de cutoff")

L'app reste en ligne indéfiniment. Quelques bonnes pratiques :

- **Backup Postgres hebdomadaire** (ajouter un cron sur l'hôte) :
  ```bash
  0 3 * * 0 cd /etc/dokploy/projects/regards && docker compose exec -T postgres \
    pg_dump -U regards regards | gzip > /backups/regards-$(date +\%F).sql.gz
  ```
- **Vérifier la sync Drive** une fois par mois :
  `SELECT COUNT(*) FROM media WHERE drive_synced = false;` doit rester à 0
- **Nettoyer MinIO** si vous voulez récupérer de l'espace : une fois Drive
  100 % à jour, MinIO devient redondant. Mais à 150-200 Go, sur 400 Go, ça
  peut attendre.

---

## Fichiers de ce dossier

| Fichier | Rôle |
|---|---|
| `README.md` | ce guide |
| `.env.production.example` | template variables d'env, copier dans Dokploy |
| `google-drive-setup.md` | création Service Account + partage dossier |
| `bootstrap.sql` | seed initial (drive config, moments, challenges) |
| `smoke-test.sh` | vérification end-to-end post-déploiement |

---

## 10) Activer Google Drive ultérieurement (optionnel)

Si un jour vous voulez ajouter le backup Drive :

1. Suivre `deploy/google-drive-setup.md` pour créer le Service Account + dossier partagé
2. Renseigner `GOOGLE_SERVICE_ACCOUNT_KEY` dans les env vars Dokploy
3. Décommenter le bloc « 1) Google Drive configuration » dans `deploy/bootstrap.sql`
   et y mettre les vrais `folder_id` / `all_moments_folder_id`
4. Appliquer : `docker compose cp deploy/bootstrap.sql postgres:/bootstrap.sql && docker compose exec postgres psql -U regards -d regards -f /bootstrap.sql`
5. Redeploy l'app → vous devez voir au démarrage : `[cron] Drive sync enabled (every 5 min).`
6. Le dashboard admin réaffichera automatiquement la carte « En attente Drive » et le bouton de sync forcée
7. La sync rattrape automatiquement les anciens médias (`drive_synced = false` par défaut)

---

## Référence : fichiers modifiés/ajoutés hors de `deploy/`

- `src/instrumentation.ts` — **NOUVEAU**. Démarre les cron jobs via le hook `register()`
  de Next.js. Sans ce fichier, aucun cron ne tourne (challenges + Drive). Indispensable.

- `src/lib/cron.ts` — modifié. Le cron Drive n'est planifié **que** si
  `GOOGLE_SERVICE_ACCOUNT_KEY` est défini. En mode local, log unique au démarrage,
  pas de spam toutes les 5 min.

- `src/app/admin/page.tsx` — modifié. Carte « En attente Drive » et bouton « Forcer la
  sync Drive » conditionnés par la présence de la clé. En mode local, affiche
  « Drive désactivé — Stockage local uniquement » à la place.

- `src/app/api/media/file/[...key]/route.ts` — **réécrit**. Avant : redirigeait le
  navigateur vers une presigned URL MinIO interne (`http://minio:9000/...`) → toutes
  les images cassées en prod. Après : proxie le contenu via Next.js, MinIO reste
  privé dans le réseau Docker. Headers `Cache-Control: max-age=3600` pour soulager
  le serveur sur les vues répétées. **MAJ perf** : le proxy reste le défaut, mais si
  `MINIO_PUBLIC_ENDPOINT` est défini (voir § Performance), la route renvoie un 307
  vers une presigned URL **publique** — les octets ne transitent plus par Next.js.

---

## Performance — corrections (lot A/B/C)

Trois symptômes traités : feed lent, scroll perdu au retour d'un média, swipe
inter-photos intermittent. Détail des corrections livrées :

- **Clé de contexte unifiée** (`feed/page.tsx`) : les cartes simples et les clusters
  pointent désormais vers la même clé de cache (`guest:<id>`). Avant, ouvrir une photo
  *isolée* d'un feed invité cassait à la fois le swipe et la restauration de scroll.
- **Restauration de scroll exacte** : on persiste `window.scrollY` (clé légère) et on
  le restaure en `useLayoutEffect` ; chaque vignette réserve sa hauteur via
  `aspect-ratio`, donc le retour tombe pile à la position quittée.
- **Index Postgres** (`idx_media_feed` partiel sur `uploaded_at DESC`,
  `idx_media_guest_uploaded`, `idx_comments_media`) : le feed triait/paginait sur des
  colonnes non indexées → seq-scan qui empirait avec le nombre de photos. **Appliqués
  automatiquement** par le service `migrate` (`drizzle-kit push --force`) au déploiement.
- **Une seule connexion SSE par onglet** (`use-sse.ts`) : avant, le `ToastProvider` du
  layout + le feed ouvraient deux flux permanents. Mutualisés via un singleton refcompté.
- **Cartes mémoïsées** (`media-card`, `cluster-card`) : le feed entier ne re-rend plus
  à chaque event SSE / `loadMore`.
- **Pool Postgres** : `DB_POOL_MAX` (défaut 20 au lieu de 10).

### Servir les médias directement depuis le stockage (optionnel, gros gain)

Par défaut, **tous** les octets (vignettes, images, vidéos, avatars) transitent par le
process Next.js. Derrière Traefik en HTTP/2 ce n'est pas catastrophique, mais ça met
toute la bande passante média sur l'app. Pour l'éliminer :

1. Dans Dokploy → service `minio` → **Domains** → ajouter un domaine public
   (ex. `storage.<votre-domaine>`), port interne **9000**, HTTPS **ON**.
2. Mettre `MINIO_PUBLIC_ENDPOINT=https://storage.<votre-domaine>` dans les env vars.
3. Redeploy. La route `/api/media/file` renverra alors un 307 vers une presigned URL
   publique : le navigateur télécharge directement depuis MinIO, Next.js ne fait que
   signer.

> ⚠️ **NE JAMAIS** mettre `minio:9000` (hôte interne) dans `MINIO_PUBLIC_ENDPOINT` :
> c'est exactement le bug qui avait cassé toutes les images. L'URL doit être joignable
> depuis un téléphone. Laisser vide = comportement proxy actuel, sûr.

### Pistes restantes (non livrées — nécessitent un test d'upload de bout en bout)

- **Transcodage vidéo en streaming** : `processing.ts` bufferise l'original entier en
  mémoire (`transformToByteArray`) avant ffmpeg. ffmpeg tourne déjà en process enfant
  (non bloquant), mais sur de grosses vidéos concurrentes le tas peut gonfler. À
  améliorer : streamer S3 → fichier temp → S3 (et idéalement déporter le transcodage
  dans un conteneur worker séparé pour ne pas disputer le CPU au serveur web).
