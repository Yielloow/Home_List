// Ma liste de courses : l'interface.
//
// Tout l'état vient d'un seul abonnement aux produits ; l'affichage est
// reconstruit à chaque changement. La liste d'une maison tient en quelques
// centaines de produits, c'est largement assez rapide et ça évite toute
// désynchronisation entre deux téléphones.

import { creerDepot, modeDemo } from "./donnees.js";
import { preparerPhoto } from "./photo.js";
import { decor } from "./scene.js";

const $ = (s) => document.querySelector(s);

// Les rayons, dans l'ordre d'un parcours de supermarché
const RAYONS = [
  { id: "fruits", nom: "Fruits et légumes", emoji: "🥕", couleur: "#4caf50" },
  { id: "boulangerie", nom: "Boulangerie", emoji: "🥖", couleur: "#d99a4e" },
  { id: "viande", nom: "Viande et poisson", emoji: "🥩", couleur: "#d9412b" },
  { id: "frais", nom: "Frais et fromages", emoji: "🧀", couleur: "#f4b740" },
  { id: "epicerie", nom: "Épicerie", emoji: "🥫", couleur: "#b5651d" },
  { id: "boissons", nom: "Boissons", emoji: "🧃", couleur: "#5aa0e6" },
  { id: "surgeles", nom: "Surgelés", emoji: "🧊", couleur: "#7fc8e8" },
  { id: "hygiene", nom: "Hygiène", emoji: "🧴", couleur: "#c07ad6" },
  { id: "maison", nom: "Maison", emoji: "🧽", couleur: "#8d9aa6" },
  { id: "autre", nom: "Autre", emoji: "🛒", couleur: "#a1887f" },
];
const rayon = (id) => RAYONS.find((r) => r.id === id) || RAYONS[RAYONS.length - 1];

// Un rayon deviné à partir du nom, pour que maman n'ait presque jamais à choisir
const INDICES = {
  fruits: "pomme poire banane orange citron fraise raisin kiwi melon pastèque tomate salade laitue carotte oignon ail poireau courgette aubergine poivron pomme de terre patate champignon concombre brocoli chou épinard haricot avocat ananas mangue clémentine persil basilic légume fruit",
  boulangerie: "pain baguette croissant brioche pistolet sandwich viennoiserie couque cramique tarte gâteau",
  viande: "viande poulet boeuf bœuf porc jambon saucisse haché steak dinde lardons poisson saumon thon cabillaud crevette scampi filet américain",
  frais: "lait beurre fromage yaourt yogourt crème oeuf œuf œufs oeufs mozzarella gouda emmental feta skyr dessert",
  epicerie: "pâtes pates riz farine sucre sel poivre huile vinaigre conserve sauce café thé chocolat biscuit céréales confiture miel moutarde mayonnaise ketchup épice soupe chips",
  boissons: "eau jus soda coca bière vin limonade sirop boisson",
  surgeles: "surgelé surgelés glace frites pizza",
  hygiene: "savon shampoing shampooing dentifrice brosse déodorant papier toilette mouchoir coton gel douche rasoir serviette",
  maison: "lessive vaisselle éponge sac poubelle essuie-tout nettoyant javel ampoule pile adoucissant liquide",
};
function devinerRayon(nom) {
  const n = cle(nom);
  for (const [id, mots] of Object.entries(INDICES)) {
    for (const mot of mots.split(" ")) {
      const m = cle(mot);
      if (m.length > 2 && (n === m || n.startsWith(m + " ") || n.includes(" " + m) || n.startsWith(m))) return id;
    }
  }
  return null;
}

