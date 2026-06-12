// backup.ts — Export et import des données de l'app (version Pro uniquement)
// ✅ Fix : utilise expo-file-system correctement + encoding robuste

import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Alert } from "react-native";

const BACKUP_VERSION = 1;
const BACKUP_MAGIC = "AMC_BACKUP";

export type BackupData = {
  magic: string;
  version: number;
  exportedAt: string;
  subscriptions: any[];
  customCategories: any[];
  baseCurrency: string;
  monthlyIncome: number;
};

// ─── Encoding robuste (supporte accents, emoji, etc.) ──────────────────────
function encodeData(obj: any): string {
  const json = JSON.stringify(obj);
  // Encode chaque caractère en URI puis en base64
  const encoded = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  return btoa(encoded);
}

function decodeData(str: string): any {
  const decoded = atob(str.trim());
  const json = decodeURIComponent(
    decoded.split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
  );
  return JSON.parse(json);
}

// ─── EXPORT ────────────────────────────────────────────────────────────────

export async function exportBackup(data: {
  subscriptions: any[];
  customCategories: any[];
  baseCurrency: string;
  monthlyIncome: number;
}): Promise<void> {
  try {
    const backup: BackupData = {
      magic: BACKUP_MAGIC,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      ...data,
    };

    const encoded = encodeData(backup);
    const filename = `allmycosts_${new Date().toISOString().slice(0, 10)}.amcbackup`;

    // ✅ Utilise expo-file-system via import dynamique pour éviter les erreurs
    const FileSystem = await import("expo-file-system");
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, encoded);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/octet-stream",
        dialogTitle: "Sauvegarder mes données All My Costs",
        UTI: "public.data",
      });
    } else {
      Alert.alert("Erreur", "Le partage de fichiers n'est pas disponible sur cet appareil.");
    }

    // Nettoyer
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {}

  } catch (e: any) {
    Alert.alert("Erreur d'export", e?.message || "Impossible d'exporter les données.");
    throw e;
  }
}

// ─── IMPORT ────────────────────────────────────────────────────────────────

export async function importBackup(): Promise<BackupData | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const file = result.assets[0];

    const FileSystem = await import("expo-file-system");
    const content = await FileSystem.readAsStringAsync(file.uri);

    let backup: BackupData;
    try {
      backup = decodeData(content);
    } catch {
      throw new Error("Ce fichier n'est pas un fichier de sauvegarde All My Costs valide.");
    }

    if (backup.magic !== BACKUP_MAGIC) {
      throw new Error("Ce fichier n'est pas un fichier de sauvegarde All My Costs.");
    }

    // Nettoyer
    try {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
    } catch {}

    return backup;

  } catch (e: any) {
    if (e?.message?.includes("All My Costs")) {
      Alert.alert("Fichier invalide", e.message);
    } else if (!e?.message?.includes("cancel")) {
      Alert.alert("Erreur d'import", e?.message || "Impossible de lire le fichier.");
    }
    return null;
  }
}
