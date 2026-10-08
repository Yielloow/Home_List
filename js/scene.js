// Le décor en 3D : un panier et des fruits en pâte à modeler qui flottent.
//
// Sur l'écran de connexion, le panier trône au milieu et les fruits tournent
// autour. Une fois dans la liste, le panier s'efface et les fruits se rangent
// sur les bords, plus petits, pour ne jamais gêner la lecture.
//
// Sobriété : pixel ratio plafonné, 30 images par seconde dans la liste, arrêt
// complet quand l'onglet est caché, une seule image si l'utilisateur a demandé
// moins d'animations.

import * as THREE from "three";

const toile = document.getElementById("scene");
let rendu;
try {
  rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: "low-power" });
} catch {
  rendu = null; // pas de WebGL : la page reste lisible sur son fond crème
}

const moinsAnimer = matchMedia("(prefers-reduced-motion: reduce)").matches;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0, 14);

scene.add(new THREE.HemisphereLight(0xfff4e0, 0xd9a77a, 1.6));
const soleil = new THREE.DirectionalLight(0xffffff, 1.6);
soleil.position.set(4, 7, 8);
scene.add(soleil);

const mat = (couleur, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.62, metalness: 0, flatShading: true, ...extra });

// ── Les modèles ───────────────────────────────────────────────────────

function pomme(couleur = 0xe2553c) {
  const g = new THREE.Group();
  const corps = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), mat(couleur));
  corps.scale.set(1, 0.9, 1);
  g.add(corps);
  const queue = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 6), mat(0x6b4226));
  queue.position.y = 0.66; queue.rotation.z = 0.25;
  g.add(queue);
  const feuille = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(0x4caf50));
  feuille.scale.set(1.5, 0.3, 0.8); feuille.position.set(0.2, 0.74, 0); feuille.rotation.z = -0.5;
  g.add(feuille);
  return g;
}

function orange() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), mat(0xf59a2f)));
  const point = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat(0x5a8f3a));
  point.position.y = 0.58;
  g.add(point);
  return g;
}

function citron() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), mat(0xf6d743));
  c.scale.set(1.35, 1, 1);
  g.add(c);
  for (const s of [-1, 1]) {
    const bout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 6), mat(0xf6d743));
    bout.rotation.z = -s * Math.PI / 2; bout.position.x = s * 0.72;
    g.add(bout);
  }
  return g;
}

function carotte() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 7), mat(0xf07c2a));
  c.rotation.z = Math.PI;
  g.add(c);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 4), mat(0x4caf50));
    f.position.set((i - 1) * 0.1, 0.95, 0); f.rotation.z = (i - 1) * 0.35;
    g.add(f);
  }
  return g;
}

function baguette() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.7, 4, 8), mat(0xd99a4e));
  b.rotation.z = Math.PI / 2;
  g.add(b);
  for (let i = -1; i <= 1; i++) {
    const entaille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.3), mat(0xf3d29b));
    entaille.position.set(i * 0.5, 0.2, 0); entaille.rotation.y = 0.6;
    g.add(entaille);
  }
  return g;
}

function brique() {
  const g = new THREE.Group();
  const corps = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), mat(0xfdfdfd));
  g.add(corps);
  const bande = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.72), mat(0x5aa0e6));
  bande.position.y = -0.05;
  g.add(bande);
  const toit = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 4), mat(0xf2f2f2));
  toit.position.y = 0.72; toit.rotation.y = Math.PI / 4;
  g.add(toit);
  return g;
}

function tomate() {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), mat(0xd9412b));
  t.scale.set(1.1, 0.85, 1.1);
  g.add(t);
  const etoile = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.08, 5), mat(0x3f8f3a));
  etoile.position.y = 0.44;
  g.add(etoile);
  return g;
}

