// Classification des trouvailles d'archives de magazines en fiches
// « lunette vintage » : marque/modèle devinés par correspondance de mots-clés
// dans le texte OCR/titre, année extraite de la date de publication.
//
// IMPORTANT — ce que ce module fait et ne fait PAS :
//   - Il repère des pages de magazines PROBABLES (texte OCR ou légende
//     mentionnant des lunettes / une marque connue). C'est une détection
//     textuelle, pas une détection visuelle.
//   - Il ne « voit » pas l'image et ne sait pas si des lunettes sont
//     réellement visibles sur la page — cela demanderait un détecteur
//     d'objets entraîné (ex. YOLO fine-tuné sur des montures), que nous
//     n'avons pas ici. Chaque fiche porte un champ `confidence` qui reflète
//     cette limite : une revue humaine reste nécessaire avant publication.

export const KNOWN_BRANDS = [
  'Ray-Ban', 'Rayban', 'Persol', 'Cartier', 'Dior', 'Christian Dior',
  'Saint Laurent', 'Yves Saint Laurent', 'YSL', 'Chloé', 'Chloe',
  'Celine', 'Céline', 'Mykita', 'Moscot', 'Oliver Peoples', 'Vuarnet',
  'Silhouette', 'Lindberg', 'Tom Ford', 'Prada', 'Gucci', 'Balenciaga',
  'Bausch & Lomb', 'American Optical', 'Metzler', 'Rodenstock',
  'Essilor', 'Alain Mikli', 'Mikli', 'Lafont', 'Lissac'
];

const SHAPE_KEYWORDS = [
  ['cat-eye', /cat[\s-]?eye|papillon|œil[\s-]?de[\s-]?chat/i],
  ['aviator', /aviator|aviateur|pilote/i],
  ['browline', /browline|clubmaster/i],
  ['butterfly', /butterfly/i],
  ['round', /\bround\b|rondes?\b/i],
  ['square', /\bsquare\b|carrées?\b/i],
  ['oval', /\boval(es?)?\b/i],
  ['oversize', /oversiz|surdimension/i],
  ['rectangular', /rectangulaires?\b/i],
];

const EYEWEAR_TERMS = /lunettes?|eyeglasses|sunglasses|spectacles|glasses|montures?|verres?\s+(de\s+)?soleil/i;

export function looksLikeEyewear(text) {
  return EYEWEAR_TERMS.test(text ?? '');
}

export function guessBrand(text) {
  if (!text) return null;
  for (const brand of KNOWN_BRANDS) {
    const re = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) return brand;
  }
  return null;
}

export function guessShape(text) {
  if (!text) return null;
  for (const [shape, re] of SHAPE_KEYWORDS) {
    if (re.test(text)) return shape;
  }
  return null;
}

export function extractYear(dateLike) {
  if (!dateLike) return null;
  const match = String(dateLike).match(/(1[89]\d{2}|20[0-2]\d)/);
  return match ? Number(match[1]) : null;
}

// Construit une fiche normalisée, commune aux deux agents (archive.org et
// Gallica), directement compatible avec Magazine/Glasses.magazineFeatures
// une fois validée par un humain.
export function buildVintageRecord({
  source, sourceUrl, magazine, issueDate, imageUrl, matchedText, hasKnownBrandMatch
}) {
  const brandGuess = guessBrand(matchedText) ?? guessBrand(magazine);
  const shapeGuess = guessShape(matchedText);
  const year = extractYear(issueDate);

  return {
    source,
    sourceUrl,
    magazine,
    issueDate: issueDate ?? null,
    year,
    imageUrl,
    brandGuess,
    shapeGuess,
    matchedText: matchedText?.slice(0, 280) ?? null,
    // 'brand-match' : un nom de marque connu a été repéré dans le texte —
    //   fiabilité correcte, mais toujours à confirmer visuellement.
    // 'keyword-match' : seulement un terme générique ("lunettes"...) —
    //   fiabilité faible, la page peut ne pas contenir de lunettes du tout.
    confidence: brandGuess || hasKnownBrandMatch ? 'brand-match' : 'keyword-match',
    needsHumanReview: true
  };
}
