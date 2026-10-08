# Ma liste de courses

Une liste de courses partagée pour la maison, pensée pour être simple au
téléphone : gros boutons, des mots plutôt que des symboles, une photo pour
reconnaître le bon produit en rayon.

- **Une liste par famille.** On se connecte avec un nom d'utilisateur et un
  mot de passe. Pour créer un compte, il faut le **code de la famille** :
  sans code, impossible de voir ou de créer une liste.
- **Ma liste** : ce qu'il faut acheter, rangé par rayon, avec quantité et
  **prix maximum**. Le haut de l'écran donne le budget maximum total. On coche
  en mettant dans le caddie, puis « J'ai fini mes courses » vide les cochés.
- **Ajout rapide** : en haut de la liste, les produits habituels qui n'y sont
  pas encore. Un toucher les remet, avec leur photo, quantité et prix max.
- **Déjà achetés** : tout ce qui a été ajouté un jour, du plus acheté au
  moins acheté, avec recherche.
- En tapant un nom, l'application propose les produits déjà connus et devine
  le rayon toute seule.
- Les photos du téléphone sont réduites avant l'envoi (une vignette d'environ
  10 Ko pour la liste, une grande d'environ 100 Ko quand on la touche).
- La liste s'affiche et se coche même sans réseau au fond du magasin ; les
  changements partent quand la connexion revient.

## Technique

Site statique, sans étape de construction : HTML, CSS et modules JavaScript.

| Rôle | Service | Coût |
| --- | --- | --- |
| Hébergement | GitHub Pages | gratuit |
| Connexion | Firebase Authentication (e-mail + mot de passe) | gratuit |
| Données et photos | Cloud Firestore, offre Spark | gratuit (1 Go, 50 000 lectures par jour) |
| Décor 3D | Three.js 0.160 | gratuit |

Les photos sont rangées dans Firestore sous forme d'images JPEG compressées,
ce qui évite Firebase Storage (devenu payant pour les nouveaux projets).

Sans configuration Firebase, l'application démarre en **mode essai** : tout
reste dans le navigateur, pratique pour regarder l'interface.

## Familles et codes

Les familles ne se créent pas depuis l'application, seulement par
l'administrateur du projet Firebase :

```bash
npx firebase-tools login
node outils/creer-famille.mjs "Famille Dupont" DUPO
```

Le script affiche le code (par exemple `DUPO-XXXX-XXXX`) à transmettre aux
membres de la famille. Chacun choisit « Première fois » sur l'écran d'accueil,
invente son nom d'utilisateur et son mot de passe, et tape le code. Une fois
connecté, le code reste visible dans le menu ⋮ pour inviter les autres.

Les codes ne sont jamais publiés dans ce dépôt. Les règles Firestore
([`firestore.rules`](firestore.rules)) n'acceptent un nouveau membre que si son
code mène bien à la famille demandée, et ne laissent lire une liste qu'à ses
membres. Pour les publier :

```bash
npx firebase-tools deploy --only firestore:rules
```

Mot de passe oublié : il n'y a pas d'e-mail derrière les noms d'utilisateur.
Dans la console Firebase > Authentication, retrouver `nom@home-list-cb734.firebaseapp.com`,
puis supprimer le compte : la personne en recrée un avec le code de sa famille.

## Mise en route d'un nouveau projet Firebase

1. Créer un projet sur <https://console.firebase.google.com>.
2. Authentication : activer **Adresse e-mail/Mot de passe**, et ajouter le
   domaine du site dans Paramètres > **Domaines autorisés**.
3. Firestore Database : créer la base (`eur3`, mode production).
4. Paramètres du projet > Vos applications > **Web** : copier la config dans
   [`js/config.js`](js/config.js), et l'ID du projet dans `.firebaserc`.
5. Publier les règles, puis créer une famille (voir plus haut).

GitHub Pages : Settings > Pages > branche `main`, dossier `/ (root)`.

## Essayer en local

```bash
python -m http.server 8765
```

puis ouvrir <http://localhost:8765/?essai> : le paramètre `essai` fait tourner
l'application sur des données locales, sans toucher aux vraies listes.
