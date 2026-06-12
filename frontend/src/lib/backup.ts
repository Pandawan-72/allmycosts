// backup.ts — Export et import des données de l'app (version Pro uniquement)
// Format : fichier JSON chiffré/encodé en base64, extension .amcbackup
// Utilisable uniquement dans All My Costs

import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { Alert, Platform } from "react-native";

const BACKUP_VERSION = 1;
const BACKUP_MAGIC = "AMC_BACKUP"; // Identifiant pour vérifier que c'est bien un fichier de l'app

export type BackupData = {
  magic: string;
  version: number;
  exportedAt: string;
  subscriptions: any[];
  customCategories: any[];
  baseCurrency: string;
  monthlyIncome: number;
};

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

    // Encode en base64 pour rendre le fichier opaque
    const json = JSON.stringify(backup);
    const encoded = btoa(unescape(encodeURIComponent(json)));

    const filename = `allmycosts_backup_${new Date().toISOString().slice(0, 10)}.amcbackup`;
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
      Alert.alert("Erreur", "Le partage de fichiers n'est pas disponible sur cet appareil.");
    }

    // Nettoyer le fichier temporaire
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
    const content = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Décoder le base64
    let json: string;
    try {
      json = decodeURIComponent(escape(atob(content.trim())));
    } catch {
      throw new Error("Ce fichier n'est pas un fichier de sauvegarde All My Costs valide.");
    }

    let backup: BackupData;
    try {
      backup = JSON.parse(json);
    } catch {
      throw new Error("Fichier de sauvegarde corrompu.");
    }

    // Vérifier que c'est bien un fichier de l'app
    if (backup.magic !== BACKUP_MAGIC) {
      throw new Error("Ce fichier n'est pas un fichier de sauvegarde All My Costs.");
    }

    // Nettoyer le fichier temporaire
    try {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
    } catch {}

    return backup;

  } catch (e: any) {
    if (e?.message?.includes("All My Costs")) {
      Alert.alert("Fichier invalide", e.message);
    } else if (!e?.message?.includes("cancelled")) {
      Alert.alert("Erreur d'import", e?.message || "Impossible de lire le fichier.");
    }
    return null;
  }
}