// Clé de comparaison : minuscules, sans accents ni espaces superflus
function cle(texte) {
  return (texte || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const echapper = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── État ──────────────────────────────────────────────────────────────

let depot;
let compte = null;
let produits = [];
let vue = "liste";
let desabonner = null;
let edition = null;       // produit modifié dans la feuille, ou null pour un ajout
let photoEnAttente;       // undefined : inchangée ; null : retirée ; objet : nouvelle
let rayonChoisi = null;
let rayonTouche = false;  // maman a choisi un rayon elle-même : on ne devine plus

// ── Démarrage ─────────────────────────────────────────────────────────

decor.demarrer();
init().catch((e) => {
  console.error(e);
  afficherErreurConnexion("Impossible de joindre le serveur. Vérifiez la connexion Internet puis rechargez la page.");
  montrerEcran("connexion");
});

async function init() {
  depot = await creerDepot();
  $("#c-demo").hidden = !modeDemo;
  depot.surConnexion((c) => {
    compte = c;
    if (desabonner) { desabonner(); desabonner = null; }
    if (c) {
      montrerEcran("app");
      desabonner = depot.suivreProduits((liste) => {
        produits = liste;
        dessiner();
      }, (err) => {
        console.error(err);
        if (err.code === "permission-denied") {
          toast("Ce compte n'a pas encore accès à la liste.");
        } else {
          toast("Problème de connexion avec la liste.");
        }
      });
    } else {
      produits = [];
      montrerEcran("connexion");
    }
  });
}

function montrerEcran(nom) {
  $("#ecran-connexion").hidden = nom !== "connexion";
  $("#ecran-app").hidden = nom !== "app";
  decor.mode(nom === "connexion" ? "connexion" : "liste");
  if (nom === "connexion") mesurerZone();
}

// Le panier 3D se loge entre le texte d'accueil et le formulaire
function mesurerZone() {
  if ($("#ecran-connexion").hidden) return;
  const haut = $(".sous-titre").getBoundingClientRect().bottom;
  const bas = $("#form-connexion").getBoundingClientRect().top;
  decor.zone(haut / innerHeight, bas / innerHeight);
}
addEventListener("resize", mesurerZone);
if (document.fonts) document.fonts.ready.then(mesurerZone);

// ── Connexion ─────────────────────────────────────────────────────────

$("#voir-mdp").addEventListener("click", () => {
  const champ = $("#c-mdp");
  const visible = champ.type === "text";
  champ.type = visible ? "password" : "text";
  $("#voir-mdp").textContent = visible ? "Voir" : "Cacher";
});

$("#form-connexion").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#c-email").value.trim();
  const mdp = $("#c-mdp").value;
  if (!modeDemo && (!email || !mdp)) {
    afficherErreurConnexion("Il faut remplir l'adresse e-mail et le mot de passe.");
    return;
  }
  const bouton = $("#c-bouton");
  bouton.disabled = true;
  bouton.textContent = "Un instant…";
  $("#c-erreur").hidden = true;
  try {
    await depot.connecter(email, mdp);
  } catch (err) {
    const messages = {
      "auth/invalid-credential": "L'adresse e-mail ou le mot de passe ne correspond pas. Réessayez doucement.",
      "auth/wrong-password": "Le mot de passe ne correspond pas.",
      "auth/user-not-found": "Cette adresse e-mail n'est pas connue.",
      "auth/invalid-email": "L'adresse e-mail n'est pas bien écrite.",
      "auth/too-many-requests": "Trop d'essais. Attendez quelques minutes puis réessayez.",
      "auth/network-request-failed": "Pas de connexion Internet.",
    };
    afficherErreurConnexion(messages[err.code] || "La connexion n'a pas marché. Réessayez.");
  } finally {
    bouton.disabled = false;
    bouton.textContent = "Entrer";
  }
});

function afficherErreurConnexion(texte) {
  const el = $("#c-erreur");
  el.textContent = texte;
  el.hidden = false;
}

// ── Navigation ────────────────────────────────────────────────────────

document.querySelectorAll(".onglet").forEach((b) => {
  b.addEventListener("click", () => changerVue(b.dataset.vue));
});

function changerVue(v) {
  vue = v;
  document.querySelectorAll(".onglet").forEach((b) => b.classList.toggle("actif", b.dataset.vue === v));
  $("#vue-liste").hidden = v !== "liste";
  $("#vue-historique").hidden = v !== "historique";
  scrollTo({ top: 0 });
  dessiner();
}

// ── Affichage ─────────────────────────────────────────────────────────

function vignetteHTML(p, classe = "vignette") {
  if (p.vignette) return `<img class="${classe}" src="${p.vignette}" alt="">`;
  return `<span class="${classe}">${rayon(p.rayon).emoji}</span>`;
}

