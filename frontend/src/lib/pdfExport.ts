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
  const SIZE = 140, STROKE = 20, R = (SIZE - STROKE) / 2, CX = SIZE / 2, CY = SIZE / 2, CIRC = 2 * Math.PI * R;
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
  const CW = 520, CH = 80, BW = 30, BG = (CW - 12 * BW) / 13;
  const chartBars = data.monthlyChart.map((d, i) => {
    const bh = Math.max((d.value / chartMax) * CH, 2);
    const bx = BG + i * (BW + BG);
    const by = CH - bh;
    const isLast = i === 11;
    const fill = isLast ? "#10B981" : "#E5E7EB";
    const valLabel = isLast ? `<text x="${(bx + BW / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" font-size="8" fill="#10B981" text-anchor="middle" font-family="sans-serif" font-weight="bold">${formatAmount(d.value, baseCurrency)}</text>` : "";
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${BW}" height="${bh.toFixed(1)}" rx="4" fill="${fill}"/><text x="${(bx + BW / 2).toFixed(1)}" y="${(CH + 14).toFixed(1)}" font-size="8" fill="#9CA3AF" text-anchor="middle" font-family="sans-serif">${d.label}</text>${valLabel}`;
  }).join("");
  const chartSvg = `<svg width="100%" height="${CH + 20}" viewBox="0 0 ${CW} ${CH + 20}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${chartBars}</svg>`;

  if (data.rows.length === 0) {
    return `<h1 class="section-title">${escapeHtml(title)}</h1>
      <p class="empty-msg">—</p>`;
  }

  return `<h1 class="section-title">${escapeHtml(title)}</h1>

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
        <svg width="140" height="140" viewBox="0 0 140 140">
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
  `;
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
  installedAt?: string;
  monthlyIncome: number;
  incomeOverrides: Record<string, number>;
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
    savingsTitle: string;
    savingsTotal12: string;
    savingsAvg: string;
    savingsDetail: string;
    savingsNoData: string;
  };
}): string {
  const { subscriptions, expenses, customCategories, baseCurrency, convert, t, monthLabel, userName, logoB64, generatedOn, installedAt, monthlyIncome, incomeOverrides, i18nText } = params;

  // ─── Calcul épargne 12 derniers mois ───────────────────────────────────
  const savingsRows: { label: string; value: number }[] = [];
  const now = new Date();
  const installDate = installedAt ? new Date(installedAt) : null;
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    if (installDate && (y < installDate.getFullYear() || (y === installDate.getFullYear() && m < installDate.getMonth()))) continue;
    const monthEnd = new Date(y, m + 1, 0);
    let recurringTotal = 0;
    for (const s of subscriptions) {
      const createdAt = new Date(s.createdAt);
      if (createdAt <= monthEnd) {
        const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
        recurringTotal += convert(monthly, s.currency, baseCurrency);
      }
    }
    let oneoffTotal = 0;
    for (const e of expenses) {
      const ed = new Date(e.date);
      if (ed.getFullYear() === y && ed.getMonth() === m) {
        oneoffTotal += convert(e.price, e.currency, baseCurrency);
      }
    }
    // On récupère le revenu via monthLabel qui encode year-month
    const overrideKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const income = incomeOverrides[overrideKey] !== undefined ? incomeOverrides[overrideKey] : monthlyIncome;
    savingsRows.push({ label: monthLabel(y, m), value: income - recurringTotal - oneoffTotal });
  }
  const activeSavingsRows = savingsRows.filter(r => r.value !== 0);
  const totalSavings = activeSavingsRows.reduce((sum, r) => sum + r.value, 0);
  const avgSavings = activeSavingsRows.length > 0 ? totalSavings / activeSavingsRows.length : 0;

  const recurringData = buildSectionData("recurring", subscriptions, expenses, customCategories, baseCurrency, convert, t, monthLabel);
  const oneoffData = buildSectionData("oneoff", subscriptions, expenses, customCategories, baseCurrency, convert, t, monthLabel);
  const combinedData = buildSectionData("combined", subscriptions, expenses, customCategories, baseCurrency, convert, t, monthLabel);

  // ─── HTML section épargne construit avant le template principal ──────────
  let savingsHtml = "";
  if (activeSavingsRows.length === 0) {
    savingsHtml = `<p class="empty-msg">${escapeHtml(i18nText.savingsNoData)}</p>`;
  } else {
    const rowsHtml = activeSavingsRows.map(r => {
      const color = r.value >= 0 ? "#15803D" : "#EF4444";
      const sign = r.value >= 0 ? "+" : "";
      return `<tr style="border-bottom:1px solid #F3F4F6"><td style="padding:8px 4px;font-size:13px;color:#374151">${escapeHtml(r.label)}</td><td style="padding:8px 4px;font-size:13px;font-weight:700;text-align:right;color:${color}">${sign}${formatAmount(r.value, baseCurrency)}</td></tr>`;
    }).join("");
    const totalColor = totalSavings >= 0 ? "#15803D" : "#EF4444";
    const avgColor = avgSavings >= 0 ? "#15803D" : "#EF4444";
    savingsHtml = `<div class="totals"><div class="total-card"><div class="label">${escapeHtml(i18nText.savingsTotal12)}</div><div class="value" style="color:${totalColor}">${formatAmount(totalSavings, baseCurrency)}</div></div><div class="total-card"><div class="label">${escapeHtml(i18nText.savingsAvg)}</div><div class="value" style="color:${avgColor}">${formatAmount(avgSavings, baseCurrency)}</div></div></div><h3 style="font-size:11px;letter-spacing:1.8px;color:#6B7280;font-weight:700;text-transform:uppercase;margin:20px 0 10px 0">${escapeHtml(i18nText.savingsDetail)}</h3><table style="width:100%;border-collapse:collapse">${rowsHtml}</table>`;
  }

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

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <style>
      /* ── Page setup ── */
      @page { size: A4 portrait; margin: 16mm 15mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 12px; }

      /* ── Page wrapper : une page A4 par section ── */
      .page { width: 100%; min-height: 257mm; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; }
      .page:last-child { page-break-after: auto; }

      /* ── Header répété sur chaque page ── */
      .page-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #E5E7EB; margin-bottom: 16px; flex-shrink: 0; }
      .brand-row { display: flex; align-items: center; gap: 10px; }
      .brand-icon { width: 36px; height: 36px; border-radius: 8px; display: block; flex-shrink: 0; }
      .brand-name { font-size: 16px; font-weight: 900; letter-spacing: -0.4px; margin: 0; }
      .brand-sub { font-size: 10px; color: #6B7280; margin: 2px 0 0 0; }
      .page-num { font-size: 9px; color: #9CA3AF; }

      /* ── Titre section ── */
      .section-title { font-size: 18px; font-weight: 900; letter-spacing: -0.4px; margin: 0 0 14px 0; padding-bottom: 8px; border-bottom: 2px solid #111827; flex-shrink: 0; }
      .empty-msg { color: #9CA3AF; font-size: 12px; padding: 8px 0; }

      /* ── Totaux ── */
      .totals { display: flex; gap: 10px; margin: 0 0 16px 0; flex-shrink: 0; }
      .total-card { flex: 1; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 14px; }
      .total-card .label { font-size: 8px; letter-spacing: 1.5px; color: #6B7280; font-weight: 700; text-transform: uppercase; }
      .total-card .value { font-size: 22px; font-weight: 900; color: #111827; letter-spacing: -0.8px; margin-top: 3px; }
      .total-card.dark { background: #111827; border-color: #111827; }
      .total-card.dark .label { color: #9CA3AF; }
      .total-card.dark .value { color: #10B981; }

      /* ── Sous-titres ── */
      h2 { font-size: 9px; letter-spacing: 1.5px; color: #6B7280; font-weight: 700; text-transform: uppercase; margin: 14px 0 8px 0; padding-bottom: 5px; border-bottom: 1px solid #E5E7EB; flex-shrink: 0; }

      /* ── Tables ── */
      table { width: 100%; border-collapse: collapse; }
      thead th { text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #9CA3AF; font-weight: 700; padding: 5px 8px; }
      thead th.num, tbody td.num { text-align: right; }
      tbody td { padding: 8px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; font-size: 11px; }
      tbody tr:last-child td { border-bottom: none; }
      .sub-name { font-weight: 700; color: #111827; font-size: 12px; }
      .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
      td.num { font-weight: 700; color: #111827; white-space: nowrap; }

      /* ── Donut + légende ── */
      .stats { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 8px; }
      .donut-wrap { position: relative; width: 140px; height: 140px; flex-shrink: 0; }
      .donut-center { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .donut-center .label { font-size: 7px; letter-spacing: 1px; color: #6B7280; font-weight: 700; }
      .donut-center .value { font-size: 12px; font-weight: 900; color: #111827; letter-spacing: -0.3px; margin-top: 2px; }
      .legend { flex: 1; min-width: 0; }
      .legend-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #F3F4F6; }
      .legend-row:last-child { border-bottom: none; }
      .legend-label { font-size: 11px; color: #111827; font-weight: 600; }
      .legend-right { text-align: right; }
      .legend-amount { font-size: 11px; font-weight: 700; color: #111827; }
      .legend-pct { font-size: 10px; color: #6B7280; margin-top: 1px; }

      /* ── Graphique barres ── */
      .chart-wrap { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 10px 6px 4px 6px; margin-bottom: 6px; }

      /* ── Footer ── */
      .footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 9px; display: flex; justify-content: space-between; flex-shrink: 0; }
    </style></head><body>

    <div class="page">
      <div class="page-header">
        ${logoBlock}
        <span class="page-num">1 / 4</span>
      </div>
      ${recurringHtml}
      <div class="footer"><span>${escapeHtml(i18nText.footerGenerated)} ${generatedOn}</span><span>${escapeHtml(i18nText.footerCurrency)} : ${baseCurrency}</span></div>
    </div>

    <div class="page">
      <div class="page-header">
        ${logoBlock}
        <span class="page-num">2 / 4</span>
      </div>
      ${oneoffHtml}
      <div class="footer"><span>${escapeHtml(i18nText.footerGenerated)} ${generatedOn}</span><span>${escapeHtml(i18nText.footerCurrency)} : ${baseCurrency}</span></div>
    </div>

    <div class="page">
      <div class="page-header">
        ${logoBlock}
        <span class="page-num">3 / 4</span>
      </div>
      ${combinedHtml}
      <div class="footer"><span>${escapeHtml(i18nText.footerGenerated)} ${generatedOn}</span><span>${escapeHtml(i18nText.footerCurrency)} : ${baseCurrency}</span></div>
    </div>

    <div class="page">
      <div class="page-header">
        ${logoBlock}
        <span class="page-num">4 / 4</span>
      </div>
      <h2 class="section-title">${escapeHtml(i18nText.savingsTitle)}</h2>
      ${savingsHtml}
      <div class="footer"><span>${escapeHtml(i18nText.footerGenerated)} ${generatedOn}</span><span>${escapeHtml(i18nText.footerCurrency)} : ${baseCurrency}</span></div>
    </div>

    </body></html>`;
}
