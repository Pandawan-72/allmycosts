import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, FlatList, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/src/contexts/ThemeContext";
import { confirmAction } from "@/src/utils/confirm";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { DEFAULT_CATEGORIES, Category, getCategoryLabel } from "@/src/data/categories";
import { CURRENCIES, findCurrency } from "@/src/data/currencies";

const ICON_OPTIONS = ["Tag", "Sparkles", "Star", "Heart", "Coffee", "Plane", "Car", "Home", "Book", "Globe", "Briefcase", "ShoppingBag", "Newspaper"];

function CatIcon({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  const Cmp = (Icons as any)[name] || (Icons as any).Tag;
  return <Cmp color={color} size={size} strokeWidth={2} />;
}

export default function SubscriptionForm() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const { subscriptions, customCategories, baseCurrency, addSubscription, updateSubscription, deleteSubscription, addCustomCategory } =
    useSubscriptions();

  const existing = useMemo(() => subscriptions.find((s) => s.id === params.id), [params.id, subscriptions]);
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name || "");
  const [priceStr, setPriceStr] = useState(existing ? String(existing.price) : "");
  const [currency, setCurrency] = useState(existing?.currency || baseCurrency);
  const [cycle, setCycle] = useState<"monthly" | "yearly">(existing?.cycle || "monthly");
  const [categoryId, setCategoryId] = useState(existing?.categoryId || "video");
  const [dueDate, setDueDate] = useState<string>(existing?.dueDate || "");
  const [err, setErr] = useState<string | null>(null);

  const [showCurrency, setShowCurrency] = useState(false);
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customIcon, setCustomIcon] = useState("Tag");
  const [customColor, setCustomColor] = useState("#10B981");

  const allCats: Category[] = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);

  const onSubmit = async () => {
    setErr(null);
    if (!name.trim()) return setErr(t("sub.nameRequired"));
    const price = parseFloat(priceStr.replace(",", "."));
    if (isNaN(price) || price < 0) return setErr(t("sub.priceInvalid"));
    const cleanDate = dueDate.trim();
    const dateOk = !cleanDate || /^\d{4}-\d{2}-\d{2}$/.test(cleanDate);
    if (!dateOk) return setErr(t("sub.dateInvalid"));
    const payload = { name: name.trim(), price, currency, cycle, categoryId, dueDate: cleanDate || null };
    if (isEdit && existing) {
      await updateSubscription(existing.id, payload);
    } else {
      await addSubscription(payload);
    }
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    confirmAction(t("common.delete"), t("sub.deleteConfirm", { name: existing.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteSubscription(existing.id);
          router.back();
        },
      },
    ]);
  };

  const createCustomCategory = async () => {
    if (!customLabel.trim()) return;
    const cat = await addCustomCategory({ label: customLabel.trim(), icon: customIcon, color: customColor });
    setCategoryId(cat.id);
    setShowCustomCat(false);
    setCustomLabel("");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="close-form-button" onPress={() => router.back()} style={styles.headerBtn}>
            <Icons.X color={theme.text} size={22} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? t("sub.editSub") : t("sub.newSub")}</Text>
          {isEdit ? (
            <TouchableOpacity testID="delete-subscription-button" onPress={onDelete} style={styles.headerBtn}>
              <Icons.Trash2 color={theme.danger} size={20} strokeWidth={2} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{t("sub.name")}</Text>
          <TextInput
            testID="sub-name-input"
            value={name}
            onChangeText={setName}
            placeholder={t("sub.namePh")}
            placeholderTextColor={theme.textSubtle}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 18 }]}>{t("sub.price")}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              testID="sub-price-input"
              value={priceStr}
              onChangeText={setPriceStr}
              placeholder="0,00"
              placeholderTextColor={theme.textSubtle}
              keyboardType="decimal-pad"
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity testID="sub-currency-button" onPress={() => setShowCurrency(true)} style={[styles.input, styles.currencyBtn]}>
              <Text style={styles.currencyBtnText}>{findCurrency(currency).code}</Text>
              <Icons.ChevronDown color={theme.textMuted} size={16} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>{t("sub.cycle")}</Text>
          <View style={styles.cycleRow}>
            {(["monthly", "yearly"] as const).map((c) => (
              <TouchableOpacity
                key={c}
                testID={`cycle-${c}`}
                onPress={() => setCycle(c)}
                style={[styles.cycleBtn, cycle === c && styles.cycleBtnActive]}
              >
                <Text style={[styles.cycleText, cycle === c && styles.cycleTextActive]}>
                  {c === "monthly" ? t("common.monthly") : t("common.yearly")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>{t("sub.dateOptional")}</Text>
          <TextInput
            testID="sub-duedate-input"
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSubtle}
            style={styles.input}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { marginTop: 18 }]}>{t("sub.category")}</Text>
          <View style={styles.catGrid}>
            {allCats.map((cat) => {
              const active = cat.id === categoryId;
              return (
                <TouchableOpacity
                  key={cat.id}
                  testID={`category-pill-${cat.id}`}
                  onPress={() => setCategoryId(cat.id)}
                  style={[styles.catPill, active && { backgroundColor: theme.cardBg, borderColor: theme.cardBg }]}
                >
                  <CatIcon name={cat.icon} color={active ? "#fff" : cat.color} size={14} />
                  <Text style={[styles.catPillText, active && { color: "#fff" }]} numberOfLines={1}>{getCategoryLabel(cat, t)}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              testID="add-custom-category-button"
              onPress={() => setShowCustomCat(true)}
              style={[styles.catPill, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
            >
              <Icons.Plus color={theme.accent} size={14} strokeWidth={2.5} />
              <Text style={[styles.catPillText, { color: theme.accent }]}>{t("sub.newCategory")}</Text>
            </TouchableOpacity>
          </View>

          {err ? <Text testID="form-error" style={styles.error}>{err}</Text> : null}

          <TouchableOpacity testID="save-subscription-button" onPress={onSubmit} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{isEdit ? t("common.save") : t("common.add")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Currency selector */}
      <Modal visible={showCurrency} animationType="slide" onRequestClose={() => setShowCurrency(false)}>
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCurrency(false)} style={styles.headerBtn}>
              <Icons.X color={theme.text} size={22} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("sub.pickCurrency")}</Text>
            <View style={styles.headerBtn} />
          </View>
          <FlatList
            data={CURRENCIES}
            keyExtractor={(c) => c.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`currency-option-${item.code}`}
                onPress={() => { setCurrency(item.code); setShowCurrency(false); }}
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

      {/* Custom category modal */}
      <Modal visible={showCustomCat} animationType="slide" onRequestClose={() => setShowCustomCat(false)}>
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCustomCat(false)} style={styles.headerBtn}>
              <Icons.X color={theme.text} size={22} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("sub.customCat")}</Text>
            <View style={styles.headerBtn} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t("sub.customName")}</Text>
            <TextInput
              testID="custom-cat-name-input"
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder={t("sub.customNamePh")}
              placeholderTextColor={theme.textSubtle}
              style={styles.input}
            />
            <Text style={[styles.label, { marginTop: 18 }]}>{t("sub.icon")}</Text>
            <View style={styles.iconRow}>
              {ICON_OPTIONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  testID={`custom-icon-${ic}`}
                  onPress={() => setCustomIcon(ic)}
                  style={[styles.iconChoice, customIcon === ic && { borderColor: theme.cardBg, backgroundColor: theme.cardBg }]}
                >
                  <CatIcon name={ic} color={customIcon === ic ? "#fff" : theme.text} size={18} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { marginTop: 18 }]}>{t("sub.color")}</Text>
            <View style={styles.colorRow}>
              {["#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#EF4444", "#0EA5E9", "#F59E0B", "#14B8A6"].map((col) => (
                <TouchableOpacity
                  key={col}
                  testID={`custom-color-${col}`}
                  onPress={() => setCustomColor(col)}
                  style={[styles.colorDot, { backgroundColor: col }, customColor === col && { borderWidth: 3, borderColor: theme.text }]}
                />
              ))}
            </View>
            <TouchableOpacity testID="create-custom-cat-button" onPress={createCustomCategory} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{t("sub.create")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.bg,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: theme.text },
  label: { fontSize: 12, fontWeight: "700", color: theme.textMuted, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" },
  input: {
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.text,
  },
  currencyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, minWidth: 96 },
  currencyBtnText: { fontWeight: "800", color: theme.text },
  cycleRow: { flexDirection: "row", gap: 10 },
  cycleBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: "center",
  },
  cycleBtnActive: { backgroundColor: theme.cardBg, borderColor: theme.cardBg },
  cycleText: { fontWeight: "700", color: theme.text },
  cycleTextActive: { color: "#fff" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, flexShrink: 0,
  },
  catPillText: { color: theme.text, fontSize: 13, fontWeight: "600" },
  saveBtn: { backgroundColor: theme.cardBg, borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 28 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  error: { color: theme.danger, marginTop: 16, textAlign: "center" },
  modalSafe: { flex: 1, backgroundColor: theme.bg },
  modalHeader: {
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  currencyRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
  currencyCode: { fontWeight: "800", color: theme.text, width: 50 },
  currencyName: { color: theme.textMuted, flex: 1 },
  currencySymbol: { color: theme.text, fontWeight: "700" },
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconChoice: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
});
}
