// Réduit une photo de téléphone (3 à 8 Mo) à quelque chose de léger.
//
// Deux tailles : la vignette (environ 8 Ko) voyage avec le produit et
// s'affiche dans la liste ; la grande (environ 100 Ko) n'est chargée que
// quand on touche la photo. Les deux sont des data URL JPEG, rangées dans
// Firestore : pas besoin de Firebase Storage, qui n'est plus gratuit.

const GRANDE = 1000;
const VIGNETTE = 220;
const POIDS_MAX = 600_000; // caractères, bien sous la limite de 1 Mo d'un document

export async function preparerPhoto(fichier) {
  const image = await charger(fichier);
  let qualite = 0.72;
  let grande = reduire(image, GRANDE, qualite);
  while (grande.length > POIDS_MAX && qualite > 0.35) {
    qualite -= 0.12;
    grande = reduire(image, GRANDE, qualite);
  }
  const vignette = reduire(image, VIGNETTE, 0.62);
  if (image.close) image.close();
  return { grande, vignette };
}

async function charger(fichier) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(fichier, { imageOrientation: "from-image" });
    } catch { /* certains navigateurs refusent l'option : on passe par <img> */ }
  }
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function reduire(image, cote, qualite) {
  const l = image.width, h = image.height;
  const echelle = Math.min(1, cote / Math.max(l, h));
  const toile = document.createElement("canvas");
  toile.width = Math.round(l * echelle);
  toile.height = Math.round(h * echelle);
  const c = toile.getContext("2d");
  c.imageSmoothingQuality = "high";
  c.drawImage(image, 0, 0, toile.width, toile.height);
  return toile.toDataURL("image/jpeg", qualite);
}
