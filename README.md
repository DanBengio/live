# Live — interactions en atelier (type Vevox / AhaSlides)

Une page projetée, un QR code, les participants répondent sur leur téléphone, les résultats s'affichent en direct.

Activités : **sondage**, **nuage de mots**, **quiz chronométré avec classement**, **questions du public avec votes**.

## Tester avec de vrais téléphones, sans rien héberger

1. Double-cliquer sur `demarrer.bat` (la première fois, il installe et construit : 1 à 2 minutes).
   Si Windows demande d'autoriser Node.js sur le réseau, accepter (réseaux privés).
2. Le navigateur s'ouvre sur http://localhost:3000 : créer une présentation, la lancer.
3. Les participants, **sur le même Wi-Fi**, scannent le QR code ou tapent l'adresse affichée (du type `192.168.x.x:3000`).

Raccourcis animateur : `espace` = action principale (démarrer, lancer le chrono, résultats, suivant), `←` `→` = navigation.
« Écran seul ↗ » ouvre la vue projecteur sans la barre de contrôle, à glisser sur le second écran.

Pour développer : `npm run dev` (API Node sur 3001 + site sur 5173, rechargement à chaud).

## Mettre en ligne chez Infomaniak (hébergement web PHP) : sondage.baratextile.com

Le serveur de production est `php/api/index.php` : un seul fichier PHP, base SQLite créée toute seule, rien à configurer.
Les téléphones lisent des fichiers JSON statiques (`data/s/<code>/…`) qu'Apache sert sans PHP, donc 300 participants restent légers.

1. Dans le Manager Infomaniak : créer le site `sondage.baratextile.com` sur l'hébergement, PHP 8.1 ou plus, certificat SSL activé (HTTPS).
2. Sur ce PC :
   ```bash
   npm run release
   ```
   Le dossier `release/` contient tout (site construit + API PHP + `.htaccess`).
3. Déposer le **contenu** de `release/` à la racine du site, par SSH :
   ```bash
   scp -r release/* release/.htaccess UTILISATEUR@HOTE_SSH:sites/sondage.baratextile.com/
   ```
   (ou par FTP, en n'oubliant pas le fichier caché `.htaccess`).
4. Ouvrir https://sondage.baratextile.com : la page « Mes présentations » s'affiche. Les dossiers `data/` et `api/data/` se remplissent tout seuls.

Mise à jour : refaire les étapes 2 et 3. Les données (présentations, sessions) sont dans `api/data/live.sqlite` sur le serveur, elles ne sont pas écrasées.

Pour que les déploiements se fassent sans mot de passe, ajouter une clé SSH publique dans le Manager (Hébergement → Comptes FTP/SSH → clés SSH).

### Autres hébergements

- **Serveur Node (VPS, Serveur Cloud)** : `npm install --omit=dev && npm run build && PUBLIC_URL=https://… node server/index.js`, derrière un reverse proxy HTTPS, maintenu par `pm2`.
- **Firebase** : `src/backend/firebase.ts` et `firestore.rules` sont prêts, voir `.env.example`.

## Comment ça marche

- `src/pages/Editor.tsx` : préparation d'une présentation (liste d'activités).
- `src/pages/Host.tsx` : écran animateur = grand écran + barre de contrôle. `src/pages/Screen.tsx` : même écran sans contrôles.
- `src/pages/Join.tsx` puis `src/pages/Participant.tsx` : côté téléphone.
- `src/backend/` : une interface, trois implémentations. `http.ts` (serveurs Node et PHP, même API), `local.ts` (démo dans un seul navigateur, `VITE_BACKEND=local`), `firebase.ts`.
- `server/index.js` (Node, pour le PC et les VPS) et `php/api/index.php` (hébergement mutualisé) exposent exactement la même API.
- Les téléphones interrogent le serveur toutes les 1 à 1,5 secondes ; il répond « rien de nouveau » (304) tant que rien ne change.
- Sécurité : chaque navigateur a un identifiant aléatoire. Seul l'animateur modifie sa session ; un participant ne peut envoyer qu'une réponse par question et ne peut pas toucher aux scores.

Barème quiz : 1000 points pour une bonne réponse immédiate, 500 en fin de chrono, 0 si faux. Le temps de réponse est mesuré sur le téléphone, donc indépendant des horloges.

## Limites de cette version

- Pas d'intégration PowerPoint (le plug-in Office est un projet à part). Contournement : « Écran seul » sur le second écran, `Alt+Tab` depuis PowerPoint.
- L'animateur est reconnu par son navigateur : vider les données du navigateur fait perdre l'accès à ses présentations (elles restent sur le serveur).
- Pas d'export des résultats (CSV/PDF).
