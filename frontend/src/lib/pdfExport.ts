// pdfExport.ts — Génère le HTML du rapport PDF exporté depuis l'accueil.
// Contient désormais 3 sections à la suite : Récurrent (abonnements),
// Ponctuel (dépenses datées) et Cumulé (les deux combinés), reflétant les
// 3 modes disponibles dans l'écran Statistiques.

import { Subscription, Expense } from "@/src/contexts/SubscriptionsContext";
import { Category, findCategory, getCategoryLabel } from "@/src/data/categories";
import { formatAmount } from "@/src/data/currencies";

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

type Entry = { id: string; name: string; categoryId: string; monthlyAmount: number; createdAt: string };

type SectionData = {
  monthlyTotal: number;
  yearlyTotal: number;
  rows: Entry[];
  segments: { id: string; label: string; color: string; amount: number }[];
  monthlyChart: { label: string; value: number }[];
};

// Convertit subscriptions + expenses en une liste normalisée, pour un mode donné.
function buildEntries(
  mode: "recurring" | "oneoff" | "combined",
  subscriptions: Subscription[],
  expenses: Expense[],
  baseCurrency: string,
  convert: (amount: number, from: string, to: string) => number
): Entry[] {
  const subEntries: Entry[] = subscriptions.map((s) => {
    const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
    return { id: s.id, name: s.name, categoryId: s.categoryId, monthlyAmount: convert(monthly, s.currency, baseCurrency), createdAt: s.createdAt };
  });
  const expEntries: Entry[] = expenses.map((e) => ({
    id: e.id, name: e.name, categoryId: e.categoryId, monthlyAmount: convert(e.price, e.currency, baseCurrency), createdAt: e.date,
  }));
  if (mode === "recurring") return subEntries;
  if (mode === "oneoff") return expEntries;
  return [...subEntries, ...expEntries];
}

// Calcule les données agrégées (total, segments par catégorie, graphique 12 mois)
// pour un mode donné.
function buildSectionData(
  mode: "recurring" | "oneoff" | "combined",
  subscriptions: Subscription[],
  expenses: Expense[],
  customCategories: Category[],
  baseCurrency: string,
  convert: (amount: number, from: string, to: string) => number,
  t: (key: string) => string,
  monthLabel: (year: number, month: number) => string
): SectionData {
  const entries = buildEntries(mode, subscriptions, expenses, baseCurrency, convert);

  let monthlyTotal = 0;
  const catMap = new Map<string, number>();
  for (const e of entries) {
    monthlyTotal += e.monthlyAmount;
    catMap.set(e.categoryId, (catMap.get(e.categoryId) || 0) + e.monthlyAmount);
  }

  const segments = Array.from(catMap.entries())
    .map(([id, amount]) => {
      const cat = findCategory(id, customCategories);
      return { id, label: getCategoryLabel(cat, t), color: cat.color, amount };
    })
    .sort((a, b) => b.amount - a.amount);

  const rows = [...entries].sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  // Évolution 12 mois — recalcul réel par mois (cohérent avec l'écran Stats)
  const now = new Date();
  const monthlyChart = Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    let recurringTotal = 0;
    if (mode === "recurring" || mode === "combined") {
      for (const s of subscriptions) {
        const createdAt = new Date(s.createdAt);
        if (createdAt <= monthEnd) {
          const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
          recurringTotal += convert(monthly, s.currency, baseCurrency);
        }
      }
    }
    let oneoffTotal = 0;
    if (mode === "oneoff" || mode === "combined") {
      for (const e of expenses) {
        const d = new Date(e.date);
        if (d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()) {
          oneoffTotal += convert(e.price, e.currency, baseCurrency);
        }
      }
    }
    return { label: monthLabel(monthDate.getFullYear(), monthDate.getMonth()), value: recurringTotal + oneoffTotal };
  });

  // Total annuel : pour le récurrent, on garde la projection (monthlyTotal × 12),
  // cohérente puisqu'un abonnement actif se répète chaque mois. Pour le ponctuel
  // et le cumulé, une projection n'a pas de sens — on utilise plutôt la somme
  // réelle des 12 derniers mois (déjà calculée pour le graphique d'évolution).
  const realYearlySum = monthlyChart.reduce((sum, m) => sum + m.value, 0);
  const yearlyTotal = mode === "recurring" ? monthlyTotal * 12 : realYearlySum;

  return { monthlyTotal, yearlyTotal, rows, segments, monthlyChart };
}

