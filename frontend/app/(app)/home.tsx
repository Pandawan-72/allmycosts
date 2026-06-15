import { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import * as Icons from "lucide-react-native";
import { BrandLockup } from "@/src/components/BrandLockup";
import { IncomeEditorModal } from "@/src/components/IncomeEditorModal";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { findCategory, DEFAULT_CATEGORIES, getCategoryLabel } from "@/src/data/categories";
import { findCurrency, formatAmount } from "@/src/data/currencies";
import { useFxRatesEUR } from "@/src/hooks/useFxRates";
import { confirmAction } from "@/src/utils/confirm";
import { getBrandLogoBase64 } from "@/src/utils/brandLogoBase64";
import { useTranslation } from "react-i18next";

const FREE_SUB_LIMIT = 5;

function CatIcon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  const Cmp = (Icons as any)[name] || (Icons as any).Tag;
  return <Cmp color={color} size={size} strokeWidth={2} />;
}

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscriptions, customCategories, baseCurrency, deleteSubscription, monthlyIncome } = useSubscriptions();
  const { convert } = useFxRatesEUR();
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);

  const allCats = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  const totalsCurrency = findCurrency(baseCurrency);

  // Convert all subscriptions to base currency via FX rates
  const totals = useMemo(() => {
    let m = 0;
    for (const s of subscriptions) {
      const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
      const conv = convert(monthly, s.currency, baseCurrency);
      m += conv;
    }
    return { monthly: m, yearly: m * 12 };
  }, [subscriptions, baseCurrency, convert]);

  const monthlyTotal = totals.monthly;
  const yearlyTotal = totals.yearly;

  // Remaining budget (income - subscriptions cost), scaled to current toggle view.
  const displayedRemaining = useMemo(() => {
    if (view === "monthly") return monthlyIncome - monthlyTotal;
    return monthlyIncome * 12 - yearlyTotal;
  }, [view, monthlyIncome, monthlyTotal, yearlyTotal]);
  const isOverBudget = monthlyIncome > 0 && displayedRemaining < 0;
  const totalAmount = view === "monthly" ? monthlyTotal : yearlyTotal;

  const isPro = !!user?.pro?.is_pro;
  const isTrialing = user?.pro?.plan === "trialing";
  const trialExpired = user?.pro?.plan === "expired" || (user?.pro?.plan === "free" && !!user?.pro?.has_used_trial);
  const trialHoursLeft = (() => {
    const te = user?.pro?.trial_end;
    if (!te || !isTrialing) return 0;
    return Math.max(0, Math.ceil((new Date(te).getTime() - Date.now()) / 3600000));
  })();
  const trialDaysLeft = Math.ceil(trialHoursLeft / 24);
  const showPaywallGate = !isPro;

  const lockedSubIds = useMemo(() => {
    if (isPro) return new Set<string>();
    return new Set(subscriptions.slice(FREE_SUB_LIMIT).map((s) => s.id));
  }, [subscriptions, isPro]);

  useEffect(() => {
    if (isTrialing && trialDaysLeft <= 2 && trialDaysLeft > 0) {
      Alert.alert(
        t("paywall.trialEndingTitle"),
        t("paywall.trialEndingBody"),
        [
          { text: t("common.later"), style: "cancel" },
          { text: t("paywall.goProNow"), onPress: () => router.push("/(app)/paywall") },
        ]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ============================================================================
   *  CANONICAL PDF EXPORT — LOCKED AS OF 2025-06-15
   * ----------------------------------------------------------------------------
   *  This template was validated by the user and MUST NOT be altered unless they
   *  explicitly request a layout change. The locked structure is:
   *    1. Header: logo + "All My Costs" + user name (NO Stats/PDF/Settings icons,
   *       NO date in the top corner)
   *    2. Two totals cards side-by-side: TOTAL MENSUEL (light) + TOTAL ANNUEL
   *       (dark, green value)
   *    3. "Détail des abonnements" table — one row per subscription, columns:
   *       name + category (colored dot, NO app icon) | Monthly | Annual
   *    4. "Répartition par catégorie" — SVG donut chart + legend (amount + %)
   *    5. Footer: "Généré le <date>" + "Devise : <code>"
   *
   *  WEB rendering MUST use the iframe + window.print() trick below so the
   *  browser prints THIS HTML and not the current home page. Do NOT remove that
   *  branch.
   *
   *  Reference snapshot: /app/memory/pdf_template_locked.md
   * ============================================================================
   */
  const exportPdf = async () => {
    if (!isPro) {
      router.push("/(app)/paywall");
      return;
    }
    if (subscriptions.length === 0) {
      if (Platform.OS === "web") window.alert("Ajoutez d'abord des abonnements pour exporter un PDF.");
      else Alert.alert("Aucun abonnement", "Ajoutez d'abord des abonnements pour exporter un PDF.");
      return;
    }

    // ----- Aggregate per category (in base currency) -----
    const catMap = new Map<string, number>();
    let monthlyBase = 0;
    for (const s of subscriptions) {
      const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
      const base = convert(monthly, s.currency, baseCurrency);
      monthlyBase += base;
      catMap.set(s.categoryId, (catMap.get(s.categoryId) || 0) + base);
    }
    const yearlyBase = monthlyBase * 12;
    const segments = Array.from(catMap.entries())
      .map(([id, amount]) => {
        const cat = findCategory(id, customCategories);
        return { id, label: getCategoryLabel(cat, t), color: cat.color, amount };
      })
      .sort((a, b) => b.amount - a.amount);

    // ----- SVG donut -----
    const SIZE = 200;
    const STROKE = 26;
    const R = (SIZE - STROKE) / 2;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const CIRC = 2 * Math.PI * R;
    let acc = 0;
    const donutArcs = segments.map((s) => {
      const len = monthlyBase > 0 ? (s.amount / monthlyBase) * CIRC : 0;
      const offset = -acc;
      acc += len;
      return `<circle cx="${CX}" cy="${CY}" r="${R}" stroke="${s.color}" stroke-width="${STROKE}" fill="none" stroke-dasharray="${len.toFixed(2)} ${(CIRC - len).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />`;
    }).join("");

    // ----- Subscription rows (sorted by monthly cost desc, all in base currency) -----
    const subsSorted = [...subscriptions].sort((a, b) => {
      const aM = (a.cycle === "monthly" ? a.price : a.price / 12);
      const bM = (b.cycle === "monthly" ? b.price : b.price / 12);
      return convert(bM, b.currency, baseCurrency) - convert(aM, a.currency, baseCurrency);
    });

    const rows = subsSorted.map((s) => {
      const cat = findCategory(s.categoryId, customCategories);
      const catLabel = getCategoryLabel(cat, t);
      const monthlyOwn = s.cycle === "monthly" ? s.price : s.price / 12;
      const monthlyB = convert(monthlyOwn, s.currency, baseCurrency);
      const yearlyB = monthlyB * 12;
      return `<tr>
        <td>
          <div class="sub-name">${escapeHtml(s.name)}</div>
          <div class="sub-meta"><span class="dot" style="background:${cat.color}"></span>${escapeHtml(catLabel)}</div>
        </td>
        <td class="num">${formatAmount(monthlyB, baseCurrency)}</td>
        <td class="num">${formatAmount(yearlyB, baseCurrency)}</td>
      </tr>`;
    }).join("");

    const legend = segments.map((s) => {
      const pct = monthlyBase > 0 ? (s.amount / monthlyBase * 100) : 0;
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

    // ----- Monthly chart (12 months SVG for PDF) -----
    const now2 = new Date();
    const monthlyChartData = Array.from({ length: 12 }, (_, i) => {
      const monthDate = new Date(now2.getFullYear(), now2.getMonth() - (11 - i), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      let monthTotal = 0;
      for (const s of subscriptions) {
        const createdAt = new Date(s.createdAt);
        if (createdAt <= monthEnd) {
          const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
          monthTotal += convert(monthly, s.currency, baseCurrency);
        }
      }
      return { label: monthDate.toLocaleString("fr-FR", { month: "short" }), value: monthTotal };
    });
    const chartMax2 = Math.max(...monthlyChartData.map((d) => d.value), 0.01);
    const CW = 480, CH = 100, BW = 28, BG = (CW - 12 * BW) / 13;
    const chartBars = monthlyChartData.map((d, i) => {
      const bh = Math.max((d.value / chartMax2) * CH, 2);
      const bx = BG + i * (BW + BG);
      const by = CH - bh;
      const isLast = i === 11;
      const fill = isLast ? "#10B981" : "#E5E7EB";
      const valLabel = isLast ? `<text x="${(bx + BW / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" font-size="8" fill="#10B981" text-anchor="middle" font-family="sans-serif" font-weight="bold">${formatAmount(d.value, baseCurrency)}</text>` : "";
      return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${BW}" height="${bh.toFixed(1)}" rx="4" fill="${fill}"/><text x="${(bx + BW / 2).toFixed(1)}" y="${(CH + 14).toFixed(1)}" font-size="8" fill="#9CA3AF" text-anchor="middle" font-family="sans-serif">${d.label}</text>${valLabel}`;
    }).join("");
    const chartSvg = `<svg width="${CW}" height="${CH + 20}" viewBox="0 0 ${CW} ${CH + 20}" xmlns="http://www.w3.org/2000/svg">${chartBars}</svg>`;

    const generatedOn = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const logoB64 = await getBrandLogoBase64();
    const logoBlock = logoB64
      ? `<div class="brand-row">
           <img class="brand-icon" src="data:image/png;base64,${logoB64}" alt="" />
           <div>
             <h1 class="brand-name">All My Costs</h1>
             <p class="brand-sub">${escapeHtml(user?.name || "")}</p>
           </div>
         </div>`
      : `<div class="brand-row">
           <div>
             <h1 class="brand-name">All My Costs</h1>
             <p class="brand-sub">${escapeHtml(user?.name || "")}</p>
           </div>
         </div>`;

    const html = `<!doctype html><html><head><meta charset="utf-8" />
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

        .totals { display: flex; gap: 14px; margin: 24px 0 28px 0; }
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
          margin: 8px 0 14px 0; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB;
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
        .sub-meta { font-size: 11px; color: #6B7280; margin-top: 2px; }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
        td.num { font-weight: 700; color: #111827; white-space: nowrap; }

        .stats { margin-top: 30px; display: flex; gap: 28px; align-items: center; }
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

      <div class="totals">
        <div class="total-card">
          <div class="label">TOTAL MENSUEL</div>
          <div class="value">${formatAmount(monthlyBase, baseCurrency)}</div>
        </div>
        <div class="total-card dark">
          <div class="label">TOTAL ANNUEL</div>
          <div class="value">${formatAmount(yearlyBase, baseCurrency)}</div>
        </div>
      </div>

      <h2>Détail des abonnements</h2>
      <table>
        <thead><tr>
          <th>Abonnement</th>
          <th class="num">Mensuel</th>
          <th class="num">Annuel</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h2>Répartition par catégorie</h2>
      <div class="stats">
        <div class="donut-wrap">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <g transform="rotate(-90 ${CX} ${CY})">
              <circle cx="${CX}" cy="${CY}" r="${R}" stroke="#F3F4F6" stroke-width="${STROKE}" fill="none" />
              ${donutArcs}
            </g>
          </svg>
          <div class="donut-center">
            <div class="label">MENSUEL</div>
            <div class="value">${formatAmount(monthlyBase, baseCurrency)}</div>
          </div>
        </div>
        <div class="legend">${legend}</div>
      </div>

      <h2>Évolution 12 mois</h2>
      <div class="chart-wrap">${chartSvg}</div>

      <div class="footer">
        <span>Généré le ${generatedOn}</span>
        <span>Devise : ${baseCurrency}</span>
      </div>

      </body></html>`;

    // On web, expo-print's printToFileAsync prints the *current page* via window.print()
    // — not our custom HTML. We bypass it entirely by rendering our HTML inside a
    // sandboxed iframe and calling print() on that iframe document.
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.setAttribute("aria-hidden", "true");
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) throw new Error("iframe doc unavailable");
        doc.open();
        doc.write(html);
        doc.close();
        // wait for the iframe to layout/render before printing
        await new Promise<void>((resolve) => setTimeout(resolve, 350));
        const win = iframe.contentWindow as (Window & { focus: () => void; print: () => void }) | null;
        if (!win) throw new Error("iframe window unavailable");
        win.focus();
        win.print();
        setTimeout(() => { try { iframe.remove(); } catch { /* noop */ } }, 1500);
        return;
      } catch (e: any) {
        window.alert(e?.message || "Impossible de générer le PDF.");
        return;
      }
    }

    try {
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
        useMarkupFormatter: true,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: "All My Costs — Export PDF",
        });
      } else {
        Alert.alert("PDF généré", uri);
      }
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de générer le PDF.");
    }
  };

  const renderItem = ({ item }: any) => {
    const cat = findCategory(item.categoryId, customCategories);
    const catLabel = getCategoryLabel(cat, t);
    // Compute the monthly equivalent in the subscription's own currency, then scale to the toggle.
    const monthlyOwn = item.cycle === "monthly" ? item.price : item.price / 12;
    const displayOwn = view === "monthly" ? monthlyOwn : monthlyOwn * 12;
    // Convert to user's base currency for the secondary line.
    const displayBase = convert(displayOwn, item.currency, baseCurrency);
    const cycleLabel = view === "monthly" ? t("common.monthly") : t("common.yearly");
    const locked = lockedSubIds.has(item.id);
    return (
      <TouchableOpacity
        testID={`subscription-item-${item.name}`}
        onPress={() => {
          if (locked) { router.push("/(app)/paywall"); return; }
          router.push({ pathname: "/(app)/subscription", params: { id: item.id } });
        }}
        onLongPress={() => {
          if (locked) { router.push("/(app)/paywall"); return; }
          confirmAction(item.name, t("sub.deleteConfirm", { name: item.name }), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.delete"), style: "destructive", onPress: () => deleteSubscription(item.id) },
          ]);
        }}
        style={styles.subItem}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14, opacity: locked ? 0.45 : 1 }}>
          <View style={[styles.subIcon, { backgroundColor: cat.color + "22" }]}>
            <CatIcon name={cat.icon} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.subCat} numberOfLines={1}>{catLabel}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.subPrice}>{formatAmount(displayOwn, item.currency)}</Text>
            <Text style={styles.subCycle}>{cycleLabel}</Text>
            {item.currency !== baseCurrency ? (
              <Text style={styles.subFx}>≈ {formatAmount(displayBase, baseCurrency)}</Text>
            ) : null}
          </View>
        </View>
        {locked ? (
          <View style={styles.lockedOverlay}>
            <Icons.Lock color="#fff" size={18} strokeWidth={2.5} />
            <Text style={styles.lockedText}>{t("home.lockedCard")}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const firstName = (user?.name || "").trim().split(/\s+/)[0] || "";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerBrandRow}>
          <BrandLockup height={40} />
        </View>
        {firstName ? (
          <Text testID="home-greeting" style={styles.greeting}>
            {t("auth.welcomeName", { name: firstName })}
          </Text>
        ) : null}
        <View style={styles.headerActionsRow}>
          <TouchableOpacity testID="stats-button" onPress={() => router.push("/(app)/stats")} style={styles.iconBtn}>
            <Icons.PieChart color={theme.text} size={20} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity testID="export-pdf-button" onPress={exportPdf} style={styles.iconBtn}>
            <Icons.FileDown color={theme.text} size={20} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity testID="settings-button" onPress={() => router.push("/(app)/settings")} style={styles.iconBtn}>
            <Icons.Settings color={theme.text} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={subscriptions}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
        ListHeaderComponent={
          <View>
            {isTrialing && trialDaysLeft > 0 ? (
              <TouchableOpacity testID="trial-banner" onPress={() => router.push("/(app)/paywall")} style={styles.trialBanner}>
                <Icons.Sparkles color={theme.accent} size={16} />
                <Text style={styles.trialBannerText}>{t("home.trialDaysLeft", { count: trialDaysLeft })}</Text>
                <Icons.ChevronRight color={theme.accent} size={16} />
              </TouchableOpacity>
            ) : null}
            {trialExpired ? (
              <TouchableOpacity testID="upgrade-banner" onPress={() => router.push("/(app)/paywall")} style={[styles.trialBanner, { backgroundColor: "#FEF2F2", borderColor: theme.danger }]}>
                <Icons.AlertCircle color={theme.danger} size={16} />
                <Text style={[styles.trialBannerText, { color: theme.danger }]}>{t("home.trialEnded")}</Text>
                <Text style={{ color: theme.danger, fontWeight: "800" }}>{t("home.upgrade")}</Text>
              </TouchableOpacity>
            ) : null}
            {isPro && !isTrialing && !trialExpired ? (
              <View style={[styles.trialBanner, styles.proActivatedBanner]}>
                <Icons.BadgeCheck color={theme.accent} size={16} />
                <Text style={styles.proActivatedBannerText}>{t("home.proUnlocked")}</Text>
              </View>
            ) : null}
            <View style={styles.heroCard}>
              <View style={styles.heroToggle}>
                <TouchableOpacity
                  testID="toggle-monthly"
                  onPress={() => setView("monthly")}
                  style={[styles.toggleBtn, view === "monthly" && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, view === "monthly" && styles.toggleTextActive]}>{t("common.monthly")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="toggle-yearly"
                  onPress={() => setView("yearly")}
                  style={[styles.toggleBtn, view === "yearly" && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, view === "yearly" && styles.toggleTextActive]}>{t("common.yearly")}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.heroLabel}>{view === "monthly" ? t("home.totalMonthly") : t("home.totalYearly")}</Text>
              <Text testID="total-cost-display" style={styles.heroAmount}>
                {formatAmount(totalAmount, baseCurrency)}
              </Text>
              <Text style={styles.heroHint}>
                {t("home.subsCount", { count: subscriptions.length, currency: totalsCurrency.code })}
              </Text>
            </View>

            {/* Income + Remaining budget — compact row */}
            {monthlyIncome > 0 ? (
              <View style={styles.budgetRow}>
                <TouchableOpacity
                  testID="income-card"
                  onPress={() => setIncomeModalOpen(true)}
                  activeOpacity={0.7}
                  style={styles.miniCard}
                >
                  <View style={styles.miniCardHeader}>
                    <Icons.Wallet color={theme.textMuted} size={13} strokeWidth={2} />
                    <Text style={styles.miniCardLabel} numberOfLines={1}>{t("home.income")}</Text>
                  </View>
                  <Text style={styles.miniCardAmount} numberOfLines={1}>
                    {formatAmount(view === "monthly" ? monthlyIncome : monthlyIncome * 12, baseCurrency)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="remaining-card"
                  onPress={() => setIncomeModalOpen(true)}
                  activeOpacity={0.7}
                  style={[styles.miniCardOk, isOverBudget && styles.miniCardWarn]}
                >
                  <View style={styles.miniCardHeader}>
                    <Icons.PiggyBank
                      color={isOverBudget ? theme.danger : "#15803D"}
                      size={13}
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        styles.miniCardLabel,
                        { color: isOverBudget ? theme.danger : "#15803D" },
                      ]}
                      numberOfLines={1}
                    >
                      {view === "monthly" ? t("home.remainingMonthly") : t("home.remainingYearly")}
                    </Text>
                  </View>
                  <Text
                    testID="remaining-amount"
                    style={[
                      styles.miniCardAmount,
                      { color: isOverBudget ? theme.danger : "#15803D" },
                    ]}
                    numberOfLines={1}
                  >
                    {formatAmount(displayedRemaining, baseCurrency)}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                testID="add-income-cta"
                onPress={() => setIncomeModalOpen(true)}
                style={styles.addIncomeCta}
                activeOpacity={0.7}
              >
                <View style={styles.addIncomeIcon}>
                  <Icons.Wallet color={theme.accent} size={16} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addIncomeTitle}>{t("home.addIncome")}</Text>
                  <Text style={styles.addIncomeSub} numberOfLines={1}>{t("home.noIncomeYet")}</Text>
                </View>
                <Icons.Plus color={theme.accent} size={18} strokeWidth={2.5} />
              </TouchableOpacity>
            )}

            {isOverBudget ? (
              <View style={styles.overBudgetBanner}>
                <Icons.AlertTriangle color={theme.danger} size={14} strokeWidth={2.5} />
                <Text style={styles.overBudgetText} numberOfLines={2}>
                  {t("home.overBudgetWarning")}
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>{t("home.yourSubs")}</Text>
            {subscriptions.length === 0 ? (
              <Text style={styles.empty}>{t("home.empty")}</Text>
            ) : null}
          </View>
        }
      />

      <TouchableOpacity
        testID="add-subscription-button"
        onPress={() => {
          if (showPaywallGate && subscriptions.length >= FREE_SUB_LIMIT) {
            router.push("/(app)/paywall");
          } else {
            router.push("/(app)/subscription");
          }
        }}
        style={styles.fab}
      >
        <Icons.Plus color="#fff" size={28} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Income editor — shared with Settings */}
      <IncomeEditorModal visible={incomeModalOpen} onClose={() => setIncomeModalOpen(false)} />
    </SafeAreaView>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  headerBrandRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  headerActionsRow: {
    flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 12,
  },
  greeting: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    marginTop: 10,
    letterSpacing: -0.2,
  },
  brand: { fontSize: 20, fontWeight: "800", color: theme.text, letterSpacing: -0.3, flexShrink: 1 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  heroCard: {
    backgroundColor: theme.primary, borderRadius: 24, padding: 24, marginTop: 8, marginBottom: 24, overflow: "hidden",
  },
  heroToggle: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, padding: 4, alignSelf: "flex-start", marginBottom: 16,
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  toggleBtnActive: { backgroundColor: "#fff" },
  toggleText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  toggleTextActive: { color: theme.text },
  heroLabel: { color: "#9CA3AF", fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  heroAmount: { color: theme.accent, fontSize: 44, fontWeight: "900", letterSpacing: -1.5, marginTop: 6 },
  heroHint: { color: "#9CA3AF", fontSize: 12, marginTop: 8 },
  sectionTitle: { fontSize: 13, color: theme.textMuted, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  empty: { color: theme.textMuted, paddingVertical: 24, textAlign: "center" },
  subItem: {
    flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border, position: "relative",
  },
  subIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  subName: { fontSize: 16, fontWeight: "700", color: theme.text },
  subCat: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  subPrice: { fontSize: 16, fontWeight: "800", color: theme.text },
  subCycle: { fontSize: 11, color: theme.textSubtle, marginTop: 2 },
  subFx: { fontSize: 11, color: theme.textMuted, marginTop: 2, fontStyle: "italic" },
  fab: {
    position: "absolute", right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: theme.primary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  trialBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginTop: 8,
  },
  trialBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: theme.accent },
  proActivatedBanner: { alignSelf: "center" },
  proActivatedBannerText: { fontSize: 13, fontWeight: "700", color: theme.accent },
  lockedOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(107,114,128,0.75)",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  lockedText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  // Income + Remaining budget — compact pill-like cards
  budgetRow: {
    flexDirection: "row", gap: 10, marginBottom: 12,
  },
  miniCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  miniCardOk: {
    flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "#86EFAC", backgroundColor: "#F0FDF4",
  },
  miniCardWarn: {
    borderColor: "#FCA5A5", backgroundColor: "#FEF2F2",
  },
  miniCardHeader: {
    flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3,
  },
  miniCardLabel: {
    flex: 1, fontSize: 10, fontWeight: "700",
    color: theme.textMuted, letterSpacing: 0.4, textTransform: "uppercase",
  },
  miniCardAmount: {
    fontSize: 16, fontWeight: "800", color: theme.text, letterSpacing: -0.3,
  },
  overBudgetBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderColor: "#FCA5A5", borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 14,
  },
  overBudgetText: {
    flex: 1, fontSize: 12, fontWeight: "600", color: theme.danger, lineHeight: 15,
  },

  addIncomeCta: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    marginBottom: 14,
  },
  addIncomeIcon: {
    width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.accentSoft,
  },
  addIncomeTitle: { fontSize: 13, fontWeight: "700", color: theme.text },
  addIncomeSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
});
