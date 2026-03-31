# Regards — Spec technique

**Projet :** PWA de partage de photos/vidéos de mariage, gamifiée et communautaire.
**Mariage :** Malachie & Jessica — 23 mai 2026, Nantes, France.
**URL :** `https://regards.{domaine}`

---

## 1. Infrastructure

### Stack

| Couche | Technologie |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Base de données | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Stockage médias | MinIO (buffer) + Google Drive (long terme) |
| Temps réel | Server-Sent Events (SSE) |
| Style | Tailwind CSS |
| Upload gros fichiers | tus protocol |
| Traitement images | sharp + exifr |
| Traitement vidéos (thumbnails) | ffmpeg |
| QR Code | qrcode (npm) |
| Cron | node-cron |
| Déploiement | Dokploy sur VPS (32 Go RAM, 8 CPU, 100 Go disque) |

### Docker Compose — 3 services

```
┌─────────────────────────────────────────────────┐
│                   Dokploy (VPS)                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Next.js  │  │PostgreSQL│  │    MinIO      │   │
│  │ :3000    │──│ :5432    │  │ :9000 (API)   │   │
│  │          │  │          │  │ :9001 (console)│  │
│  └──────────┘  └──────────┘  └──────────────┘   │
│       │                            │             │
│       └────── Cron interne ────────┘             │
│               (node-cron)    │                   │
│                              ▼                   │
│                        Google Drive              │
└─────────────────────────────────────────────────┘
```

- **PostgreSQL 16** : données relationnelles. Volume Docker persistant.
- **MinIO** : stockage objets S3-compatible. Volume Docker persistant. Un seul bucket `regards` avec préfixes `avatars/`, `media/originals/`, `media/thumbnails/`.
- **Next.js** : monolithe — pages SSR, API routes, SSE endpoint, cron interne.
- **Réseau Docker interne** : les 3 services communiquent entre eux. Seul Next.js est exposé via le reverse proxy Dokploy (HTTPS).
- MinIO n'est pas exposé publiquement.

---

## 2. Schéma de base de données (Drizzle)

### Table `guests`

| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | gen_random_uuid() |
| name | TEXT NOT NULL | Prénom |
| relation | TEXT | 'ami_mariee', 'famille_marie', 'collegue', 'autre' |
| avatar_url | TEXT | Clé MinIO du selfie |
| created_at | TIMESTAMPTZ | now() |
| last_active_at | TIMESTAMPTZ | now() — mis à jour par le middleware auth à chaque requête |
| points | INTEGER | 0 |
| badges | TEXT[] | '{}' |
| drive_folder_id | TEXT | ID du dossier Google Drive de l'invité |

### Table `media`

| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | gen_random_uuid() |
| guest_id | UUID FK → guests | Auteur |
| file_url | TEXT NOT NULL | Clé MinIO de l'original (ex: `media/originals/abc.jpg`) |
| thumbnail_url | TEXT | Clé MinIO de la miniature |
| file_type | TEXT NOT NULL | MIME type |
| file_size | INTEGER | Taille en octets |
| width | INTEGER | Largeur en pixels |
| height | INTEGER | Hauteur en pixels |
| caption | TEXT | Commentaire de l'auteur sur ce média |
| challenge_id | UUID FK → challenges | Défi associé (optionnel) |
| taken_at | TIMESTAMPTZ | Date EXIF ou fallback upload |
| uploaded_at | TIMESTAMPTZ | now() |
| processing_status | TEXT | 'pending', 'processing', 'done', 'error' |
| drive_synced | BOOLEAN | false |
| drive_file_id | TEXT | ID du fichier sur Google Drive |

**Index :** `taken_at`, `guest_id`, `challenge_id`, `drive_synced WHERE false`, `processing_status`.

### Table `challenges`

| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | gen_random_uuid() |
| title | TEXT NOT NULL | Titre du défi |
| description | TEXT NOT NULL | Description |
| points | INTEGER | 30 par défaut |
| unlock_at | TIMESTAMPTZ | NULL = toujours disponible |
| sort_order | INTEGER | Ordre d'affichage |
| is_active | BOOLEAN | Défaut : `true` si `unlock_at` est NULL, `false` si `unlock_at` est défini. Le cron active le défi quand l'heure est atteinte. |
| created_at | TIMESTAMPTZ | now() |

