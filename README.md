# Regards 💍 - Application PWA de Mariage

Regards est une application web progressive (PWA) conçue spécifiquement pour immortaliser les souvenirs d'un mariage. Elle permet aux invités de partager leurs photos et vidéos en temps réel, de réagir aux contenus, et de participer à des défis grâce à un système de gamification.

## 🌟 Fonctionnalités Principales

- **Upload Fiable (Tus Protocol)** : Téléversement asynchrone et reprenable des fichiers volumineux (photos et vidéos) supportant les pertes de connexion.
- **Feed Social en Temps Réel** : Un fil d'actualité chronologique (avec regroupement intelligent des photos prises au même moment) mis à jour en direct via Server-Sent Events (SSE).
- **Gamification & Défis** : Les invités scannent des QR codes spécifiques (cachés ou affichés lors de l'événement) pour débloquer des défis, gagner des points et monter dans le classement (Leaderboard).
- **Interactions Sociales** : Possibilité de laisser des commentaires et des réactions (cœurs, flammes, etc.) sur chaque média.
- **Interface Caméra PWA** : Prise de photos directement depuis l'application via les API web natives avec extraction automatique des métadonnées (EXIF) pour la date et le lieu.
- **Synchronisation Google Drive (Admin)** : Sauvegarde automatique de toutes les photos postées vers un dossier Google Drive (via un Cron Job).
- **Espace Administrateur** : Dashboard de modération des contenus, gestion des invités, des défis, et suivi de la santé du système, protégé par mot de passe.

## 📸 Comment partager l'application aux invités ?

1. **Génération d'un QR Code d'Accès** : L'URL publique de l'application (ex: https://regards.mon-domaine.com) peut être convertie en QR code géant imprimé sur les tables ou le menu.
2. **Onboarding Sensationnel** : L'URL amène vers une belle page d'accueil (Landing Page).
3. **Création du Profil** : Les invités n'ont pas besoin de mot de passe. Ils entrent leur Prénom, prennent un selfie (avatar), et ils sont instantanément connectés au mariage pour uploader ou regarder le flux en direct !
4. **Installation PWA** : Une suggestion de "Ajouter à l'écran d'accueil" apparaîtra sur leur smartphone pour vivre l'expérience comme une application native.

---

## 🚀 Déploiement sur Docploy

L'application est 100% "Docker-ready" avec son fichier docker-compose.yml définissant Next.js, PostgreSQL (Base de données) et MinIO (Stockage des photos/vidéos type S3).

### Étapes sur Docploy :

1. Allez dans l'interface de votre instance **Docploy**.
2. Créez une nouvelle application de type **Compose**.
3. Liez ce **dépôt GitHub** à votre projet sur Docploy.
4. Spécifiez le fichier docker-compose.yml comme source.
5. Allez dans l'onglet **Environnement / Variables** sur Docploy et ajoutez obligatoirement ces variables :
   - POSTGRES_PASSWORD : Un mot de passe fort pour la base de données.
   - MINIO_ACCESS_KEY : (ex: dmin)
   - MINIO_SECRET_KEY : Un mot de passe fort long (ex: MySecretMinioKey123!).
   - ADMIN_PASSWORD : Le mot de passe pour accéder à la route /admin.
   - NEXT_PUBLIC_APP_URL : L'URL publique du site (ex: https://regards.mon-domaine.com).
   - GOOGLE_SERVICE_ACCOUNT_KEY : (Optionnel, au format stringifié) JSON du compte de service Google pour le Drive.
6. **Réseau / Domaines** : 
   - Dirigez votre nom de domaine (egards.votre-domaine.com) vers le service pp sur le port **3000**.
   - (Optionnel) Dirigez un sous-domaine minio.votre-domaine.com vers le service minio sur le port **9000** si vos médias semblent cassés en front-end (à régler ensuite aussi dans les variables d'environnement si l'URL externe est requise - bien que l'app utilise un proxy pour le téléchargement).
7. Déployez ! Docploy va s'occuper de construire le conteneur Next (qui est configuré en mode \standalone\) et lancer Postgres et MinIO avec les volumes persistants.

---

## 🧪 Commencer le test End-To-End (E2E)

Maintenant que le code est validé et corrigé, voici comment procéder au test complet de l'application (en local ou une fois déployé) :

1. **Générer un utilisateur (Onboarding)** : 
   Allez sur URL_APP/. Soumettez un nom et prenez une photo (selfie) -> vous serez redirigé vers /feed.
2. **Uploader des Média** : 
   Cliquez sur le gros bouton '+' du menu en bas (Bottom Nav). Choisissez une ou deux photos depuis la galerie de votre téléphone ou d'un PC (elles simuleront des dates Exif s'il y en a). Attendez la fin du transfert Tus.
3. **Tester le Feed & Clustering** : 
   Affichez le /feed. Si vous avez posté deux photos à moins de 2 minutes d'intervalle, la vue doit les afficher côte à côte (en mode "Cluster"), sinon elles sont individuellement l'une au-dessus de l'autre ("Single").
4. **Interactions sociales** : 
   Amusez-vous à cliquer sur le bouton ❤️ (réaction) ou la bulle pour laisser un rapide commentaire. Ouvrez une autre fenêtre de navigation privée (qui est un autre invité), vous devriez voir les Likes et le feed s'animer en Live grâce au flux Server-Sent Events.
5. **Gamification (Points)** : 
   Rendez-vous sur l'onglet 🏆 (Leaderboard). Votre compte d'invité devrait avoir des points. Pour valider une quête, appelez l'URL /quests/SCAN_ID ou suivez les instructions de QR codes cachés simulés !
6. **Vérification Admin** : 
   Visitez la route /admin (en vous connectant avec admin + ADMIN_PASSWORD défini). Vous verrez la vue panoramique du mariage, le stockage occupé sur MinIO, et le bouton forcer la sauvegarde Google Drive.

*Happy Wedding! 🎉*
