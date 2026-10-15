# Live — suivi du projet

Dernière mise à jour : 15 octobre 2026.

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
- [x] 14/10 : la présentation de Bahaâ gelait parfois. Cause probable : ses ~18 modules tournent en même temps dans le vieux moteur, chacun interrogeant le site et PowerPoint chaque seconde et redessinant tout (QR code compris). Correctif dans `legacy.js` : seule la diapo à l'écran travaille (les autres en veille, 6 s), redessin seulement si le contenu change, QR code jamais redessiné, appels à PowerPoint espacés (1 s). Vérifié dans le moteur IE11 : 0 redessin en 8 s sans changement, nouveaux participants bien affichés. Fichier contrôlé en ES5 strict (acorn).
- [x] 14/10 : une seconde de décalage au changement de diapo (l'activité précédente restait visible), chez Mona comme chez Bahaâ. Cause : chaque diapo affichait l'activité en cours de la salle, pas la sienne, en attendant que la salle suive. Correctif dans les deux versions du module (`showSlide` dans `Host.tsx`, `slideView` dans `legacy.js`) : la diapo affiche tout de suite sa propre activité et ses réponses ; le bouton de secours « Afficher cette activité » n'apparaît dans PowerPoint qu'après 5 s sans synchronisation. Vérifié : la page affiche la bonne activité dès la première image ; version ancienne revérifiée dans le moteur IE11.
- [x] 14/10 : l'adresse du site n'apparaît plus à l'écran tant qu'elle contient « baratextile » (`visibleJoinHost` dans `src/lib/origin.ts`, `shownHost` dans `legacy.js`) : accueil « Scannez le QR code » + code, badge « Code ». Elle réapparaîtra seule avec un domaine propre (régler alors PUBLIC_URL sur le serveur). Reste visible en petit dans la barre d'adresse des téléphones.
- [x] 14/10 : chez Bahaâ, impossible de passer à la diapo suivante après une diapo Live (le module garde clavier et souris en diaporama). Correctif dans les deux versions : le module renvoie à PowerPoint → ↓ Page suiv. espace Entrée N (suivante), ← ↑ Page préc. retour arrière P (précédente) et le clic (suivante) via `goToByIdAsync(Office.Index.Next/Previous)`. **En ligne le 14/10 au soir.** Testé par Claude sur PowerPoint récent (PC de Dan) : clic et flèches font avancer et reculer, y compris d'une diapo Live à une autre. Reste à confirmer chez Bahaâ (ancien PowerPoint).
- [x] 14/10 : chez Mona (Mac), le module affichait « version de PowerPoint trop ancienne ». Cause probable : PowerPoint Mac a rouvert l'ancienne page du module gardée en mémoire, qui cherchait des fichiers supprimés par la mise en ligne (et le serveur renvoyait la page d'accueil à la place). Correctifs : `emptyOutDir: false` (les anciens fichiers restent), pages HTML en `no-store`, fichier manquant = 404, et dans `index.html` un filet de sécurité qui recharge une fois au bout de 12 s puis affiche un message juste (plus « version trop ancienne »). Testé en local : démarrage normal sans rechargement, échec simulé → rechargement puis message. **En ligne le 14/10 au soir** (vérifié : no-store, 404 sur fichier manquant).
- [x] 14/10 : synthèse Excel des 3 premières conférences ICF (Dan 13/10, Bahaâ et Mona 14/10) : « Live - synthèse conférences ICF.xlsx » rangé dans Google Drive : Mon Drive → ICF → EDVANTIS (attention : le nom local du dossier « Mon Drive » contient une espace insécable). Onglets Synthèse, Résultats (par question et par conférence), Mots, Participants. 368 formules, 0 erreur (recalcul Excel via COM). Pour la mettre à jour : `node scripts/conferences-data.cjs data.json "Nom=code" …` puis `py -3.14 scripts/synthese-excel.py data.json sortie.xlsx`. Archive de la conférence de Dan : `434294~1791885133900`.
- [x] 14/10 : sauvegarde avant séparation : tag et branche GitHub `sauvegarde-2026-10-14` / `sauvegarde-avant-icf`, copie locale dans `sauvegardes/2026-10-14` (code, PowerPoint, clés privées ; dossier hors dépôt).
- [x] 14/10 : un code, plusieurs sites. `<données>/instance.json` (publicUrl, addinId, addinName, adminKey), `--data`, manifeste et installateurs générés par le serveur, PowerPoint téléchargé avec le module du site, export/import de présentations. Testé en local avec deux sites. Sur le site de Dan, sans instance.json, tout reste identique (même module).
- [x] 14/10 : option A, un seul module PowerPoint pour tous les sites : le module lit l'adresse de la diapo et parle au site correspondant (`setApiBase` dans `src/backend/http.ts`, `BASE` dans `legacy.js`), le serveur accepte ces appels entre sites (CORS sur /api, sans cookies). Testé en local, deux sites : page du module servie par le site de Dan, diapo et salle du site ICF, dans Chrome et dans le moteur IE11 (affichage, QR code, et la salle suit la diapo).
- [x] 14/10 : espaces sur un seul serveur (`createSpace` dans `server/index.js`) : l'adresse appelée choisit l'espace, chacun avec ses données (`<données>/espaces/<nom>/`). Testé en local : données séparées, déménagement des 3 coachs vers l'espace ICF, diapo ICF affichée par le module servi depuis l'adresse principale, page coach sur l'adresse ICF, espace principal inchangé.
- [ ] Nom et domaine de l'application à choisir (libres le 14/10 en .com et .fr : sallevive, echosalle, levelamain, levemain, vivasalle, voxsalle, agorasalle, ondesalle, mainhaute, sallium).
- [ ] Suite possible, à décider avec Dan : export des résultats, connexion Google pour l'animateur, vrai module PowerPoint (option C, seulement si l'outil devient un produit).

