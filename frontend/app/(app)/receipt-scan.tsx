import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import * as Icons from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/src/contexts/ThemeContext";
import { saveReceiptImage } from "@/src/utils/receiptStorage";
import { useAuth } from "@/src/contexts/AuthContext";

export default function ReceiptScan() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { t } = useTranslation();
  const { isPro, isInTrial } = useAuth();
  const canUseFeature = isPro || isInTrial;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirige immédiatement vers le paywall si la fonctionnalité n'est pas
  // accessible (ni Pro, ni en période d'essai).
  if (!canUseFeature) {
    router.replace("/(app)/paywall");
    return null;
  }

  const runOcr = async (uri: string) => {
    setProcessing(true);
    setError(null);
    let permanentUri: string | null = null;
    try {
      // Copie la photo vers un stockage permanent dès le départ, pour
      // pouvoir la retrouver/partager plus tard même si le ticket physique
      // est perdu. Si la copie échoue, on continue quand même l'OCR sans
      // bloquer le flow — la photo n'est qu'un bonus, pas une dépendance dure.
      try {
        permanentUri = await saveReceiptImage(uri);
      } catch {
        permanentUri = null;
      }

      const result = await TextRecognition.recognize(uri);
      const rawText = result.text || "";

      if (!rawText.trim()) {
        setError(t("receiptScan.noTextFound"));
        setProcessing(false);
        return;
      }

      // Le texte OCR brut (jamais l'image) est envoyé à notre script relais,
      // qui demande à un modèle de langage de structurer nom/montant/date —
      // bien plus fiable que des règles regex sur du texte OCR imparfait.
      const response = await fetch("https://dev.retro-spare.fr/parse-receipt.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const parsed = await response.json();

      if (!response.ok || !parsed.success) {
        setError(t("receiptScan.ocrError"));
        setProcessing(false);
        return;
      }

      // Redirige vers le formulaire de dépense, pré-rempli avec ce qui a été
      // détecté. La catégorie par défaut "other" est gérée côté formulaire
      // si categoryId n'est pas fourni — l'utilisateur complète le reste.
      router.replace({
        pathname: "/(app)/subscription",
        params: {
          prefillName: parsed.merchantName || "",
          prefillAmount: parsed.amount !== null && parsed.amount !== undefined ? String(parsed.amount) : "",
          prefillDate: parsed.date || "",
          prefillType: "oneoff",
          fromScan: "true",
          receiptImageUri: permanentUri || "",
        },
      });
    } catch (e) {
      setError(t("receiptScan.ocrError"));
      setProcessing(false);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (Platform.OS === "web") window.alert(t("receiptScan.permissionDenied"));
      else Alert.alert(t("receiptScan.permissionDeniedTitle"), t("receiptScan.permissionDenied"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      base64: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      await runOcr(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (Platform.OS === "web") window.alert(t("receiptScan.permissionDenied"));
      else Alert.alert(t("receiptScan.permissionDeniedTitle"), t("receiptScan.permissionDenied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      base64: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      await runOcr(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="receipt-scan-close" onPress={() => router.back()} style={styles.headerBtn}>
          <Icons.X color={theme.text} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("receiptScan.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.content}>
        {processing ? (
          <View style={styles.centerBlock}>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" /> : null}
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 20 }} />
            <Text style={styles.processingText}>{t("receiptScan.processing")}</Text>
          </View>
        ) : (
          <View style={styles.centerBlock}>
            <View style={styles.iconBubble}>
              <Icons.Receipt color={theme.accent} size={36} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>{t("receiptScan.heroTitle")}</Text>
            <Text style={styles.subtitle}>{t("receiptScan.heroSubtitle")}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity testID="receipt-scan-camera" onPress={pickFromCamera} style={styles.primaryBtn}>
              <Icons.Camera color="#fff" size={18} strokeWidth={2} />
              <Text style={styles.primaryBtnText}>{t("receiptScan.takePhoto")}</Text>
            </TouchableOpacity>

            <TouchableOpacity testID="receipt-scan-gallery" onPress={pickFromGallery} style={styles.secondaryBtn}>
              <Icons.Image color={theme.text} size={18} strokeWidth={2} />
              <Text style={styles.secondaryBtnText}>{t("receiptScan.chooseFromGallery")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  content: { flex: 1, padding: 24, justifyContent: "center" },
  centerBlock: { alignItems: "center" },
  iconBubble: {
    width: 76, height: 76, borderRadius: 24, backgroundColor: theme.accentSoft,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "900", color: theme.text, textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.textMuted, textAlign: "center", marginBottom: 28, lineHeight: 20 },
  error: { color: theme.danger, textAlign: "center", marginBottom: 16, fontSize: 13 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.cardBg, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 28,
    width: "100%", marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.surface, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 28,
    width: "100%", borderWidth: 1, borderColor: theme.border,
  },
  secondaryBtnText: { color: theme.text, fontWeight: "700", fontSize: 15 },
  previewImage: { width: 220, height: 220, borderRadius: 16 },
  processingText: { color: theme.textMuted, marginTop: 12, fontSize: 14 },
});
}
