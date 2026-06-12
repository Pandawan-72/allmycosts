// backup.ts — Export et import des données (Pro uniquement)
// ✅ Utilise expo-file-system/legacy pour compatibilité

import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
// ✅ Import legacy API
import * as FileSystem from "expo-file-system/legacy";
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

// Encoding robuste (supporte accents, emoji, caractères spéciaux)
function encodeData(obj: any): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decodeData(str: string): any {
  const binary = atob(str.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

// ─── EXPORT ──────────────────────────────────────────────────────────────

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
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, encoded, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/octet-stream",
        dialogTitle: "Sauvegarder mes données All My Costs",
        UTI: "public.data",
      });
    } else {
      Alert.alert("Erreur", "Le partage de fichiers n\'est pas disponible.");
    }

    try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch {}

  } catch (e: any) {
    Alert.alert("Erreur d\'export", e?.message || "Impossible d\'exporter les données.");
    throw e;
  }
}

// ─── IMPORT ──────────────────────────────────────────────────────────────

export async function importBackup(): Promise<BackupData | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const file = result.assets[0];
    const content = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    let backup: BackupData;
    try {
      backup = decodeData(content);
    } catch {
      throw new Error("Ce fichier n\'est pas un fichier de sauvegarde All My Costs valide.");
    }

    if (backup.magic !== BACKUP_MAGIC) {
      throw new Error("Ce fichier n\'est pas un fichier de sauvegarde All My Costs.");
    }

    try { await FileSystem.deleteAsync(file.uri, { idempotent: true }); } catch {}

    return backup;

  } catch (e: any) {
    if (e?.message?.includes("All My Costs")) {
      Alert.alert("Fichier invalide", e.message);
    } else if (!e?.message?.toLowerCase().includes("cancel")) {
      Alert.alert("Erreur d\'import", e?.message || "Impossible de lire le fichier.");
    }
    return null;
  }
}