function dessiner() {
  const dansListe = produits.filter((p) => p.dansListe);
  const restants = dansListe.filter((p) => !p.achete).length;
  const coches = dansListe.length - restants;

  $("#titre-vue").textContent = vue === "liste" ? "Ma liste" : "Déjà achetés";
  if (vue === "liste") {
    $("#resume").textContent = dansListe.length === 0 ? "Rien à acheter pour l'instant"
      : restants === 0 ? "Tout est dans le caddie 🎉"
      : `${restants} ${restants > 1 ? "choses" : "chose"} à acheter`;
  } else {
    $("#resume").textContent = `${produits.length} ${produits.length > 1 ? "produits gardés" : "produit gardé"}`;
  }
  const badge = $("#badge-liste");
  badge.hidden = restants === 0;
  badge.textContent = restants;

  if (vue === "liste") dessinerListe(dansListe, coches);
  else dessinerHistorique();
}

function dessinerListe(dansListe, coches) {
  $("#liste-vide").hidden = dansListe.length > 0;
  $("#zone-terminer").hidden = coches === 0;
  $("#btn-terminer").textContent = `✅ J'ai fini mes courses (${coches} dans le caddie)`;

  const parRayon = new Map();
  for (const p of dansListe) {
    const r = rayon(p.rayon).id;
    if (!parRayon.has(r)) parRayon.set(r, []);
    parRayon.get(r).push(p);
  }
  let html = "";
  for (const r of RAYONS) {
    const articles = parRayon.get(r.id);
    if (!articles) continue;
    // Les articles cochés descendent en bas de leur rayon
    articles.sort((a, b) => (a.achete - b.achete) || (a.ajouteLe || 0) - (b.ajouteLe || 0));
    html += `<section class="rayon"><h2 class="rayon-titre"><span class="pastille" style="background:${r.couleur}"></span>${r.emoji} ${r.nom}</h2>`;
    for (const p of articles) {
      const detail = [
        p.quantite && p.quantite !== "1" ? `<span class="qte">× ${echapper(p.quantite)}</span>` : "",
        p.note ? echapper(p.note) : "",
      ].join("");
      html += `
        <div class="article${p.achete ? " coche" : ""}" data-id="${p.id}">
          <button class="case" data-action="cocher" aria-label="${p.achete ? "Décocher" : "Cocher"} ${echapper(p.nom)}">
            <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          ${p.vignette ? `<button class="vignette" data-action="photo" aria-label="Voir la photo en grand"><img class="vignette" src="${p.vignette}" alt=""></button>` : vignetteHTML(p)}
          <button class="article-corps" data-action="modifier">
            <div class="article-nom">${echapper(p.nom)}</div>
            ${detail ? `<div class="article-detail">${detail}</div>` : ""}
          </button>
          <button class="modifier" data-action="modifier" aria-label="Modifier ${echapper(p.nom)}">
            <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>
          </button>
        </div>`;
    }
    html += "</section>";
  }
  $("#liste").innerHTML = html;
}

function dessinerHistorique() {
  const q = cle($("#h-recherche").value);
  const tries = produits
    .filter((p) => !q || cle(p.nom).includes(q))
    .sort((a, b) => (b.fois || 0) - (a.fois || 0) || cle(a.nom).localeCompare(cle(b.nom)));
  $("#historique-vide").hidden = produits.length > 0;
  $("#historique").innerHTML = tries.map((p) => `
    <div class="tuile" data-id="${p.id}">
      ${p.vignette ? `<button class="vignette" data-action="photo" aria-label="Voir la photo"><img class="vignette" src="${p.vignette}" alt=""></button>` : vignetteHTML(p)}
      <div class="tuile-nom">${echapper(p.nom)}</div>
      <div class="tuile-info">${rayon(p.rayon).emoji} ${(p.fois || 1) > 1 ? `acheté ${p.fois} fois` : rayon(p.rayon).nom}</div>
      ${p.dansListe
        ? `<button class="tuile-bouton dedans" data-action="modifier">✓ Déjà dans la liste</button>`
        : `<button class="tuile-bouton" data-action="remettre">＋ Ajouter</button>`}
    </div>`).join("")
    + (q && tries.length === 0 ? `<p class="aide">Aucun produit ne s'appelle comme ça. <button class="btn-texte" data-action="creer">Ajouter « ${echapper($("#h-recherche").value.trim())} »</button></p>` : "");
}

$("#h-recherche").addEventListener("input", () => dessinerHistorique());

