// Le dépôt de données : comptes, familles et produits.
//
// Deux réalisations derrière la même interface :
//  - Firebase (Auth + Firestore), la vraie ;
//  - le mode essai, qui garde tout dans le localStorage, pour regarder
//    l'application avant d'avoir créé le projet Firebase.
//
// Comptes : on se connecte avec un nom d'utilisateur. Firebase n'accepte que
// des adresses e-mail, alors le nom devient « nom@<authDomain> » en coulisse.
// Une adresse complète (avec @) reste acceptée pour les anciens comptes.
//
// Familles : chaque famille a sa liste dans familles/<id>/produits. On ne
// crée pas de famille depuis l'application ; on en rejoint une en tapant son
// code, qui pointe vers elle dans codes/<CODE>. La fiche membres/<uid> relie
// un compte à sa famille, et les règles Firestore vérifient le code.
//
// Un « produit » est une entrée du carnet de la famille : tout ce qui a été
// ajouté un jour reste dans la collection, c'est l'onglet « Déjà achetés ».
// `dansListe` dit s'il est sur la liste du moment, `achete` s'il est coché.
// La photo en grand vit à part (photos/<id>) pour que la liste ne télécharge
// que les vignettes.

import { firebaseConfig } from "./config.js";

// « ?essai » dans l'adresse force le mode essai, pour tester l'interface sans
// toucher aux vraies données.
export const modeDemo = !firebaseConfig.apiKey || firebaseConfig.apiKey === "A_REMPLIR"
  || new URLSearchParams(location.search).has("essai");

export function creerDepot() {
  return modeDemo ? depotDemo() : depotFirebase();
}

// « marie.dupont » ; lettres sans accents, chiffres, point, tiret, souligné
export function nettoyerPseudo(texte) {
  return (texte || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "");
}

