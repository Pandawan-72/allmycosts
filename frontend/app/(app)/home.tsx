import { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Platform, Modal, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import * as Icons from "lucide-react-native";
import { BrandLockup } from "@/src/components/BrandLockup";
import { IncomeEditorModal } from "@/src/components/IncomeEditorModal";
import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { findCategory, DEFAULT_CATEGORIES, getCategoryLabel } from "@/src/data/categories";
import { findCurrency, formatAmount } from "@/src/data/currencies";
import { useFxRatesEUR } from "@/src/hooks/useFxRates";
import { monthShortName, monthYearLabel } from "@/src/utils/dateUtils";
import { deleteReceiptImage } from "@/src/utils/receiptStorage";
import { confirmAction } from "@/src/utils/confirm";
import { getBrandLogoBase64 } from "@/src/utils/brandLogoBase64";
import { buildPdfHtml } from "@/src/lib/pdfExport";
import { useTranslation } from "react-i18next";

const FREE_SUB_LIMIT = 10; // Limite combinée : récurrents + ponctuels confondus.

function CatIcon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  const Cmp = (Icons as any)[name] || (Icons as any).Tag;
  return <Cmp color={color} size={size} strokeWidth={2} />;
}

export default function Home() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isPro, isInTrial, trialDaysLeft, trialExpired } = useAuth();
  const { subscriptions, expenses, customCategories, baseCurrency, deleteSubscription, deleteExpense, monthlyIncome, incomeOverrides, getIncomeForMonth, installedAt } = useSubscriptions();
  const { convert } = useFxRatesEUR();
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  // Mode d'affichage : récurrent (abonnements), ponctuel (dépenses), ou cumulé (les deux additionnés).
  const [dataMode, setDataMode] = useState<"recurring" | "oneoff" | "combined">("recurring");
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);

  const [showFabMenu, setShowFabMenu] = useState(false);
  const fabMenuAnim = useRef(new Animated.Value(0)).current;

  const openFabMenu = () => {
    setShowFabMenu(true);
    Animated.spring(fabMenuAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
  };
  const closeFabMenu = () => {
    Animated.timing(fabMenuAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShowFabMenu(false);
    });
  };

  const allCats = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  const totalsCurrency = findCurrency(baseCurrency);

  const now = new Date();
  // Mois/année sélectionnés pour le calcul des dépenses ponctuelles — navigables
  // depuis la heroCard, par défaut sur le mois en cours.
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const curYear = selectedYear;
  const curMonth = selectedMonth;

  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  // Convert all subscriptions to base currency via FX rates
  const totals = useMemo(() => {
    let m = 0;
    for (const s of subscriptions) {
      // Ne compte un abonnement récurrent que s'il existait déjà au mois
      // sélectionné — évite de déduire du budget des mois antérieurs à
      // la création de l'abonnement.
      const created = new Date(s.createdAt);
      const createdYear = created.getFullYear();
      const createdMonth = created.getMonth();
      if (
        createdYear > selectedYear ||
        (createdYear === selectedYear && createdMonth > selectedMonth)
      ) continue;
      const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
      const conv = convert(monthly, s.currency, baseCurrency);
      m += conv;
    }
    return { monthly: m, yearly: m * 12 };
  }, [subscriptions, baseCurrency, convert, selectedYear, selectedMonth]);

  // Totaux des dépenses ponctuelles : mois en cours / année en cours, convertis en devise de base.
  const expenseTotals = useMemo(() => {
    let m = 0;
    let y = 0;
    for (const e of expenses) {
      const conv = convert(e.price, e.currency, baseCurrency);
      const d = new Date(e.date);
      if (d.getFullYear() === curYear) {
        y += conv;
        if (d.getMonth() === curMonth) m += conv;
      }
    }
    return { monthly: m, yearly: y };
  }, [expenses, baseCurrency, convert, curYear, curMonth]);

  const recurringMonthlyTotal = totals.monthly;
  const recurringYearlyTotal = totals.yearly;
  const oneoffMonthlyTotal = expenseTotals.monthly;
  const oneoffYearlyTotal = expenseTotals.yearly;

  // Totaux affichés selon le mode sélectionné (récurrent / ponctuel / cumulé)
  const monthlyTotal = dataMode === "recurring" ? recurringMonthlyTotal : dataMode === "oneoff" ? oneoffMonthlyTotal : recurringMonthlyTotal + oneoffMonthlyTotal;
  const yearlyTotal = dataMode === "recurring" ? recurringYearlyTotal : dataMode === "oneoff" ? oneoffYearlyTotal : recurringYearlyTotal + oneoffYearlyTotal;

  // Revenu effectif pour le mois actuellement sélectionné (override s'il existe, sinon le défaut).
  const effectiveIncome = useMemo(
    () => getIncomeForMonth(selectedYear, selectedMonth),
    [getIncomeForMonth, selectedYear, selectedMonth]
  );

  // Remaining budget (income - ALL expenses), toujours basé sur le total
  // cumulé (récurrent + ponctuel) réel, indépendamment du mode d'affichage
  // sélectionné via le toggle — le budget restant doit refléter la réalité
  // des dépenses, pas seulement ce qui est actuellement filtré à l'écran.
  const alwaysCombinedMonthlyTotal = recurringMonthlyTotal + oneoffMonthlyTotal;
  const alwaysCombinedYearlyTotal = recurringYearlyTotal + oneoffYearlyTotal;

  const displayedRemaining = useMemo(() => {
    if (view === "monthly") return effectiveIncome - alwaysCombinedMonthlyTotal;
    return effectiveIncome * 12 - alwaysCombinedYearlyTotal;
  }, [view, effectiveIncome, alwaysCombinedMonthlyTotal, alwaysCombinedYearlyTotal]);
  const isOverBudget = effectiveIncome > 0 && displayedRemaining < 0;
  const totalAmount = view === "monthly" ? monthlyTotal : yearlyTotal;

  const showPaywallGate = !isPro && !isInTrial;

  // Limite combinée gratuite : 6 éléments au total, abonnements récurrents et
  // dépenses ponctuelles confondus. Les plus anciens (par createdAt) restent
  // accessibles en premier ; tout ce qui dépasse est verrouillé.
  const { lockedSubIds, lockedExpenseIds, totalEntriesCount } = useMemo(() => {
    if (isPro || isInTrial) return { lockedSubIds: new Set<string>(), lockedExpenseIds: new Set<string>(), totalEntriesCount: subscriptions.length + expenses.length };

    const allEntries = [
      ...subscriptions.map((s) => ({ id: s.id, createdAt: s.createdAt, kind: "sub" as const })),
      ...expenses.map((e) => ({ id: e.id, createdAt: e.createdAt, kind: "exp" as const })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const lockedSubs = new Set<string>();
    const lockedExps = new Set<string>();
    allEntries.slice(FREE_SUB_LIMIT).forEach((e) => {
      if (e.kind === "sub") lockedSubs.add(e.id);
      else lockedExps.add(e.id);
    });

    return { lockedSubIds: lockedSubs, lockedExpenseIds: lockedExps, totalEntriesCount: allEntries.length };
  }, [subscriptions, expenses, isPro, isInTrial]);


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
    if (!isPro && !isInTrial) {
      router.push("/(app)/paywall");
      return;
    }
    if (subscriptions.length === 0 && expenses.length === 0) {
      if (Platform.OS === "web") window.alert(t("home.pdfEmptyMessage"));
      else Alert.alert(t("home.pdfEmptyTitle"), t("home.pdfEmptyMessage"));
      return;
    }

    const generatedOn = new Date().toLocaleDateString(i18n.language, { day: "2-digit", month: "long", year: "numeric" });
    const logoB64 = await getBrandLogoBase64();

    const html = buildPdfHtml({
      subscriptions,
      expenses,
      customCategories,
      baseCurrency,
      convert,
      t: (key: string) => t(key),
      monthLabel: (year, month) => monthShortName(month, i18n.language) + " " + String(year).slice(2),
      userName: "",
      logoB64,
      generatedOn,
      i18nText: {
        appName: "All My Costs",
        recurringTitle: t("pdf.recurringTitle"),
        oneoffTitle: t("pdf.oneoffTitle"),
        combinedTitle: t("pdf.combinedTitle"),
        entryColumnSub: t("pdf.entryColumnSub"),
        entryColumnExp: t("pdf.entryColumnExp"),
        entryColumnCombined: t("pdf.entryColumnCombined"),
        monthlyCol: t("pdf.monthlyCol"),
        yearlyCol: t("pdf.yearlyCol"),
        breakdownTitle: t("stats.breakdown"),
        evolutionTitle: t("stats.evolution12"),
        monthlyTotalLabel: t("pdf.monthlyTotalLabel"),
        yearlyTotalLabel: t("pdf.yearlyTotalLabel"),
        last12MonthsLabel: t("pdf.last12MonthsLabel"),
        footerGenerated: t("pdf.footerGenerated"),
        footerCurrency: t("pdf.footerCurrency"),
        savingsTitle: t("stats.savingsTitle"),
        savingsTotal12: t("stats.savingsTotal12"),
        savingsAvg: t("stats.savingsAvg"),
        savingsDetail: t("stats.savingsDetail"),
        savingsNoData: t("stats.savingsNoData"),
      },
      installedAt,
      monthlyIncome,
      incomeOverrides,
    });

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

  // Affichage d'une dépense ponctuelle (item: Expense). Distinct de renderItem
  // car Expense n'a pas de "cycle" — on affiche simplement le montant et la date.
  // Liste affichée dans la FlatList, filtrée selon le mode et le mois/année sélectionnés :
  // - Abonnements récurrents : visibles à partir de leur mois de création (createdAt) inclus.
  // - Dépenses ponctuelles : uniquement celles dont la date tombe dans le mois/année sélectionné.
  const displayedItems = useMemo(() => {
    const visibleSubs = subscriptions.filter((s) => {
      const created = new Date(s.createdAt);
      const createdYM = created.getFullYear() * 12 + created.getMonth();
      const selectedYM = selectedYear * 12 + selectedMonth;
      return createdYM <= selectedYM;
    }).map((s) => ({ ...s, __kind: "sub" as const }));

    const visibleExps = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    }).map((e) => ({ ...e, __kind: "exp" as const }));

    if (dataMode === "recurring") return visibleSubs;
    if (dataMode === "oneoff") return visibleExps;
    return [...visibleSubs, ...visibleExps];
  }, [subscriptions, expenses, dataMode, selectedYear, selectedMonth]);

  const renderExpenseItem = ({ item }: any) => {
    const cat = findCategory(item.categoryId, customCategories);
    const catLabel = getCategoryLabel(cat, t);
    const displayBase = convert(item.price, item.currency, baseCurrency);
    const locked = lockedExpenseIds.has(item.id);
    return (
      <TouchableOpacity
        testID={`expense-item-${item.name}`}
        onPress={() => {
          if (locked) { router.push("/(app)/paywall"); return; }
          router.push({ pathname: "/(app)/subscription", params: { id: item.id } });
        }}
        onLongPress={() => {
          if (locked) { router.push("/(app)/paywall"); return; }
          confirmAction(item.name, t("sub.deleteConfirm", { name: item.name }), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.delete"), style: "destructive", onPress: async () => {
              if (item.receiptImageUri) {
                try { await deleteReceiptImage(item.receiptImageUri); } catch {}
              }
              await deleteExpense(item.id);
            } },
          ]);
        }}
        style={styles.subItem}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14, opacity: locked ? 0.45 : 1 }}>
          <View style={[styles.subIcon, { backgroundColor: cat.color + "22" }]}>
            <CatIcon name={cat.icon} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={styles.subName} numberOfLines={1}>{item.name}</Text>
              <Icons.Calendar color="#FBBF24" size={12} strokeWidth={2.5} />
            </View>
            <Text style={styles.subCat} numberOfLines={1}>{catLabel}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.subPrice}>{formatAmount(item.price, item.currency)}</Text>
            <Text style={styles.subCycle}>{item.date}</Text>
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
            { text: t("common.delete"), style: "destructive", onPress: async () => { await deleteSubscription(item.id); } },
          ]);
        }}
        style={styles.subItem}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14, opacity: locked ? 0.45 : 1 }}>
          <View style={[styles.subIcon, { backgroundColor: cat.color + "22" }]}>
            <CatIcon name={cat.icon} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={styles.subName} numberOfLines={1}>{item.name}</Text>
              <Icons.RefreshCw color="#FBBF24" size={12} strokeWidth={2.5} />
            </View>
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

  const firstName = "";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BrandLockup height={36} />
        <View style={[styles.proBadge, { backgroundColor: (isPro || isInTrial) ? theme.accent : theme.surfaceAlt }]}>
          <Text style={[styles.proBadgeText, { color: (isPro || isInTrial) ? "#fff" : theme.textMuted }]}>{isPro ? "Pro" : isInTrial ? "Trial" : "Free"}</Text>
        </View>
        <View style={{ flex: 1 }} />
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

      <FlatList
        data={displayedItems}
        keyExtractor={(item: any) => item.id}
        renderItem={(props: any) => props.item.__kind === "exp" ? renderExpenseItem(props) : renderItem(props)}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
        ListHeaderComponent={
          <View>
            {isInTrial && !isPro ? (
              <TouchableOpacity onPress={() => router.push("/(app)/paywall")} style={[styles.trialBanner, { backgroundColor: trialDaysLeft <= 3 ? "#FFFBEB" : "#ECFDF5", borderColor: trialDaysLeft <= 3 ? "#F59E0B" : "#10B981" }]}>
                <Icons.Clock color={trialDaysLeft <= 3 ? "#F59E0B" : "#10B981"} size={16} />
                <Text style={[styles.trialBannerText, { color: trialDaysLeft <= 3 ? "#92400E" : "#065F46" }]}>{t("home.trialDaysLeft", { count: trialDaysLeft })}</Text>
                <Icons.ChevronRight color={trialDaysLeft <= 3 ? "#F59E0B" : "#10B981"} size={16} />
              </TouchableOpacity>
            ) : null}
            {trialExpired && !isPro ? (
              <TouchableOpacity onPress={() => router.push("/(app)/paywall")} style={[styles.trialBanner, { backgroundColor: "#FEF2F2", borderColor: "#EF4444" }]}>
                <Icons.AlertCircle color="#EF4444" size={16} />
                <Text style={[styles.trialBannerText, { color: "#991B1B" }]}>{t("home.trialEnded")}</Text>
                <Icons.ChevronRight color="#EF4444" size={16} />
              </TouchableOpacity>
            ) : null}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
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
                <View style={styles.monthNav}>
                  <TouchableOpacity testID="month-prev" onPress={goToPrevMonth} style={styles.monthNavArrow}>
                    <Icons.ChevronLeft color="rgba(255,255,255,0.5)" size={14} strokeWidth={3} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="month-nav-label"
                    onPress={() => { setPickerYear(selectedYear); setMonthPickerOpen(true); }}
                    style={styles.monthNavPill}
                    activeOpacity={0.7}
                  >
                    <Icons.Calendar color="#fff" size={13} strokeWidth={2.5} />
                    <Text style={styles.monthNavLabel}>
                      {monthYearLabel(selectedYear, selectedMonth, i18n.language)}
                    </Text>
                    <Icons.ChevronDown color="rgba(255,255,255,0.6)" size={13} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <TouchableOpacity testID="month-next" onPress={goToNextMonth} style={styles.monthNavArrow}>
                    <Icons.ChevronRight color="rgba(255,255,255,0.5)" size={14} strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.heroLabel}>{view === "monthly" ? t("home.totalMonthly") : t("home.totalYearly")}</Text>
              <Text testID="total-cost-display" style={styles.heroAmount}>
                {formatAmount(totalAmount, baseCurrency)}
              </Text>
              <Text style={styles.heroHint}>
                {dataMode === "recurring"
                  ? t("home.subsCount", { count: subscriptions.length, currency: totalsCurrency.code })
                  : dataMode === "oneoff"
                  ? t("home.expensesCount", { count: expenses.length, currency: totalsCurrency.code })
                  : t("home.combinedCount", { subCount: subscriptions.length, expCount: expenses.length, currency: totalsCurrency.code })}
              </Text>
            </View>

            <View style={styles.dataModeRow}>
              <TouchableOpacity
                testID="datamode-recurring"
                onPress={() => setDataMode("recurring")}
                style={[styles.dataModeBtn, dataMode === "recurring" && styles.dataModeBtnActive]}
              >
                <Text style={[styles.dataModeText, dataMode === "recurring" && styles.dataModeTextActive]}>{t("home.recurringMode")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="datamode-oneoff"
                onPress={() => setDataMode("oneoff")}
                style={[styles.dataModeBtn, dataMode === "oneoff" && styles.dataModeBtnActive]}
              >
                <Text style={[styles.dataModeText, dataMode === "oneoff" && styles.dataModeTextActive]}>{t("home.oneoffMode")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="datamode-combined"
                onPress={() => setDataMode("combined")}
                style={[styles.dataModeBtn, dataMode === "combined" && styles.dataModeBtnActive]}
              >
                <Text style={[styles.dataModeText, dataMode === "combined" && styles.dataModeTextActive]}>{t("home.combinedMode")}</Text>
              </TouchableOpacity>
            </View>

            {/* Income + Remaining budget — compact row */}
            {effectiveIncome > 0 ? (
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
                    {formatAmount(view === "monthly" ? effectiveIncome : effectiveIncome * 12, baseCurrency)}
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

            {subscriptions.length === 0 && dataMode === "recurring" ? (
              <Text style={styles.empty}>{t("home.empty")}</Text>
            ) : expenses.length === 0 && dataMode === "oneoff" ? (
              <Text style={styles.empty}>{t("home.emptyOneoff")}</Text>
            ) : subscriptions.length === 0 && expenses.length === 0 && dataMode === "combined" ? (
              <Text style={styles.empty}>{t("home.emptyCombined")}</Text>
            ) : null}
          </View>
        }
      />

      {showFabMenu ? (
        <TouchableOpacity testID="fab-menu-overlay" style={styles.fabOverlay} activeOpacity={1} onPress={closeFabMenu} />
      ) : null}

      {showFabMenu ? (
        <Animated.View style={[styles.fabMenu, { bottom: Math.max(insets.bottom + 84, 100) }, {
          opacity: fabMenuAnim,
          transform: [{ translateY: fabMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <TouchableOpacity
            testID="fab-add-recurring"
            style={styles.fabMenuItemRow}
            onPress={() => {
              closeFabMenu();
              if (showPaywallGate && totalEntriesCount >= FREE_SUB_LIMIT) {
                setTimeout(() => router.push("/(app)/paywall"), 200);
              } else {
                setTimeout(() => router.push("/(app)/subscription"), 200);
              }
            }}
          >
            <View style={[styles.fabMenuIcon, { backgroundColor: theme.accentSoft }]}>
              <Icons.RefreshCw color={theme.accent} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fabMenuTitle}>{t("home.fabAddRecurring")}</Text>
              <Text style={styles.fabMenuSub}>{t("home.fabAddRecurringSub")}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.fabMenuDivider} />

          <TouchableOpacity
            testID="fab-add-oneoff"
            style={styles.fabMenuItemRow}
            onPress={() => {
              closeFabMenu();
              if (showPaywallGate && totalEntriesCount >= FREE_SUB_LIMIT) {
                setTimeout(() => router.push("/(app)/paywall"), 200);
              } else {
                setTimeout(() => router.push({ pathname: "/(app)/subscription", params: { prefillType: "oneoff" } }), 200);
              }
            }}
          >
            <View style={[styles.fabMenuIcon, { backgroundColor: "#EFF6FF" }]}>
              <Icons.Calendar color="#3B82F6" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fabMenuTitle}>{t("home.fabAddOneoff")}</Text>
              <Text style={styles.fabMenuSub}>{t("home.fabAddOneoffSub")}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.fabMenuDivider} />

          <TouchableOpacity
            testID="fab-scan-receipt"
            style={styles.fabMenuItemRow}
            onPress={() => {
              closeFabMenu();
                if (!isPro && !isInTrial) {
                setTimeout(() => router.push("/(app)/paywall"), 200);
              } else {
                setTimeout(() => router.push("/(app)/receipt-scan"), 200);
              }
            }}
          >
            <View style={[styles.fabMenuIcon, { backgroundColor: isPro ? "#FFFBEB" : theme.surfaceAlt }]}>
              <Icons.ScanLine color={isPro ? "#F59E0B" : theme.textSubtle} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fabMenuTitle, !isPro && { color: theme.textMuted }]}>{t("home.fabScanReceipt")}</Text>
              <Text style={styles.fabMenuSub}>{isPro ? t("home.fabScanReceiptSub") : t("settings.backup.proRequired")}</Text>
            </View>
            {!isPro ? <Icons.Lock color={theme.textSubtle} size={16} /> : null}
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      <TouchableOpacity testID="add-subscription-button" style={[styles.fab, { bottom: Math.max(insets.bottom + 12, 24) }]} onPress={showFabMenu ? closeFabMenu : openFabMenu}>
        <Icons.Plus color="#fff" size={28} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Income editor — shared with Settings */}
      <IncomeEditorModal
        visible={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        monthOverride={{
          year: selectedYear,
          month: selectedMonth,
          label: monthYearLabel(selectedYear, selectedMonth, i18n.language),
        }}
      />

      {/* Month/year picker popup */}
      <Modal
        visible={monthPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setMonthPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerYearRow}>
              <TouchableOpacity testID="picker-year-prev" onPress={() => setPickerYear((y) => y - 1)} style={styles.pickerYearBtn}>
                <Icons.ChevronLeft color={theme.text} size={20} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text testID="picker-year-label" style={styles.pickerYearLabel}>{pickerYear}</Text>
              <TouchableOpacity testID="picker-year-next" onPress={() => setPickerYear((y) => y + 1)} style={styles.pickerYearBtn}>
                <Icons.ChevronRight color={theme.text} size={20} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerMonthGrid}>
              {Array.from({ length: 12 }, (_, i) => i).map((m) => {
                const isSelected = pickerYear === selectedYear && m === selectedMonth;
                const isThisMonth = pickerYear === now.getFullYear() && m === now.getMonth();
                const label = monthShortName(m, i18n.language);
                return (
                  <TouchableOpacity
                    key={m}
                    testID={`picker-month-${m}`}
                    onPress={() => {
                      setSelectedYear(pickerYear);
                      setSelectedMonth(m);
                      setMonthPickerOpen(false);
                    }}
                    style={[
                      styles.pickerMonthCell,
                      isSelected && styles.pickerMonthCellActive,
                      !isSelected && isThisMonth && styles.pickerMonthCellToday,
                    ]}
                  >
                    <Text style={[styles.pickerMonthText, isSelected && styles.pickerMonthTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              testID="picker-today-button"
              onPress={() => {
                setSelectedYear(now.getFullYear());
                setSelectedMonth(now.getMonth());
                setMonthPickerOpen(false);
              }}
              style={styles.pickerTodayBtn}
            >
              <Text style={styles.pickerTodayText}>{t("home.todayShortcut")}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

function makeStyles(theme: any) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  proBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  proBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  trialBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginBottom: 8 },
  trialBannerText: { fontSize: 13, fontWeight: "700", flex: 1 },
  brand: { fontSize: 20, fontWeight: "800", color: theme.text, letterSpacing: -0.3, flexShrink: 1 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  heroCard: {
    backgroundColor: theme.cardBg, borderRadius: 24, padding: 20, marginTop: 8, marginBottom: 20, overflow: "hidden",
  },
  heroTopRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
  },
  heroToggle: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, padding: 4, alignSelf: "flex-start",
  },
  monthNav: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  monthNavArrow: {
    width: 22, height: 22, alignItems: "center", justifyContent: "center",
  },
  monthNavPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  monthNavLabel: {
    color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center", textTransform: "capitalize",
  },
  toggleBtn: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999 },
  toggleBtnActive: { backgroundColor: "#fff" },
  toggleText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  toggleTextActive: { color: "#111827" },
  dataModeRow: {
    flexDirection: "row", backgroundColor: theme.cardBg, borderRadius: 999, padding: 4, marginBottom: 20,
  },
  dataModeBtn: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: "center" },
  dataModeBtnActive: { backgroundColor: "#fff" },
  dataModeText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  dataModeTextActive: { color: "#111827" },
  heroLabel: { color: "#9CA3AF", fontSize: 11, letterSpacing: 2, fontWeight: "700", textAlign: "center" },
  heroAmount: { color: theme.accent, fontSize: 38, fontWeight: "900", letterSpacing: -1.5, marginTop: 4, textAlign: "center" },
  heroHint: { color: "#9CA3AF", fontSize: 12, marginTop: 6, textAlign: "center" },
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
  fabOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  fabMenu: {
    position: "absolute", alignSelf: "center", left: "10%", right: "10%", bottom: "18%",
    backgroundColor: theme.surface, borderRadius: 20,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
    overflow: "hidden",
  },
  fabMenuItemRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  fabMenuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  fabMenuTitle: { fontSize: 15, fontWeight: "700", color: theme.text },
  fabMenuSub: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  fabMenuDivider: { height: 1, backgroundColor: theme.border, marginHorizontal: 16 },
  fab: {
    position: "absolute", right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: theme.cardBg, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  proActivatedBanner: { alignSelf: "center", backgroundColor: "transparent", borderWidth: 0, paddingHorizontal: 4, paddingVertical: 6 },
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

  // Month/year picker popup
  pickerOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32,
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border,
    alignSelf: "center", marginBottom: 18,
  },
  pickerYearRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28, marginBottom: 20,
  },
  pickerYearBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  pickerYearLabel: {
    fontSize: 19, fontWeight: "800", color: theme.text, minWidth: 70, textAlign: "center",
  },
  pickerMonthGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center",
  },
  pickerMonthCell: {
    width: "29%", paddingVertical: 16, borderRadius: 16,
    backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "transparent",
  },
  pickerMonthCellActive: {
    backgroundColor: theme.cardBg,
  },
  pickerMonthCellToday: {
    borderColor: theme.accent,
  },
  pickerMonthText: {
    fontSize: 14, fontWeight: "700", color: theme.text, textTransform: "capitalize",
  },
  pickerMonthTextActive: {
    color: "#fff",
  },
  pickerTodayBtn: {
    marginTop: 22, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 22,
    borderRadius: 999, backgroundColor: theme.accentSoft,
  },
  pickerTodayText: {
    fontSize: 13, fontWeight: "700", color: theme.accent,
  },
});
}
