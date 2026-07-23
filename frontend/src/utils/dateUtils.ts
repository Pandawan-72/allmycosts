// Petits utilitaires de date au format ISO (YYYY-MM-DD), utilisés pour les
// dépenses ponctuelles et la validation de dates dans les formulaires.

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !isNaN(d.getTime());
}

// Noms des mois abrégés (3-4 lettres), pour les 8 langues de l'app.
// Utilisé à la place de toLocaleDateString, dont le rendu dépend du moteur
// JS natif et peut être incohérent entre Android/iOS/langues installées.
const MONTH_NAMES: Record<string, string[]> = {
  fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."],
  es: ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."],
  it: ["gen.", "feb.", "mar.", "apr.", "mag.", "giu.", "lug.", "ago.", "set.", "ott.", "nov.", "dic."],
  pt: ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."],
  nl: ["jan.", "feb.", "mrt.", "apr.", "mei", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "dec."],
  ru: ["янв.", "февр.", "март", "апр.", "май", "июнь", "июль", "авг.", "сент.", "окт.", "нояб.", "дек."],
};

// Retourne le nom abrégé du mois (0-11) dans la langue donnée, avec repli sur l'anglais.
export function monthShortName(month: number, lang: string): string {
  const list = MONTH_NAMES[lang] || MONTH_NAMES.en;
  return list[month] || "";
}

// Retourne "mois année" (ex: "juin 2026") dans la langue donnée.
export function monthYearLabel(year: number, month: number, lang: string): string {
  return `${monthShortName(month, lang)} ${year}`;
}