// Un seul écouteur pour la liste et l'historique
for (const conteneur of [$("#liste"), $("#historique")]) {
  conteneur.addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-action]");
    if (!bouton) return;
    const carte = bouton.closest("[data-id]");
    const p = carte && produits.find((x) => x.id === carte.dataset.id);
    const action = bouton.dataset.action;
    if (action === "creer") { ouvrirFeuille(null, $("#h-recherche").value.trim()); return; }
    if (!p) return;
    if (action === "cocher") cocher(p, bouton);
    else if (action === "modifier") ouvrirFeuille(p);
    else if (action === "photo") voirPhoto(p);
    else if (action === "remettre") remettre(p, bouton);
  });
}

// ── Actions ───────────────────────────────────────────────────────────

function erreurEcriture(err) {
  console.error(err);
  toast(err && err.code === "permission-denied"
    ? "Ce compte n'a pas le droit de modifier la liste."
    : "Le changement n'a pas pu être enregistré.");
}

// Les écritures ne sont pas attendues : hors ligne, Firestore les garde et
// l'affichage suit tout de suite grâce au cache local.
function ecrire(promesse) {
  Promise.resolve(promesse).catch(erreurEcriture);
}

function cocher(p, bouton) {
  const achete = !p.achete;
  ecrire(depot.modifier(p.id, { achete }));
  if (achete) {
    const r = bouton.getBoundingClientRect();
    decor.celebrer((r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight);
    if (navigator.vibrate) navigator.vibrate(15);
  }
}

function remettre(p, bouton) {
  ecrire(depot.modifier(p.id, { dansListe: true, achete: false, quantite: "1", fois: (p.fois || 0) + 1, ajouteLe: Date.now() }));
  const r = bouton.getBoundingClientRect();
  if (r.width) decor.celebrer((r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight);
  else decor.celebrer(0.5, 0.85);
  toast(`« ${p.nom} » est dans la liste`, () => {
    ecrire(depot.modifier(p.id, { dansListe: false, fois: Math.max(1, p.fois || 1) }));
  });
}

$("#btn-terminer").addEventListener("click", () => {
  const coches = produits.filter((p) => p.dansListe && p.achete);
  if (!coches.length) return;
  const maintenant = Date.now();
  ecrire(depot.modifierPlusieurs(coches.map((p) => [p.id, { dansListe: false, achete: false, dernierAchat: maintenant }])));
  decor.celebrer(0.5, 0.75);
  toast(`Bravo ! ${coches.length} ${coches.length > 1 ? "articles rangés" : "article rangé"} dans « Déjà achetés »`, () => {
    ecrire(depot.modifierPlusieurs(coches.map((p) => [p.id, { dansListe: true, achete: true }])));
  });
});

// ── Feuille d'ajout / modification ────────────────────────────────────

$("#btn-ajouter").addEventListener("click", () => ouvrirFeuille(null));

function construirePuces() {
  $("#f-rayons").innerHTML = RAYONS.map((r) =>
    `<button type="button" class="puce" data-rayon="${r.id}" aria-pressed="false">${r.emoji} ${r.nom}</button>`).join("");
}
construirePuces();

$("#f-rayons").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rayon]");
  if (!b) return;
  rayonTouche = true;
  choisirRayon(b.dataset.rayon);
});

function choisirRayon(id) {
  rayonChoisi = id;
  document.querySelectorAll("#f-rayons .puce").forEach((p) => p.setAttribute("aria-pressed", String(p.dataset.rayon === id)));
}

function ouvrirFeuille(p, nomInitial = "") {
  edition = p;
  photoEnAttente = undefined;
  rayonTouche = !!p;
  $("#f-titre").textContent = p ? "Modifier" : "Ajouter un produit";
  $("#f-valider").textContent = p ? "Enregistrer" : "Ajouter à la liste";
  $("#f-nom").value = p ? p.nom : nomInitial;
  $("#f-quantite").value = p ? (p.quantite || "1") : "1";
  $("#f-note").value = p ? (p.note || "") : "";
  $("#f-erreur").hidden = true;
  $("#f-suggestions").hidden = true;
  $("#f-actions").hidden = !p;
  $("#f-retirer").hidden = !(p && p.dansListe);
  choisirRayon(p ? rayon(p.rayon).id : (devinerRayon(nomInitial) || null));
  montrerApercu(p && p.vignette ? p.vignette : null);
  if (p && p.photo) depot.lirePhoto(p.id).then((img) => { if (edition === p && img && photoEnAttente === undefined) montrerApercu(img); }).catch(() => {});
  $("#feuille").hidden = false;
  if (!p) setTimeout(() => $("#f-nom").focus(), 320);
}

