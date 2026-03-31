# REGARDS — Brief technique complet

## Résumé du projet

**"Regards"** est une Progressive Web App (PWA) de partage de photos et vidéos de mariage, gamifiée et communautaire. Les invités scannent un QR code, partagent leurs médias, explorent les photos des autres, relèvent des défis photo, et revivent le mariage à travers la perspective de chaque invité. Tout est synchronisé en arrière-plan vers un dossier Google Drive des mariés.

**Mariage cible :** Malachie & Jessica — 23 mai 2026, Nantes, France.

**URL cible :** `https://regards.ton-domaine.com` (ou sous-domaine personnalisé)

---

## Stack technique recommandé

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Framework | **Next.js 14+ (App Router)** | SSR, API routes intégrées, déploiement facile |
| Base de données | **Supabase** (PostgreSQL + Realtime + Storage) | Temps réel natif, stockage de fichiers, auth simple, gratuit pour ce volume |
| Stockage médias | **Supabase Storage** (primaire) + **Google Drive** (sync) | Upload rapide vers Supabase, sync asynchrone vers Drive |
| Sync Google Drive | **Google APIs Node.js SDK** (`googleapis`) via Service Account | Écriture directe dans le dossier Drive des mariés |
| Déploiement | **Vercel** ou **Dokploy** (Malachie maîtrise Dokploy) | Vercel pour la simplicité, Dokploy si hébergement propre souhaité |
| Style | **Tailwind CSS** | Mobile-first, cohérent, rapide |
| Temps réel | **Supabase Realtime** (subscriptions PostgreSQL) | Feed live, compteurs, notifications |
| QR Code | **qrcode** (npm) | Génération du QR code personnalisé aux couleurs du mariage |

---

## Architecture de la base de données (Supabase / PostgreSQL)

### Table `guests`

```sql
CREATE TABLE guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  relation TEXT, -- 'ami_mariee', 'famille_marie', 'collegue', 'autre'
  avatar_url TEXT, -- URL du selfie dans Supabase Storage
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now(),
  points INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT '{}'
);
```

### Table `media`

```sql
CREATE TABLE media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL, -- URL Supabase Storage
  thumbnail_url TEXT, -- Miniature générée côté serveur
  file_type TEXT NOT NULL, -- 'image/jpeg', 'video/mp4', etc.
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  caption TEXT, -- Commentaire individuel associé à CETTE photo
  challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
  taken_at TIMESTAMPTZ, -- Extrait des EXIF si disponible
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  drive_synced BOOLEAN DEFAULT false, -- Flag de synchronisation Drive
  drive_file_id TEXT -- ID du fichier sur Google Drive une fois synced
);

-- Index pour le regroupement temporel "Même moment"
CREATE INDEX idx_media_taken_at ON media(taken_at);
CREATE INDEX idx_media_guest ON media(guest_id);
CREATE INDEX idx_media_challenge ON media(challenge_id);
CREATE INDEX idx_media_not_synced ON media(drive_synced) WHERE drive_synced = false;
```

### Table `challenges`

```sql
CREATE TABLE challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 30,
  unlock_at TIMESTAMPTZ, -- NULL = toujours disponible, sinon heure de déverrouillage
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table `reactions`

```sql
CREATE TABLE reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'heart', -- extensible: 'heart', 'laugh', 'wow', 'cry'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(media_id, guest_id, type) -- Un seul coeur par invité par photo
);
```

### Table `comments`

```sql
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- Réponses en fil
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table `moments` (regroupement automatique)

```sql
CREATE TABLE moments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT, -- 'Cérémonie', 'Première danse', etc. (optionnel, défini par les mariés)
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  auto_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table `config` (paramètres globaux du mariage)

```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Données initiales
INSERT INTO config VALUES
  ('wedding', '{"groom": "Malachie", "bride": "Jessica", "date": "2026-05-23", "city": "Nantes"}'),
  ('theme', '{"primary": "#5B6B52", "secondary": "#C4A882", "accent": "#7B4F5C", "bg": "#FAF8F5"}'),
  ('drive', '{"folder_id": "VOTRE_FOLDER_ID_ICI"}');
