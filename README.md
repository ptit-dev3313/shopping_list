# Courses

Courses aide à préparer les repas et à organiser les achats, seul ou à plusieurs.

## Fonctionnalités

- Enregistrer des recettes, leurs ingrédients, les quantités et les unités.
- Préparer les achats à partir de plusieurs recettes et ajouter des produits supplémentaires.
- Indiquer ce qui est déjà à la maison pour calculer les quantités restantes.
- Générer une liste de courses et cocher les produits pendant les achats.
- Réorganiser, renommer et fusionner les ingrédients.
- Utiliser un espace personnel ou partager un espace sur invitation.
- Copier une liste vers un autre espace ; les copies évoluent indépendamment.
- Enregistrer automatiquement les modifications et conserver un brouillon en cas de problème réseau.
- Vérifier et installer les mises à jour Android depuis l’application.

Les suggestions s’affichent sous le champ de saisie. Les noms saisis sont convertis en minuscules ; les mots de passe restent inchangés.

## Installer sur Android

Téléchargez `Courses.apk` depuis les [versions publiées](https://github.com/ptit-dev3313/shopping_list/releases/latest), puis ouvrez le fichier sur votre téléphone. Android vous demandera de confirmer l’installation et, si nécessaire, d’autoriser cette source.

Pour mettre à jour une installation existante, installez la nouvelle version par-dessus l’ancienne, sans la désinstaller. Le bouton **Mises à jour** permet de vérifier les nouvelles versions depuis l’app.

## Espaces, partage et sauvegarde

Chaque compte dispose d’un espace personnel. Les espaces partagés deviennent accessibles après acceptation d’une invitation. Les membres peuvent en modifier le contenu ; le propriétaire gère les invitations et les accès.

L’état d’enregistrement indique si les modifications ont atteint le cloud. Les changements indépendants de plusieurs appareils sont fusionnés lorsque leur version de départ est connue. En cas de conflit, le brouillon est conservé et l’app propose de le copier dans un espace séparé avant de reprendre les données partagées.

Le chargement initial nécessite une connexion Internet. La conservation d’un brouillon ne constitue pas un mode hors ligne complet.

## Développement

Prérequis : Node.js 22 et une configuration Supabase adaptée à votre propre environnement.

1. Installez les dépendances avec `npm ci`.
2. Copiez `.env.example` vers `.env.local` et renseignez vos valeurs.
3. Lancez `npm run dev`.

```sh
npm test
npm run audit:public
npm run build
```

La distribution est limitée à Android : une APK signée est publiée sur GitHub Releases. L’application se connecte directement à Supabase ; aucun VPS n’est nécessaire.

Les variables `VITE_*` sont intégrées au client : utilisez uniquement une URL d’API et une clé publique prévues à cet effet. Les accès aux données doivent être protégés côté serveur.


## Compiler Android

Le projet Android se trouve dans `android/`. Installez un JDK 21, Android SDK Platform 36 et Build Tools 36.0.0, puis configurez `JAVA_HOME` et `ANDROID_HOME`.

```sh
npm run android:build
```

Les fichiers compilés sont générés dans `release/`. Pour une compilation locale de débogage : `npm run android:build -- --debug`.

La procédure de publication est décrite dans [docs/ANDROID_RELEASES.md](docs/ANDROID_RELEASES.md).