### Table `reactions`

| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | gen_random_uuid() |
| media_id | UUID FK → media | |
| guest_id | UUID FK → guests | |
| type | TEXT | 'heart' (extensible) |
| created_at | TIMESTAMPTZ | now() |

**Contrainte unique :** `(media_id, guest_id, type)`

### Table `comments`

| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | gen_random_uuid() |
| media_id | UUID FK → media | |
| guest_id | UUID FK → guests | |
| parent_id | UUID FK → comments | Fil de réponse |
| content | TEXT NOT NULL | |
| created_at | TIMESTAMPTZ | now() |

### Table `moments`

| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | gen_random_uuid() |
| label | TEXT | 'Cérémonie', 'Cocktail', etc. |
| start_time | TIMESTAMPTZ NOT NULL | |
| end_time | TIMESTAMPTZ NOT NULL | |
| auto_generated | BOOLEAN | true |
| drive_folder_id | TEXT | ID du dossier Drive pour ce moment |
| created_at | TIMESTAMPTZ | now() |

### Table `config`

| Colonne | Type | Description |
|---|---|---|
| key | TEXT (PK) | |
| value | JSONB NOT NULL | |

**Données initiales :**
- `wedding` : `{"groom": "Malachie", "bride": "Jessica", "date": "2026-05-23", "city": "Nantes"}`
- `theme` : `{"primary": "#5B6B52", "secondary": "#C4A882", "accent": "#7B4F5C", "bg": "#FAF8F5"}`
- `drive` : `{"folder_id": "...", "all_moments_folder_id": "..."}`

---

## 3. Gestion des médias

### UX de l'écran d'upload

- **Bouton principal** "Prendre une photo" → ouvre la caméra native (`<input accept="image/*,video/*" capture="environment">`)
- **Bouton secondaire** "Choisir depuis la galerie" → sélection multiple (`<input accept="image/*,video/*" multiple>`)
- **Preview en grille** des fichiers sélectionnés
- **Swipe horizontal** entre les previews pour ajouter un **caption individuel** à chaque photo/vidéo
- **Sélecteur de défi** (optionnel) : dropdown avec les défis disponibles et non verrouillés
- **Bouton "Envoyer X fichiers"** avec barre de progression globale

### Flux d'upload technique

1. **Compression côté client** (images uniquement) : Canvas API, max 2048px, ~80% quality JPEG. Vidéos envoyées telles quelles.
2. **Upload via tus protocol** vers `/api/upload/tus` : reprise automatique si réseau instable. Barre de progression visible par fichier. Le fichier est écrit directement dans MinIO → `media/originals/{uuid}.{ext}`.
3. **Hook post-upload** (déclenché automatiquement par tus quand le fichier est complet) :
   - Insert PostgreSQL avec métadonnées tus (`processing_status = 'pending'`, caption, challenge_id passés en metadata tus)
   - Réponse immédiate au client
   - **Async** (sans bloquer) — traité via une **file d'attente in-process** (un fichier à la fois pour éviter de saturer la RAM avec des vidéos lourdes) :
     - Extraction EXIF (taken_at, dimensions) via `exifr`
     - Génération thumbnail (800px wide) via `sharp`
     - Vidéos : thumbnail première frame via `ffmpeg`
     - Conversion HEIC → JPEG si nécessaire
     - Upload thumbnail vers MinIO → `media/thumbnails/{uuid}.jpg`
     - Update PostgreSQL (`processing_status = 'done'`, metadata)
     - Émission SSE `new_media`
     - Calcul points/badges
     - Normalisation des fuseaux horaires : `taken_at` stocké en **UTC**

### Aucune limite

Pas de taille max, pas de durée max pour les vidéos, pas de rate limit. Les invités partagent librement.

### Formats acceptés

JPEG, PNG, HEIC, MP4, MOV.

### Serving des médias

API route `/api/media/file/[...key]` :
- Vérifie l'existence en base
- Génère une URL pré-signée MinIO (expiration 1h)
- Redirect 302 vers l'URL pré-signée
- Paramètre `?download=true` → header `Content-Disposition: attachment` pour le téléchargement

### Bouton Télécharger

Présent sur **chaque média affiché** dans l'app : feed, vue détail, clusters, galerie moment. Télécharge l'original.

