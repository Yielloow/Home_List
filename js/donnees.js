// Le dépôt de données : connexion et produits.
//
// Deux réalisations derrière la même interface :
//  - Firebase (Auth + Firestore), la vraie ;
//  - le mode essai, qui garde tout dans le localStorage, pour regarder
//    l'application avant d'avoir créé le projet Firebase.
//
// Un « produit » est une entrée du carnet : tout ce qui a été ajouté un jour
// reste dans la collection, c'est l'onglet « Déjà achetés ». Le champ
// `dansListe` dit s'il est sur la liste du moment, `achete` s'il est coché.
// La photo en grand vit dans une collection à part (`photos`) pour que la
// liste ne télécharge que les vignettes.

import { firebaseConfig } from "./config.js";

export const modeDemo = !firebaseConfig.apiKey || firebaseConfig.apiKey === "A_REMPLIR";

export function creerDepot() {
  return modeDemo ? depotDemo() : depotFirebase();
}

const VERSION_FIREBASE = "10.14.1";

async function depotFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/`;
  const [appMod, auth, fs] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-firestore.js"),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const a = auth.getAuth(app);

  // Cache local : la liste s'affiche et se coche même sans réseau au fond du
  // magasin, Firestore renvoie les changements quand la connexion revient.
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }
  const produits = fs.collection(db, "produits");
  const photo = (id) => fs.doc(db, "photos", id);

  return {
    surConnexion(cb) {
      return auth.onAuthStateChanged(a, (u) => cb(u ? { email: u.email } : null));
    },
    async connecter(email, mdp) {
      await auth.signInWithEmailAndPassword(a, email, mdp);
    },
    deconnecter() {
      return auth.signOut(a);
    },
    suivreProduits(cb, erreur) {
      return fs.onSnapshot(produits, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, erreur);
    },
    nouvelId() {
      return fs.doc(produits).id;
    },
    creer(id, donnees) {
      return fs.setDoc(fs.doc(produits, id), donnees);
    },
    modifier(id, champs) {
      return fs.updateDoc(fs.doc(produits, id), champs);
    },
    modifierPlusieurs(changements) {
      const lot = fs.writeBatch(db);
      for (const [id, champs] of changements) lot.update(fs.doc(produits, id), champs);
      return lot.commit();
    },
    supprimer(id) {
      const lot = fs.writeBatch(db);
      lot.delete(fs.doc(produits, id));
      lot.delete(photo(id));
      return lot.commit();
    },
    async lirePhoto(id) {
      const s = await fs.getDoc(photo(id));
      return s.exists() ? s.data().image : null;
    },
    ecrirePhoto(id, image) {
      return image ? fs.setDoc(photo(id), { image }) : fs.deleteDoc(photo(id));
    },
  };
}

// ── Mode essai ─────────────────────────────────────────────────────────

function depotDemo() {
  const CLE = "maliste-demo";
  const lire = () => {
    try { return JSON.parse(localStorage.getItem(CLE)) || { produits: {}, photos: {}, compte: null }; }
    catch { return { produits: {}, photos: {}, compte: null }; }
  };
  let etat = lire();
  const abonnes = new Set();
  let surCompte = () => {};

  const sauver = () => {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); }
    catch { /* stockage plein ou bloqué : la session continue en mémoire */ }
    const liste = Object.entries(etat.produits).map(([id, p]) => ({ id, ...p }));
    abonnes.forEach((cb) => cb(liste));
  };

  return Promise.resolve({
    surConnexion(cb) {
      surCompte = cb;
      cb(etat.compte);
      return () => {};
    },
    async connecter(email) {
      etat.compte = { email: email || "essai" };
      sauver();
      surCompte(etat.compte);
    },
    async deconnecter() {
      etat.compte = null;
      sauver();
      surCompte(null);
    },
    suivreProduits(cb) {
      abonnes.add(cb);
      cb(Object.entries(etat.produits).map(([id, p]) => ({ id, ...p })));
      return () => abonnes.delete(cb);
    },
    nouvelId() {
      return Math.random().toString(36).slice(2, 12);
    },
    async creer(id, donnees) {
      etat.produits[id] = { ...donnees };
      sauver();
    },
    async modifier(id, champs) {
      if (etat.produits[id]) Object.assign(etat.produits[id], champs);
      sauver();
    },
    async modifierPlusieurs(changements) {
      for (const [id, champs] of changements) {
        if (etat.produits[id]) Object.assign(etat.produits[id], champs);
      }
      sauver();
    },
    async supprimer(id) {
      delete etat.produits[id];
      delete etat.photos[id];
      sauver();
    },
    async lirePhoto(id) {
      return etat.photos[id] || null;
    },
    async ecrirePhoto(id, image) {
      if (image) etat.photos[id] = image; else delete etat.photos[id];
      sauver();
    },
  });
}
