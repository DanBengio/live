# Live — suivi du projet

Dernière mise à jour : 12 octobre 2026, nuit (Dan est parti dormir).

## En une phrase

Application type Vevox / AhaSlides pour les ateliers de Dan : une page projetée, un QR code, les participants répondent sur leur téléphone. Code dans `C:\Users\HP VICTUS\DEV\live`. En ligne sur https://sondage.baratextile.com (Infomaniak, site Node.js), avec un module PowerPoint maison qui affiche les questions dans les diapos.

## Où on en est

- [x] Application v1 : sondage, nuage de mots, quiz chronométré avec classement, questions du public avec votes.
- [x] Testée sur le PC avec le téléphone de Dan via le Wi-Fi (`demarrer.bat`).
- [x] Dépôt GitHub public : https://github.com/DanBengio/live (branche `main`).
- [x] Site Node.js créé chez Infomaniak : `sondage.baratextile.com` (Node 24, démarrage `npm start`, port 3000, build `npm install --include=dev && npm run build`).
- [x] Premier déploiement : https://sondage.baratextile.com en ligne (vérifié le 12/10 au soir). Réglage clé : commande d'exécution = `npm start` dans les paramètres avancés.
- [ ] **EN COURS** : test en conditions réelles sur le site en ligne (téléphones en 4G, plusieurs personnes).
- [x] Module PowerPoint Live en ligne et installé sur le PC de Dan (12/10). Testé en vrai dans PowerPoint : en diaporama, la salle passe à la question 5 à 10 secondes après l'arrivée de la diapo.
- [x] Deck « Recharge tes 3 batteries - ICF & Edvantis - LIVE.pptx » (Téléchargements, 51 diapos) : 17 questions Live, code fixe 434294. Le module couvre les diapos 2, 7, 9, 14, 17, 22, 25, 29, 33 d'origine ; 9 diapos Live ajoutées (accueil, checks, coup de barre, recharge, P/E/M, énergie avant/après la pause active, choix de l'expérience). Checks P/E/M notés de 1 à 10 et phrases libres (diapos 37, 41) restent dans le chat. Script : `scripts/deck-live.cjs`.
- [x] Salle 2 (13/10) pour deux conférences en parallèle : « Recharge tes 3 batteries · ICF & Edvantis · Salle 2 », code fixe 989539, mêmes 17 questions. Fichiers dans Téléchargements : « ... - LIVE salle 2.pptx » et « Live sur Mac - salle 2.txt ». Vérifié dans PowerPoint. Les deux salles sont indépendantes : réponses et remise à zéro séparées.
- [x] Page PowerPoint du site (13/10) : déposer son .pptx (gardé sur le serveur dans `server/data/decks/`), choisir pour chaque question « Remplace la diapo n » ou « Après la diapo n », puis télécharger le fichier complet avec les modules posés (généré dans le navigateur, `src/lib/pptx.ts`). Sans fichier : téléchargement des seules diapos Live. Bouton « Dupliquer » sur l'accueil : mêmes questions, fichier et emplacements, nouveau code. Testé en local avec le deck ICF : résultat identique au fichier fait à la main, s'ouvre dans PowerPoint.
- [x] Liens coach (13/10) : `/coach/<id>?k=<clé coach>`, sans compte. Le coach clique « Nouvelle conférence » (nouveau code, nouvelle clé de diapos, salle vide ; l'ancien code est archivé avec ses résultats et ne pilote plus rien), puis « Télécharger ma présentation » (fichier complet). Créé depuis la page PowerPoint de l'animateur (« Lien pour le coach »). Le lien « adopter » accepte aussi la clé coach. Testé en local.
- [x] 13/10 : présentations coachs ICF créées en ligne (Mona, Sakina, Bahaâ), chacune avec le PowerPoint ICF et ses 18 emplacements ; page coach de Mona testée en ligne (téléchargement OK). Liens « adopter » donnés à Dan pour les voir dans « Mes présentations ».
- [x] 14/10 : chez Bahaâ, le module est installé mais les diapos Live restent vides (ancienne version de PowerPoint, moteur Internet Explorer : l'application ne démarre pas). Ajouts : page coach → « Présentation sans module » (fichier d'origine) + « Présenter depuis le navigateur » (`/coach/<id>/presenter?k=`, pilotage au clavier avec la clé coach) ; dans le module, message d'explication au lieu d'un écran vide (script ES5 dans `index.html`). Version exacte d'Office de Bahaâ pas encore connue (Fichier → Compte).
- [x] 14/10 : module compatible anciens PowerPoint (moteur Internet Explorer 11 / Edge ancien). `index.html` détecte le vieux moteur sur `/addin` et bascule vers `public/addin/legacy.html` (ES5 écrit à la main : accueil + QR code servi par le serveur `/api/qr.svg`, barres, nuage de mots en liste, questions du public, la salle suit les diapos). Testé dans le vrai moteur IE11 de Windows avec `scripts/test-moteur-ie.ps1` (mode document 11) : rendu correct. **Mis en ligne et confirmé par Dan le 14/10 : fonctionne chez Bahaâ.** Le quiz s'y affiche mais son chrono ne se pilote pas depuis la diapo.
- [ ] Suite possible, à décider avec Dan : export des résultats, connexion Google pour l'animateur, vrai module PowerPoint (option C, seulement si l'outil devient un produit).