---

## 4. Temps réel (SSE)

### Endpoint

`GET /api/sse` — connexion persistante, un par client connecté.

### Événements

| Événement | Déclencheur | Données |
|---|---|---|
| `new_media` | Upload terminé | media ID, guest name, thumbnail URL |
| `new_reaction` | Toggle réaction | media ID, total count |
| `new_comment` | Nouveau commentaire | media ID, comment count |
| `badge_unlocked` | Attribution badge | guest ID, badge name |
| `challenge_unlocked` | Heure déverrouillage atteinte | challenge ID |
| `leaderboard_update` | Changement de points | top 5 résumé |

### Implémentation

`Map<string, Response>` en mémoire. Fonction `broadcast(event, data)` itère sur toutes les connexions actives.

**Cleanup :** quand un client se déconnecte (événement `close` sur la requête), sa `Response` est retirée de la Map pour éviter les fuites mémoire.

**Config Next.js requise** pour le endpoint SSE :
```typescript
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
```
Ceci désactive le cache et force le runtime Node.js (pas Edge), nécessaire pour les connexions long-lived. Fonctionne sur Dokploy (serveur Node persistant) contrairement à Vercel (serverless, timeout 30s).

Reconnexion automatique via `EventSource` natif + `Last-Event-ID` pour reprise.

---

## 5. Synchronisation Google Drive

### Cron : toutes les 5 minutes

1. `SELECT * FROM media WHERE drive_synced = false AND processing_status = 'done' LIMIT 20`
2. Pour chaque média :
   - Stream depuis MinIO → upload vers Google Drive
   - Rangement dans le dossier de l'invité + sous-dossier du moment correspondant
   - Création de raccourci (shortcut) dans le dossier `_Tous les moments/{moment}`
   - `UPDATE media SET drive_synced = true, drive_file_id = '...'`

### Structure Google Drive

```
📁 Regards - Malachie & Jessica
├── 📁 Sophie (Amie de la mariée)
│   ├── 📁 Cérémonie
│   ├── 📁 Cocktail
│   ├── 📁 Soirée dansante
│   └── 📁 Autres
├── 📁 Thomas (Famille du marié)
│   └── ...
└── 📁 _Tous les moments
    ├── 📁 Cérémonie (16h30 - 17h15)
    ├── 📁 Cocktail (18h00 - 19h30)
    └── ...
```

