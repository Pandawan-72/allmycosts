// receiptParser.ts — Extrait nom du commerce, montant total et date depuis le
// texte brut reconnu par l'OCR sur un ticket de caisse.
//
// L'OCR ne comprend pas la structure du ticket : il renvoie juste du texte,
// ligne par ligne. On applique donc des heuristiques simples mais robustes
// pour deviner quelle ligne est quoi — sans garantie à 100%, le formulaire
// reste toujours modifiable manuellement ensuite.

export type ParsedReceipt = {
  merchantName: string | null;
  amount: number | null;
  date: string | null; // format ISO YYYY-MM-DD
};

// Mots-clés FORTS : combinaison "total" + indication de finalité (à payer,
// ttc, due...). Une ligne qui matche un de ces mots-clés est quasi-certaine
// d'être LE total final — on la privilégie toujours en premier.
const STRONG_TOTAL_KEYWORDS = [
  "total a payer", "total à payer", "net a payer", "net à payer", "total ttc",
  "total due", "amount due", "grand total", "balance due",
  "gesamtbetrag", "zu zahlen", "endbetrag",
  "total a pagar", "importe total",
  "totale da pagare", "importo totale",
  "valor total",
  "totaal te betalen", "totaalbedrag",
  "итого к оплате",
];

// Mot-clé faible : juste "total" (ou équivalent) tout seul, sans précision.
// Utilisé en repli si aucune ligne "forte" n'est trouvée, car "total" seul
// peut aussi désigner un total intermédiaire (total HT, total articles...).
const WEAK_TOTAL_KEYWORDS = [
  "total", "montant", "summe", "totale", "totaal", "итого",
];

// Lignes à exclure même si elles contiennent un mot total partiel — ce sont
// des sous-totaux ou lignes intermédiaires, pas le total final du ticket.
const EXCLUDE_KEYWORDS = [
  "sous-total", "sous total", "subtotal", "sub-total",
  "zwischensumme", "subtotale", "subtotaal",
  "промежуточный итог",
];

function normalize(line: string): string {
  return line.trim().toLowerCase();
}

// Extrait le DERNIER montant numérique d'une chaîne (gère virgule et point
// décimal). On prend le dernier plutôt que le premier car sur un ticket, le
// prix est presque toujours aligné à l'extrême droite de la ligne — un code
// article ou une quantité peut apparaître avant lui sur la même ligne.
//
// requireCurrencySymbol : si true, le montant DOIT être immédiatement suivi
// (à quelques caractères près) d'un symbole monétaire (€, $, £, etc.) pour
// être retenu. Ça exclut par construction les pourcentages (20.00 %) et
// autres nombres décimaux qui ne sont pas un prix, sans dépendre d'une
// détection fragile du caractère "%" lui-même (parfois mal lu par l'OCR).
function extractAmount(text: string, requireCurrencySymbol = false): number | null {
  const re = requireCurrencySymbol
    ? /(\d{1,3}(?:[ .]\d{3})*|\d+)[,.](\d{2})\s?(?:€|\$|£|EUR|USD|GBP)\b/g
    : /(\d{1,3}(?:[ .]\d{3})*|\d+)[,.](\d{2})\b/g;
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const integerPart = last[1].replace(/[ .]/g, "");
  const decimalPart = last[2];
  const value = parseFloat(`${integerPart}.${decimalPart}`);
  return isNaN(value) ? null : value;
}

// Cherche le montant total : UNIQUEMENT sur les lignes contenant un mot-clé
// "total" reconnu, en excluant les sous-totaux. Si plusieurs lignes "total"
// sont trouvées (ex: total HT puis total TTC), on garde la dernière — le
// total final apparaît généralement en dernier sur un ticket.
// Cherche un montant sur une ligne donnée, avec repli sur les 2 lignes
// suivantes (au cas où l'OCR aurait séparé libellé et montant qui sont
// pourtant alignés sur la même ligne du ticket physique).
function extractAmountNear(lines: string[], i: number): number | null {
  let amount = extractAmount(lines[i]);
  if (amount === null && i + 1 < lines.length) amount = extractAmount(lines[i + 1]);
  if (amount === null && i + 2 < lines.length) amount = extractAmount(lines[i + 2]);
  return amount;
}

function findAmount(lines: string[]): number | null {
  // Passe 1 : lignes "fortes" (total à payer, total ttc, etc.) — la plus
  // fiable. On garde la DERNIÈRE trouvée si plusieurs (le total final
  // apparaît généralement après d'éventuels sous-totaux dans ce groupe).
  let strongResult: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = normalize(lines[i]);
    if (EXCLUDE_KEYWORDS.some((kw) => line.includes(kw))) continue;
    if (!STRONG_TOTAL_KEYWORDS.some((kw) => line.includes(kw))) continue;
    const amount = extractAmountNear(lines, i);
    if (amount !== null) strongResult = amount;
  }
  if (strongResult !== null) return strongResult;

  // Passe 2 : repli sur le mot "total" seul (ou équivalent), en excluant
  // toujours les sous-totaux. Garde la DERNIÈRE occurrence — sur un ticket,
  // le total final vient généralement après d'éventuels totaux partiels.
  let weakResult: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = normalize(lines[i]);
    if (EXCLUDE_KEYWORDS.some((kw) => line.includes(kw))) continue;
    if (!WEAK_TOTAL_KEYWORDS.some((kw) => line.includes(kw))) continue;
    const amount = extractAmountNear(lines, i);
    if (amount !== null) weakResult = amount;
  }

  return weakResult;
}

