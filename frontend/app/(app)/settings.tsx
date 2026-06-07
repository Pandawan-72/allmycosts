import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Switch, TextInput, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Icons from "lucide-react-native";

import { theme } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { CURRENCIES, findCurrency } from "@/src/data/currencies";
import { confirmAction } from "@/src/utils/confirm";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/contexts/LanguageContext";
import { SUPPORTED_LANGS, AppLang } from "@/src/i18n";
import { NotificationsHelper } from "@/src/utils/notifications";

export default function Settings() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { baseCurrency, setBaseCurrency } = useSubscriptions();
  const { t } = useTranslation();
  const { lang, setLang } = useLanguage();
  const [showCurrency, setShowCurrency] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifDays, setNotifDays] = useState("1");

  const isPro = !!user?.pro?.is_pro;

  useEffect(() => {
    (async () => {
      setNotifEnabled(await NotificationsHelper.getEnabled());
      setNotifDays(String(await NotificationsHelper.getDaysBefore()));
    })();
  }, []);

  const toggleNotif = async (next: boolean) => {
    if (!isPro) { router.push("/(app)/paywall"); return; }
    if (next) {
      const ok = await NotificationsHelper.requestPermissions();
      if (!ok && Platform.OS !== "web") return;
    }
    await NotificationsHelper.setEnabled(next);
    setNotifEnabled(next);
  };

  const saveDays = async (val: string) => {
    setNotifDays(val);
    const n = Math.max(0, Math.min(30, parseInt(val || "1", 10) || 1));
    await NotificationsHelper.setDaysBefore(n);
  };

  const proLabel = (() => {
    const p = user?.pro?.plan;
    if (p === "lifetime") return t("common.lifetime");
    if (p === "active_monthly") return t("common.monthly");
    if (p === "active_yearly") return t("common.yearly");
    if (p === "trialing") return "Trial";
    return t("home.upgrade");
  })();

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/sign-in");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.headerBtn}>
          <Icons.ChevronLeft color={theme.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={{ padding: 20 }}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{(user?.name || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
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

        <TouchableOpacity testID="change-language-row" onPress={() => setShowLang(true)} style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.rowIcon}><Icons.Languages color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.language")}</Text>
            <Text style={styles.rowSub}>{t(`langs.${lang}`)}</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <TouchableOpacity testID="manage-pro-row" onPress={() => router.push("/(app)/paywall")} style={[styles.row, { marginTop: 10 }]}>
          <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}><Icons.Crown color={theme.accent} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.proPlan")}</Text>
            <Text style={styles.rowSub}>{proLabel}</Text>
          </View>
          <Icons.ChevronRight color={theme.textSubtle} size={18} />
        </TouchableOpacity>

        <View style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.rowIcon}><Icons.Bell color={theme.text} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("settings.notifications")}</Text>
            <Text style={styles.rowSub}>
              {!isPro ? t("paywall.title") : (notifEnabled ? t("settings.notifEnabled") : t("settings.notifDisabled"))}
            </Text>
          </View>
          <Switch
            testID="notif-toggle"
            value={isPro && notifEnabled}
            onValueChange={toggleNotif}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={"#fff"}
          />
        </View>
        {isPro && notifEnabled ? (
          <View style={[styles.row, { marginTop: 10 }]}>
            <View style={styles.rowIcon}><Icons.CalendarClock color={theme.text} size={18} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t("settings.notifDays", { days: notifDays })}</Text>
            </View>
            <TextInput
              testID="notif-days-input"
              value={notifDays}
              onChangeText={saveDays}
              keyboardType="number-pad"
              style={styles.daysInput}
              maxLength={2}
            />
          </View>
        ) : null}

        <TouchableOpacity testID="logout-button" onPress={onLogout} style={[styles.row, { marginTop: 20 }]}>
          <View style={[styles.rowIcon, { backgroundColor: "#FEE2E2" }]}>
            <Icons.LogOut color={theme.danger} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: theme.danger }]}>{t("settings.logout")}</Text>
          </View>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.headerTitle}>Devise principale</Text>
            <View style={styles.headerBtn} />
          </View>
          <FlatList
            data={CURRENCIES}
            keyExtractor={(c) => c.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`base-currency-${item.code}`}
                onPress={async () => {
                  await setBaseCurrency(item.code);
                  setShowCurrency(false);
                }}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: theme.text },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 20,
    backgroundColor: theme.primary, borderRadius: 20, marginBottom: 24,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#374151", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontSize: 20, fontWeight: "800" },
  name: { color: "#fff", fontSize: 18, fontWeight: "800" },
  email: { color: "#9CA3AF", fontSize: 13, marginTop: 2 },
  section: { fontSize: 11, color: theme.textMuted, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 14,
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, color: theme.text, fontWeight: "700" },
  rowSub: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  currencyRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
  currencyCode: { fontWeight: "800", color: theme.text, width: 50 },
  currencyName: { color: theme.textMuted, flex: 1 },
  currencySymbol: { color: theme.text, fontWeight: "700" },
  daysInput: {
    width: 56, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border,
    borderRadius: 10, textAlign: "center", color: theme.text, fontWeight: "700",
  },
});