function panier() {
  const g = new THREE.Group();
  const profil = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    profil.push(new THREE.Vector2(1.0 + 0.55 * Math.pow(t, 0.8), -0.8 + 1.4 * t));
  }
  const osier = mat(0xc98b4f, { side: THREE.DoubleSide });
  const bol = new THREE.Mesh(new THREE.LatheGeometry(profil, 14), osier);
  g.add(bol);
  const fond = new THREE.Mesh(new THREE.CircleGeometry(1.0, 14), osier);
  fond.rotation.x = -Math.PI / 2; fond.position.y = -0.8;
  g.add(fond);
  for (let i = 0; i < 3; i++) {
    const tresse = new THREE.Mesh(new THREE.TorusGeometry(1.05 + 0.2 * i, 0.06, 6, 28), mat(0xa86c36));
    tresse.rotation.x = Math.PI / 2; tresse.position.y = -0.55 + 0.42 * i;
    g.add(tresse);
  }
  const bord = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.11, 8, 32), mat(0xa86c36));
  bord.rotation.x = Math.PI / 2; bord.position.y = 0.6;
  g.add(bord);
  const anse = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.1, 8, 24, Math.PI), mat(0xa86c36));
  anse.position.y = 0.6;
  g.add(anse);
  // Ce qui dépasse du panier
  const dedans = [[pomme(), -0.55, 0.75, 0.2], [orange(), 0.45, 0.7, 0.3], [baguette(), 0.1, 1.0, -0.3], [pomme(0x8cc63f), 0.05, 0.6, 0.6]];
  for (const [m, x, y, z] of dedans) {
    m.position.set(x, y, z);
    m.rotation.set(Math.random(), Math.random() * 3, Math.random() * 0.5);
    g.add(m);
  }
  return g;
}

// ── Mise en place ─────────────────────────────────────────────────────

const lePanier = panier();
lePanier.rotation.x = 0.35;
scene.add(lePanier);

const fabriques = [pomme, orange, citron, carotte, baguette, brique, tomate, () => pomme(0x8cc63f), orange, citron, tomate, carotte];
const fruits = fabriques.map((f, i) => {
  const m = f();
  const angle = (i / fabriques.length) * Math.PI * 2;
  m.userData = {
    angle,
    vitesse: 0.08 + Math.random() * 0.06,
    phase: Math.random() * Math.PI * 2,
    tourne: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.8),
    // Place dans la liste : sur les bords, en haut et en bas de l'écran
    bord: new THREE.Vector3((i % 2 ? 1 : -1) * (0.95 + Math.random() * 0.15), -0.9 + (i / fabriques.length) * 1.9, -2 - Math.random() * 3),
  };
  m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
  scene.add(m);
  return m;
});

// Confettis de légumes quand on coche un article
const confettis = [];
const couleursConfettis = [0xe2553c, 0xf59a2f, 0xf6d743, 0x4caf50, 0x5aa0e6];
const geoConfetti = new THREE.TetrahedronGeometry(0.16);

let mode = "connexion";
let premierMode = true;
let melange = 1; // 1 = connexion, 0 = liste ; suit `mode` en douceur
let largeurMonde = 6, hauteurMonde = 8;
let pointeur = { x: 0, y: 0 }, pointeurLisse = { x: 0, y: 0 };
// Bande libre de l'écran de connexion, en fractions de la hauteur : entre le
// texte d'accueil et le formulaire. La page la mesure et nous la donne.
let zone = { haut: 0.3, bas: 0.55 };
// Plus de place pour le panier (formulaire d'inscription sur petit écran) :
// les fruits restent sur les bords, comme dans la liste.
let zoneEtroite = false;

function redimensionner() {
  if (!rendu) return;
  const l = innerWidth, h = innerHeight;
  rendu.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  rendu.setSize(l, h, false);
  camera.aspect = l / h;
  camera.updateProjectionMatrix();
  hauteurMonde = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  largeurMonde = hauteurMonde * camera.aspect;
}
addEventListener("resize", redimensionner);
redimensionner();

addEventListener("pointermove", (e) => {
  pointeur.x = e.clientX / innerWidth - 0.5;
  pointeur.y = e.clientY / innerHeight - 0.5;
}, { passive: true });

let horloge = new THREE.Clock();
let dernier = 0;
let enMarche = false;

