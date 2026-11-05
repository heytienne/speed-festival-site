# Speed Festival — site web

Nouveau site du **Speed Festival**, le festival de vitesse depuis 2021 à Saint-Paul-du-Bois (49).

Direction artistique « Grand Prix » : affiche orange, grille de départ, menu façon classement F1, d'après la charte graphique 2026 (Barlow Condensed + Inter ; orange `#FF5500`, vert `#00FF97`, rose `#FC8AFD`).

## Voir le site

- En ligne (GitHub Pages) : https://heytienne.github.io/speed-festival-site/
- En local : le site charge ses contenus depuis `content/`, il faut donc le servir via un petit serveur web (ouvrir `index.html` directement ne suffit pas).

## Modifier les contenus : le back-office

Les contenus se modifient sans toucher au code, avec **Pages CMS** :

1. Aller sur https://app.pagescms.org et se connecter avec son compte GitHub.
2. Installer l'application Pages CMS sur le dépôt `speed-festival-site` (une seule fois).
3. Ouvrir le dépôt : les rubriques du back-office apparaissent à gauche.
4. Modifier, puis **Enregistrer** : la modification part sur GitHub et le site se met à jour en 1 à 2 minutes.

| Rubrique | Ce qu'on y fait | Fichier |
|---|---|---|
| Pages & blocs | Ordre des blocs de l'accueil, afficher / masquer, ajouter un bloc texte ou un bandeau annonce, textes du bloc bénévoles | `content/accueil.json` |
| Programmation | Artistes : jour, scène, horaires, photo presse, présentation, magic link d'écoute, publié ou non | `content/programmation.json` |
| Billetterie | Lien de billetterie, pass (prix, couleur, statut en vente / bientôt / complet, lien d'achat) | `content/billetterie.json` |
| Infos pratiques | Cartes « Briefing pilotes » et contenu de leurs popups | `content/infos.json` |
| Médias (replay) | Photos de la mosaïque Replay | `content/replay.json` |
| Partenaires | Logos, liens, e-mail partenariats | `content/partenaires.json` |
| Réglages | Dates, lieu, accroche, date du compte à rebours, liens du pied de page | `content/general.json` |

Astuces :
- Dans les textes, `[[…]]` s'affiche surligné en jaune (« à compléter »).
- Les artistes sont triés automatiquement par heure de passage (format `23h30`).
- Un prix vide affiche « BIENTÔT ».
- Pour inviter un autre membre de l'équipe : l'ajouter comme collaborateur du dépôt GitHub (ou l'inviter depuis Pages CMS).

La configuration du back-office est dans `.pages.yml`.

## Structure

| Chemin | Contenu |
|---|---|
| `index.html` | La page d'accueil (une seule page, responsive mobile → grand écran) |
| `content/` | Les contenus du site (modifiés par le back-office) |
| `assets/css/style.css` | Styles |
| `assets/js/main.js` | Charge les contenus et construit la page : line-up et fiches artistes, billetterie, popups infos, replay + visionneuse, compte à rebours, ordre des blocs |
| `assets/img/` | Logos, éléments de la charte, photos (les images envoyées depuis le back-office arrivent ici) |
| `maquettes/` | Sources des maquettes de travail (canevas Claude), dont celles du back-office |

## À compléter

- Dates de l'édition 2027 (le site affiche encore 28/29 août 2026, le compte à rebours est donc à 0).
- Photos presse, présentations et magic links des artistes 2027, prix et liens des pass, infos d'accès et de camping, logos partenaires, e-mail partenariats.

## Crédits

Photos 2025 : Morisseau Steeve Photographie.