## Prochaine action


**Dan** : envoyer à Mona, Sakina et Bahaâ leur lien coach (donnés dans la conversation du 13/10, jamais dans ce fichier public). Chacune : installer le module une fois, puis avant chaque conférence « Nouvelle conférence » → « Télécharger ma présentation ».

**Demain matin, 13 octobre — Dan, dans l'ordre :**
1. Ouvrir le lien « adopter » (dans la conversation du 12/10) s'il ne l'a pas encore fait : il range « Recharge tes 3 batteries · ICF & Edvantis » dans « Mes présentations ».
2. Sur la page PowerPoint de cette présentation, cliquer **« Nouvel atelier : remettre à zéro »** (les réponses de test du 12/10 sont encore dans la salle).
3. Envoyer à son associé, qui anime sur **Mac** le 13/10 : le fichier « Recharge tes 3 batteries - ICF & Edvantis - LIVE.pptx » et le guide « Live sur Mac - pour mon associé.txt » (tous deux dans Téléchargements). L'associé installe le module et vérifie la diapo 3 **avant** l'atelier.
4. Rapporter à Claude si les modules s'ouvrent sur Mac, et comment s'est passé l'atelier.

**Plan B si le Mac bloque** : sans PowerPoint, ouvrir dans le navigateur les adresses de la fin du guide Mac, une par question (chaque adresse ouverte fait passer la salle à sa question). Le bouton Lancer du site ne marche que dans le navigateur de Dan, propriétaire de la présentation.

**Claude** : selon le retour du Mac, corriger le module ou la procédure ; ajuster les questions si Dan le demande.

**Non urgent** : la ligne d'installation Mac a été ajoutée à la page PowerPoint du site, mais pas encore mise en ligne (git pull + Build + Run au prochain déploiement).

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
- Capacité : test de charge le 13/10 sur le site en ligne, 105 téléphones simulés pendant 1 minute (~100 requêtes/s) : 0 erreur, réponse en 46 ms (médiane), 160 ms au pire, 105 réponses reçues. Le vrai risque est le Wi-Fi de la salle, pas le serveur.
- Changer sa réponse : sondage et nuage de mots oui (tant que l'activité est à l'écran), quiz non.
- Mac : **testé le 13/10 par l'associée de Dan, le module fonctionne** (modules posés sous Windows reconnus). Installation du module en copiant le manifeste dans `~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/` (commande Terminal sur la page PowerPoint du site). Non testé : les modules posés sous Windows (référence « developer / Registry ») pourraient devoir être reposés sur Mac ; le guide contient les 18 adresses de secours.
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
- **13 octobre 2026** : le module marche sur le Mac de l'associée. Le texte débordait de la diapo : correctif d'échelle 16:9 et barres compactes, poussé, à déployer hors atelier.
- **13 octobre 2026** : correctif 16:9 mis en ligne par Dan. Ajout de « Modifier ma réponse » (sondage, nuage de mots), testé en local, poussé, à déployer.
- **13 octobre 2026** : « Modifier ma réponse » en ligne (vérifié). Test de charge à 105 participants réussi.
- **13 octobre 2026, fin d'après-midi** : création de la salle 2 (code 989539) pour une conférence en parallèle, deck et guide Mac générés. Dan doit ouvrir le lien « adopter » de la salle 2.
- **13 octobre 2026, soir** : Dan veut télécharger toute sa présentation depuis le site, sans pose manuelle. Fait : dépôt du .pptx, emplacements, téléchargement complet, Dupliquer. Poussé, à déployer.
- **13 octobre 2026, soir** : conférence ICF avec 3 coachs (Mona, Sakina, Bahaâ), 3 conférences chacune. Ajout des liens coach avec nouveau code par conférence. Poussé, à déployer.
- **13 octobre 2026, soir** : liens coach en ligne, 3 présentations coachs créées et vérifiées.
- **14 octobre 2026** : PowerPoint trop ancien chez Bahaâ. Mode navigateur ajouté aux pages coach, testé en local, poussé, à déployer.
- **14 octobre 2026** : option A choisie pour Bahaâ : version du module pour anciens PowerPoint, testée dans le moteur IE11, poussée, à déployer.
- **14 octobre 2026** : version anciens PowerPoint en ligne, fonctionne chez Bahaâ (QR code compris). Mona et Sakina inchangées.