function fermer(fenetre) {
  fenetre.hidden = true;
}
document.querySelectorAll(".feuille-fond, .visionneuse").forEach((fond) => {
  fond.addEventListener("click", (e) => {
    if (e.target === fond || e.target.closest("[data-fermer]")) fermer(fond);
  });
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".feuille-fond:not([hidden]), .visionneuse:not([hidden])").forEach(fermer);
});

function montrerApercu(src) {
  const img = $("#f-apercu");
  img.hidden = !src;
  if (src) img.src = src; else img.removeAttribute("src");
  $("#f-photo-retirer").hidden = !src;
  $("#f-photo-texte").textContent = src ? "📷 Changer la photo" : "📷 Prendre ou choisir une photo";
}

$("#f-photo").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  e.target.value = "";
  if (!fichier) return;
  $("#f-photo-texte").textContent = "Préparation de la photo…";
  try {
    photoEnAttente = await preparerPhoto(fichier);
    montrerApercu(photoEnAttente.grande);
  } catch (err) {
    console.error(err);
    montrerApercu(null);
    toast("Cette photo n'a pas pu être lue. Essayez-en une autre.");
  }
});

$("#f-photo-retirer").addEventListener("click", () => {
  photoEnAttente = null;
  montrerApercu(null);
});

$("#f-moins").addEventListener("click", () => pasQuantite(-1));
$("#f-plus").addEventListener("click", () => pasQuantite(1));
function pasQuantite(delta) {
  const champ = $("#f-quantite");
  const m = champ.value.match(/^(\d+)(.*)$/);
  const n = m ? parseInt(m[1], 10) : 1;
  const suite = m ? m[2] : "";
  champ.value = Math.max(1, n + delta) + suite;
}

// Suggestions tirées des produits déjà achetés pendant que maman écrit
$("#f-nom").addEventListener("input", () => {
  const texte = $("#f-nom").value;
  if (!rayonTouche) {
    const devine = devinerRayon(texte);
    if (devine) choisirRayon(devine);
  }
  const q = cle(texte);
  const boite = $("#f-suggestions");
  if (edition || q.length < 2) { boite.hidden = true; return; }
  const trouves = produits
    .filter((p) => cle(p.nom).includes(q))
    .sort((a, b) => (cle(a.nom).startsWith(q) ? 0 : 1) - (cle(b.nom).startsWith(q) ? 0 : 1) || (b.fois || 0) - (a.fois || 0))
    .slice(0, 4);
  boite.hidden = trouves.length === 0;
  boite.innerHTML = trouves.map((p) => `
    <button type="button" class="suggestion" data-id="${p.id}">
      ${vignetteHTML(p)}
      <span><b>${echapper(p.nom)}</b><small>${p.dansListe ? "Déjà dans la liste" : "Déjà acheté, touchez pour le reprendre"}</small></span>
    </button>`).join("");
});

$("#f-suggestions").addEventListener("click", (e) => {
  const b = e.target.closest("[data-id]");
  const p = b && produits.find((x) => x.id === b.dataset.id);
  if (!p) return;
  fermer($("#feuille"));
  if (p.dansListe) {
    toast(`« ${p.nom} » est déjà dans la liste`);
  } else {
    remettre(p, b);
  }
});

