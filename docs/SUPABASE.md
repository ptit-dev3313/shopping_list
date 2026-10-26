# Supabase et distribution Android

Le client React/TypeScript utilise directement Supabase Auth, la Data API et Realtime. Il ne dépend d’aucun serveur VPS. Seule l’APK Android est distribuée, via GitHub Releases.

## Accès aux données

Les tables `public.app_state` et `public.space_invitations` doivent conserver RLS activé et leurs politiques de propriété, de partage et d’acceptation des invitations. L’inscription reste contrôlée par la liste privée des adresses autorisées.

Pour rétablir les permissions du client sur le schéma existant :

```sql
grant usage on schema public to authenticated;
grant select, insert on public.app_state to authenticated;
grant update (name, payload) on public.app_state to authenticated;
grant select, insert, delete on public.space_invitations to authenticated;
grant update (user_id) on public.space_invitations to authenticated;
```

Les mises à jour sont limitées aux colonnes utiles pour empêcher le changement de propriétaire d’un espace ou le déplacement d’une invitation. Les accès sans connexion ne reçoivent aucun droit sur ces tables. Le trigger de révision et la publication Realtime de `app_state` doivent rester actifs.

L’environnement de compilation reçoit uniquement l’URL Supabase et la clé publique publishable, sous les noms historiques `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Les secrets de signature Android restent dans GitHub Actions. Aucune clé privilégiée Supabase ne doit être intégrée à l’APK.

## Retour depuis la version VPS

La version 0.8.0 reprend le code Supabase de la version 0.5.6 et augmente le code de version Android pour permettre l’installation en mise à jour. Les comptes et données sont ceux de Supabase. Les changements effectués uniquement sur le VPS nécessitent un export puis une migration distincte avant son effacement. Ne pas effacer sa base tant que cette vérification n’est pas terminée.