```

---

## Structure des pages (App Router Next.js)

```
app/
├── layout.tsx                  # Layout global, police, meta tags
├── page.tsx                    # Écran d'accueil (Welcome)
├── join/
│   └── page.tsx                # Inscription invité (prénom, relation, selfie)
├── feed/
│   ├── layout.tsx              # Layout avec barre de navigation bottom
│   ├── page.tsx                # Feed principal (fil chronologique)
│   └── [guestId]/
│       └── page.tsx            # Feed filtré = "Le regard de [Prénom]"
├── upload/
│   └── page.tsx                # Écran d'upload (sélection + capture direct)
├── media/
│   └── [mediaId]/
│       └── page.tsx            # Vue détail photo (plein écran, commentaires, réactions)
├── challenges/
│   └── page.tsx                # Liste des défis photo
├── moments/
│   └── page.tsx                # Timeline chronologique des moments
├── leaderboard/
│   └── page.tsx                # Classement et badges
├── admin/
│   ├── page.tsx                # Dashboard mariés (stats, modération)
│   ├── challenges/
│   │   └── page.tsx            # CRUD des défis
│   └── moments/
│       └── page.tsx            # Définir les moments clés
└── api/
    ├── guests/
    │   └── route.ts            # POST: créer invité, GET: liste
    ├── media/
    │   ├── route.ts            # POST: upload, GET: feed (paginé)
    │   └── [mediaId]/
    │       ├── route.ts        # GET: détail, DELETE: supprimer
    │       ├── reactions/
    │       │   └── route.ts    # POST/DELETE: toggle réaction
    │       └── comments/
    │           └── route.ts    # POST: ajouter commentaire, GET: liste
    ├── challenges/
    │   └── route.ts            # GET: liste, POST: créer (admin)
    ├── moments/
    │   └── route.ts            # GET: timeline avec photos groupées
    ├── leaderboard/
    │   └── route.ts            # GET: classement
    ├── sync-drive/
    │   └── route.ts            # POST: synchronisation manuelle
    └── cron/
        └── sync/
            └── route.ts        # Cron job: sync automatique vers Drive
