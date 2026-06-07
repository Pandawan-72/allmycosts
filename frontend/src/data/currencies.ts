export type Currency = { code: string; symbol: string; name: string };

export const CURRENCIES: Currency[] = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "Dollar US" },
  { code: "GBP", symbol: "£", name: "Livre Sterling" },
  { code: "CHF", symbol: "CHF", name: "Franc Suisse" },
  { code: "CAD", symbol: "CA$", name: "Dollar Canadien" },
  { code: "AUD", symbol: "A$", name: "Dollar Australien" },
  { code: "JPY", symbol: "¥", name: "Yen Japonais" },
  { code: "CNY", symbol: "¥", name: "Yuan Chinois" },
  { code: "INR", symbol: "₹", name: "Roupie Indienne" },
  { code: "BRL", symbol: "R$", name: "Real Brésilien" },
  { code: "MXN", symbol: "Mex$", name: "Peso Mexicain" },
  { code: "RUB", symbol: "₽", name: "Rouble Russe" },
  { code: "KRW", symbol: "₩", name: "Won Sud-Coréen" },
  { code: "SGD", symbol: "S$", name: "Dollar de Singapour" },
  { code: "HKD", symbol: "HK$", name: "Dollar de Hong Kong" },
  { code: "NZD", symbol: "NZ$", name: "Dollar Néo-Zélandais" },
  { code: "SEK", symbol: "kr", name: "Couronne Suédoise" },
  { code: "NOK", symbol: "kr", name: "Couronne Norvégienne" },
  { code: "DKK", symbol: "kr", name: "Couronne Danoise" },
  { code: "PLN", symbol: "zł", name: "Złoty Polonais" },
  { code: "CZK", symbol: "Kč", name: "Couronne Tchèque" },
  { code: "HUF", symbol: "Ft", name: "Forint Hongrois" },
  { code: "TRY", symbol: "₺", name: "Livre Turque" },
  { code: "ZAR", symbol: "R", name: "Rand Sud-Africain" },
  { code: "AED", symbol: "د.إ", name: "Dirham des Émirats" },
  { code: "SAR", symbol: "﷼", name: "Riyal Saoudien" },
  { code: "ILS", symbol: "₪", name: "Shekel Israélien" },
  { code: "THB", symbol: "฿", name: "Baht Thaïlandais" },
  { code: "IDR", symbol: "Rp", name: "Roupie Indonésienne" },
  { code: "MYR", symbol: "RM", name: "Ringgit Malaisien" },
  { code: "PHP", symbol: "₱", name: "Peso Philippin" },
  { code: "VND", symbol: "₫", name: "Dong Vietnamien" },
  { code: "ARS", symbol: "AR$", name: "Peso Argentin" },
  { code: "CLP", symbol: "CL$", name: "Peso Chilien" },
  { code: "COP", symbol: "CO$", name: "Peso Colombien" },
  { code: "EGP", symbol: "E£", name: "Livre Égyptienne" },
  { code: "NGN", symbol: "₦", name: "Naira Nigérian" },
  { code: "MAD", symbol: "DH", name: "Dirham Marocain" },
  { code: "TND", symbol: "د.ت", name: "Dinar Tunisien" },
  { code: "DZD", symbol: "DA", name: "Dinar Algérien" },
  { code: "XOF", symbol: "CFA", name: "Franc CFA (BCEAO)" },
  { code: "XAF", symbol: "FCFA", name: "Franc CFA (BEAC)" },
];

const REGION_TO_CURRENCY: Record<string, string> = {
  FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", BE: "EUR", NL: "EUR", PT: "EUR", AT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
  US: "USD", GB: "GBP", CH: "CHF", CA: "CAD", AU: "AUD", JP: "JPY", CN: "CNY", IN: "INR", BR: "BRL", MX: "MXN", RU: "RUB", KR: "KRW",
  SG: "SGD", HK: "HKD", NZ: "NZD", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", TR: "TRY", ZA: "ZAR",
  AE: "AED", SA: "SAR", IL: "ILS", TH: "THB", ID: "IDR", MY: "MYR", PH: "PHP", VN: "VND", AR: "ARS", CL: "CLP", CO: "COP",
  EG: "EGP", NG: "NGN", MA: "MAD", TN: "TND", DZ: "DZD", SN: "XOF", CI: "XOF", CM: "XAF", GA: "XAF",
};

export function currencyForRegion(region?: string | null): string {
  if (!region) return "EUR";
  return REGION_TO_CURRENCY[region.toUpperCase()] || "EUR";
}

export function findCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

export function formatAmount(amount: number, code: string): string {
  const cur = findCurrency(code);
  const formatted = amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${cur.symbol}`;
}
