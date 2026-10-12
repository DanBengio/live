# Live — suivi du projet

Dernière mise à jour : 12 octobre 2026, soir.

## En une phrase

Application type Vevox / AhaSlides pour les ateliers de Dan : une page projetée, un QR code, les participants répondent sur leur téléphone. Code dans `C:\Users\HP VICTUS\DEV\live`. Mise en ligne en cours sur https://sondage.baratextile.com (Infomaniak, site Node.js).

## Où on en est

- [x] Application v1 : sondage, nuage de mots, quiz chronométré avec classement, questions du public avec votes.
- [x] Testée sur le PC avec le téléphone de Dan via le Wi-Fi (`demarrer.bat`).
- [x] Dépôt GitHub public : https://github.com/DanBengio/live (branche `main`).
- [x] Site Node.js créé chez Infomaniak : `sondage.baratextile.com` (Node 24, démarrage `npm start`, port 3000, build `npm install --include=dev && npm run build`).
- [ ] **EN COURS** : premier déploiement. Dan a collé le `git clone` dans la console SSH du site et lancé le Build. Reste à vérifier que https://sondage.baratextile.com affiche « Mes présentations ».
- [ ] Test en conditions réelles sur le site en ligne (téléphones en 4G, plusieurs personnes).
- [ ] Suite possible, à décider avec Dan : export des résultats, connexion Google pour l'animateur, intégration PowerPoint.

## Prochaine action

**Dan** : ouvrir https://sondage.baratextile.com après le Build et dire ce qu'il voit (capture si erreur).
**Claude** : corriger si besoin, puis faire un test complet avec Dan sur le site en ligne.

## Comment déployer une mise à jour

1. Sur le PC, Claude commite et pousse : `git push`.
2. Dan, dans le Manager Infomaniak → site `sondage.baratextile.com` → Actions rapides → **Ouvrir la console SSH**, colle :
   ```bash
   cd ~/sites/sondage.baratextile.com && git pull
   ```
3. Dan clique **Build** sur le tableau de bord du site (l'application redémarre toute seule à la fin).

## Décisions prises

- Pas de Firebase ni de service tiers payant : serveur Node maison (`server/index.js`), données dans `server/data/db.json` sur le serveur.
- Hébergement sur l'hébergement Infomaniak existant, dans un site Node.js séparé. **Interdit de toucher au site baratextile.com** (dossier `web` de l'ancien hébergement).
- Dépôt GitHub public : aucun secret dans le code, les données restent sur le serveur.
- Intégration PowerPoint reportée après la mise en ligne.
- Usage personnel ou produit à vendre : pas encore tranché.

## Repères et accès

- Manager Infomaniak : Web & Domaines → baratextile.com → site `sondage.baratextile.com` (Tableau de bord, Consoles, Avancé).
- Console SSH du site : utilisateur `client`, dossier `/srv/customer/sites/sondage.baratextile.com`, serveur interne non joignable depuis l'extérieur (d'où le passage par GitHub).
- Ancien hébergement (site baratextile.com) : utilisateur SSH `uid133012`, dossier `web` = site existant, **ne pas toucher**.
- Clé SSH générée sur le PC : `~/.ssh/live_infomaniak` (pas utile pour l'instant).
- GitHub : compte `DanBengio`, double authentification active.

## Commandes utiles sur le PC

- `demarrer.bat` : test avec des téléphones sur le Wi-Fi local.
- `npm run dev` : développement (site sur http://localhost:5173).
- `npm run build` : vérification avant mise en ligne.
- `npm run release` : variante PHP (en réserve, jamais testée).

## Journal

- **12 octobre 2026** : création de l'application, tests locaux avec le téléphone de Dan, abandon de Firebase, choix Infomaniak, création du site Node.js, dépôt GitHub, premier build lancé.
