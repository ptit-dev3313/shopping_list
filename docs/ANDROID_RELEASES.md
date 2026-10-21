# Publier Courses sur GitHub

## Avant de rendre le dépôt public

L’audit du 21 octobre 2026 a trouvé un ancien jeton GitHub répété dans l’historique Python (`src/shopping_list/sync.py` et `src/shopping_list/github_gist.py`). La demande de révocation a été acceptée par GitHub et l’historique de `main` a été remplacé, avec autorisation du propriétaire, par les commits propres de la version 0.5.0. Une sauvegarde de l’ancien historique est conservée uniquement dans `.tools/private-history.bundle` (privé, ignoré par Git). Ne republiez pas cette sauvegarde ni les anciennes branches/clones contenant le jeton. Des copies ou caches de l’ancien historique peuvent persister hors des branches nettoyées ; la révocation est donc indispensable, même après le nettoyage.

Le code courant ne nécessite aucun jeton GitHub embarqué. Les données utilisateurs restent dans Supabase, avec les politiques RLS. L’URL Supabase et la clé publique/anon sont une configuration publique de client ; elles ne remplacent pas les contrôles d’accès. Ne publiez jamais de clé `service_role`, mot de passe de base, fichier `.env`, jeton personnel ou clé privée de signature. Le dépôt ignore les fichiers de signature, `.tools/`, `.env*` (sauf `.env.example`) et les sorties de compilation. Garder un dépôt public ne publie pas automatiquement les données Supabase ; toute future table exposée doit cependant rester protégée.

## Configuration déjà préparée

- Dépôt et nom d’APK : `release.config.json` (`ptit-dev3313/shopping_list`, `Courses.apk`).
- Vérification automatique au démarrage puis à la reprise (au maximum toutes les six heures), et manuelle via le bouton en haut à droite.
- Seules les releases stables publiées et contenant `Courses.apk` sont proposées. Les brouillons et préversions sont exclus. Les liens sont limités à ce dépôt GitHub.
- Téléchargement par le navigateur système. L’utilisateur ouvre ensuite l’APK et confirme l’installation dans Android. Aucune installation silencieuse ni permission d’installation ajoutée à Courses.
- L’identité de signature de l’APK locale existante a été importée dans un conteneur protégé, afin de conserver la compatibilité des mises à jour. Le build de publication est signé et non débogable. **Sauvegardez `.tools/signing/` dans un emplacement privé** ; ce dossier ne doit jamais être commité.
- Secrets GitHub Actions configurés : `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- Variables GitHub Actions configurées : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (configuration publique).
- Aucun compte Google Play Developer n’est nécessaire pour distribuer les APK par GitHub. Une publication sur le Play Store serait une démarche distincte.

## Nouvelle version

1. Modifiez la version dans `package.json` et dans le lockfile (`npm version patch --no-git-tag-version` convient pour une correction).
2. Augmentez **toujours** `androidVersionCode` dans `release.config.json`. Android utilise ce numéro pour autoriser la mise à jour ; ne le réutilisez pas.
3. Lancez `npm test` et `npm run android:build`. L’APK signée est copiée dans `release/Courses.apk` et `release/Courses-<version>.apk`.
4. Commitez et poussez le code vérifié vers `main`.
5. Créez puis poussez le tag correspondant, par exemple `git tag v0.5.0`, puis `git push origin v0.5.0`.
6. Le workflow **Android release** teste le code, compile l’APK signée, vérifie sa signature et crée la release GitHub avec `Courses.apk` et `SHA256SUMS.txt`. Il peut aussi être relancé manuellement pour un tag existant qui n’a pas encore de release.

La vérification de mise à jour publique fonctionnera quand le dépôt sera public et contiendra une release publiée. Avant cela, GitHub renvoie 404 aux téléphones sans authentification. Ne mettez pas de jeton personnel dans l’app pour contourner ce comportement.

Installez l’APK par-dessus la version précédente, avec le même identifiant et la même signature. **Ne désinstallez pas** l’app pour une mise à jour normale : cela effacerait sa session et ses données locales. Les données déjà sauvegardées dans Supabase restent accessibles au compte.

## Marges Android

`SystemBars.insetsHandling` utilise le mode natif de Capacitor 8, avec `viewport-fit=contain` et `EdgeToEdge.enable`. La WebView est maintenue dans la zone utilisable en tenant compte des barres système, des découpes et du clavier. Cela évite que le sélecteur d’espace, les en-têtes ou les fenêtres recouvrent les contrôles Android. Les champs restent zoomables et les commandes s’adaptent aux écrans étroits.

Références : [Capacitor SystemBars](https://capacitorjs.com/docs/apis/system-bars), [signature Android](https://developer.android.com/studio/publish/app-signing), [GitHub Releases](https://docs.github.com/en/rest/releases/releases).
