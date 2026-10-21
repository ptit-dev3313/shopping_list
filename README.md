# Courses

Application de courses en React + TypeScript, avec comptes individuels et espaces partagés.

Les données vivent dans le projet Supabase **Shopping list**. On crée un compte (e-mail + mot de passe), puis on clique sur le lien de confirmation reçu par e-mail. Chaque compte reçoit un espace privé. Une seule base Supabase héberge les espaces ; les règles RLS isolent leurs données côté serveur.

## Espaces et partage

- Le menu « Espace actif » sélectionne les données affichées. Le changement d’espace sauvegarde les modifications ; un échec bloque le changement.
- Dans **Paramètres**, créez un espace séparé puis sélectionnez-le pour inviter d’autres personnes par e-mail. Tout membre accepté peut lire et modifier toutes ses recettes, ingrédients et listes. Seul le propriétaire peut inviter ou retirer des personnes.
- Les invitations apparaissent dans les paramètres du destinataire après création et confirmation de son compte. Aucun e-mail d’invitation n’est envoyé. Le destinataire doit accepter avant de voir les données.
- Un espace personnel ne peut pas être partagé. Pour ne partager qu’une liste « À acheter », copiez-la vers un autre espace depuis les paramètres. Seuls cette liste et ses ingrédients sont copiés ; les copies évoluent indépendamment.
- L’ancien espace `household` et son contenu sont conservés. Le premier compte existant autorisé en est propriétaire ; les autres anciennes adresses autorisées ont une invitation.
- La sauvegarde reste manuelle. Une version de données empêche d’écraser une sauvegarde plus récente. En cas de conflit, les modifications locales sont conservées ; rechargez l’espace pour récupérer la version distante (cela abandonne les modifications locales).

## Base et sécurité

La migration `supabase/migrations/20261021190259_secure_multi_user_spaces.sql` a été appliquée au projet existant le 21 octobre 2026. Elle est destinée à mettre à niveau son ancien schéma, pas à initialiser une base vide. Ne pas la réappliquer sur ce projet. L’ancien registre `allowed_emails` est conservé dans le schéma privé comme archive administrative, sans accès client.

Les tests `supabase/tests/space_access.sql` vérifient l’isolation des comptes, les invitations en attente, l’acceptation, les droits du propriétaire, la confidentialité des espaces personnels, les modifications par les membres, les conflits de sauvegarde et la révocation. Ils créent des données temporaires et annulent toute la transaction.

Les fonctions privilégiées publiques ne sont plus exécutables par les clients. Le contrôle d’inscription par liste d’e-mails a été remplacé par les droits sur les espaces. La confirmation d’e-mail reste activée. La clé publique/anon dans `.env` est adaptée au navigateur ; ne jamais y placer une clé `service_role` ou secrète.

Avertissement restant : **Leaked password protection** est désactivée. L’organisation est sur l’offre Free ; Supabase réserve cette fonction à Pro et aux offres supérieures. Aucun changement d’abonnement n’a été effectué. Le connecteur utilisé ne permet pas de changer cette option. Guide : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Lancer

```sh
npm install
npm run dev
```

Téléphone (navigateur, même Wi-Fi) : ouvrez l’URL affichée par Vite.

## Android / APK

La version 0.5.0 corrige la zone utilisable Android (barres système, découpes et clavier) et ajoute le bouton **Mises à jour** en haut à droite. La configuration des publications, de la signature et du dépôt public est détaillée dans [docs/ANDROID_RELEASES.md](docs/ANDROID_RELEASES.md). **L’ancien historique contient des jetons GitHub : révoquez-les et nettoyez l’historique avant de rendre le dépôt public.**

Le projet Android est dans `android/`. Installez les dépendances, un JDK 21 et le SDK Android 36. Configurez `JAVA_HOME` et `ANDROID_HOME`. Le script utilise aussi un JDK 21 portable présent dans `.tools/jdk21/` si disponible. Gradle 8.14 ne prend pas en charge le JDK 25.

```sh
npm run android:build
```

Le fichier installable signé est copié dans `release/Courses.apk` et `release/Courses-0.5.0.apk`. La configuration privée de signature est dans `.tools/signing` ; ne la publiez jamais. Transférez l’APK sur le téléphone puis ouvrez-la pour l’installer. Android 7.0 minimum. Pour les mises à jour, gardez le même identifiant d’application et la même clé de signature : une installation par-dessus conserve les données ; désinstaller l’application les efface. Pour une APK de débogage séparée : `npm run android:build -- --debug`.

La session est conservée dans les préférences natives Android et les jetons sont renouvelés automatiquement. Il n’est pas nécessaire de se reconnecter à chaque ouverture. Une déconnexion explicite, une session révoquée ou la suppression des données de l’app nécessitent une nouvelle connexion. Le mot de passe n’est pas stocké. Les sauvegardes Android des données de l’app sont désactivées. Sur le web, Supabase conserve son stockage local habituel.

Sur Android, une sauvegarde est aussi tentée au passage en arrière-plan. Utilisez **Sauvegarder** avant de fermer l’app pour être certain que les changements ont atteint le cloud ; une coupure réseau ou l’arrêt forcé du processus peut interrompre cette tentative. Cette version ne propose pas de mode hors ligne complet.

Pour ouvrir le projet dans Android Studio :

```sh
npx cap open android
```

## Ingrédients et listes

- **Déjà à la maison** affiche les ingrédients nécessaires aux recettes et aux extras, avec les quantités regroupées et les unités compatibles converties. Chaque sélection propose la quantité totale par défaut. Après validation, la quantité disponible apparaît en orange et le reste à acheter est recalculé. La fenêtre reste ouverte jusqu’au bouton **Fermer** ; sélectionner à nouveau un ingrédient permet de corriger sa quantité ou de le retirer.
- Les listes de courses générées suivent l’ordre du catalogue d’ingrédients. Ajouter ou renommer un ingrédient ne réinitialise plus cet ordre. Déplacer un ingrédient dans le catalogue remet aussi les listes existantes dans cet ordre ; le déplacement manuel dans une liste reste possible.
- Les poignées de déplacement font défiler la page près des bords supérieur et inférieur, à la souris comme au doigt.
- **Ingrédients → Fusionner deux ingrédients** remplace leurs références dans toutes les recettes, les extras, le stock disponible et les listes de l’espace actif. Les quantités et les cases cochées restent conservées. Choisissez l’orthographe finale en minuscules. Cette opération ne modifie pas les copies dans d’autres espaces.
- Les nouveaux noms de recettes et d’ingrédients, ainsi que leurs renommages, refusent les majuscules. Les anciens noms ne sont pas réécrits automatiquement.
- Les recettes, les achats et les listes de courses ont un bouton explicite **Renommer**. Les ingrédients se renomment via leur crayon ; le propriétaire peut renommer son espace dans les paramètres.

Tests : `npm test` (calculs, conversions, fusion, ordre, fenêtre persistante, défilement et stockage de session).

Ordinateur :

```sh
npm run electron:dev
```

Build desktop :

```sh
npm run electron:build
```

## E-mail de confirmation

Le modèle par défaut **Confirm signup** de Supabase suffit : un lien `{{ .ConfirmationURL }}`. Après le clic, tu reviens sur l’app.

Site URL : `http://localhost:5173`.

Pour utiliser une URL publique, configurez **Site URL** et les **Redirect URLs** dans Supabase Auth avec cette URL. Les nouveaux utilisateurs peuvent s’inscrire sans liste d’e-mails autorisés. Après cette mise à jour, relancez/reconstruisez les clients web, Electron ou Capacitor pour utiliser les nouveaux espaces.