function image(t) {
  const dt = Math.min(0.05, horloge.getDelta());
  const cible = mode === "connexion" && !zoneEtroite ? 1 : 0;
  melange += (cible - melange) * Math.min(1, dt * 2.5);
  pointeurLisse.x += (pointeur.x - pointeurLisse.x) * 0.05;
  pointeurLisse.y += (pointeur.y - pointeurLisse.y) * 0.05;

  // Le panier : au centre de la bande libre, à une taille qui y tient
  const yZone = (0.5 - (zone.haut + zone.bas) / 2) * hauteurMonde;
  const hZone = Math.max(1.5, (zone.bas - zone.haut) * hauteurMonde);
  const tailleZone = Math.min(1.25, hZone / 4.2, largeurMonde / 4.6);
  const sPanier = THREE.MathUtils.lerp(0.001, tailleZone, melange);
  lePanier.scale.setScalar(sPanier);
  lePanier.visible = melange > 0.02;
  lePanier.position.set(0, yZone - 0.45 * tailleZone + Math.sin(t * 1.1) * 0.08, 0);
  lePanier.rotation.y = t * 0.35;

  const tailleCo = Math.max(0.55, tailleZone * 0.8);
  const rayonX = Math.min(largeurMonde * 0.4, 4.2);
  const rayonY = hZone * 0.22;
  for (const m of fruits) {
    const u = m.userData;
    const a = u.angle + t * u.vitesse;
    // Position « connexion » : une ronde autour du panier
    const xc = Math.cos(a) * rayonX, yc = yZone + Math.sin(a) * rayonY, zc = Math.sin(a) * 1.5 - 0.5;
    // Position « liste » : rangés sur les bords
    const xl = u.bord.x * largeurMonde * 0.5, yl = u.bord.y * hauteurMonde * 0.5 + Math.sin(t * 0.6 + u.phase) * 0.25, zl = u.bord.z;
    m.position.set(
      THREE.MathUtils.lerp(xl, xc, melange),
      THREE.MathUtils.lerp(yl, yc, melange) + Math.sin(t * 1.3 + u.phase) * 0.12,
      THREE.MathUtils.lerp(zl, zc, melange),
    );
    m.scale.setScalar(THREE.MathUtils.lerp(0.6, tailleCo, melange) * (u.rebond ? 1 + Math.sin(u.rebond * Math.PI) * 0.5 : 1));
    if (u.rebond) { u.rebond += dt * 2.2; if (u.rebond >= 1) u.rebond = 0; }
    m.rotation.x += u.tourne.x * dt;
    m.rotation.y += u.tourne.y * dt;
  }

  for (let i = confettis.length - 1; i >= 0; i--) {
    const c = confettis[i];
    c.userData.v.y -= 9 * dt;
    c.position.addScaledVector(c.userData.v, dt);
    c.rotation.x += 5 * dt; c.rotation.z += 4 * dt;
    c.userData.vie -= dt;
    c.material.opacity = Math.max(0, c.userData.vie / 1.2);
    if (c.userData.vie <= 0) {
      scene.remove(c); c.material.dispose(); confettis.splice(i, 1);
    }
  }

  camera.position.x = pointeurLisse.x * 0.8;
  camera.position.y = -pointeurLisse.y * 0.6;
  camera.lookAt(0, 0, 0);
  rendu.render(scene, camera);
}

function boucle(ms) {
  if (!enMarche) return;
  requestAnimationFrame(boucle);
  // Dans la liste, 30 images par seconde suffisent pour un décor qui dérive
  const pas = mode === "connexion" || confettis.length ? 0 : 1000 / 30 - 2;
  if (ms - dernier < pas) return;
  dernier = ms;
  image(ms / 1000);
}

function demarrer() {
  if (!rendu || enMarche) return;
  if (moinsAnimer) { melange = mode === "connexion" ? 1 : 0; image(0); return; }
  enMarche = true;
  horloge.getDelta();
  requestAnimationFrame(boucle);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) enMarche = false; else demarrer();
});

export const decor = {
  demarrer,
  zone(haut, bas) {
    zone = { haut, bas };
    zoneEtroite = bas - haut < 0.12;
    if (moinsAnimer && rendu) image(0);
  },
  mode(m) {
    // Au premier affichage, pas de transition : on arrive directement au bon décor
    if (premierMode) { premierMode = false; melange = m === "connexion" ? 1 : 0; }
    mode = m;
    if (moinsAnimer && rendu) { melange = m === "connexion" ? 1 : 0; image(0); }
  },
  // Petite fête : un fruit rebondit et des confettis jaillissent du bas
  celebrer(xEcran = 0.5, yEcran = 0.8) {
    if (!rendu || moinsAnimer) return;
    const f = fruits[Math.floor(Math.random() * fruits.length)];
    f.userData.rebond = 0.001;
    const x = (xEcran - 0.5) * largeurMonde, y = (0.5 - yEcran) * hauteurMonde;
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(geoConfetti, mat(couleursConfettis[i % couleursConfettis.length], { transparent: true }));
      c.position.set(x, y, 1);
      const a = Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const v = 5 + Math.random() * 4;
      c.userData = { v: new THREE.Vector3(Math.cos(a) * v, Math.sin(a) * v, (Math.random() - 0.5) * 2), vie: 1.2 };
      scene.add(c);
      confettis.push(c);
    }
  },
};
