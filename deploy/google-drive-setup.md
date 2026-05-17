# Google Drive Service Account — setup pas à pas

Objectif : permettre à REGARDS d'écrire automatiquement les photos/vidéos des invités dans un dossier Drive des mariés, **sans OAuth utilisateur** (pas de popup de connexion, pas de token à renouveler).

Durée : ~10 minutes. À faire une seule fois.

---

## 1) Créer un projet Google Cloud

1. Allez sur https://console.cloud.google.com/
2. En haut, cliquez sur le sélecteur de projet → **« Nouveau projet »**
3. Nom : `regards-mariage` (ou ce que vous voulez). Pas d'organisation requise.
4. Cliquez **Créer**, puis sélectionnez le projet.

## 2) Activer l'API Google Drive

1. Menu de gauche → **APIs et services** → **Bibliothèque**
2. Cherchez `Google Drive API` → cliquez dessus → **Activer**

## 3) Créer le Service Account

1. Menu → **IAM et administration** → **Comptes de service**
2. **+ Créer un compte de service**
   - Nom : `regards-uploader`
   - ID : `regards-uploader` (auto-rempli)
   - Description : `Upload photos/vidéos invités vers Drive du mariage`
3. Cliquez **Créer et continuer**
4. **Rôle** : aucun (laissez vide — on n'utilise pas IAM Google Cloud, juste Drive partagé)
5. Cliquez **Continuer** puis **OK**

## 4) Générer la clé JSON

1. Dans la liste, cliquez sur `regards-uploader@…iam.gserviceaccount.com`
2. Onglet **Clés** → **Ajouter une clé** → **Créer une clé**
3. Type : **JSON** → **Créer**
4. Un fichier `regards-mariage-XXXX.json` se télécharge. **Gardez-le en sécurité, il n'est pas regénérable.**

## 5) Préparer le dossier Drive des mariés

1. Allez sur https://drive.google.com (compte Drive 5 To des mariés)
2. Créez un dossier : `Photos et vidéos du mariage`
3. **Important** : créez aussi un sous-dossier `_Tous les moments` à l'intérieur (pour les shortcuts cross-invité — optionnel mais recommandé)
4. Sur le dossier parent, clic droit → **Partager** → ajoutez l'email du Service Account (visible dans le JSON, champ `client_email`, ex: `regards-uploader@regards-mariage.iam.gserviceaccount.com`)
5. Donnez le rôle **Éditeur**. Décochez « Notifier les utilisateurs ».
6. Faites pareil sur `_Tous les moments`.

## 6) Récupérer les IDs de dossier

Ouvrez chaque dossier dans le navigateur. L'URL ressemble à :
```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz123456
                                        └────── c'est ça l'ID ───────┘
```

Notez :
- `folder_id` = ID de `Photos et vidéos du mariage`
- `all_moments_folder_id` = ID de `_Tous les moments` (ou `null` si vous skippez)

→ ces deux IDs vont dans `deploy/bootstrap.sql`.

## 7) Injecter la clé dans la variable d'environnement

Le fichier JSON doit être passé en **une seule ligne** à `GOOGLE_SERVICE_ACCOUNT_KEY`. Dokploy gère ça correctement si vous collez le JSON brut dans le champ. Sinon, en CLI :

```bash
# Convertit le JSON en string single-line (échappe les \n du private_key)
node -e "console.log(JSON.stringify(require('./regards-mariage-XXXX.json')))" | pbcopy
```

Puis collez dans Dokploy → variables d'environnement → `GOOGLE_SERVICE_ACCOUNT_KEY`.

## 8) Vérifier

Après le premier upload + 5 min, le cron doit sync. Vérifier :

```bash
# Combien de fichiers en attente de sync
docker compose exec postgres psql -U regards -d regards \
  -c "SELECT COUNT(*) FROM media WHERE drive_synced = false AND processing_status = 'done';"

# Logs du sync
docker compose logs app --tail=100 | grep '\[drive\]'
```

Vous devriez voir : `[drive] Synced N files.`

## Quotas et limites

- **Drive API** : 1 000 requêtes/100s par utilisateur. Le sync fait ~3 req/fichier (folder lookup + upload + shortcut), donc max ~30 fichiers/100s. Pour un mariage de 200 invités × 100 médias = 20 000 fichiers, ça prend ~18h de sync total après le mariage. Acceptable.
- **Espace Drive** : votre quota personnel (5 To). Les fichiers uploadés via Service Account **comptent dans le quota du propriétaire du dossier** (les mariés), pas du SA.
- **Scope** : `drive.file` — le SA ne voit QUE les fichiers/dossiers qu'il crée ou qui lui sont explicitement partagés. Il ne peut pas lister tout votre Drive. Sécurisé.

## Que faire si la clé fuite

1. Console GCP → Comptes de service → `regards-uploader` → onglet Clés → supprimez la clé compromise
2. Générez-en une nouvelle (étape 4)
3. Mettez à jour `GOOGLE_SERVICE_ACCOUNT_KEY` dans Dokploy, redémarrez le conteneur app
4. Les fichiers déjà synchronisés restent intacts (le SA y a toujours accès via le partage du dossier)