$("#form-produit").addEventListener("submit", (e) => {
  e.preventDefault();
  const nom = majuscule($("#f-nom").value.trim());
  if (!nom) {
    const err = $("#f-erreur");
    err.textContent = "Écrivez d'abord ce qu'il faut acheter.";
    err.hidden = false;
    $("#f-nom").focus();
    return;
  }
  const champs = {
    nom,
    nomCle: cle(nom),
    quantite: $("#f-quantite").value.trim() || "1",
    note: $("#f-note").value.trim(),
    rayon: rayonChoisi || devinerRayon(nom) || "autre",
  };
  if (photoEnAttente) { champs.vignette = photoEnAttente.vignette; champs.photo = true; }
  if (photoEnAttente === null) { champs.vignette = null; champs.photo = false; }

  let id;
  let existant = edition;
  if (!existant) {
    // Un produit déjà connu est repris plutôt que dupliqué : il garde sa photo et son compteur
    existant = produits.find((p) => p.nomCle === champs.nomCle || cle(p.nom) === champs.nomCle);
    if (existant && existant.dansListe && !existant.achete) {
      // Déjà sur la liste : on met à jour sans compter un achat de plus
      champs.dansListe = true;
    } else if (existant) {
      Object.assign(champs, { dansListe: true, achete: false, fois: (existant.fois || 0) + 1, ajouteLe: Date.now() });
    }
  }
  if (existant) {
    id = existant.id;
    ecrire(depot.modifier(id, champs));
  } else {
    id = depot.nouvelId();
    ecrire(depot.creer(id, {
      vignette: null, photo: false, ...champs,
      dansListe: true, achete: false, fois: 1, ajouteLe: Date.now(),
      ajoutePar: compte ? compte.email : "",
    }));
  }
  if (photoEnAttente) ecrire(depot.ecrirePhoto(id, photoEnAttente.grande));
  if (photoEnAttente === null && existant && existant.photo) ecrire(depot.ecrirePhoto(id, null));

  fermer($("#feuille"));
  if (!edition) {
    if (vue !== "liste") changerVue("liste");
    decor.celebrer(0.5, 0.85);
    toast(`« ${nom} » ajouté à la liste`);
  } else {
    toast("C'est enregistré");
  }
});

$("#f-retirer").addEventListener("click", () => {
  const p = edition;
  if (!p) return;
  fermer($("#feuille"));
  ecrire(depot.modifier(p.id, { dansListe: false, achete: false }));
  toast(`« ${p.nom} » retiré de la liste`, () => ecrire(depot.modifier(p.id, { dansListe: true, achete: !!p.achete })));
});

$("#f-supprimer").addEventListener("click", async () => {
  const p = edition;
  if (!p) return;
  const ok = await confirmer(`Supprimer « ${p.nom} » pour toujours ? Il disparaîtra aussi de « Déjà achetés ».`);
  if (!ok) return;
  fermer($("#feuille"));
  ecrire(depot.supprimer(p.id));
  toast(`« ${p.nom} » supprimé`);
});

// ── Photo en grand ────────────────────────────────────────────────────

async function voirPhoto(p) {
  const img = $("#v-image");
  img.src = p.vignette || "";
  $("#v-legende").textContent = p.nom;
  $("#visionneuse").hidden = false;
  if (p.photo) {
    try {
      const grande = await depot.lirePhoto(p.id);
      if (grande && !$("#visionneuse").hidden) img.src = grande;
    } catch { /* la vignette reste affichée */ }
  }
}

// ── Menu, confirmation, messages ──────────────────────────────────────

$("#btn-menu").addEventListener("click", () => {
  $("#menu-compte").textContent = compte ? `Connectée avec ${compte.email}` : "";
  $("#menu").hidden = false;
});
$("#btn-deconnexion").addEventListener("click", async () => {
  fermer($("#menu"));
  if (await confirmer("Se déconnecter ? Il faudra retaper le mot de passe.")) depot.deconnecter();
});

function confirmer(texte) {
  return new Promise((resoudre) => {
    const fond = $("#confirmation");
    $("#conf-texte").textContent = texte;
    fond.hidden = false;
    const fin = (v) => {
      fond.hidden = true;
      $("#conf-oui").onclick = $("#conf-non").onclick = fond.onclick = null;
      resoudre(v);
    };
    $("#conf-oui").onclick = () => fin(true);
    $("#conf-non").onclick = () => fin(false);
    fond.onclick = (e) => { if (e.target === fond) fin(false); };
  });
}

let minuteurToast;
function toast(texte, annuler) {
  const el = $("#toast");
  $("#toast-texte").textContent = texte;
  const b = $("#toast-annuler");
  b.hidden = !annuler;
  b.onclick = () => { el.hidden = true; annuler(); };
  el.hidden = false;
  // Relancer l'animation d'entrée
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { el.hidden = true; }, annuler ? 6000 : 3200);
}
