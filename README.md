# Speed Festival — site web

Nouveau site du **Speed Festival**, le festival de vitesse depuis 2021 à Saint-Paul-du-Bois (49).

Direction artistique « Grand Prix » : affiche orange, grille de départ, menu façon classement F1, d'après la charte graphique 2026 (Barlow Condensed + Inter ; orange `#FF5500`, vert `#00FF97`, rose `#FC8AFD`).

## Voir le site

- En ligne (GitHub Pages) : https://heytienne.github.io/speed-festival-site/
- En local : ouvrir `index.html` dans un navigateur.

## Structure

| Chemin | Contenu |
|---|---|
| `index.html` | La page d'accueil (une seule page, responsive mobile → grand écran) |
| `assets/css/style.css` | Styles |
| `assets/js/main.js` | Grille de départ 2027, compte à rebours, galerie Replay + visionneuse, menu mobile |
| `assets/img/` | Logos, éléments de la charte et photos utilisées par le site |
| `maquettes/` | Sources des maquettes de travail (canevas Claude), éléments extraits de la charte et sélection de photos 2025 |

## Mettre à jour le contenu

- **Line-up** : listes `VEN` et `SAM` en haut de `assets/js/main.js` (nom, scène, horaires). Couleurs : orange = Speed Arena, vert = Boiler Vroom.
- **Date du compte à rebours** : constante `DEPART` dans `assets/js/main.js` (0 = ouverture du vendredi à 18h).
- **Photos du Replay** : liste `PHOTOS` dans `assets/js/main.js`.

## À compléter

- Dates de l'édition 2027 (le site affiche encore 28/29 août 2026).
- Photos presse des artistes 2027, prix des pass, logos partenaires, adresse e-mail partenariats.

## Crédits

Photos 2025 : Morisseau Steeve Photographie.
