# Ma liste de courses

Une liste de courses partagée pour la maison, pensée pour être simple au
téléphone : gros boutons, des mots plutôt que des symboles, une photo pour
reconnaître le bon produit en rayon.

- **Ma liste** : ce qu'il faut acheter, rangé par rayon. On coche en mettant
  dans le caddie, puis « J'ai fini mes courses » vide les articles cochés.
- **Déjà achetés** : tout ce qui a été ajouté un jour, avec sa photo, du plus
  acheté au moins acheté. Un bouton suffit pour le remettre dans la liste.
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

## Mise en route

### 1. Créer le projet Firebase

1. Aller sur <https://console.firebase.google.com> et créer un projet
   (Google Analytics n'est pas utile).
2. **Authentication** > Commencer > Mode de connexion : activer
   **Adresse e-mail/Mot de passe**.
3. **Authentication** > Utilisateurs > Ajouter un utilisateur : créer le compte
   de maman (et le sien si besoin). Noter l'**UID** de chaque compte.
4. **Firestore Database** > Créer une base de données, emplacement
   `eur3 (europe-west)`, en mode production.
5. Firestore > **Règles** : coller le contenu de [`firestore.rules`](firestore.rules)
   puis Publier.
6. Firestore > **Données** : créer la collection `membres`, avec un document
   par compte autorisé dont l'**ID est l'UID** du compte (un champ
   `nom` = `Maman` suffit).
7. Paramètres du projet > Général > Vos applications > icône **Web** `</>` :
   enregistrer l'application, puis copier l'objet `firebaseConfig` dans
   [`js/config.js`](js/config.js).
8. Authentication > Paramètres > **Domaines autorisés** : ajouter
   `yielloow.github.io`.

### 2. Publier sur GitHub Pages

Dépôt > Settings > Pages > Source : **Deploy from a branch**, branche `main`,
dossier `/ (root)`. Le site est ensuite en ligne à
<https://yielloow.github.io/Home_List/>.

### 3. Sur le téléphone de maman

Ouvrir l'adresse dans Chrome (Android) ou Safari (iPhone), se connecter, puis :

- Android : menu ⋮ > **Ajouter à l'écran d'accueil** ;
- iPhone : bouton Partager > **Sur l'écran d'accueil**.

L'application s'ouvre alors comme une vraie appli, en plein écran, et reste
connectée.

## Essayer en local

```bash
python -m http.server 8765
```

puis ouvrir <http://localhost:8765>.
