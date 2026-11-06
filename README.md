# Speed Festival — site web

Nouveau site du **Speed Festival**, le festival de vitesse depuis 2021 à Saint-Paul-du-Bois (49).

Direction artistique « Grand Prix » : affiche orange, grille de départ, menu façon classement F1, d'après la charte graphique 2026 (Barlow Condensed + Inter ; orange `#FF5500`, vert `#00FF97`, rose `#FC8AFD`).

## Voir le site

- Version de démonstration (GitHub Pages, sans back-office) : https://heytienne.github.io/speed-festival-site/
- En local : le site charge ses contenus depuis `content/`, il faut le servir via un serveur web. Avec PHP installé : `php -S localhost:8766` à la racine, puis http://localhost:8766 (site) et http://localhost:8766/admin/ (back-office).

## Le back-office (`admin/`)

Back-office sur mesure, hébergé avec le site, sans service externe ni base de données : PHP 7.4 ou plus, les contenus restent dans les fichiers `content/*.json`.

| Écran | Ce qu'on y fait |
|---|---|
| Tableau de bord | État du site, chiffres clés, liste « À compléter avant l'annonce », dernières modifications |
| Pages & blocs | Ordre des blocs de l'accueil (glisser-déposer), afficher / masquer, ajouter un bloc texte + image ou un bandeau annonce, textes de chaque section, bandeau & en-tête, pied de page |
| Programmation | Tableau des artistes filtrable par jour ; fiche : photo presse, jour, scène, horaires, présentation, magic link d'écoute, publié ou masqué |
| Billetterie | Lien de vente, pass (prix, couleur, statut, lien d'achat, grande plaque) avec aperçu des plaques en direct |
| Infos pratiques | Cartes « Briefing pilotes » et contenu complet de leurs popups (horaires, rubriques, objets interdits, bouton) |
| Médias | Photos du Replay (envoi direct, taille dans la mosaïque, étiquette) et bibliothèque d'images |
| Partenaires | Logos, liens, e-mail partenariats |
| Réglages | Dates, compte à rebours, pied de page, équipe (comptes), mot de passe, sauvegardes |

Fonctionnement :
- **Brouillon puis publication** : chaque modification est enregistrée automatiquement en brouillon (invisible du public). Le bouton **Aperçu** ouvre le site avec les brouillons ; **Publier** met tout en ligne d'un coup ; **Annuler** revient à la version publiée.
- **Sauvegardes** : une copie des contenus est gardée à chaque publication (les 30 dernières). Réglages → Sauvegardes → « Restaurer en brouillon », puis vérifier et publier.
- Dans les textes, `[[…]]` s'affiche surligné en jaune « à compléter » sur le site.
- Sécurité : comptes avec mot de passe chiffré (10 caractères minimum), blocage 15 min après 5 essais ratés, jeton anti-falsification sur chaque action, liens filtrés, images vérifiées (JPG, PNG, WebP, GIF, 12 Mo max). Les données privées (comptes, brouillons, sauvegardes, journal) sont dans `admin/data/`, interdit d'accès depuis le web.

## Mise en ligne chez OVH

1. **PHP** : dans l'espace client OVH (Hébergements → Informations générales), vérifier que la version PHP est 7.4 ou plus (8.2 / 8.3 recommandé).
2. **HTTPS** : activer le certificat SSL gratuit de l'hébergement si ce n'est pas déjà fait (indispensable pour se connecter de façon sûre).
3. **Envoyer les fichiers par FTP** (FileZilla, identifiants FTP de l'espace client) dans le dossier `www/` : `index.html`, `assets/`, `content/`, `admin/`. Ne pas envoyer `maquettes/`, `README.md`, `.git/`, `.claude/`. ⚠️ Cela remplace le site actuel : garder une copie de l'ancien `www/` avant.
4. **Tout de suite après l'envoi**, ouvrir https://speedfestival.fr/admin/ et créer le compte administrateur : le premier compte se crée librement, il faut donc le faire immédiatement. Les autres membres s'ajoutent ensuite dans Réglages → Équipe.

Ensuite, **les contenus vivent sur le serveur** : ne plus renvoyer `content/` ni `admin/data/` par FTP, sinon les modifications faites dans le back-office seraient écrasées. Pour mettre à jour le code du site plus tard, n'envoyer que `index.html`, `assets/css`, `assets/js` et `admin/` (sans `admin/data/`).

## Structure

| Chemin | Contenu |
|---|---|
| `index.html` | La page d'accueil (une seule page, responsive mobile → grand écran) |
| `content/` | Les contenus du site (modifiés par le back-office) |
| `assets/css/style.css`, `assets/js/main.js` | Styles et script du site (charge les contenus et construit la page ; `?apercu=1` affiche les brouillons) |
| `assets/img/` | Logos, éléments de la charte, photos ; les images envoyées depuis le back-office vont dans `assets/img/uploads/` |
| `admin/` | Back-office : `index.php` (connexion), `api.php` (actions), `lib.php`, `assets/` (interface) ; `data/` est créé sur le serveur |
| `maquettes/` | Sources des maquettes de travail (canevas Claude), dont celles du back-office |

## À compléter

- Dates de l'édition 2027 (le site affiche encore 28/29 août 2026, le compte à rebours est donc à 0).
- Photos presse, présentations et magic links des artistes 2027, prix et liens des pass, infos d'accès et de camping, logos partenaires, e-mail partenariats.

## Crédits

Photos 2025 : Morisseau Steeve Photographie.