// « mone-7k4p q9tx » devient « MONE7K4PQ9TX »
export function nettoyerCode(texte) {
  return (texte || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Firestore refuse les champs `undefined` en levant une exception immédiate :
// on les retire, une valeur absente vaut mieux qu'un ajout perdu.
function propre(objet) {
  return Object.fromEntries(Object.entries(objet).filter(([, v]) => v !== undefined));
}

function erreur(code) {
  const e = new Error(code);
  e.code = code;
  return e;
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

  const versEmail = (identifiant) => identifiant.includes("@")
    ? identifiant.trim()
    : `${nettoyerPseudo(identifiant)}@${firebaseConfig.authDomain}`;

  let famille = null;
  const produits = () => fs.collection(db, "familles", famille, "produits");
  const produit = (id) => fs.doc(db, "familles", famille, "produits", id);
  const photo = (id) => fs.doc(db, "familles", famille, "photos", id);

  // Retrouve la famille d'un compte : null s'il n'en a pas encore
  async function lireCompte(u) {
    const pseudo = u.email.endsWith("@" + firebaseConfig.authDomain) ? u.email.split("@")[0] : u.email;
    const fiche = await fs.getDoc(fs.doc(db, "membres", u.uid));
    if (!fiche.exists() || !fiche.data().famille) return { pseudo, famille: null };
    const f = fiche.data().famille;
    const fam = await fs.getDoc(fs.doc(db, "familles", f));
    const donnees = fam.exists() ? fam.data() : {};
    return { pseudo, famille: f, nomFamille: donnees.nom || "Ma famille", code: donnees.code || "" };
  }

  async function rejoindre(u, pseudo, code) {
    const c = nettoyerCode(code);
    if (c.length < 6) throw erreur("famille/code-inconnu");
    const fiche = await fs.getDoc(fs.doc(db, "codes", c));
    if (!fiche.exists()) throw erreur("famille/code-inconnu");
    await fs.setDoc(fs.doc(db, "membres", u.uid), {
      famille: fiche.data().famille, pseudo, code: c, creeLe: Date.now(),
    });
  }

  async function verifierCode(code) {
    const c = nettoyerCode(code);
    if (c.length < 6) throw erreur("famille/code-inconnu");
    const fiche = await fs.getDoc(fs.doc(db, "codes", c));
    if (!fiche.exists()) throw erreur("famille/code-inconnu");
  }

  return {
    surConnexion(cb) {
      return auth.onAuthStateChanged(a, async (u) => {
        if (!u) { famille = null; cb(null); return; }
        try {
          const compte = await lireCompte(u);
          famille = compte.famille;
          cb(compte);
        } catch (e) {
          console.error(e);
          cb({ pseudo: u.email, famille: null, erreur: true });
        }
      });
    },
    async connecter(identifiant, mdp) {
      await auth.signInWithEmailAndPassword(a, versEmail(identifiant), mdp);
    },
    // Crée le compte puis le relie à la famille du code. Le code est vérifié
    // avant, pour ne pas laisser de compte orphelin sur une faute de frappe.
    async inscrire(pseudo, mdp, code) {
      const p = nettoyerPseudo(pseudo);
      if (p.length < 3) throw erreur("famille/pseudo-court");
      await verifierCode(code);
      const { user } = await auth.createUserWithEmailAndPassword(a, versEmail(p), mdp);
      try {
        await rejoindre(user, p, code);
      } catch (e) {
        await user.delete().catch(() => {});
        throw e;
      }
      // onAuthStateChanged a pu passer avant la fiche membre : on relit
      const compte = await lireCompte(user);
      famille = compte.famille;
      return compte;
    },
    // Pour un compte connecté qui n'a pas encore de famille
    async rejoindreFamille(code) {
      const u = a.currentUser;
      await rejoindre(u, nettoyerPseudo(u.email.split("@")[0]), code);
      const compte = await lireCompte(u);
      famille = compte.famille;
      return compte;
    },
    deconnecter() {
      return auth.signOut(a);
    },
    suivreProduits(cb, erreurCb) {
      return fs.onSnapshot(produits(), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, erreurCb);
    },
    nouvelId() {
      return fs.doc(produits()).id;
    },
    async creer(id, donnees) {
      return fs.setDoc(produit(id), propre(donnees));
    },
    async modifier(id, champs) {
      return fs.updateDoc(produit(id), propre(champs));
    },
    async modifierPlusieurs(changements) {
      const lot = fs.writeBatch(db);
      for (const [id, champs] of changements) lot.update(produit(id), propre(champs));
      return lot.commit();
    },
    async supprimer(id) {
      const lot = fs.writeBatch(db);
      lot.delete(produit(id));
      lot.delete(photo(id));
      return lot.commit();
    },
    async lirePhoto(id) {
      const s = await fs.getDoc(photo(id));
      return s.exists() ? s.data().image : null;
    },
    async ecrirePhoto(id, image) {
      return image ? fs.setDoc(photo(id), { image }) : fs.deleteDoc(photo(id));
    },
  };
}

// ── Mode essai ─────────────────────────────────────────────────────────

function depotDemo() {
  const CLE = "maliste-demo";
  const vide = () => ({ produits: {}, photos: {}, compte: null });
  const lire = () => {
    try { return JSON.parse(localStorage.getItem(CLE)) || vide(); }
    catch { return vide(); }
  };
  let etat = lire();
  const abonnes = new Set();
  let surCompte = () => {};
  const compteDemo = (pseudo) => ({ pseudo: pseudo || "essai", famille: "demo", nomFamille: "Famille Essai", code: "ESSA12345678" });

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
    async connecter(identifiant) {
      etat.compte = compteDemo(nettoyerPseudo(identifiant));
      sauver();
      surCompte(etat.compte);
    },
    async inscrire(pseudo) {
      etat.compte = compteDemo(nettoyerPseudo(pseudo));
      sauver();
      surCompte(etat.compte);
      return etat.compte;
    },
    async rejoindreFamille() {
      return etat.compte;
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
      // Même exigence que Firestore, pour que le mode essai attrape ces oublis
      if (Object.values(donnees).includes(undefined)) throw new Error("Champ undefined refusé par Firestore");
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