**Tri :** le `taken_at` du média est comparé aux `moments` en base :
- Si le `taken_at` tombe dans la tranche `[start_time, end_time]` d'un moment → ce dossier.
- Sinon → rattaché **au moment le plus proche** par timestamp (cohérent avec le comportement dans la Timeline de l'app).
- Si le `taken_at` est très éloigné de tout moment (ex: photo prise la veille) → dossier "Autres".

**Dossier `_Tous les moments`** : raccourcis Google Drive (pas de copies).

**Nommage fichiers :** `{Prénom}_{HHhMM}_{uuid-court}.{ext}`

**Streaming :** MinIO → Drive sans charger en RAM.

**Création dossiers :** à la volée, IDs cachés en base (`guests.drive_folder_id`, `moments.drive_folder_id`).

### Google Cloud Setup (à faire)

1. Créer un projet sur Google Cloud Console
2. Activer l'API Google Drive
3. Créer un Service Account
4. Télécharger la clé JSON
5. Créer le dossier racine sur Google Drive
6. Partager avec l'email du Service Account (éditeur)
7. Stocker le `folder_id` dans la table `config`

---

## 6. Pages, Navigation & API

### Barre de navigation bottom

```
[ Feed ]  [ Défis ]  [ 📷 Camera ]  [ Moments ]  [ Score ]
```

Bouton camera central surélevé (FAB). La bottom nav est dans un **layout partagé** (`(app)/layout.tsx`) qui wrappe les routes `/feed`, `/challenges`, `/upload`, `/moments`, `/leaderboard`.

### Routes pages

| Route | Rôle |
|---|---|
| `/` | Welcome — "Malachie & Jessica — Regards" |
| `/join` | Onboarding : prénom, relation, selfie optionnel |
| `/feed` | Feed chronologique, clusters "même moment", avatars filtrables, SSE |
| `/feed?guest={uuid}` | "Le regard de [Prénom]" — feed filtré via query param (même composant page) |
| `/media/[mediaId]` | Vue détail plein écran — réactions, commentaires, télécharger |
| `/upload` | Capture photo / sélection galerie — upload tus, caption, tag défi |
| `/challenges` | Liste des défis (verrouillés/déverrouillés) |
| `/moments` | Timeline verticale de la journée |
| `/leaderboard` | Classement + badges |
| `/admin` | Dashboard mariés (protégé par mot de passe) |

### Routes API

| Endpoint | Méthodes | Rôle |
|---|---|---|
| `/api/guests` | POST, GET | Créer invité, lister invités |
| `/api/media` | GET | Feed paginé (avec clustering) |
| `/api/upload/tus` | POST, PATCH, HEAD | Endpoint tus pour upload de fichiers |
| `/api/media/[mediaId]` | GET, DELETE | Détail média, suppression (admin) |
| `/api/media/[mediaId]/reactions` | POST, DELETE | Toggle réaction |
| `/api/media/[mediaId]/comments` | POST, GET | Ajouter/lister commentaires |
| `/api/media/file/[...key]` | GET | Servir un fichier depuis MinIO (redirect pré-signé) |
| `/api/challenges` | GET, POST | Lister défis, créer (admin) |
| `/api/moments` | GET | Timeline avec photos groupées |
| `/api/leaderboard` | GET | Classement |
| `/api/sync-drive` | POST | Sync manuelle (admin) |
| `/api/sse` | GET | Endpoint SSE (connexion persistante) |

### Algorithme de clustering "Même moment"

Le clustering est calculé **côté serveur** à la lecture (dans `GET /api/media`) :

1. Récupérer les médias paginés avec `processing_status = 'done'`, triés par `taken_at DESC`
2. Grouper les médias dont le `taken_at` est dans une fenêtre de **±2 minutes** ET de **guests différents**
3. Un cluster = 2+ médias de guests différents dans cette fenêtre
4. Les médias isolés (pas de cluster) sont renvoyés comme posts individuels
5. Le feed final est un mix de posts individuels et de clusters, trié chronologiquement

```typescript
// Pseudo-code
function clusterMedia(media: Media[]): (Media | MediaCluster)[] {
  const sorted = media.sort((a, b) => a.taken_at - b.taken_at);
  let current: Media[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].taken_at - current[current.length - 1].taken_at;
    const differentGuest = sorted[i].guest_id !== current[current.length - 1].guest_id;

    if (diff <= 120_000 && differentGuest) { // 2 min, guest différent
      current.push(sorted[i]);
    } else {
      flush(current); // cluster si >= 2, sinon post individuel
      current = [sorted[i]];
    }
  }
  flush(current);
}
```

### Feed — filtrage par "Regard"

Rangée horizontale d'avatars en haut du feed :
- Tap sur un avatar → query param `?guest={uuid}`, le feed ne montre que les médias de cet invité (pas de clustering dans ce mode)
- Tap sur "TOUS" → retour au feed complet
- Nouvelle photo d'un invité : animation subtile d'apparition en haut du feed (via SSE `new_media`)

### Feed — leaderboard détaillé

La page `/leaderboard` affiche :
- **Top photographes** par points (classement)
- **Badges de l'invité connecté** (ceux obtenus + ceux restants grisés)
- **Photo la plus aimée** de la soirée avec aperçu et nom de l'auteur
- **Compteurs globaux** : total de regards (invités actifs), total de photos, total de défis complétés

### Défis — rendu visuel

- **Défi actif** : border-left colorée, points visibles, bouton "Participer"
- **Défi verrouillé** (`is_active = false` + `unlock_at` futur) : **grisé**, icône **cadenas**, affiche l'heure de déverrouillage. Non cliquable.
- **Défi complété** par l'invité : checkmark vert, "Défi validé"

### Auth

- Cookie `guest_id` (HttpOnly) + localStorage fallback
- **Middleware** : vérifie le cookie, redirect vers `/join` si absent, **met à jour `last_active_at`** à chaque requête
- `/admin` : mot de passe → cookie de session admin séparé
- **CORS** configuré pour n'accepter que le domaine de l'app (`NEXT_PUBLIC_APP_URL`)

### Interactions sur les médias

Chaque invité peut sur les médias des autres :
- Liker (cœur animé au tap)
- Commenter (avec fils de réponse)
- Télécharger l'original
- Explorer le "regard" de l'auteur (tap avatar)

---

## 7. Gamification

### Points

| Action | Points |
|---|---|
| Upload photo | +10 |
| Upload vidéo | +15 |
| Photo tagguée défi | +points du défi |
| Recevoir un cœur | +2 |
| Commenter | +5 |
| Premier upload de la soirée | +20 bonus |

### Badges

| Badge | Condition |
|---|---|
| Premier regard | Premier invité à uploader |
| Paparazzi | 20+ photos uploadées |
| Vidéaste | Première vidéo uploadée |
| Social butterfly | 10+ commentaires sur photos d'autres |
| Chasseur de défis | 5+ défis complétés |
| Noctambule | Photo après minuit |
| Fan #1 | 50+ réactions données |
| Regard d'or | Photo la plus aimée (calculé en temps réel) |

Badges vérifiés après chaque action pertinente dans les API routes. Notification toast côté client.

### Défis verrouillés

- Les défis avec `unlock_at` sont créés avec `is_active = false`.
- Les défis sans `unlock_at` (toujours disponibles) sont créés avec `is_active = true`.
- Cron `node-cron` vérifie **chaque minute** : `unlock_at <= now() AND is_active = false` → `UPDATE is_active = true` + SSE `challenge_unlocked` → toast notification chez tous les invités connectés.

---

## 8. Dashboard Admin

**Accès :** `/admin`, mot de passe unique (env `ADMIN_PASSWORD`).

### Stats en direct (SSE)
- Invités actifs, total photos/vidéos, défis complétés, sync Drive status, espace MinIO.

### Modération
- Grille de tous les médias, filtre par invité.
- Supprimer un média → suppression en base + MinIO + Drive si synced.

### Gestion défis
- CRUD des défis. Modifier heure de déverrouillage. Voir participations.

### Gestion moments
- CRUD des tranches horaires. Pré-chargés avec le seed.

### Vue Timeline `/moments`

- Axe vertical avec nœuds pour chaque moment clé
- Chaque nœud affiche : heure, label, nombre de photos, nombre de regards (invités différents), aperçu en miniatures
- **Rattachement des photos** : les photos dont le `taken_at` ne tombe dans aucun moment sont rattachées **au moment le plus proche** par timestamp (même logique que le tri Drive)
- Tap sur un moment → galerie filtrée avec toutes les photos de cette tranche

### Actions
- Forcer sync Drive.
- Générer QR code : SVG aux couleurs du thème (`dark: #5B6B52`, `light: #FAF8F5`). Formats d'impression : **carte de table (10x10cm)**, **A5 pour chevalet d'accueil**. Téléchargeable en SVG haute résolution avec les prénoms des mariés et la date.
- Exporter ZIP de tous les médias (streaming).

---

## 9. PWA

### Manifest
- Installable sur l'écran d'accueil. `display: standalone`.
- `theme_color: #5B6B52`, `background_color: #FAF8F5`.

### Service Worker
- Cache assets statiques (CSS, JS, fonts).
- Cache thumbnails (cache-first).
- Pas de cache des originaux.
- Pas de mode offline complet — écran "Reconnexion en cours..." si pas de réseau.

### Optimisations mobile
- Compression client des images avant upload.
- Lazy loading (Intersection Observer).
- Pagination infinie (20 médias par batch).
- Thumbnails dans le feed, originaux en vue détail.
- Touch targets 44x44px minimum.
- Swipe vertical pour fermer la vue détail.
- Swipe horizontal dans les clusters.
- **Préchargement** des images suivantes dans le carousel (vue détail + clusters).

### Compatibilité
- Safari 14+ (iPhone 6s+).
- Chrome 80+ (Android).

---

## 10. Design system

### Palette

| Token | Valeur | Usage |
|---|---|---|
| primary | #5B6B52 | Vert sauge — boutons principaux |
| secondary | #C4A882 | Or doux — accents, labels moments |
| accent | #7B4F5C | Bordeaux floral — défis premium |
| bg | #FAF8F5 | Crème — fond principal |
| bg-card | #FFFFFF | Cartes |
| bg-secondary | #F3F0EB | Fonds secondaires |
| text | #2C2A28 | Texte principal |
| text-secondary | #6B6560 | Texte secondaire |
| text-tertiary | #A39E98 | Texte tertiaire |
| border | rgba(0,0,0,0.08) | Bordures, séparateurs |

### Typographie

- Headings : Cormorant Garamond (400, 500) — via Google Fonts
- Corps/UI : DM Sans (400, 500) — via Google Fonts

### Composants clés

- **Barre de navigation bottom** : 5 onglets, bouton camera central surélevé (FAB)
- **Carte photo** : coins arrondis 12px, avatar+prénom en header, photo pleine largeur, réactions/commentaires/télécharger en footer
- **Cluster "Même moment"** : fond bg-secondary, header horloge+timestamp, layout 1 grande + N petites
- **Chips relation** : pills arrondies, active = primary filled, inactive = border gris

---

## 11. Considérations techniques

### tus + Next.js

Le serveur tus (`@tus/server`) nécessite un handler personnalisé dans l'API route `/api/upload/tus`. Le store tus écrit directement dans MinIO via `@tus/s3-store` (compatible S3). Le endpoint tus doit être configuré avec `export const runtime = 'nodejs'` et `export const dynamic = 'force-dynamic'`. Le body parsing de Next.js doit être désactivé pour cette route (`export const config = { api: { bodyParser: false } }`).

### ffmpeg — dépendance système

`ffmpeg` est un binaire système, pas un package npm. Il doit être installé dans le **Dockerfile** :
```dockerfile
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
```
Utilisé uniquement pour extraire la première frame des vidéos (thumbnail). Appelé via `child_process.exec` ou un wrapper comme `fluent-ffmpeg`.

### node-cron — initialisation

`node-cron` doit être initialisé au démarrage du serveur Next.js. Utiliser le fichier `instrumentation.ts` (Next.js 14+) :
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCronJobs } = await import('./lib/cron');
    startCronJobs(); // Drive sync toutes les 5 min + unlock défis toutes les 1 min
  }
}
```

### File d'attente de traitement async

Les traitements lourds (thumbnails, EXIF, ffmpeg) passent par une file d'attente in-process simple (tableau + traitement séquentiel) pour éviter de saturer la RAM si 20 invités uploadent en même temps. Un seul fichier traité à la fois.

### HEIC

Le support HEIC dans `sharp` nécessite `sharp` compilé avec le support libheif. L'image Docker Node.js officielle + `sharp` installé via npm inclut ce support par défaut sur Linux.

---

## 12. Variables d'environnement

```env
# PostgreSQL
DATABASE_URL=postgresql://regards:password@postgres:5432/regards

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=regards-access
MINIO_SECRET_KEY=regards-secret
MINIO_BUCKET=regards

