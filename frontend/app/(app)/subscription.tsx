import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, FlatList, KeyboardAvoidingView, Platform, Modal, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { confirmAction } from "@/src/utils/confirm";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { todayISO, isValidISODate } from "@/src/utils/dateUtils";
import { saveReceiptImage, deleteReceiptImage } from "@/src/utils/receiptStorage";
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
  const { user } = useAuth();
  const isPro = !!user?.pro?.is_pro;
  const isTrialing = user?.pro?.plan === "trialing";
  const canUseReceiptPhoto = isPro || isTrialing;
  const params = useLocalSearchParams<{
    id?: string;
    prefillName?: string;
    prefillAmount?: string;
    prefillDate?: string;
    prefillType?: string;
    fromScan?: string;
    receiptImageUri?: string;
  }>();
  const { subscriptions, expenses, customCategories, baseCurrency, addSubscription, updateSubscription, deleteSubscription, addExpense, updateExpense, deleteExpense, addCustomCategory } =
    useSubscriptions();

  // L'écran gère les deux types : on cherche dans les deux listes.
  // Si on édite, le type (récurrent/ponctuel) est déduit de la liste où l'élément a été trouvé.
  const existingSub = useMemo(() => subscriptions.find((s) => s.id === params.id), [params.id, subscriptions]);
  const existingExp = useMemo(() => expenses.find((e) => e.id === params.id), [params.id, expenses]);
  const existing = existingSub || existingExp;
  const isEdit = !!existing;
  const isEditingExpense = !!existingExp;

  // Type de dépense : récurrent (abonnement) ou ponctuel (dépense unique).
  // En édition, déduit automatiquement de la liste où l'élément a été trouvé.
  const [expenseType, setExpenseType] = useState<"recurring" | "oneoff">(
    isEditingExpense ? "oneoff" : params.prefillType === "oneoff" ? "oneoff" : "recurring"
  );

  const [name, setName] = useState(existing?.name || params.prefillName || "");
  const [priceStr, setPriceStr] = useState(existing ? String(existing.price) : (params.prefillAmount || ""));
  const [currency, setCurrency] = useState(existing?.currency || baseCurrency);
  const [cycle, setCycle] = useState<"monthly" | "yearly">((existingSub?.cycle) || "monthly");
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId || (params.fromScan === "true" ? "shopping" : params.prefillType === "oneoff" ? "other" : "video")
  );
  const [dueDate, setDueDate] = useState<string>(existingSub?.dueDate || "");
  // Date de la dépense ponctuelle (obligatoire pour ce type), par défaut aujourd'hui.
  const [expenseDate, setExpenseDate] = useState<string>(
    existingExp?.date || (isValidISODate(params.prefillDate || "") ? params.prefillDate! : todayISO())
  );
  // Photo du ticket de caisse associée à la dépense ponctuelle (optionnelle, Pro).
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(
    existingExp?.receiptImageUri || params.receiptImageUri || null
  );
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [showCurrency, setShowCurrency] = useState(false);
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customIcon, setCustomIcon] = useState("Tag");
  const [customColor, setCustomColor] = useState("#10B981");

  const allCats: Category[] = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);

  const pickReceiptPhoto = async (source: "camera" | "gallery") => {
    if (!canUseReceiptPhoto) {
      router.push("/(app)/paywall");
      return;
    }
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1 });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    try {
      const permanentUri = await saveReceiptImage(result.assets[0].uri);
      // Remplace l'ancienne photo si elle existait, en nettoyant le fichier précédent.
      if (receiptImageUri) await deleteReceiptImage(receiptImageUri);
      setReceiptImageUri(permanentUri);
    } catch {
      // Échec de copie : on garde l'état précédent, pas de blocage de l'utilisateur.
    }
  };

  const removeReceiptPhoto = () => {
    if (!receiptImageUri) return;
    confirmAction(t("sub.removeReceiptPhoto"), t("sub.removeReceiptPhotoConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteReceiptImage(receiptImageUri);
          setReceiptImageUri(null);
        },
      },
    ]);
  };

  const shareReceiptPhoto = async () => {
    if (!receiptImageUri) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      if (Platform.OS === "web") window.alert(t("sub.sharingUnavailable"));
      else Alert.alert(t("sub.sharingUnavailable"));
      return;
    }
    await Sharing.shareAsync(receiptImageUri, { mimeType: "image/jpeg" });
  };

  const onSubmit = async () => {
    setErr(null);
    if (!name.trim()) return setErr(t("sub.nameRequired"));
    const price = parseFloat(priceStr.replace(",", "."));
    if (isNaN(price) || price < 0) return setErr(t("sub.priceInvalid"));

    if (expenseType === "oneoff") {
      // Dépense ponctuelle : la date est obligatoire.
      if (!isValidISODate(expenseDate)) return setErr(t("sub.dateInvalid"));
      const payload = {
        name: name.trim(), price, currency, categoryId, date: expenseDate,
        receiptImageUri: receiptImageUri || undefined,
      };
      if (isEdit && existing) {
        await updateExpense(existing.id, payload);
      } else {
        await addExpense(payload);
      }
    } else {
      // Abonnement récurrent : la date d'échéance reste optionnelle.
      const cleanDate = dueDate.trim();
      const dateOk = !cleanDate || isValidISODate(cleanDate);
      if (!dateOk) return setErr(t("sub.dateInvalid"));
      const payload = { name: name.trim(), price, currency, cycle, categoryId, dueDate: cleanDate || null };
      if (isEdit && existing) {
        await updateSubscription(existing.id, payload);
      } else {
        await addSubscription(payload);
      }
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
          if (isEditingExpense) {
            // Nettoie le fichier photo associé avant de supprimer la dépense,
            // pour éviter d'accumuler des fichiers orphelins sur l'appareil.
            if (existingExp?.receiptImageUri) {
              await deleteReceiptImage(existingExp.receiptImageUri);
            }
            await deleteExpense(existing.id);
          } else {
            await deleteSubscription(existing.id);
          }
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
          {!isEdit ? (
            <>
              <Text style={styles.label}>{t("sub.expenseType")}</Text>
              <View style={styles.cycleRow}>
                <TouchableOpacity
                  testID="expense-type-recurring"
                  onPress={() => setExpenseType("recurring")}
                  style={[styles.cycleBtn, expenseType === "recurring" && styles.cycleBtnActive]}
                >
                  <Text style={[styles.cycleText, expenseType === "recurring" && styles.cycleTextActive]}>
                    {t("sub.recurring")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="expense-type-oneoff"
                  onPress={() => setExpenseType("oneoff")}
                  style={[styles.cycleBtn, expenseType === "oneoff" && styles.cycleBtnActive]}
                >
                  <Text style={[styles.cycleText, expenseType === "oneoff" && styles.cycleTextActive]}>
                    {t("sub.oneoff")}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { marginTop: isEdit ? 0 : 18 }]}>{t("sub.name")}</Text>
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

          {expenseType === "recurring" ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={[styles.label, { marginTop: 18 }]}>{t("sub.expenseDate")}</Text>
              <TextInput
                testID="expense-date-input"
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textSubtle}
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { marginTop: 18 }]}>{t("sub.receiptPhoto")}</Text>
              {receiptImageUri ? (
                <View style={styles.receiptPreviewRow}>
                  <TouchableOpacity testID="receipt-photo-view" onPress={() => setReceiptViewerOpen(true)}>
                    <Image source={{ uri: receiptImageUri }} style={styles.receiptThumbnail} resizeMode="cover" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, gap: 8 }}>
                    <TouchableOpacity testID="receipt-photo-share" onPress={shareReceiptPhoto} style={styles.receiptActionBtn}>
                      <Icons.Share2 color={theme.text} size={15} strokeWidth={2} />
                      <Text style={styles.receiptActionText}>{t("sub.shareReceiptPhoto")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="receipt-photo-remove" onPress={removeReceiptPhoto} style={styles.receiptActionBtn}>
                      <Icons.Trash2 color={theme.danger} size={15} strokeWidth={2} />
                      <Text style={[styles.receiptActionText, { color: theme.danger }]}>{t("sub.removeReceiptPhoto")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity testID="receipt-photo-add" onPress={() => pickReceiptPhoto("camera")} style={styles.addReceiptBtn}>
                  {!canUseReceiptPhoto ? <Icons.Lock color={theme.textMuted} size={16} /> : <Icons.Camera color={theme.accent} size={18} strokeWidth={2} />}
                  <Text style={styles.addReceiptText}>
                    {canUseReceiptPhoto ? t("sub.addReceiptPhoto") : t("sub.addReceiptPhotoProOnly")}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

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

      {/* Receipt photo full-screen viewer */}
      <Modal visible={receiptViewerOpen} transparent animationType="fade" onRequestClose={() => setReceiptViewerOpen(false)}>
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity
            testID="receipt-viewer-close"
            onPress={() => setReceiptViewerOpen(false)}
            style={styles.viewerCloseBtn}
          >
            <Icons.X color="#fff" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
          {receiptImageUri ? (
            <Image source={{ uri: receiptImageUri }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
          <TouchableOpacity testID="receipt-viewer-share" onPress={shareReceiptPhoto} style={styles.viewerShareBtn}>
            <Icons.Share2 color="#fff" size={18} strokeWidth={2} />
            <Text style={styles.viewerShareText}>{t("sub.shareReceiptPhoto")}</Text>
          </TouchableOpacity>
        </View>
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

  addReceiptBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: theme.border, borderStyle: "dashed", borderRadius: 14,
    paddingVertical: 16, backgroundColor: theme.surface,
  },
  addReceiptText: { color: theme.text, fontWeight: "700", fontSize: 14 },
  receiptPreviewRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  receiptThumbnail: { width: 72, height: 72, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  receiptActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  receiptActionText: { color: theme.text, fontWeight: "600", fontSize: 13 },

  viewerBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center",
  },
  viewerCloseBtn: {
    position: "absolute", top: 50, right: 20, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", zIndex: 10,
  },
  viewerImage: { width: "92%", height: "75%" },
  viewerShareBtn: {
    position: "absolute", bottom: 50, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingVertical: 12, paddingHorizontal: 22,
  },
  viewerShareText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
}
