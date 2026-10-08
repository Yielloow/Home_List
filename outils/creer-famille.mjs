// Crée une famille et son code d'invitation dans Firestore, avec les droits
// du compte connecté à la CLI Firebase (les règles ne s'appliquent pas à lui).
// Usage : npx firebase-tools login (une fois), puis
//   node outils/creer-famille.mjs "Famille Dupont" DUPO
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { randomInt, randomBytes } from "node:crypto";

const [nom, prefixe] = process.argv.slice(2);
const PROJET = "home-list-cb734";
const jeton = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, "utf8")).tokens.access_token;
const base = `https://firestore.googleapis.com/v1/projects/${PROJET}/databases/(default)/documents`;
const entetes = { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans 0/O, 1/I/L
const alea = (n) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const code = (prefixe.toUpperCase().replace(/[^A-Z]/g, "") + "XXXX").slice(0, 4) + alea(8);
const famille = randomBytes(10).toString("hex");

async function creer(chemin, champs) {
  const fields = Object.fromEntries(Object.entries(champs).map(([k, v]) =>
    [k, typeof v === "number" ? { integerValue: String(v) } : { stringValue: v }]));
  const [col, id] = chemin.split("/");
  // currentDocument.exists=false : échoue plutôt que d'écraser un code existant
  const r = await fetch(`${base}/${col}?documentId=${id}`, { method: "POST", headers: entetes, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${chemin} : ${r.status} ${await r.text()}`);
}

await creer(`familles/${famille}`, { nom, code, creeLe: Date.now() });
await creer(`codes/${code}`, { famille });
console.log(JSON.stringify({ famille, code: code.match(/.{4}/g).join("-") }));

// État des anciennes fiches membres (créées avant les familles)
const r = await fetch(`${base}/membres?pageSize=50`, { headers: entetes });
const j = await r.json();
console.log("membres existants :", (j.documents || []).map((d) => ({ uid: d.name.split("/").pop(), champs: Object.keys(d.fields || {}) })));
