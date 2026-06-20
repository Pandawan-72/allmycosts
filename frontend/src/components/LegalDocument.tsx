import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Icons from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/contexts/ThemeContext";

type Section = { title: string; body: string };
type LegalDocProps = { kind: "privacy" | "terms" };

export default function LegalDocument({ kind }: LegalDocProps) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { t } = useTranslation();

  const docKey = kind === "privacy" ? "privacy" : "terms";
  const title = t(kind === "privacy" ? "legal.privacyTitle" : "legal.termsTitle");
  const intro = t(`legal.${docKey}.intro`) as string;
  const sections = (t(`legal.${docKey}.sections`, { returnObjects: true }) as Section[]) || [];
  const lastUpdated = t("legal.lastUpdated") as string;
  const editor = t("legal.editor") as string;
  const contactEmail = t("legal.contact") as string;
  const openMailto = t("legal.openMailto") as string;

  const onContact = () => {
    const subject = encodeURIComponent(`[All My Costs] ${title}`);
    const url = `mailto:${contactEmail}?subject=${subject}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="legal-back" onPress={() => router.back()} style={styles.headerBtn}>
          <Icons.ChevronLeft color={theme.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.docTitle}>{title}</Text>
        <Text style={styles.meta}>{lastUpdated}</Text>
        <Text style={styles.meta}>{editor} • {contactEmail}</Text>

        <Text style={styles.intro}>{intro}</Text>

        {Array.isArray(sections) && sections.map((s, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <TouchableOpacity testID="legal-contact" onPress={onContact} style={styles.contactBtn} activeOpacity={0.85}>
          <Icons.Mail color="#fff" size={18} />
          <Text style={styles.contactBtnTxt}>{openMailto}</Text>
        </TouchableOpacity>

        <View style={{ height: Platform.OS === "ios" ? 24 : 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: theme.text, flex: 1, textAlign: "center" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  docTitle: { fontSize: 26, fontWeight: "800", color: theme.text, marginBottom: 6 },
  meta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  intro: { fontSize: 14, color: theme.text, marginTop: 16, lineHeight: 20 },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: theme.text, marginBottom: 6 },
  sectionBody: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  contactBtn: {
    marginTop: 28,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: theme.cardBg, paddingVertical: 14, borderRadius: 14,
  },
  contactBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
}