```

---

## Fonctionnalités détaillées

### 1. Onboarding invité (scan → 2 taps → dans l'app)

**Parcours :**
1. L'invité scanne le QR code (imprimé sur les tables, le faire-part, etc.)
2. Il arrive sur la page d'accueil ("Malachie & Jessica — Regards")
3. Il tape "Rejoindre", entre son prénom, choisit sa relation, prend un selfie optionnel
4. Un cookie/localStorage persiste son `guest_id` — pas de compte, pas de mot de passe
5. Il arrive directement sur le feed

**Implémentation :**
- Stocker `guest_id` dans un cookie HttpOnly + localStorage en fallback
- Le selfie est uploadé dans Supabase Storage bucket `avatars/`
- Le selfie sert aussi potentiellement à un futur regroupement facial (v2)

### 2. Feed principal ("Regards")

**Le feed affiche deux types de contenus entremêlés :**

**A) Photos individuelles** — Affichées comme un post : avatar + prénom de l'invité, photo, compteurs de réactions/commentaires, caption si présente, badge défi si tagguée.

**B) Clusters "Même moment"** — Quand 2+ photos de guests différents ont un `taken_at` dans une fenêtre de ±2 minutes, elles sont regroupées visuellement dans un bloc spécial :
- Layout : grande photo + vignettes des autres angles
- Header : icône horloge + heure + label du moment si disponible
- Footer : "X regards sur ce moment · Touchez pour explorer"
- Au tap : vue plein écran en carousel horizontal montrant toutes les perspectives

**Algorithme de clustering :**
```typescript
// Pseudo-code pour le regroupement
function clusterMedia(media: Media[]): (Media | MediaCluster)[] {
  const sorted = media.sort((a, b) => a.taken_at - b.taken_at);
  const clusters: MediaCluster[] = [];
  let current: Media[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].taken_at - current[current.length - 1].taken_at;
    const differentGuest = sorted[i].guest_id !== current[current.length - 1].guest_id;
    
    if (diff <= 120000 && differentGuest) { // 2 minutes, guest différent
      current.push(sorted[i]);
    } else {
      if (current.length >= 2) {
        clusters.push({ type: 'cluster', media: current, time: current[0].taken_at });
      }
      current = [sorted[i]];
    }
  }
  // ... traiter le dernier groupe
  return mergeAndSort(clusters, singlePhotos);
}
```

**Filtrage par "Regard" (perspective d'un invité) :**
- La rangée horizontale d'avatars en haut du feed permet de filtrer
- Tap sur un avatar → le feed ne montre que les photos de cet invité
- Tap sur "TOUS" → retour au feed complet
- Implémenté via query param `?guest=UUID` sur `/feed`

**Temps réel :**
- Supabase Realtime subscription sur la table `media`
- Nouvelles photos apparaissent en haut avec une animation subtle
- Compteur "X regards · Y photos" se met à jour en live

### 3. Upload de médias

**Écran d'upload :**
- Bouton principal "Prendre une photo" → ouvre la caméra native via `<input type="file" accept="image/*,video/*" capture="environment">`
- Bouton secondaire "Choisir depuis la galerie" → `<input type="file" accept="image/*,video/*" multiple>`
- Preview des fichiers sélectionnés en grille
- Champ caption par photo (optionnel) — possibilité de swiper entre les photos pour ajouter un commentaire à chacune
- Sélecteur de défi (optionnel) : dropdown avec les défis disponibles et non verrouillés
- Bouton "Envoyer X fichiers"

**Traitement côté serveur (API route `/api/media`) :**
1. Recevoir le fichier via `FormData`
2. Extraire les métadonnées EXIF (date de prise de vue, dimensions) via `sharp` ou `exifr`
3. Générer une miniature (800px de large) via `sharp`
4. Upload original + miniature dans Supabase Storage bucket `media/`
5. Insérer l'entrée dans la table `media`
6. Déclencher le calcul de points si un défi est associé
7. Vérifier si la photo tombe dans un cluster "même moment" existant

**Limites recommandées :**
- Taille max par fichier : 50 MB (pour les vidéos)
- Formats acceptés : JPEG, PNG, HEIC, MP4, MOV
- Conversion HEIC → JPEG côté serveur si nécessaire (via `sharp`)

### 4. Vue détail photo

**Au tap sur une photo du feed :**
- Affichage plein écran avec geste de swipe vertical pour fermer
- Infos : avatar + prénom du photographe, heure, caption
- Boutons de réaction (cœur animé au tap, extensible à d'autres émojis)
- Fil de commentaires en bas (scrollable)
- Si la photo fait partie d'un cluster : indicateur "Voir les X autres regards sur ce moment" + swipe horizontal

### 5. Défis photo (gamification)

**Concepts :**
- Les mariés définissent les défis avant le jour J via `/admin/challenges`
- Chaque défi a : titre, description, nombre de points, heure de déverrouillage optionnelle
- Un défi verrouillé apparaît grisé avec un cadenas et l'heure de déverrouillage
- Les "défis secrets" se débloquent à une heure précise (effet de surprise)

**Exemples de défis à pré-charger :**

| Défi | Points | Heure déverrouillage |
|------|--------|---------------------|
| La cérémonie vue de votre place | 30 | 16h30 |
| La première danse des mariés | 50 | — |
| Selfie avec un(e) inconnu(e) de l'autre famille | 30 | — |
| Le dancefloor vu d'en haut | 40 | — |
| Le moment le plus émouvant | 100 | — |
| Trouvez le détail déco le plus original | 20 | — |
| Les enfants en action | 30 | — |
| Le plat que vous avez préféré | 20 | 19h00 |
| La piste de danse à son apogée | 50 | 22h00 |
| Le dernier debout | 100 | 00h00 |

**Mécanique de points :**
- Upload d'une photo : +10 pts
- Upload d'une vidéo : +15 pts
- Photo tagguée sur un défi : +points du défi
- Recevoir un cœur : +2 pts
- Commenter une photo : +5 pts
- Premier upload de la soirée : badge "Premier regard" + 20 pts bonus

### 6. Badges

| Badge | Condition | Icône |
|-------|-----------|-------|
| Premier regard | Premier invité à uploader | ⚡ |
| Paparazzi | 20+ photos uploadées | 📸 |
| Vidéaste | Première vidéo uploadée | 🎬 |
| Social butterfly | Commenté 10+ photos d'autres | 🦋 |
| Chasseur de défis | 5+ défis complétés | 🏆 |
| Noctambule | Photo uploadée après minuit | 🌙 |
| Fan #1 | 50+ réactions données | ❤️ |
| Regard d'or | Photo la plus aimée de la soirée | 👑 |

**Implémentation :**
- Vérification des badges via triggers PostgreSQL ou après chaque action côté API
- Stockés dans le champ `badges TEXT[]` de la table `guests`
- Notification toast quand un badge est débloqué

### 7. Classement (leaderboard)

**Affiche :**
- Top photographes (par points)
- Badges de l'invité connecté
- Photo la plus aimée de la soirée (avec aperçu)
- Compteur global : total de regards, total de photos, total de défis complétés

**Temps réel :** Le classement se met à jour en live via Supabase Realtime.

### 8. Timeline "Moments"

**Vue chronologique verticale de la journée :**
- Axe vertical avec des nœuds pour chaque moment clé
- Les mariés pré-définissent les moments (Cérémonie, Première danse, Cocktail, etc.) via `/admin/moments`
- Chaque nœud affiche : heure, label, nombre de photos, nombre de regards (invités différents), aperçu en miniatures
- Les photos sans moment défini sont rattachées au moment le plus proche par timestamp
- Tap sur un moment → galerie filtrée avec toutes les photos de cette tranche horaire

### 9. Synchronisation Google Drive

**Architecture :**
- Un cron job (Vercel Cron ou node-cron si Dokploy) tourne toutes les 5 minutes
- Il query les `media` où `drive_synced = false`
- Pour chaque fichier : télécharge depuis Supabase Storage → upload vers Google Drive → marque `drive_synced = true`
- Nommage sur Drive : `{PRENOM}_{TIMESTAMP}_{FILENAME}` pour garder de l'ordre

**Configuration Google :**
1. Créer un projet sur Google Cloud Console
2. Activer l'API Google Drive
3. Créer un Service Account
4. Télécharger la clé JSON
5. Créer le dossier "Photos et vidéos du mariage" sur Google Drive
6. Partager ce dossier avec l'email du Service Account (en éditeur)
7. Stocker le `folder_id` dans la table `config`

**Code de synchronisation :**
```typescript
// api/cron/sync/route.ts
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