// Génère le bloc HTML d'une section complète (titre, totaux, table, donut, graphique).
function renderSection(
  title: string,
  data: SectionData,
  baseCurrency: string,
  labels: { entryColumn: string; monthlyCol: string; yearlyCol: string; breakdownTitle: string; evolutionTitle: string; monthlyTotalLabel: string; yearlyTotalLabel: string; last12MonthsLabel: string },
  isEntryRecurring: boolean
): string {
  const SIZE = 200, STROKE = 26, R = (SIZE - STROKE) / 2, CX = SIZE / 2, CY = SIZE / 2, CIRC = 2 * Math.PI * R;
  let acc = 0;
  const donutArcs = data.segments.map((s) => {
    const len = data.monthlyTotal > 0 ? (s.amount / data.monthlyTotal) * CIRC : 0;
    const offset = -acc;
    acc += len;
    return `<circle cx="${CX}" cy="${CY}" r="${R}" stroke="${s.color}" stroke-width="${STROKE}" fill="none" stroke-dasharray="${len.toFixed(2)} ${(CIRC - len).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />`;
  }).join("");

  const rows = data.rows.map((e) => {
    return `<tr>
      <td><div class="sub-name">${escapeHtml(e.name)}</div></td>
      <td class="num">${formatAmount(e.monthlyAmount, baseCurrency)}</td>
      <td class="num">${formatAmount(e.monthlyAmount * 12, baseCurrency)}</td>
    </tr>`;
  }).join("");

  const legend = data.segments.map((s) => {
    const pct = data.monthlyTotal > 0 ? (s.amount / data.monthlyTotal * 100) : 0;
    return `<div class="legend-row">
      <div class="legend-left">
        <span class="dot" style="background:${s.color}"></span>
        <span class="legend-label">${escapeHtml(s.label)}</span>
      </div>
      <div class="legend-right">
        <div class="legend-amount">${formatAmount(s.amount, baseCurrency)}</div>
        <div class="legend-pct">${pct.toFixed(0)}%</div>
      </div>
    </div>`;
  }).join("");

  const chartMax = Math.max(...data.monthlyChart.map((d) => d.value), 0.01);
  const CW = 480, CH = 100, BW = 28, BG = (CW - 12 * BW) / 13;
  const chartBars = data.monthlyChart.map((d, i) => {
    const bh = Math.max((d.value / chartMax) * CH, 2);
    const bx = BG + i * (BW + BG);
    const by = CH - bh;
    const isLast = i === 11;
    const fill = isLast ? "#10B981" : "#E5E7EB";
    const valLabel = isLast ? `<text x="${(bx + BW / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" font-size="8" fill="#10B981" text-anchor="middle" font-family="sans-serif" font-weight="bold">${formatAmount(d.value, baseCurrency)}</text>` : "";
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${BW}" height="${bh.toFixed(1)}" rx="4" fill="${fill}"/><text x="${(bx + BW / 2).toFixed(1)}" y="${(CH + 14).toFixed(1)}" font-size="8" fill="#9CA3AF" text-anchor="middle" font-family="sans-serif">${d.label}</text>${valLabel}`;
  }).join("");
  const chartSvg = `<svg width="${CW}" height="${CH + 20}" viewBox="0 0 ${CW} ${CH + 20}" xmlns="http://www.w3.org/2000/svg">${chartBars}</svg>`;

  if (data.rows.length === 0) {
    return `<div class="section-block">
      <h1 class="section-title">${escapeHtml(title)}</h1>
      <p class="empty-msg">—</p>
    </div>`;
  }

  return `<div class="section-block">
    <h1 class="section-title">${escapeHtml(title)}</h1>

    <div class="totals">
      <div class="total-card">
        <div class="label">${escapeHtml(labels.monthlyTotalLabel)}</div>
        <div class="value">${formatAmount(data.monthlyTotal, baseCurrency)}</div>
      </div>
      <div class="total-card dark">
        <div class="label">${escapeHtml(isEntryRecurring ? labels.yearlyTotalLabel : labels.last12MonthsLabel)}</div>
        <div class="value">${formatAmount(data.yearlyTotal, baseCurrency)}</div>
      </div>
    </div>

    <h2>${escapeHtml(labels.entryColumn)}</h2>
    <table>
      <thead><tr>
        <th>${escapeHtml(labels.entryColumn)}</th>
        <th class="num">${escapeHtml(labels.monthlyCol)}</th>
        <th class="num">${escapeHtml(labels.yearlyCol)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <h2>${escapeHtml(labels.breakdownTitle)}</h2>
    <div class="stats">
      <div class="donut-wrap">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <g transform="rotate(-90 ${CX} ${CY})">
            <circle cx="${CX}" cy="${CY}" r="${R}" stroke="#F3F4F6" stroke-width="${STROKE}" fill="none" />
            ${donutArcs}
          </g>
        </svg>
        <div class="donut-center">
          <div class="label">${escapeHtml(labels.monthlyTotalLabel)}</div>
          <div class="value">${formatAmount(data.monthlyTotal, baseCurrency)}</div>
        </div>
      </div>
      <div class="legend">${legend}</div>
    </div>

    <h2>${escapeHtml(labels.evolutionTitle)}</h2>
    <div class="chart-wrap">${chartSvg}</div>
  </div>`;
}

