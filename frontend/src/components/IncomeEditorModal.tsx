import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Icons from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";

/**
 * Reusable modal used from both Home (income card) and Settings (income row)
 * to view / edit / clear the user's stored monthly income.
 */
export function IncomeEditorModal({
  visible,
  onClose,
  // Si fournis, le modal édite le revenu d'UN MOIS PRÉCIS (override) au lieu
  // du revenu par défaut global. monthYear sert uniquement à l'affichage.
  monthOverride,
}: {
  visible: boolean;
  onClose: () => void;
  monthOverride?: { year: number; month: number; label: string };
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { t } = useTranslation();
  const { baseCurrency, monthlyIncome, setMonthlyIncome, getIncomeForMonth, setIncomeForMonth, incomeOverrides } = useSubscriptions();
  const [draft, setDraft] = useState<string>("");

  const isMonthMode = !!monthOverride;
  const currentValue = isMonthMode ? getIncomeForMonth(monthOverride!.year, monthOverride!.month) : monthlyIncome;
  const monthKey = isMonthMode ? `${monthOverride!.year}-${String(monthOverride!.month + 1).padStart(2, "0")}` : null;
  const hasMonthOverride = isMonthMode && monthKey !== null && incomeOverrides[monthKey] !== undefined;

  // Reset draft each time the modal opens so it reflects the latest stored value.
  useEffect(() => {
    if (visible) setDraft(currentValue > 0 ? String(currentValue) : "");
  }, [visible, currentValue]);

  const save = async () => {
    const cleaned = draft.replace(",", ".").replace(/[^\d.]/g, "");
    const value = parseFloat(cleaned);
    const safeValue = isNaN(value) || value < 0 ? 0 : value;
    if (isMonthMode) {
      await setIncomeForMonth(monthOverride!.year, monthOverride!.month, safeValue);
    } else {
      await setMonthlyIncome(safeValue);
    }
    onClose();
  };

  const clear = async () => {
    if (isMonthMode) {
      // Efface l'override : le mois revient au revenu par défaut.
      await setIncomeForMonth(monthOverride!.year, monthOverride!.month, null);
    } else {
      await setMonthlyIncome(0);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconBubble}>
              <Icons.Wallet color={theme.accent} size={20} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {isMonthMode ? t("home.incomeTitleMonth", { month: monthOverride!.label }) : t("home.incomeTitle")}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {isMonthMode ? t("home.incomeSubtitleMonth") : t("home.incomeSubtitle")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="income-modal-close">
              <Icons.X color={theme.textMuted} size={18} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              testID="income-input"
              value={draft}
              onChangeText={setDraft}
              placeholder={t("home.incomePlaceholder")}
              placeholderTextColor={theme.textSubtle}
              keyboardType="decimal-pad"
              autoFocus
              underlineColorAndroid="transparent"
              selectionColor={theme.accent}
              style={[
                styles.input,
                // Strip the native web/Android focus ring inline — React Native Web
                // doesn't reliably pick this up from StyleSheet.create on all versions.
                Platform.OS === "web"
                  ? ({
                      outlineWidth: 0,
                      outlineColor: "transparent",
                      outlineStyle: "none",
                      outline: "none",
                      boxShadow: "none",
                      WebkitTapHighlightColor: "transparent",
                      WebkitAppearance: "none",
                    } as any)
                  : null,
              ]}
            />
            <Text style={styles.currency}>{baseCurrency}</Text>
          </View>

          <View style={styles.btnRow}>
            {(isMonthMode ? hasMonthOverride : monthlyIncome > 0) ? (
              <TouchableOpacity
                testID="income-clear-btn"
                onPress={clear}
                style={[styles.btn, styles.btnGhost]}
              >
                <Text style={[styles.btnText, { color: theme.danger }]}>
                  {isMonthMode ? t("home.resetToDefaultIncome") : t("home.removeIncome")}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              testID="income-save-btn"
              onPress={save}
              style={[styles.btn, styles.btnPrimary]}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(theme: any) { return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: theme.bg,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentSoft,
  },
  title: { fontSize: 17, fontWeight: "800", color: theme.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: theme.textMuted, marginTop: 3, lineHeight: 16 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: theme.text,
    padding: 0,
  },
  currency: { fontSize: 14, fontWeight: "700", color: theme.textMuted },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: theme.cardBg },
  btnGhost: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  btnText: { fontSize: 15, fontWeight: "800", textAlign: "center" },
});
}