export async function POST(req: Request) {
  // Vérifier le secret du cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer les médias non synchronisés
  const { data: unsynced } = await supabase
    .from('media')
    .select('*, guests(name)')
    .eq('drive_synced', false)
    .limit(10); // Batch de 10 par exécution

  const { data: config } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'drive')
    .single();
    
  const folderId = config.value.folder_id;

  for (const media of unsynced || []) {
    try {
      // Télécharger depuis Supabase Storage
      const { data: fileData } = await supabase.storage
        .from('media')
        .download(media.file_url);

      // Upload vers Google Drive
      const timestamp = new Date(media.taken_at || media.uploaded_at)
        .toISOString().replace(/[:.]/g, '-');
      const guestName = media.guests?.name || 'Inconnu';
      const fileName = `${guestName}_${timestamp}_${media.id.slice(0, 8)}`;

      const driveResponse = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType: media.file_type,
          body: fileData.stream(),
        },
      });

      // Marquer comme synchronisé
      await supabase
        .from('media')
        .update({
          drive_synced: true,
          drive_file_id: driveResponse.data.id,
        })
        .eq('id', media.id);
        
    } catch (error) {
      console.error(`Erreur sync Drive pour ${media.id}:`, error);
    }
  }

  return Response.json({ synced: unsynced?.length || 0 });
}
```

### 10. Dashboard admin (pour les mariés)

**Accessible via `/admin` avec un mot de passe simple (variable d'environnement).**

**Fonctionnalités :**
- Statistiques en direct : nombre d'invités actifs, photos uploadées, vidéos, défis complétés
- Modération : supprimer une photo inappropriée
- Gestion des défis : créer, modifier, supprimer, verrouiller/déverrouiller
- Gestion des moments : définir les tranches horaires de la journée
- Forcer une synchronisation Drive
- Exporter toutes les photos en ZIP
- Générer le QR code personnalisé (avec les couleurs du thème)

---

## Design system

### Palette (extraite du faire-part floral de Malachie & Jessica)

```css
:root {
  --color-primary: #5B6B52;       /* Vert sauge — boutons principaux */
  --color-secondary: #C4A882;     /* Or doux — accents, labels moments */
  --color-accent: #7B4F5C;        /* Bordeaux floral — défis premium, accents chauds */
  --color-bg: #FAF8F5;            /* Crème papier — fond principal */
  --color-bg-card: #FFFFFF;       /* Blanc — cartes */
  --color-bg-secondary: #F3F0EB;  /* Beige clair — fonds secondaires */
  --color-text: #2C2A28;          /* Quasi-noir chaud */
  --color-text-secondary: #6B6560;
  --color-text-tertiary: #A39E98;
  --color-border: rgba(0,0,0,0.08);
}
```

### Typographie

```css
/* Headings (noms des mariés, titres d'écran) */
font-family: 'Cormorant Garamond', serif;

