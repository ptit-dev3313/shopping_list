# Compiler et publier une version Android

## Configuration

La version de l’application est définie dans `package.json`. Le numéro de version Android et le dépôt de distribution sont définis dans `release.config.json`.

Le workflow `.github/workflows/android-release.yml` utilise une configuration fournie par l’environnement de publication :

- Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Secrets de signature : `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Les noms de ces paramètres font partie de la documentation ; leurs valeurs privées ne doivent jamais être ajoutées au dépôt. Pour une compilation locale signée, fournir `SIGNING_STORE_FILE`, `SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS` et `SIGNING_KEY_PASSWORD` dans l’environnement.

Conserver la même identité de signature et le même identifiant d’application pour permettre les mises à jour des installations existantes.

## Nouvelle version

1. Modifier la version dans `package.json` et `package-lock.json`.
2. Augmenter `androidVersionCode` dans `release.config.json`.
3. Exécuter `npm test`, `npm run audit:public` et `npm run android:build`.
4. Vérifier les fichiers à publier, puis commiter et pousser les changements.
5. Créer et pousser un tag `v<version>` correspondant à `package.json`.

Le workflow teste l’application, compile l’APK signée, vérifie sa signature et publie `Courses.apk` avec `SHA256SUMS.txt` dans une GitHub Release.

## Mises à jour dans l’application

Le client propose les versions stables plus récentes du dépôt configuré. Les brouillons et les préversions sont exclus.

Sur Android, le téléchargement s’effectue dans le cache de l’application. Le fichier, son identifiant d’application, sa version et sa signature sont vérifiés avant l’ouverture de l’installateur Android. L’utilisateur conserve le contrôle de l’installation.

Le mode de distribution actuellement implémenté nécessite des releases publiques accessibles sans authentification GitHub. Passer le dépôt en privé exige d’abord une autre distribution des mises à jour. Aucun secret GitHub ne doit être embarqué dans le client.

Les fichiers de signature, les configurations locales, les sauvegardes et les sorties de compilation sont exclus de Git. Le contrôle `npm run audit:public` aide à repérer les publications accidentelles ; il complète la vérification des fichiers avant chaque publication.