// Cherche toutes les dates valides du ticket (formats JJ/MM/AAAA, JJ-MM-AAAA,
// JJ.MM.AAAA) et retourne celle la plus proche de la date du jour du scan —
// un ticket peut contenir plusieurs dates (date d'achat, date d'impression,
// date de validité d'un coupon, etc.), la bonne est presque toujours la plus
// proche d'aujourd'hui.
function findDate(lines: string[]): string | null {
  const dateRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let bestDate: Date | null = null;
  let bestDiff = Infinity;

  for (const line of lines) {
    let match: RegExpExecArray | null;
    dateRegex.lastIndex = 0;
    while ((match = dateRegex.exec(line)) !== null) {
      let [, day, month, year] = match;
      if (year.length === 2) year = `20${year}`;

      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);

      if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) continue;

      const dateObj = new Date(y, m - 1, d);
      dateObj.setHours(0, 0, 0, 0);

      // Ignore les dates trop dans le futur (probable erreur de lecture OCR),
      // tolère un jour d'avance pour les fuseaux horaires.
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (dateObj > tomorrow) continue;

      const diff = Math.abs(dateObj.getTime() - today.getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        bestDate = dateObj;
      }
    }
  }

  if (!bestDate) return null;
  const mm = String(bestDate.getMonth() + 1).padStart(2, "0");
  const dd = String(bestDate.getDate()).padStart(2, "0");
  return `${bestDate.getFullYear()}-${mm}-${dd}`;
}

// Devine le nom du commerce : c'est presque toujours la toute première ligne
// exploitable de l'en-tête du ticket. On limite strictement aux 3 premières
// lignes (au lieu de 5) pour éviter de remonter une ligne d'adresse ou un
// slogan publicitaire situé un peu plus bas dans l'en-tête.
function findMerchantName(lines: string[]): string | null {
  const candidateLines = lines.slice(0, 3);

  for (const line of candidateLines) {
    const trimmed = line.trim();
    if (trimmed.length < 2) continue;

    const digitCount = (trimmed.match(/\d/g) || []).length;
    const letterCount = (trimmed.match(/[a-zA-ZÀ-ÿ]/g) || []).length;

    // Une ligne avec beaucoup plus de chiffres que de lettres est probablement
    // une adresse, un numéro de téléphone, ou un SIRET — pas le nom du commerce.
    if (digitCount > letterCount) continue;
    if (letterCount < 2) continue;

    return trimmed;
  }

  return null;
}

// Dernier repli : sur de nombreux tickets, le total final imprimé est situé
// juste avant la ligne contenant la date/heure d'impression du ticket — qui
// est généralement la toute dernière information imprimée. On cherche cette
// ligne de date, puis on prend le montant le plus proche juste au-dessus.
// Lignes à ignorer car elles ne contiennent jamais un montant final payé :
// taux de TVA (ex: "20.00 %"), mentions de taxes, pourcentages génériques.
function looksLikeTaxOrPercentLine(line: string): boolean {
  if (line.includes("%")) return true;
  if (/\btva\b|\bvat\b|\btax\b|\bmwst\b|\biva\b/.test(line)) return true;
  return false;
}

function findAmountNearDateLine(lines: string[]): number | null {
  const dateRegex = /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/;
  const dateLineIndex = lines.findIndex((l) => dateRegex.test(l));
  if (dateLineIndex === -1) return null;

  // Cherche en remontant depuis la ligne de date (jusqu'à 6 lignes au-dessus,
  // élargi pour sauter d'éventuelles lignes de taxe/pourcentage) le premier
  // montant exploitable, en excluant HT/sous-total/TVA/pourcentages.
  for (let i = dateLineIndex - 1; i >= Math.max(0, dateLineIndex - 6); i--) {
    const rawLine = lines[i];
    const line = normalize(rawLine);
    if (EXCLUDE_KEYWORDS.some((kw) => line.includes(kw))) continue;
    if (looksLikeTaxOrPercentLine(line)) continue;
    const amount = extractAmount(rawLine, true);
    if (amount !== null) return amount;
  }
  return null;
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const amount = findAmount(lines) ?? findAmountNearDateLine(lines);

  return {
    merchantName: findMerchantName(lines),
    amount,
    date: findDate(lines),
  };
}