/* Corps et UI */
font-family: 'DM Sans', sans-serif;
```

- Charger via Google Fonts
- Cormorant Garamond : 400, 500 (pour l'élégance du faire-part)
- DM Sans : 400, 500 (lisible, moderne, amical)

### Composants UI clés

**Barre de navigation bottom :**
- 5 onglets : Feed, Défis, [Bouton camera central], Moments, Score
- Le bouton camera est surélevé (FAB) avec un cercle `--color-primary`
- Onglet actif : icône + texte en `--color-primary`

**Carte photo dans le feed :**
- Coins arrondis 12px
- Avatar + prénom en header
- Photo pleine largeur
- Barre de réactions + commentaires sous la photo
- Badge défi si applicable (pill arrondie)

**Cluster "Même moment" :**
- Fond légèrement différent (`--color-bg-secondary`)
- Header avec icône horloge et timestamp
- Layout asymétrique : 1 grande + 2 petites (ou grille adaptative selon le nombre)

**Chips de relation :**
- Pills arrondies avec border
- Active : fond `--color-primary`, texte blanc
- Inactive : border gris, texte gris

---

## Variables d'environnement

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google Drive
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Admin
ADMIN_PASSWORD=votre-mot-de-passe-admin

# Cron
CRON_SECRET=votre-secret-cron

# App
NEXT_PUBLIC_APP_URL=https://regards.votre-domaine.com
NEXT_PUBLIC_WEDDING_DATE=2026-05-23
```

---

## Déploiement

### Option A : Vercel (recommandé pour la simplicité)

```bash
npx create-next-app@latest regards --typescript --tailwind --app
cd regards
npm install @supabase/supabase-js googleapis sharp exifr qrcode
vercel deploy
```

- Ajouter les variables d'environnement dans Vercel Dashboard
- Configurer un Vercel Cron dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Option B : Dokploy (hébergement propre)

- Dockerfile multi-stage pour Next.js
- Configurer un cron système ou utiliser `node-cron` en process séparé
- Reverse proxy via Dokploy avec certificat SSL auto

---

## QR Code

Générer un QR code aux couleurs du mariage :

```typescript
import QRCode from 'qrcode';

const qrDataUrl = await QRCode.toDataURL('https://regards.votre-domaine.com', {
  width: 400,
  margin: 2,
  color: {
    dark: '#5B6B52',  // Vert sauge
    light: '#FAF8F5', // Crème
  },
});
```

**Support d'impression :**
- Générer en SVG pour impression haute qualité
- Intégrer dans un design de carte avec les prénoms des mariés et la date
- Prévoir des formats : carte de table (10x10cm), A5 pour le chevalet d'accueil

---

## Priorités de développement (ordre recommandé)

### Phase 1 — MVP fonctionnel (semaines 1-2)
1. Setup Next.js + Supabase + schéma DB
2. Page d'accueil + onboarding invité
3. Upload de photos avec extraction EXIF
4. Feed simple chronologique (sans clustering)
5. Synchronisation Google Drive (cron)
6. Génération QR code

### Phase 2 — Expérience sociale (semaines 3-4)
7. Réactions (cœurs) sur les photos
8. Commentaires par photo (avec fils de réponse)
9. Vue "Regard de [Prénom]" (filtrage par invité)
10. Vue détail photo plein écran

### Phase 3 — Gamification (semaine 5)
11. Système de défis photo
12. Calcul de points et badges
13. Classement / leaderboard
14. Défis verrouillés par horaire

### Phase 4 — Fonctionnalités avancées (semaine 6)
15. Clustering "Même moment" automatique
16. Timeline verticale des moments
17. Dashboard admin (stats, modération, gestion défis)
18. Temps réel (feed live, compteurs live)

### Phase 5 — Polish (semaine 7)
19. PWA manifest + service worker (mode hors-ligne basique)
20. Animations et transitions
21. Optimisation performance (lazy loading, pagination infinie)
22. Tests sur différents devices et navigateurs
23. Design des cartes QR imprimables

---

## Considérations techniques importantes

