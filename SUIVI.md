# Live — suivi du projet

Dernière mise à jour : 12 octobre 2026, soir.

## En une phrase

Application type Vevox / AhaSlides pour les ateliers de Dan : une page projetée, un QR code, les participants répondent sur leur téléphone. Code dans `C:\Users\HP VICTUS\DEV\live`. Mise en ligne en cours sur https://sondage.baratextile.com (Infomaniak, site Node.js).

## Où on en est

- [x] Application v1 : sondage, nuage de mots, quiz chronométré avec classement, questions du public avec votes.
- [x] Testée sur le PC avec le téléphone de Dan via le Wi-Fi (`demarrer.bat`).
- [x] Dépôt GitHub public : https://github.com/DanBengio/live (branche `main`).
- [x] Site Node.js créé chez Infomaniak : `sondage.baratextile.com` (Node 24, démarrage `npm start`, port 3000, build `npm install --include=dev && npm run build`).
- [x] Premier déploiement : https://sondage.baratextile.com en ligne (vérifié le 12/10 au soir). Réglage clé : commande d'exécution = `npm start` dans les paramètres avancés.
- [ ] **EN COURS** : test en conditions réelles sur le site en ligne (téléphones en 4G, plusieurs personnes).
- [x] Module PowerPoint Live en ligne et installé sur le PC de Dan (12/10). Testé en vrai dans PowerPoint : en diaporama, la salle passe à la question 5 à 10 secondes après l'arrivée de la diapo.
- [x] Deck « Recharge tes 3 batteries - ICF & Edvantis - LIVE.pptx » (Téléchargements, 51 diapos) : 17 questions Live, code fixe 434294. Le module couvre les diapos 2, 7, 9, 14, 17, 22, 25, 29, 33 d'origine ; 9 diapos Live ajoutées (accueil, checks, coup de barre, recharge, P/E/M, énergie avant/après la pause active, choix de l'expérience). Checks P/E/M notés de 1 à 10 et phrases libres (diapos 37, 41) restent dans le chat. Script : `scripts/deck-live.cjs`.
- [ ] Suite possible, à décider avec Dan : export des résultats, connexion Google pour l'animateur, vrai module PowerPoint (option C, seulement si l'outil devient un produit).

## Prochaine action

**Dan** : ouvrir le lien « adopter » envoyé par Claude (range la présentation dans « Mes présentations »), relire le fichier « Recharge tes 3 batteries - ICF & Edvantis - LIVE.pptx » (Téléchargements), et avant l'atelier cliquer « Nouvel atelier : remettre à zéro » sur la page PowerPoint de la présentation.
**Dan** : envoyer à son associé (atelier sur Mac le 13/10) le fichier LIVE.pptx et le guide « Live sur Mac - pour mon associé.txt » (Téléchargements), puis rapporter si les modules s'ouvrent sur Mac.
**Claude** : ajuster les questions si Dan le demande.
**Claude** : corriger si besoin, puis faire un test complet avec Dan sur le site en ligne.

## Comment déployer une mise à jour

1. Sur le PC, Claude commite et pousse : `git push`.
2. Dan, dans le Manager Infomaniak → site `sondage.baratextile.com` → Actions rapides → **Ouvrir la console SSH**, colle :
   ```bash
   cd ~/sites/sondage.baratextile.com && git pull
   ```
3. Dan clique **Build** sur le tableau de bord du site, puis **Run** (indispensable quand le serveur a changé).

## Décisions prises

- Pas de Firebase ni de service tiers payant : serveur Node maison (`server/index.js`), données dans `server/data/db.json` sur le serveur.
- Hébergement sur l'hébergement Infomaniak existant, dans un site Node.js séparé. **Interdit de toucher au site baratextile.com** (dossier `web` de l'ancien hébergement).
- Dépôt GitHub public : aucun secret dans le code, les données restent sur le serveur.
- PowerPoint : option B choisie le 12/10. Module gratuit Microsoft « Web Viewer » dans chaque diapo. Chaque présentation a un **code fixe** à 6 chiffres. Une adresse par diapo : `/ppt/<code>/<accueil | id de l'activité | fin>?k=<clé>`. Afficher la diapo fait passer les téléphones à l'activité. Les adresses suivent l'activité même si on change l'ordre. La page « PowerPoint » du site (bouton sur chaque présentation) donne les adresses à copier et le bouton « Nouvel atelier : remettre à zéro ». La salle repart aussi vide d'elle-même 12 h après le début de l'atelier précédent.
- 12/10 : option A retenue (Dan sur PowerPoint Windows). Module « Live » maison : complément de contenu Office, manifeste `public/addin/manifest.xml` (Id 84c365e6-a511-440e-8849-ace119baf7eb), installé par `installer-module-live.bat` (clé de registre HKCU WEFDeveloper). Chaque module garde dans le fichier l'adresse de sa diapo Live et l'identifiant de sa diapo PowerPoint ; en diaporama, la salle passe à l'activité quand sa diapo est à l'écran. Pour une amie : même installateur, puis ses propres présentations sur le site.
- Mac : installation du module en copiant le manifeste dans `~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/` (commande Terminal sur la page PowerPoint du site). Non testé : les modules posés sous Windows (référence « developer / Registry ») pourraient devoir être reposés sur Mac ; le guide contient les 18 adresses de secours.
- Lien `/adopter/<id>?k=<clé>` : range dans « Mes présentations » une présentation créée par Claude.
- ⚠️ 12/10 : Web Viewer a été retiré par Microsoft en décembre 2024, il ne fonctionne plus. Il faut soit notre propre module PowerPoint (recommandé, que Claude pourrait insérer directement dans le fichier), soit SparkEmbed (payant, environ 6 $). Les adresses `/ppt/...` restent valables dans les deux cas.
- À vérifier en vrai : si PowerPoint précharge la diapo suivante, la salle pourrait changer d'activité trop tôt. Un bouton « Afficher cette activité » permet de corriger à la main.
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

- **12 octobre 2026** : création de l'application, tests locaux avec le téléphone de Dan, abandon de Firebase, choix Infomaniak, création du site Node.js, dépôt GitHub, premier build lancé. Le soir : le site répond encore avec la page de maintenance Infomaniak, l'application n'est pas démarrée ; Build réussi, application arrêtée : Dan a cliqué Run, l'application s'arrête toute seule : `npm start` lancé en SSH fonctionne : le site répond bien (vérifié). Le problème vient du réglage de Run chez Infomaniak : Run relance la compilation au lieu de `npm start` (commande d'exécution à corriger). Corrigé par Dan : le site est en ligne.
- **12 octobre 2026, nuit** : site en ligne et stable. Intégration PowerPoint (option B) codée et testée en local : code fixe, adresses par diapo, page « PowerPoint ».
- **12 octobre 2026, nuit (suite)** : Dan envoie le deck « Recharge tes 3 batteries - ICF & Edvantis » (42 diapos) pour le relier à Live. On découvre que Web Viewer n'existe plus. Une liste de questions est proposée, en attente de validation.
- **12 octobre 2026, nuit (fin)** : module PowerPoint Live codé, testé hors PowerPoint, poussé. Reste à le tester dans PowerPoint après mise en ligne.
- **12 octobre 2026, nuit (fin bis)** : module testé dans PowerPoint, deck ICF & Edvantis livré avec le module posé. Dan a déjà répondu depuis son téléphone pendant les tests : remettre à zéro avant l'atelier.
- **12 octobre 2026, nuit** : l'associé de Dan anime sur Mac le 13/10. Guide d'installation Mac et adresses de secours préparés.