export function buildPdfHtml(params: {
  subscriptions: Subscription[];
  expenses: Expense[];
  customCategories: Category[];
  baseCurrency: string;
  convert: (amount: number, from: string, to: string) => number;
  t: (key: string) => string;
  monthLabel: (year: number, month: number) => string;
  userName: string;
  logoB64: string | null;
  generatedOn: string;
  i18nText: {
    appName: string;
    recurringTitle: string;
    oneoffTitle: string;
    combinedTitle: string;
    entryColumnSub: string;
    entryColumnExp: string;
    entryColumnCombined: string;
    monthlyCol: string;
    yearlyCol: string;
    breakdownTitle: string;
    evolutionTitle: string;
    monthlyTotalLabel: string;
    yearlyTotalLabel: string;
    last12MonthsLabel: string;
    footerGenerated: string;
    footerCurrency: string;
  };
}): string {
  const { subscriptions, expenses, customCategories, baseCurrency, convert, t, monthLabel, userName, logoB64, generatedOn, i18nText } = params;

  const recurringData = buildSectionData("recurring", subscriptions, expenses, customCategories, baseCurrency, convert, t, monthLabel);
  const oneoffData = buildSectionData("oneoff", subscriptions, expenses, customCategories, baseCurrency, convert, t, monthLabel);
  const combinedData = buildSectionData("combined", subscriptions, expenses, customCategories, baseCurrency, convert, t, monthLabel);

  const recurringHtml = renderSection(i18nText.recurringTitle, recurringData, baseCurrency, {
    entryColumn: i18nText.entryColumnSub, monthlyCol: i18nText.monthlyCol, yearlyCol: i18nText.yearlyCol,
    breakdownTitle: i18nText.breakdownTitle, evolutionTitle: i18nText.evolutionTitle,
    monthlyTotalLabel: i18nText.monthlyTotalLabel, yearlyTotalLabel: i18nText.yearlyTotalLabel, last12MonthsLabel: i18nText.last12MonthsLabel,
  }, true);

  const oneoffHtml = renderSection(i18nText.oneoffTitle, oneoffData, baseCurrency, {
    entryColumn: i18nText.entryColumnExp, monthlyCol: i18nText.monthlyCol, yearlyCol: i18nText.yearlyCol,
    breakdownTitle: i18nText.breakdownTitle, evolutionTitle: i18nText.evolutionTitle,
    monthlyTotalLabel: i18nText.monthlyTotalLabel, yearlyTotalLabel: i18nText.yearlyTotalLabel, last12MonthsLabel: i18nText.last12MonthsLabel,
  }, false);

  const combinedHtml = renderSection(i18nText.combinedTitle, combinedData, baseCurrency, {
    entryColumn: i18nText.entryColumnCombined, monthlyCol: i18nText.monthlyCol, yearlyCol: i18nText.yearlyCol,
    breakdownTitle: i18nText.breakdownTitle, evolutionTitle: i18nText.evolutionTitle,
    monthlyTotalLabel: i18nText.monthlyTotalLabel, yearlyTotalLabel: i18nText.yearlyTotalLabel, last12MonthsLabel: i18nText.last12MonthsLabel,
  }, false);

  const logoBlock = logoB64
    ? `<div class="brand-row">
         <img class="brand-icon" src="data:image/png;base64,${logoB64}" alt="" />
         <div>
           <h1 class="brand-name">${escapeHtml(i18nText.appName)}</h1>
           <p class="brand-sub">${escapeHtml(userName)}</p>
         </div>
       </div>`
    : `<div class="brand-row">
         <div>
           <h1 class="brand-name">${escapeHtml(i18nText.appName)}</h1>
           <p class="brand-sub">${escapeHtml(userName)}</p>
         </div>
       </div>`;

  return `<!doctype html><html><head><meta charset="utf-8" />
    <style>
      @page { margin: 28px 32px; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        color: #111827; margin: 0; padding: 0;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .header { padding-bottom: 18px; border-bottom: 1px solid #E5E7EB; }
      .brand-row { display: flex; align-items: center; gap: 16px; }
      .brand-icon { width: 56px; height: 56px; border-radius: 12px; display: block; flex-shrink: 0; }
      .brand-name { font-size: 24px; font-weight: 900; letter-spacing: -0.6px; margin: 0; }
      .brand-sub { font-size: 12px; color: #6B7280; margin: 4px 0 0 0; }

      .section-block { margin-top: 30px; page-break-inside: avoid; }
      .section-block:first-of-type { margin-top: 24px; }
      .section-title {
        font-size: 18px; font-weight: 900; letter-spacing: -0.4px; margin: 0 0 14px 0;
        padding-bottom: 10px; border-bottom: 2px solid #111827;
      }
      .empty-msg { color: #9CA3AF; font-size: 13px; padding: 8px 0 20px 0; }

      .totals { display: flex; gap: 14px; margin: 0 0 24px 0; }
      .total-card {
        flex: 1; background: #F9FAFB; border: 1px solid #E5E7EB;
        border-radius: 14px; padding: 18px 20px;
      }
      .total-card .label { font-size: 10px; letter-spacing: 1.8px; color: #6B7280; font-weight: 700; }
      .total-card .value { font-size: 28px; font-weight: 900; color: #111827; letter-spacing: -1px; margin-top: 6px; }
      .total-card.dark { background: #111827; border-color: #111827; }
      .total-card.dark .label { color: #9CA3AF; }
      .total-card.dark .value { color: #10B981; }

      h2 {
        font-size: 11px; letter-spacing: 1.8px; color: #6B7280; font-weight: 700; text-transform: uppercase;
        margin: 24px 0 14px 0; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB;
      }

      table { width: 100%; border-collapse: collapse; }
      thead th {
        text-align: left; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase;
        color: #9CA3AF; font-weight: 700; padding: 6px 10px;
      }
      thead th.num, tbody td.num { text-align: right; }
      tbody td { padding: 12px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; font-size: 13px; }
      tbody tr:last-child td { border-bottom: none; }
      .sub-name { font-weight: 700; color: #111827; font-size: 14px; }
      .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
      td.num { font-weight: 700; color: #111827; white-space: nowrap; }

      .stats { display: flex; gap: 28px; align-items: center; }
      .donut-wrap { position: relative; width: 200px; height: 200px; flex-shrink: 0; }
      .donut-center { position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                      display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .donut-center .label { font-size: 9px; letter-spacing: 1.5px; color: #6B7280; font-weight: 700; }
      .donut-center .value { font-size: 16px; font-weight: 900; color: #111827; letter-spacing: -0.5px; margin-top: 4px; }
      .legend { flex: 1; }
      .legend-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #F3F4F6; }
      .legend-row:last-child { border-bottom: none; }
      .legend-label { font-size: 13px; color: #111827; font-weight: 600; }
      .legend-right { text-align: right; }
      .legend-amount { font-size: 13px; font-weight: 700; color: #111827; }
      .legend-pct { font-size: 11px; color: #6B7280; margin-top: 2px; }

      .chart-wrap { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px 8px 4px 8px; margin-bottom: 8px; }
      .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #E5E7EB;
                color: #9CA3AF; font-size: 10px; display: flex; justify-content: space-between; }
    </style></head><body>

    <div class="header">
      ${logoBlock}
    </div>

    ${recurringHtml}
    ${oneoffHtml}
    ${combinedHtml}

    <div class="footer">
      <span>${escapeHtml(i18nText.footerGenerated)} ${generatedOn}</span>
      <span>${escapeHtml(i18nText.footerCurrency)} : ${baseCurrency}</span>
    </div>

    </body></html>`;
}