## Prochaine action

**Espace ICF (décidé le 14/10 : un seul site Node.js chez Infomaniak — l'offre n'en permet qu'un —, deux espaces aux données séparées)** — dans l'ordre :
1. ✅ 15/10 : sous-domaine **edvantis.coachingfederation.ma** créé par le webmaster d'ICF (DNS chez Hostinger, CNAME vers sondage.baratextile.com).
2. ✅ 15/10 : ajouté comme alias du site Infomaniak (sans www ni mise à jour DNS), certificat Let's Encrypt mis à jour (⋮ → « Mettre à jour le certificat ») : https fonctionne.
3. Dan met à jour le site (git pull, Build, Run), puis colle dans la console SSH la commande de Claude qui crée `server/data/espaces/icf/instance.json` (hosts = sous-domaine, publicUrl = https://sous-domaine, adminKey préparée dans `sauvegardes/2026-10-14/prive/instance-icf.json`), puis Run.
4. ✅ 15/10 : espace ICF créé (server/data/espaces/icf) et 3 présentations coachs déménagées vers l'espace ICF, résultats compris (Mona 3 salles / 61 participants / 514 réponses, Bahaâ 4 salles / 48 / 393, Sakina vide). Liens coach (même clé, adresse edvantis) donnés à Dan dans la conversation, dans `sauvegardes/2026-10-14/prive/migration-icf-resultat.txt`. Copie de Mona sur sondage.baratextile.com supprimée par Dan le 15/10 (vérifié). Commande utilisée : avec `scripts/demenager-presentation.cjs <site> https://<sous-domaine> <adminKey> liste.json --supprimer`, hors conférence, et donne les nouveaux liens coach.
5. Chaque coach : rien à installer (même module Live), juste télécharger sa présentation depuis sa nouvelle page coach.

**Dan (sauvegarde)** : console SSH du site actuel : `cd ~/sites/sondage.baratextile.com && tar czf ~/sauvegarde-live-2026-10-14.tar.gz server/data`.

**Bahaâ** : fermer et rouvrir PowerPoint, puis diaporama complet en passant les diapos Live au clavier et à la souris ; rapporter à Dan.


**Dan** : choisir un nom pour l'application (propositions du 14/10 dans la conversation : Salle Vive, Écho Salle, Lève la main…), puis acheter le domaine chez Infomaniak.


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

- « Mes présentations » (espace animateur) : https://sondage.baratextile.com/presentations (depuis le 15/10 ; l'adresse seule mène à la saisie du code).

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
- **14 octobre 2026** : blocages chez Bahaâ, correctif d'allègement de la version anciens PowerPoint, poussé, à déployer.
- **14 octobre 2026** : correctif du décalage au changement de diapo, poussé avec le correctif des blocages, à déployer.
- **14 octobre 2026** : adresse retirée de l'écran projeté, propositions de noms d'application.
- **14 octobre 2026** : correctif de navigation dans le diaporama (diapo suivante depuis une diapo Live), poussé, à déployer puis tester.
- **14 octobre 2026** : correctif du chargement du module sur Mac (mémoire de l'ancienne page), poussé, à déployer.
- **14 octobre 2026** : Mona (Mac) débloquée en direct en vidant le cache de PowerPoint Mac (`~/Library/Containers/com.microsoft.Powerpoint/Data/Library/Caches` et `.../Application Support/Microsoft/Office/16.0/Wef`) : confirme la cause (page du module périmée). Mise en ligne des correctifs reportée après les conférences en cours (Bahaâ animait).
- **14 octobre 2026, soir** : correctifs navigation + cache en ligne. Navigation testée sur le PowerPoint de Dan (OK). Note : rouvrir le deck de la salle 1 a archivé la session du 13/10 (règle des 12 h) ; ses résultats restent conservés sous l'ancien code archivé.
- **14 octobre 2026, soir** : les archives de salle s'affichaient vides (la fiche archivée gardait l'ancien code, les lectures partaient vers la nouvelle salle). Données intactes. Correctif : lectures par le code demandé + la fiche archivée prend son nom d'archive. Testé en local, poussé, à déployer.
- **14 octobre 2026, soir** : lecture des archives en ligne (vérifié : 44 participants retrouvés). Synthèse Excel des 3 conférences livrée.
- **14 octobre 2026, nuit** : décision de faire un site ICF séparé (même code). Sauvegarde complète, puis réglages par site et déménagement codés et testés en local. Le sous-domaine ICF arrive le 15/10.
- **14 octobre 2026, nuit** : option A retenue (les coachs gardent le module Live). Module multi-sites codé et testé en local.
- **14 octobre 2026, nuit** : l'offre Infomaniak ne permet qu'un site Node.js : option B, un seul site avec deux espaces aux données séparées. Codé et testé en local.
- **15 octobre 2026** : edvantis.coachingfederation.ma en place (DNS + alias + https). Reste : mise à jour du site + création de l'espace ICF (SSH), puis déménagement des coachs.
- **15 octobre 2026** : espace ICF en ligne sur edvantis.coachingfederation.ma, 3 coachs déménagés. Les anciens fichiers PowerPoint des coachs ne marchent plus : chacune retélécharge depuis son nouveau lien.
- **15 octobre 2026** : accueil réservé aux participants (saisie du code), espace animateur sur /presentations. Poussé, à déployer.
- **15 octobre 2026** : accueil participants en ligne, confirmé par Dan (« tout fonctionne »).