# Google Drive
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Admin
ADMIN_PASSWORD=mot-de-passe-admin

# App
NEXT_PUBLIC_APP_URL=https://regards.domaine.com
NEXT_PUBLIC_WEDDING_DATE=2026-05-23
```

---

## 13. Données seed

### Défis (10)

Défis avec `unlock_at` → `is_active = false` au seed. Défis sans → `is_active = true`.

1. La cérémonie vue de votre place — 30 pts — `unlock_at: 16h30` — `is_active: false`
2. La première danse — 50 pts — `is_active: true`
3. Selfie avec un(e) inconnu(e) — 30 pts — `is_active: true`
4. Le dancefloor vu d'en haut — 40 pts — `is_active: true`
5. Le moment le plus émouvant — 100 pts — `is_active: true`
6. Détail déco le plus original — 20 pts — `is_active: true`
7. Les enfants en action — 30 pts — `is_active: true`
8. Le plat préféré — 20 pts — `unlock_at: 19h00` — `is_active: false`
9. La piste à son apogée — 50 pts — `unlock_at: 22h00` — `is_active: false`
10. Le dernier debout — 100 pts — `unlock_at: 00h00` — `is_active: false`

### Moments (5)

1. Cérémonie : 16h30 - 17h15
2. Photos de groupe : 17h15 - 18h00
3. Cocktail : 18h00 - 19h30
4. Dîner : 19h30 - 21h30
5. Soirée dansante : 21h30 - 04h00
