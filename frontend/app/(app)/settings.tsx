import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, ScrollView, Alert, Switch, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Icons from "lucide-react-native";
import * as Application from "expo-application";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { CURRENCIES, findCurrency, formatAmount } from "@/src/data/currencies";
import { IncomeEditorModal } from "@/src/components/IncomeEditorModal";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/contexts/LanguageContext";
import { SUPPORTED_LANGS, AppLang } from "@/src/i18n";
import { restorePurchasesRC, isRevenueCatSupported } from "@/src/lib/revenuecat";
import { exportBackup, importBackup } from "@/src/lib/backup";
import { saveReceiptImageFromBase64 } from "@/src/utils/receiptStorage";

const APP_VERSION = Application.nativeApplicationVersion || "1.0.0";
const APP_BUILD = Application.nativeBuildVersion || "—";

export default function Settings() {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { isPro, isInTrial } = useAuth();
  const { baseCurrency, setBaseCurrency, subscriptions, expenses, customCategories, monthlyIncome, incomeOverrides, setMonthlyIncome, setBaseCurrency: setCurrency, replaceAllSubscriptions, replaceAllExpenses, replaceAllCustomCategories, setIncomeForMonth, installedAt, setInstalledAt } = useSubscriptions();
  const { t } = useTranslation();
  const { lang, setLang } = useLanguage();
  const [showCurrency, setShowCurrency] = useState(false);
  const [showIncomeEditor, setShowIncomeEditor] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const onRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      if (isRevenueCatSupported()) {
        await restorePurchasesRC();
      }
    } finally {
      setRestoring(false);
    }
  };

  const onExport = async () => {
    if (!isPro && !isInTrial) { router.push("/(app)/paywall"); return; }
    if (exporting) return;
    setExporting(true);
    try {
      await exportBackup({ subscriptions, expenses, customCategories, baseCurrency, monthlyIncome, incomeOverrides, installedAt });
    } finally {
      setExporting(false);
    }
  };

  const onImport = async () => {
    if (!isPro) { router.push("/(app)/paywall"); return; }
    if (importing) return;
    Alert.alert(
      t("settings.backup.importTitle"),
      t("settings.backup.importConfirmMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.continue"),
          style: "destructive",
          onPress: async () => {
            setImporting(true);
            try {
              const backup = await importBackup();
              if (!backup) return;
              await setCurrency(backup.baseCurrency);
              await setMonthlyIncome(backup.monthlyIncome || 0);
              const overrides = backup.incomeOverrides || {};
              for (const key of Object.keys(overrides)) {
                const [yearStr, monthStr] = key.split("-");
                const year = parseInt(yearStr, 10);
                const month = parseInt(monthStr, 10) - 1;
                if (!isNaN(year) && !isNaN(month)) await setIncomeForMonth(year, month, overrides[key]);
              }
              const restoredExpenses = await Promise.all(
                (backup.expenses || []).map(async (exp: any) => {
                  if (!exp.receiptImageBase64) return exp;
                  try {
                    const newUri = await saveReceiptImageFromBase64(exp.receiptImageBase64);
                    const { receiptImageBase64, ...rest } = exp;
                    return { ...rest, receiptImageUri: newUri };
                  } catch {
                    const { receiptImageBase64, ...rest } = exp;
                    return rest;
                  }
                })
              );
              await replaceAllCustomCategories(backup.customCategories || []);
              await replaceAllSubscriptions(backup.subscriptions || []);
              await replaceAllExpenses(restoredExpenses);
              if (backup.installedAt) await setInstalledAt(backup.installedAt);
              Alert.alert(t("settings.backup.importSuccessTitle"), t("settings.backup.importSuccess"));
            } catch (e: any) {
              Alert.alert("Erreur", e?.message || "Impossible de restaurer la sauvegarde.");
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Icons.ChevronLeft color={theme.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: isPro ? theme.accent : "#374151" }]}>
            <Icons.Crown color="#fff" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{isPro ? t("settings.proActive") : t("settings.proInactive")}</Text>
            <Text style={styles.email}>{t("settings.googlePlayAccount")}</Text>
          </View>
        </View>

        <Text style={styles.section}>{t("settings.preferences")}</Text>

        <TouchableOpacity testID="change-currency-row" onPress={() => setShowCurrency(true)} style={styles.row}>
          <View style={styles.rowIcon}><Icons.Banknote color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.baseCurrency")}</Text>
            <Text style={styles.rowSub}>{findCurrency(baseCurrency).name} ({baseCurrency})</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <TouchableOpacity testID="default-income-row" onPress={() => setShowIncomeEditor(true)} style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.rowIcon}><Icons.Wallet color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.defaultIncome")}</Text>
            <Text style={styles.rowSub}>
              {monthlyIncome > 0 ? formatAmount(monthlyIncome, baseCurrency) : t("settings.defaultIncomeNotSet")}
            </Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <TouchableOpacity testID="change-language-row" onPress={() => setShowLang(true)} style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.rowIcon}><Icons.Languages color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.language")}</Text>
            <Text style={styles.rowSub}>{t(`langs.${lang}`)}</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <View style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.rowIcon}><Icons.Moon color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.darkMode")}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: "#E5E7EB", true: theme.accent }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity testID="manage-pro-row" onPress={() => router.push("/(app)/paywall")} style={[styles.row, { marginTop: 10 }]}>
          <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}><Icons.Crown color={theme.accent} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.proPlan")}</Text>
            <Text style={styles.rowSub}>{isPro ? t("settings.proActive") : t("settings.proInactive")}</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <Text style={[styles.section, { marginTop: 24 }]}>{t("settings.backup.title")}</Text>

        <TouchableOpacity testID="export-backup-row" onPress={onExport} disabled={exporting} style={styles.row}>
          <View style={styles.rowIcon}>
            {exporting ? <ActivityIndicator size="small" color={theme.text} /> : <Icons.Download color={(isPro || isInTrial) ? theme.text : theme.textSubtle} size={18} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, !isPro && { color: theme.textMuted }]}>{t("settings.backup.exportTitle")}</Text>
            <Text style={styles.rowSub}>{(isPro || isInTrial) ? t("settings.backup.exportSub") : t("settings.backup.proRequired")}</Text>
          </View>
          {(isPro || isInTrial) ? <Icons.ChevronRight color={theme.textSubtle} size={18} /> : <Icons.Lock color={theme.textSubtle} size={16} />}
        </TouchableOpacity>

        <TouchableOpacity testID="import-backup-row" onPress={onImport} disabled={importing} style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.rowIcon}>
            {importing ? <ActivityIndicator size="small" color={theme.text} /> : <Icons.Upload color={isPro ? theme.text : theme.textSubtle} size={18} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, !isPro && { color: theme.textMuted }]}>{t("settings.backup.importTitle")}</Text>
            <Text style={styles.rowSub}>{isPro ? t("settings.backup.importSub") : isInTrial ? t("settings.backup.importTrialLocked") : t("settings.backup.proRequired")}</Text>
          </View>
          {(isPro || isInTrial) ? <Icons.ChevronRight color={theme.textSubtle} size={18} /> : <Icons.Lock color={theme.textSubtle} size={16} />}
        </TouchableOpacity>

        <Text style={[styles.section, { marginTop: 24 }]}>{t("legal.aboutSection")}</Text>

        <TouchableOpacity testID="restore-row" onPress={onRestore} disabled={restoring} style={styles.row}>
          <View style={styles.rowIcon}>
            {restoring ? <ActivityIndicator size="small" color={theme.text} /> : <Icons.RotateCcw color={theme.text} size={18} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("paywall.restore")}</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <TouchableOpacity testID="privacy-row" onPress={() => router.push("/(app)/privacy")} style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.rowIcon}><Icons.ShieldCheck color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("legal.privacyTitle")}</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <TouchableOpacity testID="terms-row" onPress={() => router.push("/(app)/terms")} style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.rowIcon}><Icons.FileText color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("legal.termsTitle")}</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL(`mailto:dev@retro-spare.fr?subject=${encodeURIComponent(t("settings.bugSubject"))}`)}
          style={[styles.row, { marginTop: 10 }]}
        >
          <View style={styles.rowIcon}><Icons.Bug color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.bugReport")}</Text>
            <Text style={styles.rowSub}>dev@retro-spare.fr</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <View testID="app-version-row" style={styles.versionFooter}>
          <Icons.Info color={theme.textSubtle} size={13} strokeWidth={2} />
          <Text style={styles.versionText}>{t("settings.version")} {APP_VERSION} ({APP_BUILD})</Text>
        </View>

      </ScrollView>

      <Modal visible={showLang} animationType="slide" onRequestClose={() => setShowLang(false)}>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowLang(false)} style={styles.headerBtn}>
              <Icons.X color={theme.text} size={22} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("settings.language")}</Text>
            <View style={styles.headerBtn} />
          </View>
          <FlatList
            data={SUPPORTED_LANGS as readonly string[]}
            keyExtractor={(l) => l}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`lang-option-${item}`}
                onPress={async () => { await setLang(item as AppLang); setShowLang(false); }}
                style={styles.currencyRow}
              >
                <Text style={styles.currencyCode}>{(item as string).toUpperCase()}</Text>
                <Text style={styles.currencyName}>{t(`langs.${item}`)}</Text>
                {lang === item ? <Icons.Check color={theme.accent} size={18} strokeWidth={3} /> : null}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showCurrency} animationType="slide" onRequestClose={() => setShowCurrency(false)}>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowCurrency(false)} style={styles.headerBtn}>
              <Icons.X color={theme.text} size={22} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("settings.baseCurrency")}</Text>
            <View style={styles.headerBtn} />
          </View>
          <FlatList
            data={CURRENCIES}
            keyExtractor={(c) => c.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`base-currency-${item.code}`}
                onPress={async () => { await setBaseCurrency(item.code); setShowCurrency(false); }}
                style={styles.currencyRow}
              >
                <Text style={styles.currencyCode}>{item.code}</Text>
                <Text style={styles.currencyName}>{item.name}</Text>
                <Text style={styles.currencySymbol}>{item.symbol}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <IncomeEditorModal visible={showIncomeEditor} onClose={() => setShowIncomeEditor(false)} />
    </SafeAreaView>
  );
}

function makeStyles(theme: any) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: theme.text },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 20, backgroundColor: theme.cardBg, borderRadius: 20, marginBottom: 24 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  name: { color: theme.text, fontSize: 16, fontWeight: "800" },
  email: { color: theme.textMuted, fontSize: 13, marginTop: 2 },
  section: { fontSize: 11, color: theme.textMuted, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, color: theme.text, fontWeight: "700" },
  rowSub: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  currencyRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
  currencyCode: { fontWeight: "800", color: theme.text, width: 50 },
  currencyName: { color: theme.textMuted, flex: 1 },
  currencySymbol: { color: theme.text, fontWeight: "700" },
  versionFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24, paddingVertical: 8, paddingBottom: 12 },
  versionText: { fontSize: 12, color: theme.textSubtle, fontWeight: "600" },
});
}