### Performance mobile
- Compresser les images avant upload côté client (via canvas, max 2048px de large)
- Lazy loading des images dans le feed (Intersection Observer)
- Pagination infinie (charger 20 photos par batch)
- Miniatures pour le feed, originaux pour la vue détail et Drive
- Précharger les images suivantes dans le carousel

### Extraction EXIF pour "Même moment"
- Utiliser `exifr` côté serveur pour extraire `DateTimeOriginal`
- Fallback sur `Date` du fichier si pas d'EXIF
- Attention : les vidéos n'ont pas toujours d'EXIF → utiliser la date d'upload comme fallback
- Normaliser les fuseaux horaires (tout en UTC)

### Gestion des gros fichiers (vidéos)
- Upload en chunks via `tus` protocol (Supabase Storage le supporte)
- Barre de progression visible pendant l'upload
- Limiter la durée des vidéos à 60 secondes côté client
- Générer une miniature de la première frame côté serveur

### Sécurité
- Pas d'authentification lourde (c'est un mariage, pas une banque)
- Le `guest_id` dans un cookie suffit
- Rate limiting sur les uploads : max 50 uploads/heure par invité
- L'admin dashboard est protégé par mot de passe
- Les URLs Supabase Storage sont signées (expiration 7 jours)
- CORS configuré pour n'accepter que le domaine de l'app

### Accessibilité
- L'app doit fonctionner sur les smartphones les plus anciens (Safari 14+, Chrome 80+)
- Pas de JS lourd côté client — utiliser le SSR de Next.js au maximum
- Boutons de taille minimum 44x44px (mobile touch targets)
- Contraste suffisant sur tous les textes

---

## Données de test / seed

```sql
-- Seed des défis
INSERT INTO challenges (title, description, points, unlock_at, sort_order) VALUES
  ('La cérémonie vue de votre place', 'Montrez-nous la cérémonie telle que vous la voyez depuis votre siège', 30, '2026-05-23T16:30:00+02:00', 1),
  ('La première danse', 'Capturez la première danse des mariés depuis votre angle', 50, NULL, 2),
  ('Selfie avec un(e) inconnu(e)', 'Faites connaissance avec quelqu''un de l''autre famille et prenez un selfie ensemble', 30, NULL, 3),
  ('Le dancefloor vu d''en haut', 'Trouvez un point de vue en hauteur pour photographier la piste de danse', 40, NULL, 4),
  ('Le moment le plus émouvant', 'Capturez LE moment qui vous a fait monter les larmes', 100, NULL, 5),
  ('Trouvez le détail déco le plus original', 'La déco est pleine de surprises... Trouvez la plus originale', 20, NULL, 6),
  ('Les enfants en action', 'Les enfants sont les vraies stars — immortalisez leurs bêtises', 30, NULL, 7),
  ('Le plat que vous avez préféré', 'Photographiez votre plat préféré du repas', 20, '2026-05-23T19:00:00+02:00', 8),
  ('La piste à son apogée', 'Le moment où la piste de danse est la plus remplie', 50, '2026-05-23T22:00:00+02:00', 9),
  ('Le dernier debout', 'Qui sera le dernier sur la piste ? Prouvez-le !', 100, '2026-05-24T00:00:00+02:00', 10);

-- Seed des moments
INSERT INTO moments (label, start_time, end_time, auto_generated) VALUES
  ('Cérémonie', '2026-05-23T16:30:00+02:00', '2026-05-23T17:15:00+02:00', false),
  ('Photos de groupe', '2026-05-23T17:15:00+02:00', '2026-05-23T18:00:00+02:00', false),
  ('Cocktail', '2026-05-23T18:00:00+02:00', '2026-05-23T19:30:00+02:00', false),
  ('Dîner', '2026-05-23T19:30:00+02:00', '2026-05-23T21:30:00+02:00', false),
  ('Soirée dansante', '2026-05-23T21:30:00+02:00', '2026-05-24T04:00:00+02:00', false);
```

---

## Récapitulatif

Ce brief couvre l'intégralité de l'application "Regards". L'objectif est de créer quelque chose qui n'existe nulle part : une webapp de mariage qui transforme chaque invité en un "regard" unique sur la journée, avec une couche de gamification qui pousse naturellement les gens à participer, et un socle technique solide qui synchronise tout vers Google Drive.

Le design respecte l'identité visuelle du faire-part (vert sauge, or doux, bordeaux floral, fond crème) pour que l'app se sente comme une extension naturelle du mariage de Malachie et Jessica.
